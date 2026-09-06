from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
import hmac
import json
import os
from uuid import UUID, uuid4
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .graph import build_graph
from .providers import Evidence, discover_sources

CATALOGUE = Path(__file__).resolve().parents[2] / 'data' / 'schemes.json'


@asynccontextmanager
async def lifespan(app):
    if not os.getenv('SERVICE_API_KEY'):
        raise RuntimeError('SERVICE_API_KEY is required.')
    async with AsyncExitStack() as stack:
        app.state.pool = None
        app.state.checkpointer = None
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


def authorize(authorization: str = Header(default='')):
    key = os.getenv('SERVICE_API_KEY', '')
    if not key or not hmac.compare_digest(authorization, 'Bearer ' + key):
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


@app.get('/health/live')
async def live():
    return {'status': 'ok'}


@app.get('/health/ready')
async def ready():
    try:
        return {'status': 'ok', 'catalogue': len(await catalogue()), 'storage': 'postgres' if app.state.pool else 'local_catalogue'}
    except Exception:
        raise HTTPException(503, 'Database unavailable')


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
