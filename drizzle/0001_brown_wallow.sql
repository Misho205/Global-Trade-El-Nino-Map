CREATE TABLE `billing_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`customer_id` text,
	`created_at` integer NOT NULL,
	`checkout_locked_until` integer DEFAULT 0 NOT NULL,
	`checkout_url` text,
	`checkout_plan` text,
	`checkout_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_accounts_customer_id_unique` ON `billing_accounts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `billing_subscriptions` (
	`account_id` text PRIMARY KEY NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`period_end` integer NOT NULL,
	`event_created` integer NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_subscriptions_stripe_subscription_id_unique` ON `billing_subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE TABLE `professional_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`period` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
