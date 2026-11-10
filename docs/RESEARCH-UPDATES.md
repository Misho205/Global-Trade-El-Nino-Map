# Research data updates

Local implementation; no hosted deployment or schedule was activated.

Open-page: /research checks four public NOAA/USGS sources every five minutes. Compact atlas controls fetch only enabled point layers. Live earthquake/buoy cache TTL is five minutes; monthly indices and past-day earthquake queries use one day. Publisher cadence can be slower: inspect observation dates and the latest nonmissing monthly value, not just retrieval time.

Persistence reuses data_snapshots, atomic leases, last-good fallback and backoff. No new migration is needed for research. Unknown sources, invalid/future dates, non-earthquake date parameters and unknown parameters return 400. Provider/schema failures preserve prior good data as stale; without prior data the response is unavailable. Missing D1 is explicitly unpersisted. Valid empty earthquake results remain empty. Upstream URLs are fixed, redirects refused, responses bounded at 3 MB, requests timed out after 15 seconds. The four new public sources require no API key.

For unattended standalone updates, build with real Worker/D1 settings and:

ATLAS_DEPLOY_TARGET=cloudflare
ATLAS_ENABLE_CRON=true
ATLAS_RESEARCH_UPDATES=true

Generated config then contains the original six-minute collector and a separate five-minute research Cron. The handler branches by Cron expression, keeping the four research source refreshes out of the original collector/billing D1 invocation budget. Monthly sources reuse their daily cache. The research branch reports stale/unavailable outcomes as failures and prunes unrequested historical earthquake cache entries after 30 days. This is latest-valid caching, not a permanent version archive.

Inspect dist/server/wrangler.json before any approved staging deployment. Verify actual scheduled invocations and advancing successful retrievals in Workers Logs. A build flag does not prove hosted Cron is operational. Existing production approval requirements remain in force.

/research clearly labels satellite sea-height grids, GRACE water mass/uncertainty, precipitation/GNSS stress models, ocean-current/wave forecasts and official global warnings as unconnected reference capabilities. Large gridded/NetCDF products need separate validated preprocessing and publishing, not an unbounded Worker request. See VIDEO-RESEARCH-ANALYSIS.md for evidence and limits.
## Local verification � 10 November 2026

- Final type checking, all 47 tests, and the production build passed after the historical-query correction. Logs are retained in the D: verification copy.
- Production build and local Cloudflare Workers preview succeeded.
- All four public live sources returned HTTP 200 and persisted last-valid snapshots in an isolated local D1 database. Counts vary as upstream feeds update.
- Browser checks verified earthquake/buoy globe layers, Atlantic corridor selection, responsive layout, and JSON download. The downloaded file parses and includes format, exportedAt, selectedDate, data, errors, and limitations.
- Invalid source and impossible calendar date requests returned HTTP 400.
- Historical testing exposed unsupported USGS nodata=200. This was removed; an empty HTTP 204 catalog is normalized to an empty FeatureCollection. The corrected official query for 1997-12-01 returned HTTP 200 with 35 events. The post-fix built historical endpoint was not browser-retested.
- C: storage exhaustion required building a disposable source copy on D: with existing dependencies. Source edits remain in the original checkout. No production migration, deployment, scheduled trigger activation, Git commit, or push was performed.

These checks validate the implementation paths described above; they do not certify scientific models, global data coverage, ship safety, or operational rerouting.
