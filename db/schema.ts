// Durable last-valid public-data snapshots and refresh bookkeeping.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Latest valid result per source/query. Failed attempts never replace payload.
export const dataSnapshots = sqliteTable('data_snapshots', {
  key: text('key').primaryKey(),
  payload: text('payload'),
  lastSuccess: integer('last_success'),
  lastAttempt: integer('last_attempt'),
  nextAttempt: integer('next_attempt').notNull().default(0),
  leaseUntil: integer('lease_until').notNull().default(0),
  failures: integer('failures').notNull().default(0),
  error: text('error'),
  lastRequested: integer('last_requested').notNull().default(0),
});

export const billingAccounts = sqliteTable('billing_accounts', {
 id:text('id').primaryKey(), email:text('email').notNull(), customerId:text('customer_id').unique(),
 createdAt:integer('created_at').notNull(), checkoutLockedUntil:integer('checkout_locked_until').notNull().default(0),
 checkoutUrl:text('checkout_url'), checkoutPlan:text('checkout_plan'), checkoutUntil:integer('checkout_until').notNull().default(0),
});
export const billingSubscriptions = sqliteTable('billing_subscriptions', {
 accountId:text('account_id').primaryKey(), stripeSubscriptionId:text('stripe_subscription_id').notNull().unique(),
 customerId:text('customer_id').notNull(), plan:text('plan').notNull(), status:text('status').notNull(),
 periodEnd:integer('period_end').notNull(), eventCreated:integer('event_created').notNull(), syncedAt:integer('synced_at').notNull(),
});
export const billingEvents = sqliteTable('billing_events', {
 id:text('id').primaryKey(), processedAt:integer('processed_at').notNull(),
});
export const professionalScenarios = sqliteTable('professional_scenarios', {
 id:text('id').primaryKey(), accountId:text('account_id').notNull(), period:text('period').notNull(),
 title:text('title').notNull(), payload:text('payload').notNull(), createdAt:integer('created_at').notNull(),
}, table => [index('professional_scenarios_account_period').on(table.accountId,table.period)]);
