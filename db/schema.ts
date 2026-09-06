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
