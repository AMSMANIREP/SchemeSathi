import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
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
    consent: integer('consent').notNull().default(0),
    checkpoint: text('checkpoint').notNull().default('START'),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('sessions_token_idx').on(t.tokenHash)],
);
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
    blocks: text('blocks').notNull().default('[]'),
    toolCalls: text('tool_calls').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt)],
);
