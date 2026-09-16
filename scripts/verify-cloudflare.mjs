import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

// A healthy database alone cannot detect an older build replacing the login
// fix. Exercise the deployed route with synthetic profiles and a private jar.
const base =
  process.env.TEST_BASE_URL || 'https://india.scheme-sathi.workers.dev';
const cookies = new Map();
const prefix = 'release-check-' + randomUUID();
const identities = ['example.com', 'example.org'].map((domain) =>
  createHash('sha256')
    .update(prefix + '@' + domain)
    .digest('hex'),
);
const created = new Set();

async function api(path, method = 'GET', body, expected = 200, headers = {}) {
  const response = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      'X-Requested-With': 'SchemeSathi',
      Cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; '),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [key, value] = cookie.split(';')[0].split('=');
    if (/Max-Age=0(?:;|$)/.test(cookie)) cookies.delete(key);
    else cookies.set(key, value);
  }
  assert.equal(response.status, expected, method + ' ' + path);
  return response.json();
}

try {
  assert.equal((await api('health/ready')).database, 'connected');
  const first = await api('demo/login', 'PUT', { profileKey: identities[0] });
  created.add(identities[0]);
  assert.deepEqual(first.profile, {});
  await api('profile/confirm', 'PUT', {
    profile: { age: 72, occupation: 'farmer' },
    version: 0,
    confirmed: true,
  });
  await api('applications', 'POST', { schemeId: 'adip' }, 201);
  const conversation = await api('conversations', 'POST', {}, 201);
  await api('demo/logout', 'POST', {});
  await api('sessions', 'GET', undefined, 401);

  const second = await api('demo/login', 'PUT', { profileKey: identities[1] });
  created.add(identities[1]);
  assert.notEqual(first.sessionId, second.sessionId);
  assert.deepEqual(second.profile, {});
  assert.deepEqual((await api('applications')).applications, []);
  assert.deepEqual((await api('conversations')).conversations, []);
  await api(
    'conversations/' + conversation.id + '/messages',
    'GET',
    undefined,
    404,
  );
  await api('profile/confirm', 'PUT', {
    profile: { age: 32, occupation: 'salaried' },
    version: 0,
    confirmed: true,
  });

  const returned = await api('demo/login', 'PUT', {
    profileKey: identities[0],
  });
  assert.equal(returned.profile.age, 72);
  assert.equal(returned.profile.occupation, 'farmer');
  assert.equal((await api('applications')).applications[0].schemeId, 'adip');
  await api('profile/answer', 'POST', { field: 'age', value: 99 }, 409, {
    'X-SchemeSathi-Session': second.sessionId,
  });
  assert.equal((await api('sessions')).profile.age, 72);
  console.log(
    'Live login isolation passed: new identity blank, returning identity restored, stale writes rejected.',
  );
} finally {
  // Only owners created in this check are deleted; no real browser or user
  // credentials ever enter this jar. Cleanup errors remain visible failures.
  for (const profileKey of created) {
    await api('demo/login', 'PUT', { profileKey });
    await api('me/data', 'DELETE');
  }
  if (created.size) console.log('Disposable release-check profiles removed.');
}
