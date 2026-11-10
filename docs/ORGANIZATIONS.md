# Organization/RBAC staging pilot

Implemented 2026-11-10. Additive migration: drizzle/0003_peaceful_starhawk.sql and corresponding Drizzle snapshot/journal. No remote migration was applied. Existing billing/scenario rows remain individual-owned and unchanged.

## Enable only in staging

1. Complete the Auth0 staging configuration in AUTH0.md. Use synthetic accounts with verified email addresses.
2. Review and apply migration 0003 to the staging database after reconciling prior migration history and backing up. Do not blindly rerun migrations 0000–0002 on an existing database. No application request runs schema migrations.
3. Set runtime ORGANIZATIONS_ENABLED=true together with AUTH_PROVIDER=auth0 and ATLAS_ENVIRONMENT=staging. Missing any requirement returns 503. Production is deliberately blocked.
4. Visit /organizations. Create a pilot organization, then invite another verified test account. Tokens are displayed once in memory; no emails are sent. Share only through an appropriate secure channel; do not put tokens into query strings, issues or logs.
5. Verify all customer paths /organizations and /api/v1/organizations/* are handled by Auth0, with no competing Access customer policy. Keep separate operator Access protection when platform administration is implemented.

## Delivered behavior

- Each verified identity has its own users row; no account merging by email. Creation/acceptance updates that identity's normalized email.
- Creation is limited atomically to ten organizations per creator. A UUID requestId is replayable for the same owner/name; reuse for a different name or owner fails. Default pilot capacity is five, including the owner and unexpired pending invitations.
- Roles: owner, admin, billing_admin, member and viewer. No organization role can become a platform administrator. Role values are also constrained in SQLite.
- Owner: reads, invitations and member-role/removal administration; cannot demote or remove the owner through these APIs.
- Admin: reads and invitations for member/viewer only; cannot invite an admin/billing admin or change/remove members. Owner/admin may read invitation metadata and organization audit events.
- Billing admin: read role with a future billing permission; it does not grant access to another user's existing individual Stripe customer or portal.
- Member/viewer: membership reads; write is a policy capability for future shared resources, not access to another user's existing scenarios.
- Invitation token: 32 random bytes, stored as SHA-256 hash; seven-day expiry, recipient-bound and single-use. Reissuing for the same email invalidates its prior token. Pending unexpired invitations reserve capacity. Expiry/revocation releases it. Acceptance checks current capacity within the insertion statement.
- All reads are membership-scoped; every write repeats authorization in the mutation SQL. D1 batches group mutation and audit records. Role changes/removals are owner-only and cannot target an owner. Audit endpoints return latest 100 records; this is not yet a complete paginated audit export.
- Member lists show identifiers/roles, not an email directory to every role. Owner/admin can see invitation recipient emails. No token hash or token is returned in listing endpoints.
- Readiness additionally checks organization tables when ORGANIZATIONS_ENABLED=true.

## API routes

All operations require the staging feature gate and a verified Auth0 session. Browser writes require exact canonical Origin, bounded JSON and strict Zod schemas. Account/API responses use no-store. Errors are 400 invalid input, 401 unauthenticated, 403 wrong origin, 404 inaccessible resource/member, 409 rejected operation/seat conflict, or 503 unavailable/disabled. Do not infer resource existence from denial messages.

| Route | Method | Operation |
| --- | --- | --- |
| /api/v1/organizations | GET / POST | List own organizations / create |
| /api/v1/organizations/{id} | GET | Read own organization and member identifiers |
| /api/v1/organizations/{id}/members | PATCH / DELETE | Owner changes/removes non-owner member |
| /api/v1/organizations/{id}/invitations | GET / POST / DELETE | List / invite / revoke |
| /api/v1/organizations/invitations/accept | POST | Consume token for verified recipient |
| /api/v1/organizations/{id}/audit | GET | Owner/admin reads latest 100 audit events |

OpenAPI: [organizations.openapi.yaml](organizations.openapi.yaml). API handlers attach a generated X-Request-ID and emit redacted status/duration logs; no bodies, emails or tokens are logged by the organization wrapper.

## Verification and limitations

Tests exercise the real domain service and SQL using SQLite with foreign keys and transaction-wrapped D1 batch equivalents: two-tenant read/write denial, role escalation, protected owner, invite recipient/expiry/replay/renewal/revocation, pending-seat capacity, audit scoping, creation idempotency/limits and unchanged atlas storage. These are not deployed D1 concurrency, Auth0 browser E2E, or full security-audit results.

Not yet delivered: ownership transfer with recent reauthentication, organization deletion/retention, paid seat/subscription synchronization, shared transport resources, transactional emails, audit pagination/export, abuse rate limiting and platform admin. The staging dashboard must not be advertised as a live paid Business plan. Cloudflare resources, live identity settings and provider flows remain unverified. The previous Auth0 session-revocation limitations still apply.
## Recorded local checks ? 2026-11-10

29 tests passed; TypeScript and final Worker build passed. Owned loopback Worker returned 200 for liveness and the organization page, 503 with X-Request-ID for the disabled organization API, and public billing plans remained checkoutEnabled=false. The local server was stopped after these checks. No deployed Auth0 or D1 result is asserted.
