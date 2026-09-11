from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
import hmac
import json
import os
from uuid import UUID, uuid4
from typing import Literal
from fastapi import FastAPI, HTTPException, Depends, Query, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .graph import build_graph
from .providers import Evidence, discover_sources
from .rules import evaluate_scheme

CATALOGUE = Path(__file__).resolve().parents[2] / 'data' / 'schemes.json'


@asynccontextmanager
async def lifespan(app):
    if not os.getenv('SERVICE_API_KEY'):
        raise RuntimeError('SERVICE_API_KEY is required.')
    async with AsyncExitStack() as stack:
        app.state.pool = None
        app.state.checkpointer = None
        app.state.applications = {}
        if os.getenv('STORAGE_MODE', 'postgres') == 'postgres':
            from psycopg_pool import AsyncConnectionPool
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            pool = AsyncConnectionPool(os.environ['DATABASE_URL'], kwargs={'autocommit': True}, open=False)
            await stack.enter_async_context(pool)
            saver = await stack.enter_async_context(AsyncPostgresSaver.from_conn_string(os.environ['DATABASE_URL']))
            app.state.pool, app.state.checkpointer = pool, saver
        app.state.graph = build_graph(app.state.checkpointer)
        yield


app = FastAPI(title='Scheme Sathi rules and evidence service', version='1.0.0', lifespan=lifespan)
bearer_scheme = HTTPBearer(auto_error=False)


def authorize(credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme)):
    key = os.getenv('SERVICE_API_KEY', '')
    if not key or not credentials or credentials.scheme.lower() != 'bearer' or not hmac.compare_digest(credentials.credentials, key):
        raise HTTPException(401, 'Service authentication required')


