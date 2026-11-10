# Operational rerouting preparation

The new `/operations` page prepares an offline operator-review packet; it is linked from `/research`. It does not dispatch a voyage, optimize a navigable route or replace the authenticated saved professional-scenario API.

## Implemented behavior

- Vessel and cargo profile, UTC departure, still-water speed, baseline daily fuel and fuel price. Draft and under-keel margin are recorded but not evaluated against depth/tide.
- One to four candidate routes with common endpoints (within 1 km), at most 100 waypoints per route. Great-circle distance handles antimeridian crossings. Paths may cross land or restricted waters: no navigability validation is supplied.
- Baseline segment times, arrival, fuel and fuel cost. Currents, weather resistance, maneuvering and port delays do not adjust these estimates.
- Optional unverified segment forecast input checks missing samples, stale/future issue times, valid-time horizon, wind/wave limits and nonpositive theoretical ground speed. The 12-hour age and 5-minute future-tolerance policies require provider/operator validation.
- Every assessment remains NOT_CLEARED_FOR_NAVIGATION; recommendedRouteId stays null, including when submitted samples have no screening findings. Missing coverage never becomes calm conditions.
- Input changes invalidate the displayed assessment. A JSON export preserves complete input, results, time, assumptions and blockers. payloadSha256 hashes UTF-8 JSON.stringify(payload); it is an integrity checksum, not a signature or proof of source authenticity.
- Assessment runs in the browser and is not automatically refreshed or persisted. The separate research workspace retains its observation refresh behavior. Credentials must never be pasted into planning inputs.

## Forecast adapter contract

The optional forecasts object is keyed by candidate ID. Each array entry contains zero-based segment, issuedAt, validFrom, validTo (UTC timestamps ending Z), sourceUrl (public HTTPS, no credentials/query/fragment), windMs, waveM and alongTrackCurrentKn (signed in the direction of travel). Duplicate or invalid segment values are rejected. Current is recorded/screened and does not change baseline ETA/fuel.

No forecast provider is connected by this change. A single supplied sample does not prove spatial or temporal coverage. A production adapter must retain provider/product/run IDs, units, grid and ensemble resolution, original source artifacts and licensing/retention terms. Sample across each route segment and arrival time, preserve masks/missing values, uncertainty and horizon, and resample after geometry/speed/departure changes. API secrets belong server-side in Cloudflare bindings.

## Required operational phases

1. Acquire permitted navigable routing geometry, ENC/chart/bathymetry data and notices. Validate coast/land masks, prohibited areas, traffic separation, ports, canals and berth-to-berth legs. Satellite imagery and AlphaEarth are not navigational charts.
2. Connect licensed wind/wave/current forecasts and authoritative navigation/cyclone/ice/tsunami warnings. Define freshness, coverage, provenance and outage policies. ENSO indicators and buoy points cannot substitute for route forecasts.
3. Validate ship-specific performance, seakeeping and cargo constraints with operators. Add datum-consistent depth/tide, squat and dynamic under-keel clearance. Draft alone is insufficient.
4. Add time-dependent optimization only over validated navigable edges. Backtest against independent datasets, quantify uncertainty, document failure cases and unsupported areas, and run shadow-mode trials with qualified navigators.
5. Add organization-scoped server persistence, idempotent revisions, immutable evidence, role-based master/company approval and revocation. Browser input and checksums are not approved operational evidence.
6. Add continuous voyage monitoring, reassessment on source/route changes, outages and deviation alerts. Keep dispatch disabled until a shipping partner accepts the validation, approval process and operational responsibilities.

IMO A.893(21) covers appraisal, planning, execution and monitoring, with master approval. This tool prepares part of appraisal and comparison; it does not claim certification or compliance.

Primary reference: https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.893%2821%29.pdf

## Verification and environment

All 52 tests and production build passed. Browser checks verified the form, candidate globe, missing-forecast findings and operator-packet download; the downloaded SHA-256 checksum was independently verified. TypeScript passed during implementation and was rerun at completion. No production migration, Git commit/push, deployment, hosted scheduler activation or paid provider subscription was performed.

Because C: was full, testing/build used D:\AtlasBuildChecks\research-1ca0f8ba3ba040fbb315122098aab865. Source changes were copied back with hash checks. Only generated .next cache was removed; Worker response-cache files were backed up to D:; D1 was preserved. The ignored local .auth0-toolchain was moved to D:\AtlasBuildChecks\atlas-auth0-toolchain with its original path retained as a junction. Keep that D: directory for this checkout; clean installations use package.json/package-lock.json and do not depend on these ignored local paths.
