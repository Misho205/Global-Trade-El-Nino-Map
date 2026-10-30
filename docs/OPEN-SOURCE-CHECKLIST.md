# Open-source and GitHub checklist

## Files to commit

- [ ] Root README.md, README.bg.md, LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md,
  SECURITY.md, CHANGELOG.md, ROADMAP.md, THIRD_PARTY_NOTICES.md and DATA-UPDATES.md.
- [ ] All authored documents in `docs/` and templates in `.github/`.
- [ ] Source directories `app/`, `components/`, `lib/`, `build/`, `db/`, `hooks/`,
  `scripts/`, `tests/`, `vendor/`, and public assets in `public/`.
- [ ] `drizzle/`, including SQL, snapshots and `_journal.json` together.
- [ ] `package.json`, `package-lock.json`, Vite/Next/TypeScript/Drizzle/PostCSS/ESLint
  config, `cloudflare-env.d.ts`, `components.json`, `.gitignore`, `.npmrc` and
  `.openai/hosting.json` (required by the current build).

## Keep out of Git

- [ ] `.env*`, `.dev.vars*`, credentials, tokens and private keys.
- [ ] `node_modules/`, `dist/`, `.next/`, `.vinext/`, `.wrangler/`, `.sites-runtime/`,
  `.npm-cache/`, `outputs/`, `work/`, coverage and generated build state.
- [ ] Private security reports or raw logs with sensitive details.
- [ ] Review existing Git history as well as new changes: ignore rules do not
  remove previously tracked secrets. Browser uploads do not honor `.gitignore`.

## Before making the repository public

- [ ] Confirm you have rights to release original contributions under MIT.
- [ ] Finish exact-version third-party license/attribution review; root MIT does
  not relicense data, Cesium components or provider imagery.
- [ ] Enable private vulnerability reporting and a verified contact channel.
- [ ] Review the incomplete audit and document unresolved risk accurately.
- [ ] Check that public docs expose no credentials or sensitive audit evidence.
- [ ] Decide whether to finish the remaining TerraTrade branding separately.

## Add these documents without PowerShell

They are already saved in your local project directory. In GitHub Desktop:

1. Open the existing local project repository (File > Add local repository if needed).
2. Review Changes; include the authored documents and `.github/` templates.
3. Confirm the remote is the intended GitHub repository, not another hosting source.
4. Commit with a description such as `Add open-source project documentation`.
5. Push to the intended branch, or open a pull request for review.
6. Check GitHub renders README and displays the license/templates correctly.

For manual browser upload, put root files in the repository root, preserve `docs/`
and `.github/` paths, and include hidden authored files explicitly. Do not upload
the entire unfiltered local folder. ZIP archives are not a substitute for extracted
repository source files. Creating files does not upload or publish them.

## Release and deployment

- [ ] Run appropriate checks; do not infer a full audit from passing tests.
- [ ] Validate a real D1 migration, Access policy, hosted Cron and persisted readback.
- [ ] Monitor CPU/quotas and verify provider availability.
- [ ] Complete the changelog and tag a release only when ready.

The provided issue/PR templates do not enable Actions, branch protection, private
reporting, hosting, alerts or scheduling; configure those separately.
