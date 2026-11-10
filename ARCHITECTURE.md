# SaaS architecture proposal

Status: proposed, not implemented. Baseline and evidence: [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md). Existing atlas architecture remains in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Runtime and boundaries

Keep a modular monolith on the existing Vinext/React Worker plus Static Assets. Keep the public atlas anonymously accessible. Route authenticated customer APIs through a common identity, tenant-context and authorization layer; protect platform administration separately. Do not replace the framework or identity provider without approval of the migration and rollback plan.

```text
Browser -> Cloudflare edge controls -> Worker / public assets
                                     |-> public atlas -> last-valid D1 snapshots
                                     |-> /api/v1 -> identity -> membership -> policy -> tenant D1 rows
                                     |-> private file access -> R2 (when needed)
Stripe -> raw signature verification -> D1 event inbox + outbox -> 2xx
Cron -> outbox dispatcher -> Queue -> idempotent processor -> Stripe canonical state
                                  |-> retry -> dead-letter queue
                                  |-> notification outbox -> email provider
Managed identity provider -> verified identity/session lifecycle -> Worker adapter
```

The D1 inbox/outbox pair closes the non-atomic D1-write/Queue-send boundary. Acknowledge relevant verified events only after durable D1 acceptance. Dispatcher retries pending rows; queue duplicate deliveries are expected. Consumer commits entitlement state, processing receipt and notification intents together, then acknowledges. Never assume message order or exactly-once delivery. Store only the minimum necessary event data, restrict access and apply retention.

## Infrastructure decisions

| Service | Initial decision |
| --- | --- |
| Workers + Static Assets | Retain existing generated build config; explicitly test protected routes cannot bypass auth via asset routing. |
| D1 | Authoritative users, memberships, billing, quotas and outboxes; additive migrations, indexes and scoped queries. |
| Queues + DLQ | Add for durable billing and email processing; bounded retries, authenticated replay tooling and alerts. |
| R2 | Defer resource creation until private uploads/exports are implemented; private bucket, tenant metadata and authorized downloads. |
| KV | Optional non-authoritative public cache only; never identity, billing or quota truth. |
| Durable Objects | Not initially necessary: SQL conditional writes/uniques and outboxes handle initial coordination. Reevaluate for a demonstrated per-tenant real-time coordination requirement. |
| Turnstile/WAF/rate limits | Apply to public signup/recovery/invitation abuse; verify Turnstile server-side. Separate edge and application quota controls. |
| Secrets / Logs / Cron | Per-environment secrets, redacted structured logs, collector plus billing reconciliation/outbox dispatch schedules. |

