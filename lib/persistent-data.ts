import { env } from 'cloudflare:workers';
import { cachedSnapshot, type Snapshot, type SnapshotStore } from './snapshot-cache';

export function snapshotStore(): SnapshotStore | null {
  const db = env.DB;
  if (!db) return null;
  return {
    read: key => db.prepare('SELECT * FROM data_snapshots WHERE key = ?').bind(key).first<Snapshot>(),
    async touch(key, now) {
      await db.prepare('INSERT INTO data_snapshots (key, last_requested) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET last_requested = excluded.last_requested').bind(key, now).run();
    },
    async claim(key, now) {
      const lease = key === '__updater' ? 900_000 : 300_000;
      // One atomic query, including creation: keep a full cold collector below
      // the Free plan's 50-query D1 invocation limit.
      const result = await db.prepare('INSERT INTO data_snapshots (key, lease_until, last_attempt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET lease_until = excluded.lease_until, last_attempt = excluded.last_attempt WHERE data_snapshots.lease_until <= ? AND data_snapshots.next_attempt <= ? RETURNING key').bind(key, now + lease, now, now, now).first<{key:string}>();
      return !!result;
    },
    async success(key, payload, now, ttl) {
      await db.prepare('UPDATE data_snapshots SET payload = ?, last_success = ?, last_attempt = ?, next_attempt = ?, lease_until = 0, failures = 0, error = NULL WHERE key = ?').bind(payload, now, now, now + ttl, key).run();
    },
    async failure(key, error, now, retry) {
      await db.prepare('UPDATE data_snapshots SET last_attempt = ?, next_attempt = ?, lease_until = 0, failures = failures + 1, error = ? WHERE key = ?').bind(now, now + retry, error, key).run();
    },
  };
}

export function persistentData(key: string, ttl: number, load: () => Promise<Response>, valid: (data: any) => boolean, requested = true) {
  return cachedSnapshot(snapshotStore(), key, ttl, load, valid, { requested });
}
