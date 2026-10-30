// Durable last-valid public-data snapshots and refresh bookkeeping.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
