"""Deterministic eligibility. No model decides eligibility."""
from datetime import datetime, timezone


def evaluate_tree(tree, profile, confirmed):
    if 'all' in tree or 'any' in tree:
        conjunction = 'all' in tree
        results = [evaluate_tree(c, profile, confirmed) for c in tree.get('all' if conjunction else 'any', [])]
        values = [r[0] for r in results]
        if not values:
            return 'UNKNOWN', []
        if conjunction:
            result = 'FAIL' if 'FAIL' in values else 'PASS' if all(x == 'PASS' for x in values) else 'UNKNOWN'
        else:
            result = 'PASS' if 'PASS' in values else 'FAIL' if all(x == 'FAIL' for x in values) else 'UNKNOWN'
        return result, [reason for r in results for reason in r[1]]
    value, target, op = profile.get(tree['field']), tree['value'], tree['op']
    result = 'UNKNOWN'
    if value is not None and value != '' and tree['field'] in confirmed:
        match = None
        if op == 'eq':
            match = type(value) is type(target) and value == target
        elif op == 'neq':
            match = not (type(value) is type(target) and value == target)
        elif op == 'in' and isinstance(target, list):
            match = any(type(value) is type(t) and value == t for t in target)
        elif type(value) in (int, float) and type(target) in (int, float):
            match = {'gte': value >= target, 'lte': value <= target, 'gt': value > target, 'lt': value < target}.get(op)
        if match is not None:
            result = 'PASS' if match else 'FAIL'
    return result, [{**{k: tree[k] for k in ('id', 'field', 'label', 'source')}, 'result': result}]


def evaluate_scheme(scheme, profile, confirmed, now=None):
    result, reasons = evaluate_tree(scheme['rules'], profile, confirmed)
    now = now or datetime.now(timezone.utc)
    try:
        age = (now - datetime.fromisoformat(scheme['sourceCheckedAt'].replace('Z', '+00:00'))).total_seconds() / 86400
    except (TypeError, ValueError, AttributeError):
        age = float('inf')
    verified = scheme['reviewStatus'] == 'VERIFIED' and scheme['complete'] and bool(reasons) and 0 <= age <= 30
    status = 'UNABLE_TO_DETERMINE' if not verified else {'PASS': 'LIKELY_ELIGIBLE', 'FAIL': 'LIKELY_NOT_ELIGIBLE', 'UNKNOWN': 'POSSIBLY_ELIGIBLE'}[result]
    return {'schemeId': scheme['id'], 'status': status, 'reasons': reasons, 'missingFields': list(dict.fromkeys(r['field'] for r in reasons if r['result'] == 'UNKNOWN')), 'version': scheme['version'], 'notice': 'Independent review of current complete rules is required.' if not verified else 'Final eligibility is decided by the responsible government authority.'}
