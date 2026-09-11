ALTER TABLE `conversations` ADD `turns` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `declined_scheme_id` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `declined_at_turn` integer DEFAULT 0 NOT NULL;