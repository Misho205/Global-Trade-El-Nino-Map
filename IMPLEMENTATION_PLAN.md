# Incremental implementation plan

Status: Phase 1 delivered. Phase 2 local environment guards, health endpoints, setup guide and partial API/CI foundations implemented; cloud provisioning and deployed runtime checks remain pending. Auth0 direction approved; opt-in staging SDK adapter and identity policy tests added. Organization/RBAC staging pilot now includes additive tables, guarded APIs, invitation lifecycle, audit records and a dashboard. D1-backed Auth0 sessions/revocation and a staging durable billing inbox/queue pilot are now implemented locally. Complete hosted identity lifecycle, ownership transfer, team billing, provider E2E, notifications and later domains remain pending. Preserve current atlas, individual billing and last-valid data. No production action is authorized merely by this plan.

| Stage | Changes to prepare | Acceptance evidence |
| --- | --- | --- |
| 1. Inventory and design | Four root documents; architecture and threat model | Review baseline, limitations and decisions; no runtime change. |
| 2. Environment foundation | Explicit local/staging/production config generator, safe variable template, scripts, live/ready routes | Type/build and workerd config tests; no cross-environment bindings; liveness exposes no secrets, readiness verifies required storage without charging providers. |
| 3. Identity | Approved managed identity adapter, stable users/identities, verified migration, lifecycle settings UI | Registration/verification/recovery/logout/revocation/rotation tests; Access migration fixture; no email-only account merging. |
| 4. Tenants and RBAC | Additive schema, personal tenants, memberships, roles, hashed invitations, ownership/seat lifecycle | Two-tenant IDOR suite for every private route, last-owner and role-escalation races; old accounts retain their own records. |
| 5. Durable jobs | D1 inbox/outbox, queue consumer, retries/DLQ, scheduled dispatcher | Failure injection before/after DB acceptance, queue send and acknowledgement; duplicates cause one state effect; poison messages terminate in DLQ. |
| 6. Billing | Versioned price catalogue, approved PRO/BUSINESS mapping, annual/seat checkout, canonical reconciliation | Stripe test-mode monthly/annual renewal, failed payment, cancellation, upgrades, downgrades, prorations, refund and seat tests; no live charges. |
| 7. Entitlements/API | Central tenant policy, atomic limits, Zod contracts, /api/v1 and OpenAPI | Concurrent quota tests, paid-period boundaries, downgrade rules, pagination, key revocation if API product enabled. |
| 8. Dashboards | Account/security/usage; org members/seats/billing; isolated platform admin | Desktop/mobile accessibility and authorization checks; tenant role matrix; truthful feature availability. |
| 9. Privacy/email/files | Export/deletion workflow, retention, consent as needed, provider mail outbox, optional private R2 | Provider cleanup reconciliation, no duplicate emails, cross-tenant download denial, upload type/size/quota tests; legal templates marked unreviewed. |
| 10. Operations/security | Logs/redaction, metrics, alerts, edge controls, CSP rollout, independent audit | Secret/advisory scan results; local sandbox security tests; operator-observed edge configuration; audit gaps tracked honestly. |
| 11. CI/staging | Actions install/type/lint/test/security/build, staging deployment and synthetic smoke tests | Immutable commit/artifact, least-privilege tokens, untrusted PRs cannot access secrets/deploy, staging E2E evidence. |
| 12. Release | Production readiness review, backups/restore and rollback runbooks, explicit approved deployment | Protected environment approval, tested migration/backfill, provider live configuration review, monitoring and rollback owner. |

## Decisions to approve before affected implementation

1. Customer identity provider and transition away from Access-only customer identity: major identity architecture change. Keep the existing adapter until approved and verified.
2. PRO/BUSINESS monthly/annual prices, included seats, extra-seat price, proration, quota/reset and trial policy; treatment of existing Professional/Fleet subscriptions.
3. Merchant legal identity/contact, supported markets/tax handling, privacy/retention policy, transactional email provider and verified sender domain.
4. Public API and file-upload use cases before creating resources or exposing corresponding paid features.

These decisions do not block preparing reversible environment scaffolding and test contracts. They do block replacing authentication, applying billing changes to real customers or activating payments.

## Release and migration safeguards

- Use a codex/ feature branch; do not push to an automatically deployed main before reviewing repository/Workers Builds rules.
- Keep existing migrations immutable. Generate additive migrations and test both empty database and upgrade-from-current fixtures. Inventory actual production migrations before any remote command.
- Back up and rehearse restore; apply production migrations only with explicit approval. Do not recreate tables to satisfy an ORM diff.
- Distinguish build-time resource settings from runtime secrets. Never put credentials in committed examples, logs, browser bundles or OpenAPI examples.
- Configure GitHub environments and required reviewers through actual repository settings; YAML alone cannot enforce those protections.
- Select one production release mechanism. Prevent Workers Builds and Actions from independently auto-deploying the same main branch.

## Verification plan

Existing test source commands (not executed in Phase 1):

```text
node --experimental-strip-types --test tests/snapshot-cache.test.mjs tests/cloudflare-readiness.test.mjs tests/monetization.test.mjs
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Before executing repository-controlled code for a security audit, establish the sandbox controls in SECURITY_BASELINE.md. Ordinary historical build results do not satisfy the audit contract. Add workerd integration tests alongside pure unit tests, then staging-only provider E2E tests with dummy customers. Record command, revision, environment, result and remaining gaps for each stage.

## Later delivery artifacts

Create checked-in safe environment template, generated Wrangler configuration validation, resource-creation commands with placeholders, OpenAPI document, schema/data dictionary, provider setup, CI workflows, deployment/rollback/backup/maintenance guides and editable legal requirements at their corresponding stages. Do not present proposed artifacts as already functioning infrastructure. Numeric cost estimates require current official pricing plus measured expected usage.
