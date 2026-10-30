# Privacy and external requests: technical notes

These are implementation notes for maintainers, not a jurisdiction-specific
privacy policy or a claim of legal compliance. A public operator must review the
actual deployed configuration and publish appropriate contact/retention details.

## Current application behavior

- The main atlas stores its language preference in browser localStorage and sets
  a `googtrans` cookie for the Google Translate widget.
- The browser can request imagery/terrain from Esri, flags from FlagCDN and the
  Google Translate script/service. These providers receive ordinary network
  request metadata; review their policies. Translation may send page content to
  Google according to the service's behavior.
- Server routes request public NOAA, WTO and UN Comtrade resources. The D1 cache
  stores public source payloads, query keys and refresh bookkeeping, not a
  purpose-built user account or shipment-contract database.
- The current schema does not record a visitor ID against cached trade queries.
  That does not imply the hosting platform has no access logs.
- Cloudflare/Access or Sites may process identity and request logs according to
  the operator's configuration. Local mock sign-in does not establish production
  identity behavior.

## Before operating publicly

- Inventory actual providers, scripts, cookies and deployment logs.
- Set and document retention, access controls and deletion procedures.
- Establish an operator contact and review applicable consent/privacy obligations.
- Avoid putting personal information, credentials or confidential trade data in
  URLs, issue reports, screenshots, audit artifacts or logs.
- Revisit this document when adding analytics, accounts, saved personal searches,
  AI services or a different translation provider.

Clearing the browser's site data removes the local language preference. Server
cache pruning is described in [DATA-UPDATES.md](../DATA-UPDATES.md); it is not a
complete policy for all platform logs or third-party storage.
