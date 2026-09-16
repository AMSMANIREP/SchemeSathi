import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Capture/backfill triggers are maintained in 0007_storage_mirror.sql.
export const storageSyncConfig = sqliteTable('storage_sync_config', {
  id: integer('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  enabled: integer('enabled').notNull().default(0),
});
export const storageOutbox = sqliteTable(
  'storage_outbox',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    owner: text('owner').notNull(),
    operation: text('operation').notNull(),
    payload: text('payload').notNull(),
  },
  (t) => [uniqueIndex('storage_outbox_entity_idx').on(t.entity, t.entityId)],
);
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    profile: text('profile').notNull().default('{}'),
    confirmed: text('confirmed').notNull().default('[]'),
    // field -> 'answered' | 'entered' | 'inferred'. `confirmed` stays the
    // authority for eligibility; this is what /profile renders.
    provenance: text('provenance').notNull().default('{}'),
    version: integer('version').notNull().default(0),
    language: text('language').notNull().default('en'),
    languageSelected: integer('language_selected').notNull().default(0),
    voiceProfile: text('voice_profile'),
    consent: integer('consent').notNull().default(0),
    checkpoint: text('checkpoint').notNull().default('START'),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('sessions_token_idx').on(t.tokenHash)],
);
export const voicePreferences = sqliteTable(
  'voice_preferences',
  {
    id: text('id').primaryKey(),
    owner: text('owner')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    language: text('language').notNull().default('en'),
    selected: integer('selected').notNull().default(0),
  },
  (t) => [index('voice_preferences_owner_idx').on(t.owner)],
);
export const storageLegacyImports = sqliteTable('storage_legacy_imports', {
  owner: text('owner')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
});
export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    owner: text('owner')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    schemeId: text('scheme_id').notNull(),
    status: text('status').notNull().default('Interested'),
    reference: text('reference').notNull().default(''),
    notes: text('notes').notNull().default(''),
    checklist: text('checklist').notNull().default('[]'),
    // Frozen at save time so a printed report cannot silently disagree with
    // itself after the citizen edits their profile.
    decisionSnapshot: text('decision_snapshot').notNull().default('{}'),
    schemeVersion: text('scheme_version').notNull().default(''),
    conversationId: text('conversation_id'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('application_owner_scheme').on(t.owner, t.schemeId)],
);
export const feedback = sqliteTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('feedback_owner_idx').on(t.owner)],
);
export const schemeReviews = sqliteTable('scheme_reviews', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  reviewer: text('reviewer').notNull(),
  createdAt: text('created_at').notNull(),
});
export const requestLimits = sqliteTable('request_limits', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(),
  event: text('event').notNull(),
  schemeId: text('scheme_id'),
  createdAt: text('created_at').notNull(),
});
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    owner: text('owner')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    language: text('language').notNull().default('en'),
    // GATHERING | ASKED | PRESENTED | NARROWED | SAVE_OFFERED | SAVED | REPORT_READY
    checkpoint: text('checkpoint').notNull().default('GATHERING'),
    focusSchemeId: text('focus_scheme_id'),
    title: text('title').notNull().default(''),
    rollingSummary: text('rolling_summary').notNull().default(''),
    // Caps interrogation: two questions, then present what we have.
    questionsAsked: integer('questions_asked').notNull().default(0),
    // The field the last assistant turn asked about. A reply while this is
    // set counts as a direct answer, so it is confirmed rather than inferred.
    askedField: text('asked_field').notNull().default(''),
    // Turn counter and decline memory, so a save offer that was turned down
    // is not repeated at the citizen on the very next turn.
    turns: integer('turns').notNull().default(0),
    declinedSchemeId: text('declined_scheme_id'),
    declinedAtTurn: integer('declined_at_turn').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('conversations_owner_idx').on(t.owner, t.updatedAt)],
);
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    text: text('text').notNull().default(''),
    inputMode: text('input_mode').notNull().default('text'),
    language: text('language'),
    blocks: text('blocks').notNull().default('[]'),
    toolCalls: text('tool_calls').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);
export const applicationReports = sqliteTable(
  'application_reports',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    payload: text('payload').notNull(),
    // Regenerate when either drifts — never swap silently under a document
    // someone may already have printed.
    schemeVersion: text('scheme_version').notNull(),
    decisionHash: text('decision_hash').notNull(),
    mode: text('mode').notNull().default('deterministic'),
    generatedAt: text('generated_at').notNull(),
  },
  (t) => [uniqueIndex('report_application_idx').on(t.applicationId)],
);
