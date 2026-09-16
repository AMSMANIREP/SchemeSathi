"""PostgreSQL persistence, independent of Cloudflare and HTTP request handlers.

The sync protocol accepts domain snapshots, never SQL. The source's monotonic
sequence and durable tombstones make delivery safe to retry after a timeout.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from psycopg.types.json import Jsonb


class ProfileSnapshot(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    id: str
    profile: dict[str, str | int | float | bool | None]
    confirmed: list[str]
    provenance: dict[str, Literal['answered', 'entered', 'inferred']]
    version: int = Field(ge=0)
    language: Literal['en', 'hi', 'kn', 'ta', 'ml']
    language_selected: int = Field(ge=0, le=1)
    consent: int = Field(ge=0, le=1)
    checkpoint: str
    expires_at: int
    created_at: int


class ApplicationSnapshot(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    id: str
    owner: str
    scheme_id: str = Field(min_length=1, max_length=120)
    status: Literal['Interested', 'Preparing documents', 'Submitted', 'Under review', 'Action required', 'Approved', 'Closed']
    reference: str = Field(max_length=80)
    notes: str = Field(max_length=600)
    checklist: list[str] = Field(max_length=20)
    decision_snapshot: dict
    scheme_version: str
    conversation_id: str | None
    updated_at: str


class StorageEvent(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sequence: int = Field(gt=0)
    entity: Literal['profile', 'application']
    entity_id: str
    owner: str
    operation: Literal['upsert', 'delete']
    payload: dict

    @model_validator(mode='after')
    def validate_snapshot(self):
        UUID(self.owner)
        UUID(self.entity_id)
        if self.entity == 'profile' and self.entity_id != self.owner:
            raise ValueError('Profile owner mismatch')
        if self.operation == 'delete':
            if self.payload:
                raise ValueError('Deletion must not contain personal data')
            return self
        model = ProfileSnapshot if self.entity == 'profile' else ApplicationSnapshot
        snapshot = model.model_validate(self.payload)
        if snapshot.id != self.entity_id:
            raise ValueError('Snapshot ID mismatch')
        if self.entity == 'application':
            if snapshot.owner != self.owner:
                raise ValueError('Application owner mismatch')
            datetime.fromisoformat(snapshot.updated_at.replace('Z', '+00:00'))
        return self


class StorageBatch(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    source_id: str = Field(pattern=r'^[a-f0-9]{32}$')
    events: list[StorageEvent] = Field(min_length=1, max_length=100)


class PostgresStorage:
    def __init__(self, pool):
        self.pool = pool

    async def apply(self, batch: StorageBatch):
        async with self.pool.connection() as connection:
            async with connection.transaction():
                # Serialize by owner, including profile deletion vs application
                # saves. Lock in sorted order to avoid cross-batch deadlocks.
                for owner in sorted({event.owner for event in batch.events}):
                    await connection.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', (owner,))
                for event in sorted(batch.events, key=lambda item: item.sequence):
                    await self._apply_event(connection, batch.source_id, event)
        return [event.sequence for event in batch.events]

    async def _apply_event(self, connection, source, event):
        previous = await (await connection.execute(
            'SELECT sequence, deleted FROM storage_sync_versions WHERE source_id=%s AND entity=%s AND entity_id=%s',
            (source, event.entity, event.entity_id),
        )).fetchone()
        if previous and previous[0] >= event.sequence:
            return
        # A deleted session ID is never reused. Reject late snapshots even if
        # their sequence is newer (e.g. a concurrent application request).
        owner_deleted = await (await connection.execute(
            "SELECT 1 FROM storage_sync_versions WHERE source_id=%s AND entity='profile' AND entity_id=%s AND deleted",
            (source, event.owner),
        )).fetchone()
        if event.operation == 'upsert' and owner_deleted:
            return

        if event.operation == 'delete':
            if event.entity == 'profile':
                await connection.execute('DELETE FROM applications WHERE owner=%s', (event.owner,))
                await connection.execute('DELETE FROM user_profiles WHERE id=%s', (event.owner,))
            else:
                await connection.execute('DELETE FROM applications WHERE id=%s AND owner=%s', (event.entity_id, event.owner))
        elif event.entity == 'profile':
            await self.save_profile(connection, event.payload)
        else:
            await self.save_application(connection, event.payload)

        await connection.execute(
            'INSERT INTO storage_sync_versions(source_id,entity,entity_id,sequence,deleted) VALUES(%s,%s,%s,%s,%s) '
            'ON CONFLICT(source_id,entity,entity_id) DO UPDATE SET sequence=excluded.sequence,deleted=excluded.deleted',
            (source, event.entity, event.entity_id, event.sequence, event.operation == 'delete'),
        )

    async def save_profile(self, connection, value):
        await connection.execute(
            'INSERT INTO user_profiles(id,profile,confirmed,provenance,version,language,language_selected,consent,checkpoint,expires_at,created_at) '
            'VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET '
            'profile=excluded.profile,confirmed=excluded.confirmed,provenance=excluded.provenance,version=excluded.version,'
            'language=excluded.language,language_selected=excluded.language_selected,consent=excluded.consent,'
            'checkpoint=excluded.checkpoint,expires_at=excluded.expires_at,updated_at=now()',
            (value['id'], Jsonb(value['profile']), Jsonb(value['confirmed']), Jsonb(value['provenance']), value['version'],
             value['language'], value['language_selected'], value['consent'], value['checkpoint'], value['expires_at'], value['created_at']),
        )

    async def save_application(self, connection, value):
        # D1 is authoritative in dual mode. A pre-mirror PostgreSQL row for the
        # same owner/scheme adopts the D1 ID, so both databases share one key.
        await connection.execute(
            'INSERT INTO applications(id,owner,scheme_id,status,reference,notes,checklist,decision_snapshot,scheme_version,conversation_id,updated_at) '
            'VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(owner,scheme_id) DO UPDATE SET '
            'id=excluded.id,status=excluded.status,reference=excluded.reference,notes=excluded.notes,checklist=excluded.checklist,'
            'decision_snapshot=excluded.decision_snapshot,scheme_version=excluded.scheme_version,conversation_id=excluded.conversation_id,updated_at=excluded.updated_at',
            (value['id'], value['owner'], value['scheme_id'], value['status'], value['reference'], value['notes'], Jsonb(value['checklist']),
             Jsonb(value['decision_snapshot']), value['scheme_version'], value['conversation_id'], value['updated_at']),
        )

    async def profile(self, owner):
        from psycopg.rows import dict_row
        async with self.pool.connection() as connection:
            async with connection.cursor(row_factory=dict_row) as cursor:
                await cursor.execute('SELECT * FROM user_profiles WHERE id=%s', (owner,))
                return await cursor.fetchone()
