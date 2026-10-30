export type Snapshot = {
  key: string; payload: string | null; last_success: number | null;
  last_attempt: number | null; next_attempt: number; lease_until: number;
  failures: number; error: string | null; last_requested: number;
};
export type SnapshotStore = {
  read(key: string): Promise<Snapshot | null>;
  touch(key: string, now: number): Promise<void>;
  claim(key: string, now: number): Promise<boolean>;
  success(key: string, payload: string, now: number, ttl: number): Promise<void>;
  failure(key: string, error: string, now: number, retry: number): Promise<void>;
};
export type RefreshInfo = {
  state: 'fresh' | 'stale' | 'unavailable'; persisted: boolean;
  lastSuccessAt: string | null; lastAttemptAt: string | null;
  nextAttemptAt: string | null; error: string | null;
};
const iso = (n: number | null | undefined) => n ? new Date(n).toISOString() : null;

// Pure orchestration: the worker supplies storage; tests supply a dummy store.
export async function cachedSnapshot(
  store: SnapshotStore | null, key: string, ttl: number,
  load: () => Promise<Response>, valid: (data: any) => boolean,
  { now = () => Date.now(), requested = true } = {},
): Promise<Response> {
  let row: Snapshot | null = null;
  let storageError: string | null = null;
  try {
    row = await store?.read(key) ?? null;
    if (store && requested) await store.touch(key, now());
  } catch { store = null; storageError = 'Persistent storage unavailable; background updates are not active.'; }
  const answer = (data: any, current: Snapshot | null, persisted: boolean, error: string | null) => {
    const success = current?.last_success ?? null;
    const refresh: RefreshInfo = {
      state: success && now() - success < ttl && !error ? 'fresh' : success ? 'stale' : 'unavailable',
      persisted, lastSuccessAt: iso(success), lastAttemptAt: iso(current?.last_attempt),
      nextAttemptAt: iso(current?.next_attempt), error,
    };
    return Response.json({ ...data, refresh }, { status: success ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  };
  if (row?.payload && now() < row.next_attempt) {
    return answer(JSON.parse(row.payload), row, true, row.error);
  }
  if (store) {
    try {
      if (!(await store.claim(key, now()))) return answer(row?.payload ? JSON.parse(row.payload) : { errors: ['Source refresh already running.'] }, row, true, row?.error ?? 'Refresh in progress.');
    } catch { store = null; storageError = 'Persistent storage unavailable; background updates are not active.'; }
  }
  try {
    const response = await load();
    const data: any = await response.json();
    if (!response.ok || !valid(data)) {
      throw new Error(data.error || data.errors?.join(' · ') || 'Source returned incomplete or invalid data.');
    }
    const timestamp = now();
    const saved: Snapshot = { key, payload: JSON.stringify(data), last_success: timestamp,
      last_attempt: timestamp, next_attempt: timestamp + ttl, lease_until: 0,
      failures: 0, error: null, last_requested: row?.last_requested ?? timestamp };
    if (store) {
      try { await store.success(key, saved.payload!, timestamp, ttl); }
      catch { store = null; storageError = 'Latest data could not be saved; background persistence unavailable.'; }
    }
    return answer(data, saved, !!store, storageError ?? (!store ? 'Persistent storage is not configured.' : null));
  } catch (failure) {
    const error = failure instanceof Error ? failure.message : 'Source refresh failed.';
    const timestamp = now();
    const retry = Math.min(3_600_000, 60_000 * 2 ** Math.min(row?.failures ?? 0, 6));
    if (store) {
      try { await store.failure(key, error.slice(0, 500), timestamp, retry); }
      catch { store = null; }
    }
    const failed = row ? { ...row, last_attempt: timestamp, next_attempt: timestamp + retry, error } : null;
    return answer(row?.payload ? JSON.parse(row.payload) : { errors: [error], error }, failed, !!store, error);
  }
}
