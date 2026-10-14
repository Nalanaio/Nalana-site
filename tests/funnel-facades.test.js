import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { enrollWeb, lifecycle, ingestWeb, readEnrollment, writeEnrollment, seal, unseal, resumeWeb, revokeWeb } from '../src/lib/server/funnel-api.js';
process.env.NALANA_FUNNEL_ENABLED = 'true';
process.env.NALANA_FUNNEL_COOKIE_SECRET = 'local-only-cookie-key-with-32-or-more-characters';
process.env.NALANA_WEBSITE_SERVICE_TOKEN = 'local-only-service-test';
process.env.NALANA_API_BASE = 'http://127.0.0.1:9876';
function cookies() { const values = new Map(); return { get: key => values.get(key), set: (key, value, options) => { assert.equal(options.httpOnly, true); assert.equal(options.secure, true); values.set(key, value); }, delete: key => values.delete(key) }; }
/** @param {any} body @param {any} options */
function context(body, { jar = cookies(), action, id, origin = 'https://nalana.test', fetch = async () => { throw new Error('Unexpected outbound request'); }, auth } = {}) {
  const url = new URL('https://nalana.test/api/funnel/events');
  return { cookies: jar, params: { action, id }, url, request: new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) }), fetch };
}
function enrollment(jar) { const e = { id: randomUUID(), token: 'private-scoped-token', revoke_token: 'private-revoke-token', expires_at: new Date(Date.now() + 86400000).toISOString(), web_visitor_id: randomUUID(), web_session_id: randomUUID(), session_id: randomUUID(), association_epoch: 0 }; writeEnrollment(jar, e); return e; }
test('cookie encryption rejects tampering and never exposes capabilities in enrollment response', async () => {
  assert.equal(unseal(seal({ token: 'secret' })).token, 'secret'); const encrypted = seal({ token: 'secret' }); assert.equal(encrypted.includes('secret'), false); assert.equal(unseal(encrypted.slice(0, -5) + 'xxxxx'), null);
  const jar = cookies(), id = randomUUID();
  const result = await enrollWeb(context({ consent_state: 'granted', consent_version: 1, web_visitor_id: randomUUID(), web_session_id: randomUUID() }, { jar, fetch: async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:9876/v1/funnel/enrollments'); assert.equal(init.headers.authorization, 'Bearer local-only-service-test');
    const body = JSON.parse(init.body); assert.equal(body.client, 'website'); assert.equal(body.platform, 'web');
    return Response.json({ enrollment_id: id, enrollment_token: 'secret-capability', revoke_token: 'secret-revoke', expires_at: new Date(Date.now() + 86400000).toISOString() }, { status: 201 });
  } }));
  assert.equal(result.status, 201); const value = await result.json(); assert.deepEqual(Object.keys(value).sort(), ['enrollment_id', 'expires_at']); assert.equal(readEnrollment(jar).token, 'secret-capability');
});
test('disabled rollout still permits private proof revocation, and resume exposes no credentials', async () => {
  const jar = cookies(), e = enrollment(jar);
  const resumed = await resumeWeb(context({}, { jar })); const metadata = await resumed.json();
  assert.equal(metadata.enrollment_id, e.id); assert.equal(metadata.token, undefined); assert.equal(metadata.revoke_token, undefined);
  process.env.NALANA_FUNNEL_ENABLED = 'false';
  try {
    const response = await revokeWeb(context({}, { jar, fetch: async (_url, init) => { assert.equal(init.headers.authorization, `Funnel ${e.revoke_token}`); return new Response(null, { status: 204 }); } }));
    assert.equal(response.status, 204); assert.equal(readEnrollment(jar, { forRevocation: true }), null);
  } finally { process.env.NALANA_FUNNEL_ENABLED = 'true'; }
});
test('origin, body authority, action injection and account credential substitution fail before backend', async () => {
  assert.equal((await enrollWeb(context({}, { origin: 'https://foreign.test' }))).status, 403);
  assert.equal((await enrollWeb(context({ consent_state: 'granted', consent_version: 1, web_visitor_id: randomUUID(), web_session_id: randomUUID(), source: 'backend' }))).status, 400);
  const jar = cookies(), e = enrollment(jar);
  assert.equal((await lifecycle(context({}, { jar, id: e.id, action: '../../admin' }))).status, 404);
  assert.equal((await lifecycle(context({ session_id: randomUUID() }, { jar, id: e.id, action: 'associate', auth: 'Bearer account' }))).status, 403);
  assert.equal((await lifecycle(context({ session_id: e.session_id }, { jar, id: e.id, action: 'associate' }))).status, 401);
});
test('browser observations cannot forge authority or cross a session/association epoch', async () => {
  const jar = cookies(), e = enrollment(jar);
  const event = { event_id: randomUUID(), event_name: 'website_download_clicked', occurred_at: new Date().toISOString(), web_session_id: e.web_session_id, association_epoch: 0, properties: {} };
  for (const forged of [{ ...event, event_name: 'download_transfer_started' }, { ...event, actor_ref: 'account' }, { ...event, association_epoch: 1 }, { ...event, web_session_id: randomUUID() }, { ...event, properties: { email: 'private@example.test' } }]) assert.equal((await ingestWeb(context({ schema_version: 1, events: [forged] }, { jar }))).status, 400);
  let requests = 0;
  const response = await ingestWeb(context({ schema_version: 1, events: [event] }, { jar, fetch: async (_url, init) => { requests++; assert.equal(init.headers.authorization, 'Funnel private-scoped-token'); return Response.json({ schema_version: 1, accepted: [event.event_id], duplicates: [], rejected: [], private_token: 'must-not-return' }); } }));
  assert.equal(requests, 1); assert.equal(response.status, 200); assert.equal((await response.text()).includes('must-not-return'), false);
});
test('revocation clears active cookie before network and retains bounded encrypted retry only', async () => {
  const jar = cookies(), e = enrollment(jar);
  const response = await lifecycle(context({}, { jar, id: e.id, action: 'revoke', fetch: async (_url, init) => { assert.equal(readEnrollment(jar), null); assert.equal(init.headers.authorization, 'Funnel private-revoke-token'); return new Response(null, { status: 503 }); } }));
  assert.equal(response.status, 503); assert.equal(readEnrollment(jar), null); assert.ok(jar.get('nalana_funnel_revoke')); assert.equal(jar.get('nalana_funnel_revoke').includes('private-revoke-token'), false);
});
