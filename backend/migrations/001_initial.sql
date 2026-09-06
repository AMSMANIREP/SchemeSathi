CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  version TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS release_audit (
  id BIGSERIAL PRIMARY KEY,
  scheme_id TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  author TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
