ALTER TABLE `messages` ADD `language` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `language_selected` integer DEFAULT 0 NOT NULL;