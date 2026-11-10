CREATE TABLE `billing_inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`dispatch_after` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `billing_inbox_due` ON `billing_inbox` (`state`,`dispatch_after`);