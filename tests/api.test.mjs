import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
function client() {
  let cookie = '';
  return async (path, method = 'GET', data, expected = 200, headers = {}) => {
    const r = await fetch(base + '/api/v1/' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'SchemeSathi',
        Cookie: cookie,
        ...headers,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    check(
      r.status === expected,
      `${method} ${path}: expected ${expected}, got ${r.status}`,
    );
    if (r.headers.has('set-cookie'))
      cookie = r.headers.get('set-cookie').split(';')[0];
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };
}
const a = client(),
  b = client();
const caps = await a('capabilities');
check(caps.catalogue === 50, '50 references');
const all = (await a('schemes')).schemes;
check(all.length === 50, 'catalogue loads');
await a('applications', 'GET', undefined, 401);
await a('sessions', 'POST', { language: 'en' }, 201);
await b('sessions', 'POST', { language: 'kn' }, 201);
await a('recommendations', 'GET', undefined, 409);
await a(
  'profile/confirm',
  'PUT',
  { profile: { age: 45 }, version: 0, confirmed: false },
  400,
);
await a(
  'profile/confirm',
  'PUT',
  { profile: { age: -1 }, version: 0, confirmed: true },
  400,
);
await a('profile/confirm', 'PUT', {
  profile: { age: 45, occupation: 'farmer', state: 'Karnataka' },
  version: 0,
  confirmed: true,
});
await a(
  'profile/confirm',
  'PUT',
  { profile: { age: 45 }, version: 0, confirmed: true },
  409,
);
// An unreviewed record must still abstain, whatever else is in the catalogue.
check(
  (await a('recommendations')).results
    .filter((x) => x.scheme.reviewStatus === 'DRAFT')
    .every((x) => x.decision.status === 'UNABLE_TO_DETERMINE'),
  'draft sources abstain',
);
// And anything that does reach a verdict must be a record that says it was
// authored for the demo rather than independently reviewed.
check(
  (await a('recommendations')).results
    .filter((x) => x.decision.status !== 'UNABLE_TO_DETERMINE')
    .every((x) => x.scheme.authoredFor === 'demo'),
  'only demo-authored records reach a verdict',
);
const response = await a('chat', 'POST', {
  message: 'I am a 62 years old farmer from Karnataka',
});
check(
  response.proposedProfile.age === 62 && response.needsConfirmation,
  'chat extraction needs confirmation',
);
check(
  (await a('sessions')).profile.age === 45,
  'chat does not overwrite confirmed profile',
);
await a('applications', 'POST', { schemeId: all[0].id }, 201);
await a('applications', 'POST', { schemeId: all[0].id }, 201);
const apps = (await a('applications')).applications;
check(apps.length === 1, 'save idempotent');
check((await b('applications')).applications.length === 0, 'owners isolated');
await b('applications/' + apps[0].id, 'DELETE', undefined, 404);
await a('applications/' + apps[0].id, 'PATCH', {
  status: 'Submitted',
  reference: '123456789012',
  notes: 'Contact abc@example.com',
  checklist: [all[0].documents[0].item],
});
const record = (await a('applications')).applications[0];
check(
  record.reference === '•••• 9012' && record.notes === 'Contact [redacted]',
  'stored PII masked',
);
await a(
  'applications/' + apps[0].id,
  'PATCH',
  { status: 'Approved', reference: '1234', notes: '', checklist: ['injected'] },
  400,
);
await a(
  'profile/confirm',
  'PUT',
  { profile: {}, version: 1, confirmed: true },
  403,
  { Origin: 'https://attacker.example' },
);
await a('privacy/consent', 'PUT', { enabled: true, language: 'hi' });
check((await a('sessions')).language === 'hi', 'language persisted');
await a(
  'feedback',
  'POST',
  { rating: 5, comment: 'Synthetic test feedback' },
  201,
);
// Voice is optional: unconfigured it must abstain with a clear 503, and
// configured it must actually return audio. Both are correct — which one
// applies is a property of the environment, not of the code.
await a(
  'voice/synthesize',
  'POST',
  { schemeId: all[0].id },
  caps.voice ? 200 : 503,
);
await a('me/data', 'DELETE');
await a('sessions', 'GET', undefined, 401);
await a('applications', 'GET', undefined, 401);
await b('me/data', 'DELETE');
console.log(`${checks} API assertions passed against ${base}`);
