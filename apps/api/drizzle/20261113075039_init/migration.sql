CREATE TABLE `engagements` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`client` text,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY,
	`engagement_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`target` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_notes_engagement_id_engagements_id_fk` FOREIGN KEY (`engagement_id`) REFERENCES `engagements`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY,
	`engagement_id` text NOT NULL,
	`tool` text NOT NULL,
	`target` text NOT NULL,
	`started_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`status` text NOT NULL,
	`error_status` integer,
	`error_message` text,
	`input` text NOT NULL,
	`result` text,
	`findings` text DEFAULT '[]' NOT NULL,
	`fail` integer DEFAULT 0 NOT NULL,
	`warn` integer DEFAULT 0 NOT NULL,
	`pass` integer DEFAULT 0 NOT NULL,
	`info` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `fk_runs_engagement_id_engagements_id_fk` FOREIGN KEY (`engagement_id`) REFERENCES `engagements`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `scope_entries` (
	`id` text PRIMARY KEY,
	`engagement_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`excluded` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT `fk_scope_entries_engagement_id_engagements_id_fk` FOREIGN KEY (`engagement_id`) REFERENCES `engagements`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`mfa` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `notes_engagement_idx` ON `notes` (`engagement_id`);--> statement-breakpoint
CREATE INDEX `runs_engagement_started_idx` ON `runs` (`engagement_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `runs_tool_target_idx` ON `runs` (`engagement_id`,`tool`,`target`);--> statement-breakpoint
CREATE INDEX `scope_engagement_idx` ON `scope_entries` (`engagement_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);