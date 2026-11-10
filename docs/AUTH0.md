# Auth0 staging pilot

Status: approved provider direction; initial SDK adapter implemented, not deployed or enabled. This is not a completed identity lifecycle implementation.

The pinned released @auth0/auth0-hono 1.2.6 SDK uses `auth()` (its main-branch documentation describes a different API). Hono is an adapter at the Worker boundary; Vinext continues serving the atlas. OAuth exchanges, PKCE, callback verification and encrypted session handling are delegated to the SDK, not custom cryptography.

## Configure a separate test application

1. Create an Auth0 **Regular Web Application** for staging. Use Universal Login and a database or approved social connection. Enable email verification and recovery in Auth0; do not collect passwords in the atlas.
2. Set Allowed Callback URLs to https://YOUR-STAGING-HOST/auth/callback. Set Allowed Logout URLs to the exact staging origin. Do not add wildcard origins.
3. Set runtime variables AUTH_PROVIDER=auth0, ATLAS_ENVIRONMENT=staging, AUTH0_DOMAIN (tenant hostname ending .auth0.com), AUTH0_CLIENT_ID and canonical PUBLIC_APP_URL.
4. Set AUTH0_CLIENT_SECRET and AUTH0_SESSION_ENCRYPTION_KEY through Worker secrets, not build source. Generate the latter using a cryptographically random generator (at least 32 random bytes encoded as 64 hex characters); the app checks minimum length, not entropy. Never reuse secrets across environments.
5. Rebuild with staging resource settings. Staging customer paths must be reachable through Auth0 without an additional Access login. Keep Access protection for any future operator/admin routes. The public Stripe webhook must remain outside customer login.
6. Visit /auth/login?returnTo=%2Faccount. Registration/recovery use Universal Login. Verify the email before accessing the account. /auth/logout is handled by the SDK.

## Boundaries and migration

AUTH_PROVIDER unset preserves current Cloudflare Access. Auth0 is blocked outside staging regardless of credentials. Only account/customer billing/scenario and /auth/ paths run through its middleware; public observation remains public. The adapter requires a verified email and derives a different ID per issuer/subject. It never trusts client identity headers or links accounts by email. Cloudflare Access and Auth0 do not share account IDs: test users start with separate records, and current paid subscriptions are not migrated automatically.

Billing remains gated by existing activation settings and Access-oriented billing readiness. Do not turn on paid checkout for this pilot. Adapt billing activation only after identity migration and provider E2E tests are delivered. No production account data was converted.

## Outstanding work before activation

- Stateful D1 session storage and app revocation are now implemented; see SESSIONS.md. Provider-signed backchannel logout is delegated to the SDK, but its complete hosted flow still needs verification.
- Verified stable user/identity mapping and explicit account-linking/migration procedures for current Access customers.
- Profile and verified email-change management, export/deletion, remaining account security settings and recent reauthentication for sensitive operations.
- Hosted end-to-end signup, verification, recovery, callback failure, logout, expiry, concurrent-request isolation and CSRF tests under workerd/browser; current policy tests are not a substitute.
- Auth abuse controls, MFA/SSO policy and provider data-processing/cost review. Review SDK error logging before handling production identities; do not enable debug logs.

Local dependencies use an ignored .auth0-toolchain installation to avoid reinstalling the large existing toolchain on the nearly full C: drive. Committed package.json/package-lock.json contain pinned SDK requirements for a normal clean CI install. No toolchain directory, keys or provider credentials belong in Git.

References: https://github.com/auth0/auth0-hono (the installed 1.2.6 release README is the API reference for this adapter); https://auth0.com/docs/authenticate/login/auth0-universal-login
