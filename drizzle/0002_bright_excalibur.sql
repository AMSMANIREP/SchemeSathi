CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`checkpoint` text DEFAULT 'GATHERING' NOT NULL,
	`focus_scheme_id` text,
	`title` text DEFAULT '' NOT NULL,
	`rolling_summary` text DEFAULT '' NOT NULL,
	`questions_asked` integer DEFAULT 0 NOT NULL,
	`asked_field` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conversations_owner_idx` ON `conversations` (`owner`,`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`input_mode` text DEFAULT 'text' NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`tool_calls` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);