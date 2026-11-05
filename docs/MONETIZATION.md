# Subscription launch and operator setup

## Product and scope

Free public observation remains unchanged. Paid plans monetize the hosted private
workspace, saved manual comparisons and export convenience, not public data or
an exclusive license to open-source algorithms. The original MIT license remains
unchanged; self-hosting and permitted commercial use remain possible.

Pilot monthly prices in EUR, before any applicable VAT:

| Plan | Price | Implemented scope after operator activation |
| --- | --- | --- |
| Free Observer | EUR 0 | Existing public atlas and available data; no account required |
| Professional | EUR 49/month | One individual account, 20 saved comparisons per UTC calendar month, 2-5 alternatives each, latest 50 history entries and JSON export |
| Fleet | EUR 199/month | One individual account, 200 saved comparisons per UTC calendar month; same comparison capabilities |
| Enterprise | Individual quotation | Future separately scoped deployment/integration; no self-service checkout |

There is no annual billing, automatic trial, multi-user organization, seat
management, paid API key, licensed AIS, live routing engine, ship/vehicle control,
guaranteed source freshness, email alerting or SLA in this implementation. Do not
advertise these as included. Larger history retention/data access can be scoped
separately. Proposed pilot prices need validation against actual customer demand,
support load, hosting, identity and data-provider costs.

The comparison formula is explicit: duration = distance / speed + delay;
cost = distance * distanceCost + duration * timeCost + otherFees. Costs and distance
are user assumptions in EUR/km/km-h, not estimates from carrier or marine models.
The output does not select a safe course, check bathymetry, charts, navigation
restrictions or weather, and is not an operational command. Captains/operators
retain all verification and voyage-authority decisions.

## Default state

Billing is **off by default**. Pricing is public; account functions fail closed
without configuration. Purchases and paid comparisons require both
`BILLING_ENABLED=true` and `PRO_FEATURES_VALIDATED=true`, provider/identity settings
and database migrations. These flags are deliberate operator attestations, not
proof supplied by the app. Do not enable them merely to make the button clickable.

No Stripe account, products, customer, subscription or charge is created by
committing this code. Server responses never trust plan/status values supplied by
the browser. Checkout success redirects do not grant paid access.

## Database migrations

Keep the existing source-data database and binding `DB`. Apply the following new
migrations in order, once, after backup/review:

1. `drizzle/0001_brown_wallow.sql`: billing accounts, subscriptions, event receipts,
   and private scenarios. Existing `data_snapshots` is retained.
2. `drizzle/0002_flaky_midnight.sql`: account/period query index.

Use the D1 console or the existing deployment guide. Do not replay the original
0000 migration on a populated database. Code rollback does not remove billing data
or roll back these migrations.

## Authentication: standalone Cloudflare deployment

Configure one Cloudflare Access self-hosted application with public hostname/path
entries covering `/account`, `/api/billing/status`, `/api/billing/checkout`,
`/api/billing/portal` and `/api/pro/*`. All of these must use the same application
AUD. Configure an appropriate verified-user sign-in policy (such as email OTP or
an identity provider) and assess Access's user limits/costs for your customer base.

Keep `/`, `/pricing`, existing observation APIs and `/api/billing/plans` public.
**Keep `/api/billing/webhook` reachable by Stripe without Access login**; it has its
own mandatory signature verification. Do not protect all `/api/billing/*` blindly.
If the old Worker-level Access policy covers all traffic, revise it deliberately
for this public/free plus protected/account model before launch.

Runtime settings:

| Setting | Purpose |
| --- | --- |
| `PUBLIC_APP_URL` | Exact canonical HTTPS origin, no path/query; must match the browser |
| `ACCESS_TEAM_DOMAIN` | For example `your-team.cloudflareaccess.com`, no URL scheme |
| `ACCESS_AUD` | Application AUD for the protected paths |

The server verifies RS256 signatures with fixed-origin Access JWKS, issuer,
audience, expiry and subject. Email-only headers are never sufficient. Account IDs
are derived from issuer/subject rather than user-submitted email addresses.
Alternate previews/domains require their own correct configuration; a mismatched
origin is denied for writes. There is no insecure local test-user bypass.

## Stripe setup: start in test mode

Create your own Stripe merchant account; no developer needs your password/card.
Create monthly EUR recurring prices with quantity 1:

- Professional: 4900 euro cents, interval `month`, interval_count 1.
- Fleet: 19900 euro cents, interval `month`, interval_count 1.

Runtime secrets/settings, kept out of Git and build/client bundles:

| Setting | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Test secret key first; live only after acceptance |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this exact endpoint/environment |
| `STRIPE_PRICE_PROFESSIONAL` | Matching monthly price ID |
| `STRIPE_PRICE_FLEET` | Matching monthly price ID |
| `STRIPE_AUTOMATIC_TAX` | Optional `true` only after merchant tax setup/testing |
| `BILLING_ENABLED` | Explicit `true` when ready |
| `PRO_FEATURES_VALIDATED` | Explicit `true` after product/data/terms acceptance |

The API is pinned to `2026-10-28.endive`; select matching snapshot webhook payloads.
Register HTTPS `/api/billing/webhook` for `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted` and
`checkout.session.completed`. The handler verifies the raw signature/timestamp,
deduplicates processed events, retrieves canonical subscription state and checks
the known customer/account/price mapping. Retries after provider/storage errors
must remain enabled. Monitor failed deliveries in Stripe.

Configure the customer portal for payment-method updates, invoices and cancellation.
For the first pilot, disable plan switching in the portal: review a future upgrade/
downgrade/proration flow separately. Cancellation at period end retains active
access only until the recorded paid period expires; canceled/past-due/unpaid states
are denied. No automatic grace period or refund policy is invented by this app.

Checkout prevents overlapping sessions and existing subscriptions. An open session
can be resumed for the same plan; switching plans requires it to expire (about
30 minutes). Prices are validated server-side against the published amount,
currency and monthly interval. Do not edit displayed pricing without updating
the Stripe configuration too.

## Before accepting real money

- Supply merchant legal identity/contact, applicable terms, privacy notice, invoice
  and cancellation/refund handling, and tax setup appropriate to your business.
- Confirm data/service commercial permissions. The software license does not
  grant navigation certification or third-party redistribution rights.
- Complete security review of the identity, payment, webhook and private-data paths.
- Test valid/expired/tampered JWTs, two different customer identities, subscription
  expiry/cancellation/past-due, webhook retries/reordering and quota boundaries.
- Test checkout and portal with Stripe test mode; do not use a real card as a test.
- Verify paid history isolation, export, backups, deletion/support procedures and
  provider/Cloudflare limits. Team member access is not implemented.
- Verify that the free atlas and data APIs still work without an account.
- Enable live settings only after those checks and merchant acceptance.

## Documentation and operations

New routes: `/pricing`, `/account`, `/api/billing/{plans,status,checkout,portal,webhook}`
and `/api/pro/scenarios`. Monthly usage is enforced atomically on saved comparisons;
duplicate request IDs are scoped to the account. Paid history is not public.
Current pilot retention is all saved scenarios unless a reviewed operator deletion
procedure removes them; the UI lists only the latest 50. Billing event receipts and
accounts also persist. Define retention before public launch.

Public deployment is independent of a GitHub push. A connected Workers Builds
pipeline may deploy the commit automatically, but migrations and runtime secrets
are separate. Deploy to a protected test environment first; do not change the
legacy Sites deployment just because this GitHub repository is updated.

References: [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create),
[subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks),
[webhook signatures](https://docs.stripe.com/webhooks),
[customer portal](https://docs.stripe.com/api/customer_portal/sessions/create).
