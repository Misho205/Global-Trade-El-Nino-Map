# Security baseline and threat model

Status: proposed baseline, not a compliance certificate or a completed security audit. See REPOSITORY_AUDIT.md for inspected source and execution limits.

## Trust boundaries and required tests

| Boundary / threat | Required control | Release evidence |
| --- | --- | --- |
| Anonymous browser -> identity | Maintained managed identity; verified issuer/audience/signature; secure session lifecycle; throttling and enumeration resistance | Forged/expired tokens, reset/verification replay, fixation and revocation tests. |
| User -> selected tenant / IDOR | Active membership and central role policy on every operation; tenant-scoped SQL | Two synthetic tenants test every read/write/export/file route with swapped IDs. |
| Org admin -> platform admin | Separate operator grants, reauthentication and auditable actions | Role escalation and forged role/input tests; no tenant API can write platform roles. |
| Browser -> writes / CSRF | Exact trusted origin plus CSRF token where cookies require it; restrictive CORS; no wildcard credential origins | Missing/foreign origin and forged token rejected. |
| Provider -> billing | Original raw-body signature/timestamp check before parsing; bounded bodies; unique event IDs; durable inbox | Invalid signature, stale timestamp, duplicate/out-of-order/retry fixtures. |
| Queue -> state / duplicate effects | Canonical provider reads, idempotent transaction/batch, bounded retry/DLQ and outbox | Crash-point tests, replay and concurrent duplicate delivery. |
| Member -> seat/quota | Atomic conditional statements and uniqueness, not read-then-write checks | Parallel invitations, usage and downgrade tests cannot exceed capacity. |
| Upload -> private storage | Tenant authorization, random object keys, size/type/content checks, attachment downloads and expiry | Swapped owner, oversized/disguised file and expired-download tests. |
| External feed -> public content | Fixed permitted origins, bounds/timeouts, response validation and output escaping | Malicious feed fixtures; valid cache survives provider errors. |
| PR/build -> credentials | Least-privilege CI, no secrets in untrusted forks, lockfile install and reviewed actions | Workflow review and secret/advisory scan artifacts. |
| Logging -> personal/secret data | Structured request IDs and allowlisted fields; no tokens/cookies/raw payment data | Redaction tests and representative safe logs. |

## Baseline invariants

- Default deny. Authenticate identity, resolve tenant membership, authorize action, then access the record. Client-provided tenant IDs are selectors, never proof of authority.
- Parameterized SQL, bounded Zod schemas, page-size caps, finite arithmetic and idempotency keys tied to actor/operation. Reject key reuse with a different payload in new write APIs.
- Authoritative money uses integer minor units. Do not reuse floating-point transport estimates for invoices or subscription pricing.
- Stripe-hosted card collection; no card data storage. Redirects are not payment authority. Only verified canonical state changes entitlements.
- API keys, if introduced, use secure randomness, one-time reveal, protected stored representations, explicit scopes/expiry and immediate revocation. Do not log or email full keys.
- Strong platform-admin authentication/MFA, recent reauthentication for ownership/security/billing-sensitive actions, append-only application audit events with actor/tenant/action/target/requestId and redacted metadata.
- CSP must be staged in report-only mode against actual Cesium, map tile, iframe and translation origins, then enforced after browser verification. Set appropriate framing, content-type, referrer and transport policies; verify both asset and Worker responses. Do not deploy a blanket CSP that silently breaks the atlas.
- Rate-limit authentication, checkout, invitations, exports, uploads and public queries. Business usage quotas and abuse rate limits are separate. Bound queue retries/provider calls and alert on backlogs to limit cost.
- Minimize retained email/event data; define retention/deletion, billing record legal holds, processor cleanup and backups. Document processors/transfers and legal review needs; no automatic GDPR or PCI DSS claim.

## Required production evidence

- [ ] Customer identity selection and lifecycle tests, provider settings reviewed.
- [ ] Tenant isolation/role matrix including last-owner and seat races.
- [ ] Stripe test-mode lifecycle E2E; approved live prices/tax/cancellation terms.
- [ ] Durable acceptance, queue retry/DLQ, reconciliation and notification idempotence tests.
- [ ] Workerd runtime tests and browser desktop/mobile checks.
- [ ] Dependency and secret scans, reviewed lockfile, independent audit findings disposition.
- [ ] Verified Access/WAF/rate-limit/Turnstile/header configuration where applicable.
- [ ] Separate staging/production resources and secrets; protected production approval.
- [ ] Tested backup/restore, migration and rollback plan; retention and export/deletion workflow.
- [ ] Redacted operational dashboards/alerts for API errors, auth abuse, billing lag and queue age.

No item above is marked complete by the presence of this checklist.

## Audit execution boundary

The installed security-audit skill requires target code execution inside an OS-enforced environment with no external network, explicitly allowlisted empty environment, read-only target/toolchain, scratch-only writes, and low CPU/memory/process/file-size/disk/wall-clock limits. All controls must be demonstrated before builds/tests/fuzzing under that workflow. Use dummy tenants, secrets and payment fixtures; no live provider probes or charges. An ordinary terminal with elevated permissions is not this sandbox.

This Phase 1 review ran no target code and produced no independently verified vulnerability findings. A later complete security audit needs its own coverage ledger, independent validation and schema-validated report; unverified deployment conditions remain explicit validation gaps.
