# Repository audit

Date: 2026-11-10. Reviewed baseline: aaedcc8072bb1b90ae7dc22898254b137ba0fedd; clean at inspection start.
Scope: Phase 1 source inventory and architectural risk assessment for the proposed SaaS expansion. This is not a completed penetration test, dependency advisory scan, provider configuration audit, or production-readiness certification. No target-controlled code was executed during this review. No credentials, production resources, or remote database state were inspected.

## Existing implementation and reuse decisions

| Area | Evidence | Assessment / decision |
| --- | --- | --- |
| Languages | app/, lib/, build/, scripts/, drizzle/ | TypeScript/TSX, JavaScript MJS, CSS, SQL, JSON; keep existing stack. |
| Frontend | app/page.tsx, app/pricing/page.tsx, app/account/page.tsx, public/ | React 19.2.6; globe and public climate/trade atlas, pricing and individual workspace. Preserve these. |
| Runtime | package.json, vite.config.ts, build/sites-worker.ts | Vinext 1.0.0-beta.5, Vite 8.0.13, Cloudflare Vite plugin 1.37.1, Wrangler 4.92.0; Next 16.3.4 is also installed. Deployment uses Vinext's Worker fetch handler, not a persistent Next/Node server. Beta framework compatibility remains a release gate. |
| Public backend | app/api/{feed,water,trade,agreements,data-status,updates}/route.ts | Fixed-source feeds, cached last-good results, protected manual refresh. Preserve source validation, bounded polling and stale indicators. |
| Persistence | db/schema.ts, drizzle/0000*, 0001*, 0002* | Drizzle 0.45.2 / SQLite D1. Five tables: data_snapshots, billing_accounts, billing_subscriptions, billing_events, professional_scenarios. Existing schema is individual-account scoped; no organizations, roles or foreign-key relations. |
| Identity | lib/access-identity.ts | Verifies Access RS256 signature, issuer, audience and expiry; stable account identity derived from issuer/subject. Reuse as an adapter during transition. Access is not the requested complete consumer registration/password/profile/session lifecycle. Actual Access policies are unverified. |
| Billing | lib/billing-server.ts, app/api/billing/*, lib/stripe-signature.ts | Server-side Stripe REST, signed raw-body events, canonical subscription reads, receipt deduplication, same-origin writes, hosted checkout/portal. Keep these controls and off-by-default activation gates. No annual or seat billing. |
| Entitlements | lib/billing-policy.ts, app/api/pro/scenarios/route.ts | Active, unexpired paid subscription required; account-scoped SQL; atomic monthly insert quota. Reuse invariants; generalize to tenants and configurable plan versions. |
| Background work | lib/background-updates.ts, lib/snapshot-cache.ts, build/sites-worker.ts | Scheduled collector, D1 leases/backoff and preserved successful payloads. Keep. No queue consumer, dead-letter queue or billing reconciliation schedule. |
| Deployment | vite.config.ts, build/cloudflare-target.ts, .openai/hosting.json | Generated dist/server/wrangler.json. Logical DB binding; R2 null. Standalone real-D1 guard and optional six-minute Cron. No explicit staging/production isolation or managed resources manifest. |
| Tests | tests/snapshot-cache.test.mjs, cloudflare-readiness.test.mjs, monetization.test.mjs | Existing source contains cache, config, identity/signature, entitlement and SQLite quota/order tests. Previous delivery reported 18 passing tests; not rerun or independently reproduced in this review. |
| CI/CD | .github/ | Issue/PR templates only; no Actions workflows. package scripts expose lint/build but no unified test/check task. |
| Validation | lib/input-validation.ts, lib/billing-policy.ts, package.json | Manual guards; Zod 3.25.76 already installed but not the common API contract. Centralize schemas without discarding existing bounds. |
| Documents | docs/ARCHITECTURE.md, DEPLOYMENT.md, MONETIZATION.md, PRIVACY.md, SECURITY.md | Reuse existing atlas documentation; root ARCHITECTURE.md describes proposed SaaS additions rather than overwriting it. |

## Gaps and source-grounded risks

These are architectural gaps and validation requirements, not confirmed exploitable vulnerabilities with severity ratings.

1. **Identity lifecycle:** no application-managed registration, recovery, session revocation, verified email change, deletion or MFA settings. Select a managed customer identity provider before implementing these screens; do not add homegrown password cryptography.
2. **Tenant isolation:** current private data belongs to individual account IDs. Organizations, memberships, invitation lifecycle, ownership transfer and seat reservations do not exist. Do not market Fleet as multi-user Business until isolation tests pass.
3. **Billing durability:** webhook processing currently calls Stripe synchronously before recording processed events. Unsupported/unmapped events return success without an inbox record. A durable inbox/outbox and replayable async consumer are needed for the expanded contract; current implementation should not be described as an asynchronous durable-acceptance pipeline.
4. **Subscription reconciliation:** canonical reads reduce delivery-order risk but there is no recurring provider reconciliation or refund/invoice ledger. Trialing and past_due currently deny paid access immediately; this must remain explicit until approved policy changes.
5. **Pricing:** current EUR 49/199 monthly values are source constants checked against Stripe price amounts. Proposed annual pricing and seat changes need versioned server-side plan prices and migration rules for existing subscribers.
6. **Database:** current tables lack foreign keys and tenant membership structures. Additive migrations and verified backfill are necessary; never rename/drop existing account data as an implicit conversion.
7. **Operational controls:** WAF/Access configuration, CSP/header behavior, rate-limit policies, secrets, actual Cron runs, alerts and backups cannot be established from this source tree. No complete response-header/rate-limit policy was found in inspected app/lib/build files. Validate deployment controls instead of assuming they exist or are absent.
8. **Privacy:** scenario retention, self-service deletion/export, consent where relevant and legal merchant policies need implementation and operator review. Existing JSON export is not a full personal-data export.
9. **Supply chain/runtime:** pinned and ranged dependencies require advisory and lockfile review in CI. Browser/Worker boundary, node:crypto and AsyncLocalStorage behavior need actual workerd tests. node:sqlite belongs only to tests. No dependencies were installed or executed in this review.
10. **Delivery:** no CI checks or staging environment are defined; previous build success is not evidence of hosted deployment or tested Stripe renewal/cancellation flows.
11. **Product accuracy:** transport comparisons use manual assumptions, not live navigational clearance. D1 stores latest-valid snapshots, not a 50-year version archive. Preserve these disclosures.

## Phase 1 validation and limits

Read-only checks: baseline Git revision/status; package manifest; Worker/Vite configuration; schema/migration inventory; API route inventory; billing/identity/quota implementations; test and workflow inventory; existing architecture and privacy documentation. No live API probes, builds, tests, remote migrations, payment calls, deployments or full secret-history scans were performed.

The security-audit skill requires network-isolated, allowlisted-environment, read-only-target/toolchain execution with scratch-only writes and explicit resource limits for target code. This session has not established all those controls; dynamic security validation remains pending. A separate complete security audit must produce its own coverage ledger and independently verified findings; this architectural review does not substitute for it.

## Deliverables

- ARCHITECTURE.md: proposed domains, trust boundaries, data model and infrastructure choices.
- IMPLEMENTATION_PLAN.md: staged changes, acceptance criteria and approval gates.
- SECURITY_BASELINE.md: threat model, enforceable controls and release evidence.
