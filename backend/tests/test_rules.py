import json
from pathlib import Path
from datetime import datetime, timezone
import pytest
from sathi.rules import evaluate_scheme
from sathi.providers import official_url

DATA = json.loads((Path(__file__).resolve().parents[2] / 'tests/rule-cases.json').read_text(encoding='utf-8'))

@pytest.mark.parametrize('case', DATA['cases'], ids=lambda c:str(c['id']))
def test_cross_runtime_regression(case):
    scheme = {**DATA['scheme'], 'reviewStatus': 'VERIFIED' if case['reviewed'] else 'DRAFT'}
    assert evaluate_scheme(scheme, case['profile'], case['confirmed'], datetime(2026,9,6,12,tzinfo=timezone.utc))['status'] == case['expected']

@pytest.mark.parametrize('url',['http://pmkisan.gov.in','https://pmkisan.gov.in.evil.com','https://user:pass@pmkisan.gov.in','javascript:alert(1)','https://127.0.0.1'])
def test_source_allowlist(url):
    assert not official_url(url)
