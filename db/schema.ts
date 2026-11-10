import {sql} from 'drizzle-orm';
// Durable last-valid public-data snapshots and refresh bookkeeping.
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex, check } from 'drizzle-orm/sqlite-core';

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

// Organization pilot: additive tables; existing individual subscriptions remain separate.
export const users = sqliteTable('users', {
 id:text('id').primaryKey(), email:text('email').notNull(), createdAt:integer('created_at').notNull(),
});
export const organizations = sqliteTable('organizations', {
 id:text('id').primaryKey(), name:text('name').notNull(), createdBy:text('created_by').notNull().references(()=>users.id),
 seatLimit:integer('seat_limit').notNull().default(5), createdAt:integer('created_at').notNull(),
});
export const organizationMembers = sqliteTable('organization_members', {
 organizationId:text('organization_id').notNull().references(()=>organizations.id,{onDelete:'cascade'}),
 userId:text('user_id').notNull().references(()=>users.id),
 role:text('role',{enum:['owner','admin','billing_admin','member','viewer']}).notNull(), joinedAt:integer('joined_at').notNull(),
},table=>[primaryKey({columns:[table.organizationId,table.userId]}),index('organization_members_user').on(table.userId),check('organization_role_valid',sql`${table.role} IN ('owner','admin','billing_admin','member','viewer')`)]);
export const organizationInvitations = sqliteTable('organization_invitations', {
 id:text('id').primaryKey(), organizationId:text('organization_id').notNull().references(()=>organizations.id,{onDelete:'cascade'}),
 email:text('email').notNull(), role:text('role',{enum:['admin','billing_admin','member','viewer']}).notNull(),
 tokenHash:text('token_hash').notNull().unique(), expiresAt:integer('expires_at').notNull(), createdAt:integer('created_at').notNull(),
},table=>[uniqueIndex('organization_invitation_recipient').on(table.organizationId,table.email),check('invitation_role_valid',sql`${table.role} IN ('admin','billing_admin','member','viewer')`)]);
export const organizationAuditLogs = sqliteTable('organization_audit_logs', {
 id:text('id').primaryKey(),organizationId:text('organization_id').notNull().references(()=>organizations.id,{onDelete:'cascade'}),
 actorId:text('actor_id').notNull().references(()=>users.id),action:text('action').notNull(),targetId:text('target_id').notNull(),createdAt:integer('created_at').notNull(),
},table=>[index('organization_audit_time').on(table.organizationId,table.createdAt)]);

// Authoritative SDK session store. Tombstones prevent late writes restoring revoked sessions.
export const authSessions = sqliteTable('auth_sessions', {
 id:text('id').primaryKey(), issuer:text('issuer').notNull(), accountId:text('account_id').notNull(),
 subject:text('subject').notNull(), providerSid:text('provider_sid'), payload:text('payload').notNull(),
 expiresAt:integer('expires_at').notNull(), absoluteExpiresAt:integer('absolute_expires_at').notNull(),
 createdAt:integer('created_at').notNull(),lastSeenAt:integer('last_seen_at').notNull(),revokedAt:integer('revoked_at'),
},table=>[index('auth_sessions_account').on(table.accountId),index('auth_sessions_provider').on(table.issuer,table.providerSid),index('auth_sessions_expiry').on(table.absoluteExpiresAt)]);

// Durable webhook acceptance and retryable dispatch (the inbox also acts as an outbox).
export const billingInbox = sqliteTable('billing_inbox', {
 id:text('id').primaryKey(),payload:text('payload').notNull(),state:text('state',{enum:['pending','complete','failed']}).notNull().default('pending'),
 attempts:integer('attempts').notNull().default(0),dispatchAfter:integer('dispatch_after').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0),
 leaseToken:text('lease_token'),receivedAt:integer('received_at').notNull(),processedAt:integer('processed_at'),lastError:text('last_error'),
},table=>[index('billing_inbox_due').on(table.state,table.dispatchAfter)]);
