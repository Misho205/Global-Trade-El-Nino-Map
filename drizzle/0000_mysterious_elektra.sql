CREATE TABLE `data_snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text,
	`last_success` integer,
	`last_attempt` integer,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`error` text,
	`last_requested` integer DEFAULT 0 NOT NULL
);
