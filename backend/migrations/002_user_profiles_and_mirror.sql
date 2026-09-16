CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  language_selected INTEGER NOT NULL DEFAULT 0,
  consent INTEGER NOT NULL DEFAULT 0,
  checkpoint TEXT NOT NULL DEFAULT 'START',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_profiles_expiry_idx ON user_profiles(expires_at);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS scheme_version TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- Versions survive deletes, so retries and out-of-order deliveries cannot
-- resurrect deleted records. These contain identifiers, never profile values.
CREATE TABLE IF NOT EXISTS storage_sync_versions (
  source_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(source_id, entity, entity_id)
);
