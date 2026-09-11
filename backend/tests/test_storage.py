import asyncio
import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from sathi.app import app
from sathi.storage import PostgresStorage, StorageBatch, StorageEvent

OWNER = '12345678-1234-4234-9234-123456789012'
APP_ID = '12345678-1234-4234-9234-123456789020'
SOURCE = 'a' * 32


def profile_event(sequence=1, age=45):
    return {'sequence': sequence, 'entity': 'profile', 'entity_id': OWNER, 'owner': OWNER, 'operation': 'upsert', 'payload': {
        'id': OWNER, 'profile': {'age': age}, 'confirmed': ['age'], 'provenance': {'age': 'entered'},
        'version': sequence, 'language': 'en', 'language_selected': 1, 'consent': 0,
        'checkpoint': 'PROFILE_CONFIRMED', 'expires_at': 9999999999999, 'created_at': 1,
    }}


def application_event(sequence=2):
    return {'sequence': sequence, 'entity': 'application', 'entity_id': APP_ID, 'owner': OWNER, 'operation': 'upsert', 'payload': {
        'id': APP_ID, 'owner': OWNER, 'scheme_id': 'pm-kisan', 'status': 'Submitted', 'reference': '•••• 1234',
        'notes': 'Synthetic test', 'checklist': ['Identity proof'], 'decision_snapshot': {'status': 'UNABLE_TO_DETERMINE'},
        'scheme_version': 'v1', 'conversation_id': None, 'updated_at': '2026-09-12T00:00:00Z',
    }}


def batch(*events):
    return StorageBatch(source_id=SOURCE, events=list(events))


def deletion(entity, entity_id, sequence):
    return {'sequence': sequence, 'entity': entity, 'entity_id': entity_id, 'owner': OWNER, 'operation': 'delete', 'payload': {}}


def test_storage_contract_rejects_mismatched_owners_and_personal_delete_payloads():
    event = application_event()
    event['payload']['owner'] = str(uuid4())
    with pytest.raises(ValidationError):
        StorageEvent.model_validate(event)
    event = deletion('profile', OWNER, 3)
    event['payload'] = {'profile': {'age': 45}}
    with pytest.raises(ValidationError):
        StorageEvent.model_validate(event)
    event = profile_event()
    event['payload']['token_hash'] = 'not-part-of-profile-contract'
    with pytest.raises(ValidationError):
        StorageEvent.model_validate(event)


def test_storage_endpoints_require_authentication_and_real_postgres(monkeypatch):
    monkeypatch.setenv('STORAGE_MODE', 'catalogue')
    monkeypatch.setenv('SERVICE_API_KEY', 'synthetic-storage-test-key')
    with TestClient(app) as client:
        request = batch(profile_event()).model_dump()
        assert client.post('/v1/storage/sync', json=request).status_code == 401
        headers = {'Authorization': 'Bearer synthetic-storage-test-key'}
        assert client.post('/v1/storage/sync', json=request, headers=headers).status_code == 503
        assert client.get('/v1/profiles/' + OWNER).status_code == 401
        assert client.get('/v1/profiles/' + OWNER, headers=headers).status_code == 503


@pytest.mark.skipif(os.getenv('RUN_POSTGRES_STORAGE_TESTS') != '1', reason='Explicit opt-in; uses an isolated temporary PostgreSQL schema')
def test_postgres_storage_delivery_order_rollback_and_deletion():
    from psycopg import AsyncConnection, sql
    from psycopg_pool import AsyncConnectionPool

    async def scenario():
        url = os.environ['DATABASE_URL']
        schema = 'storage_test_' + uuid4().hex
        async with await AsyncConnection.connect(url, autocommit=True) as admin:
            await admin.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
            try:
                async with AsyncConnectionPool(url, kwargs={'autocommit': True, 'options': '-c search_path=' + schema}, open=False) as pool:
                    async with pool.connection() as connection:
                        root = Path(__file__).resolve().parents[1]
                        for migration in sorted((root / 'migrations').glob('*.sql')):
                            await connection.execute(migration.read_text(encoding='utf-8'))
                    store = PostgresStorage(pool)
                    await store.apply(batch(profile_event(), application_event()))
                    await store.apply(batch(profile_event(), application_event()))
                    assert (await store.profile(OWNER))['profile']['age'] == 45

                    async def application():
                        async with pool.connection() as connection:
                            return await (await connection.execute('SELECT id,status,decision_snapshot FROM applications WHERE owner=%s', (OWNER,))).fetchall()

                    assert len(await application()) == 1
                    assert (await application())[0][2]['status'] == 'UNABLE_TO_DETERMINE'
                    changed = application_event(4)
                    changed['payload']['status'] = 'Approved'
                    await store.apply(batch(profile_event(3, 50), changed))
                    await store.apply(batch(profile_event(1, 20), application_event(2)))
                    assert (await store.profile(OWNER))['profile']['age'] == 50
                    assert (await application())[0][1] == 'Approved'

                    # A failed event rolls back all earlier writes in its batch.
                    conflicting = application_event(6)
                    conflicting['owner'] = conflicting['payload']['owner'] = str(uuid4())
                    with pytest.raises(Exception):
                        await store.apply(batch(profile_event(5, 70), conflicting))
                    assert (await store.profile(OWNER))['profile']['age'] == 50

                    await store.apply(batch(deletion('application', APP_ID, 7)))
                    await store.apply(batch(changed))
                    assert await application() == []
                    await store.apply(batch(application_event(8)))
                    await store.apply(batch(deletion('profile', OWNER, 9)))
                    # Owner tombstones also reject newer late application writes.
                    await store.apply(batch(profile_event(10), application_event(11)))
                    assert await store.profile(OWNER) is None
                    assert await application() == []
            finally:
                await admin.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))
    asyncio.run(scenario())
