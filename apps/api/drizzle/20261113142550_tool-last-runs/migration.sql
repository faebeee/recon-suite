CREATE TABLE `tool_last_runs` (
	`tool` text PRIMARY KEY,
	`id` text NOT NULL,
	`target` text NOT NULL,
	`input` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`duration_ms` integer,
	`result` text,
	`error_status` integer,
	`error_message` text,
	`engagement_id` text
);
