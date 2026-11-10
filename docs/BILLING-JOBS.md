# Durable billing jobs — staging pilot

Implemented locally; disabled by default. No queues, deployments, live payments or remote migrations were created/executed.

## Processing contract

The existing webhook still verifies the original bounded raw body and Stripe timestamp/signature. In opt-in async staging mode it validates and stores an event envelope in D1 billing_inbox before returning 2xx. The envelope contains provider event ID, type, creation time and subscription ID only, not raw invoice/customer/card payloads. A D1 write failure returns non-2xx so Stripe can retry. Event IDs are unique; duplicate delivery retains the original accepted record.

The inbox also acts as a dispatch outbox: Cron selects up to 20 due rows per run, atomically delays their next dispatch and sends only {eventId} to BILLING_JOBS. A queue send failure leaves the durable event pending for retry. A crash between send and bookkeeping can produce duplicate deliveries, which are expected. With the existing six-minute Cron this pilot dispatch rate is at most 20 per tick; do not assume high-volume throughput without measurement and tuning.

The consumer claims an expiring, token-fenced processing lease and calls the shared canonical Stripe synchronizer. Successful subscription updates and legacy processed-event receipts remain a D1 batch. An event marked complete is acknowledged; duplicate completed jobs do not call Stripe again. If the subscription commit succeeded but marking inbox completion failed, retry finds the durable receipt and safely finishes. Unknown/unmapped/unsupported events can complete as ignored; this is not a full invoice/refund ledger.

Provider failures retain generic error codes and retry. At most five actual processing claims are allowed per inbox event; failed events remain in D1. Queue retry limit is separately five; repeated failures route messages to the configured dead-letter queue. Expired processing leases recover after worker crashes, including the final-attempt case. Logs contain outcomes/counters, not raw provider failures or payment secrets. Scheduled jobs run independently so a billing error does not skip public-data collection.

## Configure staging

1. Review/apply additive migration 0005_lean_outlaw_kid.sql to the staging D1 database after reconciling prior history; do not rerun old table-creation SQL blindly.
2. Create separate staging queues (commands are instructions, not already executed):

```text
npx wrangler queues create atlas-billing-staging
npx wrangler queues create atlas-billing-dead-staging
```

3. Set build values in addition to the existing explicit staging Worker/D1 settings:

```text
BILLING_ASYNC_ENABLED=true
ATLAS_ENVIRONMENT=staging
ATLAS_DEPLOY_TARGET=cloudflare
ATLAS_ENABLE_CRON=true
ATLAS_BILLING_QUEUE=atlas-billing-staging
ATLAS_BILLING_DLQ=atlas-billing-dead-staging
```

Both queue names must be distinct and end in -staging. The build emits producer/consumer/DLQ bindings and runtime BILLING_ASYNC_ENABLED=true. Inspect dist/server/wrangler.json before any deployment. Do not turn on only the runtime flag without deploying bindings: async ingress fails closed when staging/DB/queue configuration is incomplete. The handler is deliberately blocked in production async mode.

4. Use Stripe test keys and the staging webhook signing secret. Keep paid checkout disabled until the entire identity and payment test flow passes. No live charge is needed to validate job behavior.
5. Verify signed test events are durably recorded, dispatched, completed and deduplicated. Exercise provider outage, queue outage, duplicate delivery, worker crash and DLQ handling in staging. Local fixtures are not provider E2E or hosted queue evidence.

When the flag is absent, the current synchronous webhook path stays active, using the same extracted canonical synchronizer. Do not switch off an active async consumer until pending jobs are drained and durable acceptance has been disabled deliberately; disabling it with pending events strands work until it is re-enabled.

## Operational monitoring and recovery

Inspect through operator-authorized D1 tooling, never a public customer endpoint:

```sql
SELECT state,COUNT(*) AS count,MIN(received_at) AS oldest FROM billing_inbox GROUP BY state;
SELECT id,attempts,last_error,received_at FROM billing_inbox WHERE state='failed' ORDER BY received_at LIMIT 50;
```

Configure actual alerts for pending age >12 minutes, any failed inbox rows/DLQ messages, repeated billing_job_failed logs, and subscription synchronization lag. These are proposed thresholds; alerts are not provisioned by these documents. The complete raw event is not retained; inspect canonical provider state or the authorized provider dashboard when investigating.

Operator replay after the cause is fixed requires reviewed manual tooling/commands and the exact failed event ID. Reset state/attempt/lease only for that event, then allow dispatch; preserve the legacy processed receipt so a previously committed event is not applied again. No unauthenticated replay endpoint is exposed. Automated recurring reconciliation for missed webhooks, notification outbox/email, invoice/refund history, organization billing and complete retention policies remain pending.

Official references: [Queue configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/), [dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/), [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).
## Recorded local verification ? 2026-11-10

41 tests passed; TypeScript and the final Worker build passed. The session suite includes the actual installed Auth0 SDK encrypted-cookie/state-store contract. Loopback Worker checks passed for liveness, the security page, fail-closed disabled session/organization APIs, and checkoutEnabled=false. The local server was stopped. No deployed provider login, signed Auth0 callback, Stripe test-mode checkout, hosted Cron, queue delivery or DLQ delivery is claimed.

Before hosted activation, measure the combined Cron D1 query/CPU budget against the actual account limits: inbox dispatch, session cleanup and public-feed refresh share one scheduled invocation. Reduce the dispatch batch or split schedules if necessary. These limits and alert delivery remain validation work.
