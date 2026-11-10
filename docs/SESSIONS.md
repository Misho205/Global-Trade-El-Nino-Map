# Auth0 sessions and app revocation

Implemented locally, staging only; not deployed or production-ready.

## Setup

Apply additive migration 0004_rainy_nekra.sql to staging after reviewing migration history and backup. The existing Auth0 adapter now requires D1 stateful sessions: previously issued stateless pilot cookies will not map to records and test users must sign in again. Production Access accounts are unaffected.

The SDK still performs OAuth/PKCE, token verification and encrypted HttpOnly/Secure/SameSite=Lax cookies. The cookie contains an SDK-managed opaque session reference; authoritative state lives in auth_sessions. Application session payloads can contain provider tokens and personal claims: treat this table as sensitive, restrict database/backups access, and never export it through public APIs or logs. This implementation relies on Cloudflare storage encryption at rest; it does not claim application-level payload encryption.

Visit /account/security (or the Security link on a signed-in Auth0 account). GET /api/v1/account/sessions lists up to 100 own active session identifiers/timestamps, never token payloads. DELETE with JSON {sessionId:32-character-hex-ID} revokes one own app session; {} revokes all currently stored own sessions. Exact canonical Origin and authenticated identity are mandatory. Other accounts' identifiers cannot be revoked. Revoking all includes the current browser. This endpoint does not revoke Auth0 SSO or invalidate provider access tokens at external APIs.

## Expiry and races

- Database reads use a conditional UPDATE to verify expiry/revocation against the authoritative writer and record last_seen_at; no KV authority is used.
- Absolute session ceiling: eight hours from SDK creation. Stored state also expires no later than 30 minutes after its most recent SDK persistence, or earlier provider session expiry. A read alone does not extend that deadline; SDK cookie expiry can require re-login sooner. This is intentionally not a promise of eight hours of continuous browser access.
- Revocation clears token payloads immediately but retains a tombstone. Conditional upserts cannot overwrite a revoked, expired, different-subject or different-issuer row. A request that already authenticated may finish, but later requests fail. No cancellation of already authorized work is claimed.
- A new interactive login creates a new SDK session; revocation is not an account ban. Concurrent login completion after a revoke-all operation may create a new session.
- Cleanup removes records only 24 hours after their absolute deadline, retaining tombstones beyond cookie validity. Cron invokes cleanup independently from feed collection and billing dispatch; enable Cron to run retention automatically. No Cron success is asserted until deployed evidence exists.

## Backchannel logout

Configure the staging Auth0 application backchannel logout URL to https://YOUR-STAGING-HOST/auth/backchannel-logout where supported. Keep this provider callback reachable without a customer login; the official SDK verifies its token and invokes deleteByLogoutToken. Store matching uses issuer plus provider sid/sub; missing subject/session claims are rejected. Store unit tests use dummy verified-claims fixtures; they do not prove an actual Auth0-signed callback has been tested.

Still pending: hosted registration/recovery/verification/logout E2E, Auth0 SSO/token revocation controls, recent reauthentication, profile/email changes, deletion/export, brute-force/edge controls and review of SDK error logging. Session revocation is one identity phase, not completion of all identity requirements.
## Recorded local verification ? 2026-11-10

41 tests passed; TypeScript and the final Worker build passed. The session suite includes the actual installed Auth0 SDK encrypted-cookie/state-store contract. Loopback Worker checks passed for liveness, the security page, fail-closed disabled session/organization APIs, and checkoutEnabled=false. The local server was stopped. No deployed provider login, signed Auth0 callback, Stripe test-mode checkout, hosted Cron, queue delivery or DLQ delivery is claimed.
