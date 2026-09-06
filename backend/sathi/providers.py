"""Provider adapters: bounded calls, public evidence only."""
import os
from urllib.parse import urlparse
import httpx


def official_url(url):
    try:
        u = urlparse(url)
        return u.scheme == 'https' and not u.username and not u.password and (u.hostname.endswith('.gov.in') or u.hostname.endswith('.nic.in') or u.hostname in {'gov.in', 'nic.in'})
    except (AttributeError, ValueError):
        return False


async def request(method, url, **kwargs):
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()


class Evidence:
    @property
    def enabled(self):
        return all(os.getenv(x) for x in ('PINECONE_API_KEY', 'PINECONE_INDEX_HOST', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'))

    async def retrieve(self, scheme):
        if not self.enabled or scheme['reviewStatus'] != 'VERIFIED':
            return []
        endpoint = os.environ['AZURE_OPENAI_ENDPOINT'].rstrip('/')
        embedding = await request('POST', endpoint + '/openai/v1/embeddings', headers={'api-key': os.environ['AZURE_OPENAI_API_KEY']}, json={'model': os.environ['AZURE_OPENAI_EMBEDDING_DEPLOYMENT'], 'input': scheme['name'] + ' eligibility documents application'})
        result = await request('POST', os.environ['PINECONE_INDEX_HOST'].rstrip('/') + '/query', headers={'Api-Key': os.environ['PINECONE_API_KEY']}, json={'namespace': 'schemes-reviewed', 'vector': embedding['data'][0]['embedding'], 'topK': 5, 'includeMetadata': True, 'filter': {'scheme_id': {'$eq': scheme['id']}, 'version': {'$eq': scheme['version']}, 'review_status': {'$eq': 'VERIFIED'}}})
        chunks = []
        for match in result.get('matches', []):
            meta = match.get('metadata', {})
            if official_url(meta.get('source_url', '')) and meta.get('version') == scheme['version'] and meta.get('scheme_id') == scheme['id'] and meta.get('review_status') == 'VERIFIED':
                chunks.append({'id': match['id'], 'text': str(meta.get('text', ''))[:2500], 'source': meta['source_url'], 'score': match.get('score')})
        return chunks


async def discover_sources(query):
    if not os.getenv('YOU_API_KEY'):
        return {'configured': False, 'candidates': []}
    result = await request('GET', 'https://ydc-index.io/v1/search', headers={'X-API-Key': os.environ['YOU_API_KEY']}, params={'query': query + ' site:gov.in', 'count': 10})
    hits = result.get('results', {}).get('web', [])
    return {'configured': True, 'candidates': [{'url': h['url'], 'title': h.get('title', '')} for h in hits if official_url(h.get('url', ''))]}
