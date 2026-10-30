import { env } from 'cloudflare:workers';
import { stations } from './atlas-data';
import { climateSnapshot } from '../app/api/feed/route';
import { agreementsSnapshot } from '../app/api/agreements/route';
import { waterSnapshot } from '../app/api/water/route';
import { tradeSnapshot } from '../app/api/trade/route';
import { snapshotStore } from './persistent-data';

// Called by Cron in standalone Workers, or an authenticated Sites cloud task.
export async function runBackgroundUpdates(expectedIntervalMs = 3_600_000) {
  const db = env.DB, store = snapshotStore();
  if (!db || !store) throw new Error('D1 storage is not configured.');
  const now = Date.now(), today = new Date(now).toISOString().slice(0,10);
  if (!await store.claim('__updater', now)) return { running: true };
  const results: { source: string; state: string; error?: string }[] = [];
  const run = async (source: string, job: () => Promise<Response>) => {
    try {
      const response = await job(), data: any = await response.json();
      results.push({source, state: data.refresh?.state || 'unavailable', ...(data.refresh?.error ? {error:data.refresh.error} : {})});
    } catch { results.push({source, state:'unavailable', error:'Update could not complete.'}); }
  };
  try {
    await run('climate', () => climateSnapshot(false));
    for (const station of stations) await run(`water:${station.id}`, () => waterSnapshot(station.id, today, false));
    await run('agreements', () => agreementsSnapshot(false));
    // Only recently used annual queries are watched; no unbounded country-pair crawl.
    const watched = await db.prepare("SELECT key FROM data_snapshots WHERE key LIKE 'trade:%' AND last_requested > ? AND next_attempt <= ? ORDER BY next_attempt LIMIT 3").bind(now - 7 * 86_400_000, now).all<{key:string}>();
    for (const {key} of watched.results) {
      const [,year,reporter,partner,category] = key.split(':');
      await run(key, () => tradeSnapshot(+year, +reporter, +partner, category, false));
    }
    // Keep bounded latest snapshots. Old annual lookups remain available on demand.
    await db.prepare("DELETE FROM data_snapshots WHERE (key LIKE 'water:%' OR key LIKE 'trade:%') AND last_requested < ? AND COALESCE(last_success, 0) < ? AND lease_until <= ?").bind(now - 30 * 86_400_000, now - 30 * 86_400_000, now).run();
    const payload = JSON.stringify({completedAt:new Date().toISOString(), expectedIntervalMs, results});
    await store.success('__updater', payload, Date.now(), 60_000);
    return JSON.parse(payload);
  } catch (error) {
    await store.failure('__updater', 'Background run interrupted.', Date.now(), 60_000);
    throw error;
  }
}