Cloudflare Queues delivers at least once and does not guarantee ordering; see [delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) and [queue operation](https://developers.cloudflare.com/queues/reference/how-queues-works/). Preserve deduplication at database boundaries. [Static Assets bindings](https://developers.cloudflare.com/workers/static-assets/binding/) govern Worker/asset routing; do not infer private-route coverage from frontend behavior.

## Identity decision requiring approval

Recommended direction: managed customer identity with hosted registration, login, verification, reset, optional MFA and OAuth/SSO. Provider selection requires verified Workers compatibility, revocation guarantees, EU processing/transfer terms, domain setup and cost review. Keep Cloudflare Access for platform operators and as the current customer adapter until migration is proven. Introduce stable internal users and external identities keyed uniquely by issuer/subject; migrate existing hashed Access account IDs through an explicit verified mapping. Never merge accounts by an unverified email match.

If the chosen provider does not deliver immediate revocation suitable for sensitive actions, introduce an application session/revocation check. Cookie sessions, if used, are Secure, HttpOnly, appropriately SameSite and rotated after authentication/privilege changes; writes require CSRF protection. Do not promise password reset for passwords the application does not own.

## Modules and data model

Use domains under lib/domains/ (identity, users, organizations, authorization, billing, entitlements, audit, jobs, notifications, storage, administration) incrementally, not a mass move. API handlers translate Zod-validated requests into domain operations. Provider adapters preserve provider-specific semantics; Stripe first, Paddle/Dodo interfaces later, no pretend implementations.

Proposed tables, separate from unchanged current tables until migration:

- users, identities (unique issuer/subject), optional sessions depending on identity decision.
- organizations with personal or organization kind; organization_members unique(organization_id,user_id), roles, permissions, organization_invitations with hashed token, expiry and single-use acceptance.
- plans, plan_prices (currency, integer amount_minor, interval, provider IDs, version), billing_customers, subscriptions, invoices, entitlements.
- billing_event_inbox unique(provider,event_id), job_outbox, notification_outbox; reconcile existing billing_events without reprocessing charges.
- usage_records with unique operation IDs and tenant-period counters; api_keys with protected key representations, scopes, expiry and revocation if an API product is approved.
- audit_logs, notifications/preferences, files and privacy_requests/consent_records as required.

Every tenant-owned row has organization_id, appropriate foreign keys and an index beginning with organization_id. A personal tenant has one authorized owner; users can belong to multiple organizations. External identity tables belong to users, not arbitrary selected tenants. Central authorization requires an active membership before any tenant read/write and applies role permissions on the server. Platform admin grants are separate, operator-managed and never writable by organization roles.

Owner transfer requires recent reauthentication and atomic acceptance by an existing eligible member; prevent deletion/demotion of the last owner. Pending invitations reserve seats atomically, expire and release capacity; acceptance verifies the intended recipient. Seat reductions cannot silently orphan members.

## Billing and entitlement policy proposal

Preserve current plans for existing subscribers. Introduce FREE, PRO and BUSINESS as versioned offerings after owner-approved mapping/prices; do not silently rename or reprice active subscriptions. All checkout prices, intervals, seat quantities and limits resolve server-side from approved plan_prices and provider validation. Store monetary facts in integer minor units. Current floating-point transport estimates are estimates, not billing amounts.

Default proposed lifecycle: active/unexpired grants paid access; incomplete, unpaid, canceled or expired deny; past_due has zero grace, preserving current behavior. Scheduled end-of-period cancellation retains access while active and paid through period end; immediate cancellation revokes after verified canonical state. Trials are off until explicit policy approval. Upgrades/seat increases activate only after provider-confirmed payment; downgrades take effect at the paid period boundary. Preserve data on downgrade but block over-quota writes, exports/storage according to documented policy. Refunds reconcile invoice/payment state; a partial refund does not automatically cancel a subscription. Annual allowances must explicitly specify calendar-month versus subscription-year reset; initial scenario quotas stay UTC calendar-month based.

Invoice history and payment method changes use provider-hosted surfaces initially; mirror only necessary invoice facts. Never grant access from a success redirect. Outbox notifications use unique event/action keys to avoid duplicate emails.

## API, operations and environments

New routes use /api/v1 with OpenAPI schemas, standard error code/message/requestId, cursor pagination, bounded bodies, same-origin browser writes and operation idempotency. Keep existing atlas and billing routes compatible during migration. Do not add paid public API keys without a defined customer use case.

Separate local, staging and production Workers, D1 databases, queues, buckets, Access audiences/identity applications, secrets and Stripe test/live configuration. Build configuration must resolve explicit environment resource identifiers and fail closed on missing production bindings. Keep deployment config generated through the existing Vite pipeline; avoid two conflicting sources of truth. Record exact generated artifact/config and commit for rollback.

Staging uses synthetic tenants and Stripe test mode. Production deployment requires protected GitHub environment approval and an explicit user-authorized release; inspect existing Workers Builds auto-deploy configuration before any push to main. Code rollback must not attempt schema rollback: use expand/backfill/contract with approved production migrations and backup/restore rehearsal.

Cost model before pricing commitments: Worker request/CPU + D1 rows read/written/storage + queue operations/retries + R2 operations/storage + identity active users + email sends + payment fees. Measure p50/p95, queue age, retry ratio and tenant usage in staging; apply per-request, per-tenant and operator budgets. No numeric estimate or verified provider pricing is asserted here. Reevaluate D1 when measured query latency, write contention, database capacity or tenant isolation requirements exceed verified service limits.
