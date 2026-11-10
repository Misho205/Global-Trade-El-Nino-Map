# Environment setup and verification

Implemented locally: explicit environment validation, D1 migrations_dir, Worker observability for explicit environments, versioned health endpoints, test/typecheck scripts and a non-deploying GitHub checks workflow. No cloud resources were created. Workflow execution and remote health are not yet verified.

## Local

Existing `npm run dev` and local Wrangler start remain supported; omit ATLAS_ENVIRONMENT to preserve current behavior. For explicit local mode set ATLAS_ENVIRONMENT=local and choose local Worker/D1 names. Do not enable standalone target or Cron without the existing required real D1 configuration. Tool commands in Windows PowerShell can use npm.cmd/npx.cmd when script execution policy blocks npm.ps1; no execution-policy change is needed.

## Staging and production

Use config/cloudflare.env.example as a safe reference, not a committed secret store. Set build values explicitly in CI or the hosting build settings; the example is not automatically loaded. Production names must end in -production; staging names in -staging. Resource suffixes help avoid mistakes but cannot prove that two supplied IDs point to different databases: verify actual resource ownership and IDs before deployment.

Create resources deliberately (commands below are instructions, not executed actions):

```text
npx wrangler d1 create global-trade-data-staging
npx wrangler d1 create global-trade-data-production
```

Copy each returned ID only into the corresponding environment. Build using npm run build after setting all required build variables. Configuration is generated at dist/server/wrangler.json; do not add a conflicting hand-maintained root config. Confirm names, D1 ID, migrations_dir, Cron and asset routing in the generated artifact before any remote command.

For a NEW staging database, inspect and apply migrations through the generated config:

```text
npx wrangler d1 migrations list DB --remote --config dist/server/wrangler.json
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
```

Existing databases may have SQL applied manually without Wrangler migration records. Never run migrations apply against those until reconciling migration history and taking a backup; otherwise it can try to recreate existing tables. Production migrations need explicit approval. Existing migrations remain unchanged.

Runtime secrets are separate from build values. Set the approved secrets with `wrangler secret put NAME --config dist/server/wrangler.json` only after confirming which Worker the config targets. Never copy production Stripe keys into staging. Keep BILLING_ENABLED and PRO_FEATURES_VALIDATED unset/false until provider tests and release approval. ATLAS_ENVIRONMENT is a non-secret generated runtime variable.

## Health contract

- GET /api/v1/health/live: 200 {status:ok}; process liveness only.
- GET /api/v1/health/ready: 200 {status:ready}, or 503 {status:not_ready}; verifies queries against tables/columns used by the current atlas and account code. No provider calls or database writes. Does not assert feed freshness, valid Stripe configuration, index presence, Cron health or identity-provider availability.

Both responses disable caching and omit internal error details. Use a modest readiness polling interval; each readiness request performs five bounded SQL queries. WAF/rate limits should protect public endpoint abuse. Monitor feed freshness separately through the existing data-status route.

## CI and release boundaries

.github/workflows/checks.yml installs the lockfile, checks types, runs tests, builds and requests a high-severity dependency advisory scan. It does not deploy or use cloud/payment secrets. CI results and advisories have not been observed here. Lint is not yet a mandatory gate: first establish and resolve its existing baseline. Complete secret scanning, action SHA pinning review, workerd integration tests and staging E2E before claiming production readiness.

Deployment workflows are deliberately deferred until the release mechanism is selected and GitHub environment reviewers/secrets are configured. Inspect Workers Builds auto-deploy rules first; no push to main was performed in this implementation stage. Production requires protected approval. R2, Queues and new customer identity infrastructure will be bound when the corresponding domain is implemented, rather than creating unused resources now.

## Local verification — 2026-11-10

23 Node tests passed (including the Auth0 policy suite); TypeScript passed; application build passed after the final migration-path correction. No hosted runtime, GitHub Actions or provider E2E result is asserted. The generated migration directory resolves to the source checkout: rebuild on the deployment machine rather than relocating only dist/.

## Additional enabled-feature readiness

Auth0 now requires migration 0004 and validates its staging configuration. Async billing requires migration 0005, a staging queue binding and the explicit async flag. Readiness checks these locally configured capabilities without contacting providers; it does not prove hosted delivery or identity-provider availability. See SESSIONS.md and BILLING-JOBS.md.
