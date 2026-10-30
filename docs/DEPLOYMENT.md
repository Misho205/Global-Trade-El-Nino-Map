# Cloudflare Workers deployment

Deploy the complete repository as one Worker using Workers Builds. No manual split
between frontend/backend and no Pages project is required. `build/` is source;
`dist/` is generated output. Preserve `.openai/hosting.json` because Vite imports it.

## 1. Review and upload source

Read [SECURITY.md](../SECURITY.md). Review the exact commit, credentials and data
licenses. Prefer a private test deployment while the full audit remains incomplete.
Upload source and migration metadata, not `node_modules/`, `.wrangler/`, `dist/`,
`.env*` or `.dev.vars*`. See [the release checklist](OPEN-SOURCE-CHECKLIST.md).

## 2. Create and initialize D1

Create a database, for example `terra-trade-data`, in your own Cloudflare account.
Record its actual ID/name. Apply `drizzle/0000_mysterious_elektra.sql` once to the
new empty remote database. You can use its D1 SQL console or the Wrangler command
below after generating config with the real build settings and authenticating:

```sh
npx wrangler login
npx wrangler d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/0000_mysterious_elektra.sql
```

Confirm the account/database before executing. `--remote` changes production data;
never use it for a local test. Future migrations must be reviewed and applied in
order. Do not put this initial CREATE TABLE command into every deployment.

## 3. Set build variables

| Variable | Value |
| --- | --- |
| `ATLAS_DEPLOY_TARGET` | `cloudflare` |
| `ATLAS_ENABLE_CRON` | `true` |
| `CLOUDFLARE_D1_DATABASE_ID` | Actual database UUID, not the local placeholder |
| `CLOUDFLARE_D1_DATABASE_NAME` | Actual name, e.g. `terra-trade-data` |
| `ATLAS_WORKER_NAME` | Worker name, e.g. `terra-trade` |

These values are read at build time. Choose a compatible Node >=22.13.0 version
using Cloudflare's supported Node version setting. The standalone build rejects a
missing/invalid database ID; a syntactically valid ID is not proof of account access.

## 4. Connect GitHub to Workers Builds

Give the Cloudflare GitHub app access only to the intended repository. Create/select
a Worker with the configured name. Set:

| Setting | Value |
| --- | --- |
| Production branch | `main` or your actual release branch |
| Root directory | Directory containing `package.json` |
| Build command | `npx tsc --noEmit --incremental false && npm run build` |
| Deploy command | `npx wrangler deploy --config dist/server/wrangler.json` |

Cloudflare installs dependencies and executes build/deploy. Add your desired CI
checks and branch protection separately; repository templates do not create CI.
See [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## 5. Access and updater authorization

Protect the first Worker with Cloudflare Access before uploading application code.
Private GitHub visibility does not protect a deployed URL. Verify the desired
policy across workers.dev, custom domains and previews.

Cron calls `scheduled()` internally and needs no HTTP updater token. For manual
POST access, store `UPDATE_TOKEN` as a runtime secret (32+ characters, at most 256
bytes) and send it as an Authorization bearer token. Do not publish the secret.
Never set `UPDATE_AUTH_MODE=sites-owner-private` on standalone Workers.

## 6. Verify the deployed system

- Confirm binding `DB` points to the intended database and migrations are applied.
- Check the generated Cron `*/6 * * * *` and a real successful scheduled invocation.
- Read `/api/data-status`: storage should be available and collector time advance.
- Read individual data responses: verify `refresh.persisted`, success time and errors.
- Confirm token-less/incorrect-token POST `/api/updates` is rejected.
- Exercise globe, filters, historical dates, comparison, translation and mobile UI.
- Monitor CPU, D1 queries/storage and external request limits; do not assume Free fits.

The local scheduled-test limitation is recorded in [DATA-UPDATES.md](../DATA-UPDATES.md).
A local success does not certify hosted routing, access, quota or Cron behavior.

## 7. Updates and rollback

Review/test a branch, merge to the production branch and let Workers Builds publish.
Verify the new deployment. Worker rollback restores code, not D1 schema or records;
plan migrations and backups accordingly. Never edit generated `dist/` as your source.

Sites hosting is a separate supported path with its own resource provisioning and
linked cloud task; see DATA-UPDATES.md. Do not enable two schedulers for one instance.
