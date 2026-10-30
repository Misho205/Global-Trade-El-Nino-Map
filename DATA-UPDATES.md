# Background data updates

The implementation is local until deployed. A completed collector run is visible
at `GET /api/data-status`; a storage binding alone does not prove scheduling works.

## What is collected

- NOAA climate discussion and ONI: eligible every 15 minutes.
- NOAA water observations, reference-day observations and next-day astronomical
  tides: eligible every 6 minutes for the eight configured stations on today's UTC date.
- Complete WTO agreement lists: eligible daily. Partial lists are rejected rather
  than replacing the last complete result.
- UN Comtrade annual queries requested in the previous 7 days: eligible daily,
  at most 3 per collector run. Annual figures are not real-time deals. Empty
  published responses are retained as empty results, not invented values.

Eligibility is not a delivery guarantee: actual frequency is bounded by the
scheduler, upstream availability, timeouts and retry backoff. No background job
scrapes every possible country pair. On-demand historical queries remain supported.

The `data_snapshots` table holds the latest valid result per query, not a complete
version history. Old water and trade snapshots are pruned after 30 days without
requests or successful updates. Query values are validated before storage access.
Failures preserve the last valid payload and success timestamp, record the latest
attempt/error, and back off from 1 minute to 1 hour. D1 leases coalesce concurrent work.
Data API responses use `no-store` so the client sees current freshness metadata.

## Sites deployment

1. Preserve the existing Site ID and owner-private audience. Publish with the
   `DB` binding declared in `.openai/hosting.json`; Sites applies the committed
   Drizzle migration before the Worker.
2. For a confirmed owner-private Site only, set runtime
   `UPDATE_AUTH_MODE=sites-owner-private` through Sites, then deploy. This relies
   on Sites' platform access boundary for the update endpoint. Never enable this
   mode on a public Site or a standalone Worker. Before changing the audience,
   remove this mode, deploy, and replace the scheduler's authorization.
3. A future cloud task must obtain the Site's current supported service access
   from `get_site`, not from a saved credential. Send it only to this Site in
   `OAI-Sites-Authorization`. It is consumed by Sites dispatch.
4. Invoke `POST /api/updates` with no body; then read `GET /api/data-status` and
   confirm both persisted results and `background.completedAt` advanced.
5. Re-read linked automations before creating one. Start with an hourly Sites
   schedule in Europe/Kiev; this gives hourly unattended polling, not six-minute
   polling. The open page can refresh water more frequently. Keep the task quiet
   unless a persistent failure or user action is required. Save no credentials
   in task prompts, project files or logs.
6. Only call the schedule operational after a fresh unattended task has obtained
   access, invoked the writer and read back persisted results successfully.

Suggested task instructions (the Site ID is provided by the task runtime):
"Refresh TerraTrade's public climate, water, agreement and recently used trade
data using the published updater. Follow DATA-UPDATES.md from the current Site
source. Obtain current supported Site service access, POST /api/updates, then
read /api/data-status to verify persistence. Do not republish or change access.
Stay quiet unless a persistent failure or user action is required."

## Standalone Cloudflare Workers

Set these build variables (not browser variables):

```
ATLAS_DEPLOY_TARGET=cloudflare
ATLAS_ENABLE_CRON=true
CLOUDFLARE_D1_DATABASE_ID=<actual ID from Cloudflare>
CLOUDFLARE_D1_DATABASE_NAME=terra-trade-data
ATLAS_WORKER_NAME=terra-trade
```

Create the D1 database and copy its actual ID; the standalone build rejects a
missing/invalid ID or the Sites local placeholder. The name must match your
database (and Worker respectively). Apply the committed SQL migration to that
remote database before deploying. Then build again;
the generated Worker configuration then contains `*/6 * * * *` (UTC). Deploy the
generated configuration and verify the Cron Trigger in Cloudflare. The scheduled
handler calls the collector directly and does not need a public write endpoint.

For manual POST access, configure a randomly generated `UPDATE_TOKEN` secret
(at least 32 characters, at most 256 bytes) and use `Authorization: Bearer ...`.
Without the token or explicitly enabled private-Sites mode, POST is denied.
Never expose the token in client code or source control. Do not enable both a
Sites schedule and Cloudflare cron for the same deployment.

## Local validation

```
node --experimental-strip-types --test tests/snapshot-cache.test.mjs
npx tsc --noEmit --incremental false
npm run build
```

Apply `drizzle/0000_mysterious_elektra.sql` once to local D1 using the starter's
documented `wrangler d1 execute DB --local --config dist/server/wrangler.json
--persist-to .wrangler/state --file ...` command. Start `npm run start`.
Read `/api/feed` twice, checking the same saved success timestamp and persisted
flag; restart preview and read again to verify storage survives a restart.
Unauthenticated `POST /api/updates` must return 403. Local migrations never
apply to production automatically outside the Sites deployment workflow.

Local checks performed on 2026-10-20: TypeScript and production build passed;
8 fixture tests passed; the built Worker saved NOAA climate, all 8 water stations,
UN Comtrade and 629 WTO records to local D1. The saved success timestamps survived
a Worker restart. A POST without authorization returned 403, and an authorized
local POST completed the collector and persisted its readback.

The pinned Wrangler 4.92.0/Miniflare static-assets router returned `exception`
when its local scheduled test endpoint targeted the combined assets service.
Testing the same built Worker with assets omitted from a disposable local config
invoked the scheduled handler successfully and persisted a new collector run.
Do not treat that isolated check as verification of a hosted Cron Trigger.
Verify an actual scheduled invocation after standalone deployment, or use the
authenticated Sites writer and verify it through the intended cloud task.

Readiness checks on 2026-10-21 also cover UTC midnight/year rollover, preserving a
historical selection, rejecting placeholder IDs and the actual SQLite atomic
lease query. Claiming a lease is now one SQL statement instead of two. A cold
collector with all 10 core jobs and 3 watched trade queries uses at most 43 D1
statements on its normal success path (rather than 57). The Free D1 per-invocation
limit is 50. This does not establish that the full collector fits the Free CPU
limit: HTML parsing, SSR and redirects require hosted resource measurements.
Workers Paid is the safer initial deployment choice for this workload; no plan
has been purchased or changed. Monitor CPU, subrequests and D1 quotas after deploy.
The health panel uses the collector's expected interval to detect delay: 9 minutes
for the six-minute Cron, 90 minutes for the hourly Sites writer.

The updated local collector was exercised successfully with all 10 core sources;
the status readback matched the stored completion time. Both missing and incorrect
manual-update tokens returned 403. Annual trade readback returned 2 persisted
records. TypeScript, both default and standalone builds, and all 11 tests passed.
The standalone build test used an explicit dummy UUID locally; it did not provision
or connect any hosted database. No Cloudflare deployment or hosted Cron was run.

## Explicit exclusions

AlphaEarth's 36 regional PNGs are static annual previews retrieved on 2026-10-08.
This collector does not regenerate them. Map imagery/terrain are supplied by Esri,
not a live satellite acquisition feed. Routes, country borders and alliance
membership context are curated source assets, not automatically updated feeds.
Global ENSO-driven flood/sea-height forecasts and individual company contracts
are not connected. These require separate data pipelines and coverage validation.
