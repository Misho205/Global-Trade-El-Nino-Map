# Architecture

## Request and update paths

```text
Browser --> React/Vinext pages --> /api/* --> validated public sources
     |                              |
     +--> globe iframe/Cesium       +--> D1 last-valid snapshots
             |                              ^
             +--> local assets              |
             +--> Esri services        background collector
                                            ^
                               Cloudflare Cron OR protected POST
```

`build/sites-worker.ts` wraps the Vinext fetch handler and exports `scheduled()`.
`vite.config.ts` generates Worker config at `dist/server/wrangler.json`; it reads
`.openai/hosting.json` for logical bindings. Standalone build settings supply a
real D1 ID and optional Cron; Sites uses its own provisioning flow.

## API surfaces

| Route | Purpose |
| --- | --- |
| `GET /api/feed` | NOAA discussion and historical ONI |
| `GET /api/water` | Validated station/date observations, reference day and tides |
| `GET /api/trade` | Validated annual country/commodity query |
| `GET /api/agreements` | Complete active/inactive WTO lists |
| `GET /api/data-status` | Storage and latest collector status, without payloads |
| `POST /api/updates` | Authorized bounded collector invocation |

The globe exchanges messages only with the expected same-origin frame/source.
Country names can use browser locale; the Translate widget is a separate service.

## Persistence and failures

`lib/snapshot-cache.ts` orchestrates validation and freshness through a storage
interface. `lib/persistent-data.ts` implements it in D1. `data_snapshots` stores a
key, serialized latest-valid payload, success/attempt/retry timestamps, lease,
failure count, error and last-request timestamp.

Atomic leases avoid duplicate concurrent refreshes. Invalid/incomplete responses
cannot replace a prior valid payload. Failed refreshes retain original success
time and back off from one minute up to one hour. Without a valid prior result,
the data response is unavailable rather than a fabricated successful reading.

This table is not a versioned historical archive. The collector prunes inactive
water/trade cache entries after the documented retention period. It watches at
most three due annual queries per run, limited to queries used in the last week.

## Trust and operational boundaries

External data and query inputs are untrusted. Bind parameters in SQL; keep fixed
upstream origins and retain request timeouts. Browser-visible files must contain
no secrets. The manual update endpoint is closed by default; platform-private
Sites mode is not standalone Worker authorization.

Migration schema is managed outside request handling. Worker code rollback does
not roll back D1 schema/data. Cron eligibility is not a guarantee of source freshness.
See [SECURITY.md](../SECURITY.md) and [DATA-UPDATES.md](../DATA-UPDATES.md).
