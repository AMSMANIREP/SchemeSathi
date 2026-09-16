CREATE TABLE `voice_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`selected` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `voice_preferences_owner_idx` ON `voice_preferences` (`owner`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `voice_profile` text;