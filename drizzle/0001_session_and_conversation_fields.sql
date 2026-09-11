ALTER TABLE `sessions` ADD COLUMN `provenance` text DEFAULT '{}' NOT NULL;
ALTER TABLE `sessions` ADD COLUMN `language_selected` integer DEFAULT 0 NOT NULL;
ALTER TABLE `sessions` ADD COLUMN `voice_profile` text;
ALTER TABLE `applications` ADD COLUMN `decision_snapshot` text DEFAULT '{}' NOT NULL;
ALTER TABLE `applications` ADD COLUMN `scheme_version` text DEFAULT '' NOT NULL;
ALTER TABLE `applications` ADD COLUMN `conversation_id` text;

CREATE TABLE IF NOT EXISTS `voice_preferences` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `language` text DEFAULT 'en' NOT NULL,
  `selected` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`owner`) REFERENCES `sessions`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `voice_preferences_owner_idx`
  ON `voice_preferences` (`owner`);

CREATE TABLE IF NOT EXISTS `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `owner` text NOT NULL,
  `language` text DEFAULT 'en' NOT NULL,
  `checkpoint` text DEFAULT 'GATHERING' NOT NULL,
  `focus_scheme_id` text,
  `title` text DEFAULT '' NOT NULL,
  `rolling_summary` text DEFAULT '' NOT NULL,
  `questions_asked` integer DEFAULT 0 NOT NULL,
  `asked_field` text DEFAULT '' NOT NULL,
  `turns` integer DEFAULT 0 NOT NULL,
  `declined_scheme_id` text,
  `declined_at_turn` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`owner`) REFERENCES `sessions`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `conversations_owner_idx`
  ON `conversations` (`owner`, `updated_at`);

CREATE TABLE IF NOT EXISTS `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `role` text NOT NULL,
  `text` text DEFAULT '' NOT NULL,
  `input_mode` text DEFAULT 'text' NOT NULL,
  `language` text,
  `blocks` text DEFAULT '[]' NOT NULL,
  `tool_calls` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `messages_conversation_idx`
  ON `messages` (`conversation_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `application_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL,
  `payload` text NOT NULL,
  `scheme_version` text NOT NULL,
  `decision_hash` text NOT NULL,
  `mode` text DEFAULT 'deterministic' NOT NULL,
  `generated_at` text NOT NULL,
  FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS `report_application_idx`
  ON `application_reports` (`application_id`);