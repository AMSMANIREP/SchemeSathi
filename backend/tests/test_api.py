import os
os.environ['STORAGE_MODE'] = 'catalogue'
os.environ['SERVICE_API_KEY'] = 'synthetic-test-only-key'
from fastapi.testclient import TestClient
from sathi.app import app

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
        assert all(r['status'] == 'UNABLE_TO_DETERMINE' for r in result.json()['results'])
        payload['profile']['age'] = -1
        assert c.post('/v1/evaluate',json=payload,headers=headers).status_code == 422
