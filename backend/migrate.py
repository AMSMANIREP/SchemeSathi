"""Explicit release migration. Never execute DDL inside request handlers."""
import asyncio
import json
import os
from pathlib import Path
from psycopg import AsyncConnection
from psycopg.types.json import Jsonb
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def main():
    url = os.environ['DATABASE_URL']
    root = Path(__file__).resolve().parent
    async with await AsyncConnection.connect(url, autocommit=True) as conn:
        await conn.execute((root / 'migrations/001_initial.sql').read_text(encoding='utf-8'))
        for scheme in json.loads((root.parent / 'data/schemes.json').read_text()):
            await conn.execute('INSERT INTO schemes(id,payload,version) VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (scheme['id'], Jsonb(scheme), scheme['version']))
    async with AsyncPostgresSaver.from_conn_string(url) as saver:
        await saver.setup()

if __name__ == '__main__':
    asyncio.run(main())
