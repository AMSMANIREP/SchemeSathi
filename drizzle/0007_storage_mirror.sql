-- D1 remains authoritative. Queue changes atomically with their originating write.
-- No foreign keys here: deletion events must survive deletion of their owner.
CREATE TABLE IF NOT EXISTS storage_sync_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT OR IGNORE INTO storage_sync_config (id, source_id) VALUES (1, lower(hex(randomblob(16))));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS storage_outbox (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL CHECK (entity IN ('profile', 'application')),
  entity_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS storage_outbox_entity_idx ON storage_outbox(entity, entity_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS storage_legacy_imports (
  owner TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_sessions_insert
AFTER INSERT ON sessions
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='profile' AND entity_id=NEW.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('profile',NEW.id,NEW.id,'upsert',json_object('id', NEW.id, 'profile', json(NEW.profile), 'confirmed', json(NEW.confirmed), 'provenance', json(NEW.provenance), 'version', NEW.version, 'language', NEW.language, 'language_selected', NEW.language_selected, 'consent', NEW.consent, 'checkpoint', NEW.checkpoint, 'expires_at', NEW.expires_at, 'created_at', NEW.created_at));
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_sessions_update
AFTER UPDATE ON sessions
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='profile' AND entity_id=NEW.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('profile',NEW.id,NEW.id,'upsert',json_object('id', NEW.id, 'profile', json(NEW.profile), 'confirmed', json(NEW.confirmed), 'provenance', json(NEW.provenance), 'version', NEW.version, 'language', NEW.language, 'language_selected', NEW.language_selected, 'consent', NEW.consent, 'checkpoint', NEW.checkpoint, 'expires_at', NEW.expires_at, 'created_at', NEW.created_at));
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_sessions_delete
AFTER DELETE ON sessions
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='profile' AND entity_id=OLD.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('profile',OLD.id,OLD.id,'delete','{}');
  DELETE FROM storage_outbox WHERE owner=OLD.id AND operation='upsert';
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_applications_insert
AFTER INSERT ON applications
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='application' AND entity_id=NEW.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('application',NEW.id,NEW.owner,'upsert',json_object('id', NEW.id, 'owner', NEW.owner, 'scheme_id', NEW.scheme_id, 'status', NEW.status, 'reference', NEW.reference, 'notes', NEW.notes, 'checklist', json(NEW.checklist), 'decision_snapshot', json(NEW.decision_snapshot), 'scheme_version', NEW.scheme_version, 'conversation_id', NEW.conversation_id, 'updated_at', NEW.updated_at));
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_applications_update
AFTER UPDATE ON applications
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='application' AND entity_id=NEW.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('application',NEW.id,NEW.owner,'upsert',json_object('id', NEW.id, 'owner', NEW.owner, 'scheme_id', NEW.scheme_id, 'status', NEW.status, 'reference', NEW.reference, 'notes', NEW.notes, 'checklist', json(NEW.checklist), 'decision_snapshot', json(NEW.decision_snapshot), 'scheme_version', NEW.scheme_version, 'conversation_id', NEW.conversation_id, 'updated_at', NEW.updated_at));
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS mirror_applications_delete
AFTER DELETE ON applications
WHEN (SELECT enabled FROM storage_sync_config WHERE id=1)=1
BEGIN
  DELETE FROM storage_outbox WHERE entity='application' AND entity_id=OLD.id;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
  VALUES ('application',OLD.id,OLD.owner,'delete','{}');
END;
--> statement-breakpoint

-- Enabling/re-enabling dual storage captures existing D1 rows as well.
CREATE TRIGGER IF NOT EXISTS mirror_backfill
AFTER UPDATE OF enabled ON storage_sync_config
WHEN NEW.enabled=1 AND OLD.enabled=0
BEGIN
  DELETE FROM storage_outbox WHERE operation='upsert';
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
    SELECT 'profile',s.id,s.id,'upsert',json_object('id', s.id, 'profile', json(s.profile), 'confirmed', json(s.confirmed), 'provenance', json(s.provenance), 'version', s.version, 'language', s.language, 'language_selected', s.language_selected, 'consent', s.consent, 'checkpoint', s.checkpoint, 'expires_at', s.expires_at, 'created_at', s.created_at) FROM sessions s;
  INSERT INTO storage_outbox(entity,entity_id,owner,operation,payload)
    SELECT 'application',a.id,a.owner,'upsert',json_object('id', a.id, 'owner', a.owner, 'scheme_id', a.scheme_id, 'status', a.status, 'reference', a.reference, 'notes', a.notes, 'checklist', json(a.checklist), 'decision_snapshot', json(a.decision_snapshot), 'scheme_version', a.scheme_version, 'conversation_id', a.conversation_id, 'updated_at', a.updated_at) FROM applications a;
END;
--> statement-breakpoint
