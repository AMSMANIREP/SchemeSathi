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
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  scheme_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Interested',
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner, scheme_id)
);
