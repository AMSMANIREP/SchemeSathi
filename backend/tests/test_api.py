import os
import json
os.environ['STORAGE_MODE'] = 'catalogue'
os.environ['SERVICE_API_KEY'] = 'synthetic-test-only-key'
from fastapi.testclient import TestClient
from sathi.app import app, CATALOGUE

def test_api_graph_and_access():
    with TestClient(app) as c:
        assert c.get('/health/ready').json()['catalogue'] == 50
        payload = {'sessionId':'12345678-1234-4234-9234-123456789012','profile':{'age':40},'confirmed':['age'],'profileVersion':1}
        assert c.post('/v1/evaluate',json=payload).status_code == 401
        headers = {'Authorization':'Bearer synthetic-test-only-key'}
        result = c.post('/v1/evaluate',json=payload,headers=headers)
        assert result.status_code == 200
        assert result.json()['trajectory'] == ['validate_confirmed_profile','deterministic_rules','verify_citations','prepare_response']
        assert len(result.json()['results']) == 50
        records = {s['id']: s for s in json.loads(CATALOGUE.read_text(encoding='utf-8'))}
        drafts = [r for r in result.json()['results'] if records[r['schemeId']]['reviewStatus'] == 'DRAFT']
        assert drafts, 'The test must exercise unreviewed records'
        assert all(r['status'] == 'UNABLE_TO_DETERMINE' for r in drafts)
        for decision in result.json()['results']:
            if decision['status'] != 'UNABLE_TO_DETERMINE':
                record = records[decision['schemeId']]
                assert record['reviewStatus'] == 'VERIFIED' and record['complete']
                assert record.get('authoredFor') == 'demo', 'Demonstration verdicts must retain their provenance'
        payload['profile']['age'] = -1
        assert c.post('/v1/evaluate',json=payload,headers=headers).status_code == 422