class Evaluate(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sessionId: str = Field(max_length=80)
    profile: dict[str, str | int | float | bool | None]
    confirmed: list[str] = Field(max_length=13)
    profileVersion: int = Field(ge=1)

    @field_validator('sessionId')
    @classmethod
    def owner(cls, value):
        UUID(value)
        return value

    @field_validator('profile')
    @classmethod
    def profile_values(cls, value):
        allowed = {'age','state','occupation','gender','income','category','residence','land','bpl','lpg','bank','taxpayer','disability'}
        if not set(value).issubset(allowed):
            raise ValueError('Unsupported profile fields')
        bounds = {'age': 120, 'income': 1e9, 'land': 1e5, 'disability': 100}
        for k, v in value.items():
            if v is None:
                continue
            if k in bounds and (type(v) not in (int, float) or not 0 <= v <= bounds[k] or (k == 'age' and v != int(v))):
                raise ValueError('Invalid numeric profile field')
            if k not in bounds and (not isinstance(v, str) or len(v) > 80):
                raise ValueError('Invalid profile text')
        return value

    @model_validator(mode='after')
    def confirmed_values(self):
        if not set(self.confirmed).issubset(self.profile):
            raise ValueError('Confirmed fields must exist in the profile')
        return self


async def catalogue():
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            rows = await (await connection.execute('SELECT payload FROM schemes ORDER BY id')).fetchall()
            return [r[0] for r in rows]
    return json.loads(CATALOGUE.read_text(encoding='utf-8'))


def validate_owner(session_id):
    try:
        UUID(session_id)
    except (AttributeError, ValueError):
        raise HTTPException(422, 'sessionId must be a UUID')
    return session_id


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sessionId: str = Field(max_length=80)
    schemeId: str = Field(min_length=1, max_length=120)

    @field_validator('sessionId')
    @classmethod
    def valid_session(cls, value):
        return validate_owner(value)


class ApplicationPatch(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sessionId: str = Field(max_length=80)
    status: Literal['Interested', 'Preparing documents', 'Submitted', 'Under review', 'Action required', 'Approved', 'Closed'] | None = None
    reference: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=600)
    checklist: list[str] | None = Field(default=None, max_length=20)

    @field_validator('sessionId')
    @classmethod
    def valid_session(cls, value):
        return validate_owner(value)

    @field_validator('checklist')
    @classmethod
    def valid_checklist(cls, value):
        if value is None:
            return value
        if any(len(item) > 400 for item in value) or len(set(value)) != len(value):
            raise ValueError('Invalid checklist')
        return value


def application_response(application):
    return {
        'id': application['id'],
        'schemeId': application['schemeId'],
        'status': application['status'],
        'reference': application['reference'],
        'notes': application['notes'],
        'checklist': application['checklist'],
        'updatedAt': application['updatedAt'],
    }


def decode_checklist(value):
    return json.loads(value) if isinstance(value, str) else value


async def application_rows(owner):
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            rows = await (await connection.execute(
                'SELECT id, scheme_id, status, reference, notes, checklist, updated_at FROM applications WHERE owner=%s ORDER BY updated_at DESC',
                (owner,),
            )).fetchall()
        return [application_response({
            'id': row[0], 'schemeId': row[1], 'status': row[2],
            'reference': row[3], 'notes': row[4], 'checklist': decode_checklist(row[5]),
            'updatedAt': row[6].isoformat() if hasattr(row[6], 'isoformat') else row[6],
        }) for row in rows]
    return [application_response(value) for value in app.state.applications.values() if value['owner'] == owner]


async def application_row(application_id, owner):
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            row = await (await connection.execute(
                'SELECT id, scheme_id, status, reference, notes, checklist, updated_at FROM applications WHERE id=%s AND owner=%s',
                (application_id, owner),
            )).fetchone()
        if not row:
            return None
        return {'id': row[0], 'schemeId': row[1], 'status': row[2], 'reference': row[3], 'notes': row[4], 'checklist': decode_checklist(row[5]), 'updatedAt': row[6].isoformat() if hasattr(row[6], 'isoformat') else row[6]}
    value = app.state.applications.get(application_id)
    return value if value and value['owner'] == owner else None


@app.get('/health/live')
async def live():
    return {'status': 'ok'}


@app.get('/health/ready')
async def ready():
    try:
        return {'status': 'ok', 'catalogue': len(await catalogue()), 'storage': 'postgres' if app.state.pool else 'local_catalogue'}
    except Exception:
        raise HTTPException(503, 'Database unavailable')


@app.get('/v1/schemes', dependencies=[Depends(authorize)])
async def schemes():
    return {'schemes': await catalogue()}


@app.get('/v1/schemes/{scheme_id}', dependencies=[Depends(authorize)])
async def scheme(scheme_id: str):
    value = next((item for item in await catalogue() if item['id'] == scheme_id), None)
    if not value:
        raise HTTPException(404, 'Scheme not found')
    return value


@app.get('/v1/recommendations', dependencies=[Depends(authorize)])
async def recommendations(
    profile: str = Query(default='{}'),
    confirmed: str = Query(default='[]'),
    profileVersion: int = Query(default=1, ge=1),
):
    try:
        profile_value = json.loads(profile)
        confirmed_value = json.loads(confirmed)
        request = Evaluate(
            sessionId='12345678-1234-4234-9234-123456789012',
            profile=profile_value,
            confirmed=confirmed_value,
            profileVersion=profileVersion,
        )
    except (json.JSONDecodeError, TypeError, ValueError) as error:
        raise HTTPException(422, f'Invalid recommendation inputs: {error}')
    results = [evaluate_scheme(item, request.profile, request.confirmed) for item in await catalogue()]
    return {'profileVersion': request.profileVersion, 'results': results}


@app.post('/v1/applications', status_code=201, dependencies=[Depends(authorize)])
async def create_application(request: ApplicationCreate):
    scheme = next((item for item in await catalogue() if item['id'] == request.schemeId), None)
    if not scheme:
        raise HTTPException(400, 'Unknown scheme.')
    existing = next((item for item in await application_rows(request.sessionId) if item['schemeId'] == request.schemeId), None)
    if existing:
        return {'saved': True, 'application': existing}
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    record = {'id': str(uuid4()), 'owner': request.sessionId, 'schemeId': request.schemeId, 'status': 'Interested', 'reference': '', 'notes': '', 'checklist': [], 'updatedAt': now}
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            await connection.execute('INSERT INTO applications (id, owner, scheme_id, updated_at) VALUES (%s, %s, %s, %s) ON CONFLICT (owner, scheme_id) DO NOTHING', (record['id'], record['owner'], record['schemeId'], now))
    else:
        app.state.applications[record['id']] = record
    return {'saved': True, 'application': application_response(record)}


@app.get('/v1/applications', dependencies=[Depends(authorize)])
async def get_applications(sessionId: str = Query(...)):
    owner = validate_owner(sessionId)
    return {'applications': await application_rows(owner)}


@app.patch('/v1/applications/{application_id}', dependencies=[Depends(authorize)])
async def update_application(application_id: str, request: ApplicationPatch):
    existing = await application_row(application_id, request.sessionId)
    if not existing:
        raise HTTPException(404, 'Application record not found.')
    scheme = next(item for item in await catalogue() if item['id'] == existing['schemeId'])
    checklist = request.checklist if request.checklist is not None else existing['checklist']
    if any(item not in scheme.get('documents', []) for item in checklist):
        raise HTTPException(400, 'Choose checklist items from this scheme.')
    reference_value = request.reference if request.reference is not None else existing['reference']
    reference = '.... ' + ''.join(character for character in reference_value if character.isalnum())[-4:] if reference_value else ''
    status = request.status if request.status is not None else existing['status']
    notes = request.notes if request.notes is not None else existing['notes']
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            await connection.execute('UPDATE applications SET status=%s, reference=%s, notes=%s, checklist=%s, updated_at=%s WHERE id=%s AND owner=%s', (status, reference, notes, json.dumps(checklist), now, application_id, request.sessionId))
    else:
        app.state.applications[application_id].update(status=status, reference=reference, notes=notes, checklist=checklist, updatedAt=now)
    return {'saved': True}


@app.delete('/v1/applications/{application_id}', dependencies=[Depends(authorize)])
async def delete_application(application_id: str, sessionId: str = Query(...)):
    owner = validate_owner(sessionId)
    if not await application_row(application_id, owner):
        raise HTTPException(404, 'Application record not found.')
    if app.state.pool:
        async with app.state.pool.connection() as connection:
            await connection.execute('DELETE FROM applications WHERE id=%s AND owner=%s', (application_id, owner))
    else:
        del app.state.applications[application_id]
    return {'deleted': True}


@app.post('/v1/evaluate', dependencies=[Depends(authorize)])
async def evaluate(request: Evaluate):
    thread = request.sessionId + ':' + str(uuid4())
    try:
        result = await app.state.graph.ainvoke({'profile': request.profile, 'confirmed': request.confirmed, 'schemes': await catalogue()}, {'configurable': {'thread_id': thread}, 'recursion_limit': 8})
        return {'profileVersion': request.profileVersion, 'results': result['results'], 'trajectory': result['trajectory']}
    finally:
        # Eligibility is rerunnable; discard personal graph state after the response.
        if app.state.checkpointer:
            await app.state.checkpointer.adelete_thread(thread)


@app.get('/v1/evidence/{scheme_id}', dependencies=[Depends(authorize)])
async def evidence(scheme_id: str):
    s = next((s for s in await catalogue() if s['id'] == scheme_id), None)
    if not s:
        raise HTTPException(404, 'Scheme not found')
    try:
        return {'schemeId': scheme_id, 'version': s['version'], 'evidence': await Evidence().retrieve(s)}
    except Exception:
        raise HTTPException(503, 'Evidence provider unavailable')


class Discovery(BaseModel):
    query: str = Field(min_length=3, max_length=200)


@app.post('/v1/admin/discover', dependencies=[Depends(authorize)])
async def discover(request: Discovery):
    try:
        return await discover_sources(request.query)
    except Exception:
        raise HTTPException(503, 'Source discovery unavailable')
