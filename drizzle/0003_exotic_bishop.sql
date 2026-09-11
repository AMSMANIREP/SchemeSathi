CREATE TABLE `application_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`payload` text NOT NULL,
	`scheme_version` text NOT NULL,
	`decision_hash` text NOT NULL,
	`mode` text DEFAULT 'deterministic' NOT NULL,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_application_idx` ON `application_reports` (`application_id`);--> statement-breakpoint
ALTER TABLE `applications` ADD `decision_snapshot` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `scheme_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `conversation_id` text;