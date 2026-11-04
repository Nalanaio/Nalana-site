import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, tokens } from './helpers/cookie-fixture.js';
import { browserContext, checkCsrf, readCookie, authorization } from '../src/lib/server/authSession.js';
import { startGoogle } from '../src/lib/server/googleAuth.js';
import { createGoogleCompletion } from '../src/lib/auth/googleCompletion.js';
import { POST as complete } from '../src/routes/api/auth/google/complete/+server.js';
import { POST as acknowledge } from '../src/routes/api/auth/google/acknowledge/+server.js';
import { POST as cancel } from '../src/routes/api/auth/google/cancel/+server.js';

test('automatic real BFF route sequence survives lost acknowledgment response with exact cookie readback', async t => {
  const savedFetch = globalThis.fetch, previousBase = process.env.NALANA_API_BASE, previousFlag = process.env.NALANA_GOOGLE_AUTH_ENABLED;
  process.env.NALANA_API_BASE = 'https://api.example.test'; process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true';
  t.after(() => { globalThis.fetch = savedFetch; process.env.NALANA_API_BASE = previousBase; if (previousFlag === undefined) delete process.env.NALANA_GOOGLE_AUTH_ENABLED; else process.env.NALANA_GOOGLE_AUTH_ENABLED = previousFlag; });
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', upstream = [], navigations = [], jar = new Map();
  globalThis.fetch = async (url, init) => {
    upstream.push({ url, body: JSON.parse(init.body) });
    if (url.endsWith('/transactions')) return Response.json({ transaction_id: id, channel: 'web', expires_at: new Date(Date.now() + 599000).toISOString(), authorization_url: `https://api.example.test/v1/auth/google/browser?transaction_id=${id}&launch=fixture` });
    if (url.endsWith('/redemption')) return Response.json(tokens());
    return new Response(null, { status: 204 });
  };
  const start = fixture('/api/auth/google/start', { method: 'POST', body: { intent: 'sign_in' }, jar }); browserContext(start, true); await startGoogle(start);
  let loseAck = true;
  const routes = { '/api/auth/google/complete': complete, '/api/auth/google/acknowledge': acknowledge, '/api/auth/google/cancel': cancel };
  const request = async (path, init) => {
    const event = fixture(path, { method: 'POST', body: init.body ? JSON.parse(init.body) : undefined, jar: new Map(jar) });
    event.request.headers.set('x-csrf-token', browserContext(event).csrf); assert.equal(checkCsrf(event), null);
    const response = await routes[path](event);
    for (const write of event.writes) { if (write.value === null) jar.delete(write.key); else jar.set(write.key, write.value); }
    if (path.endsWith('/acknowledge') && loseAck) { loseAck = false; assert.equal(response.status, 200); throw new Error('response lost after cookies accepted'); }
    return response;
  };
  const flow = createGoogleCompletion({ request, navigate: path => navigations.push(path), returned: { transaction_id: id, web_return_proof: 'bound-callback-proof-fixture-at-least-32' } });
  await flow.mount(); assert.equal(flow.current.phase, 'retry'); assert.equal(flow.current.confirmationStarted, true);
  const browser = fixture('/account', { jar }); assert.ok(authorization(browser)); assert.equal(readCookie(browser, 'google').installed, true);
  await flow.goBack(); assert.deepEqual(navigations, []); assert.equal(upstream.some(call => call.url.endsWith('/cancellation')), false);
  await flow.retry(); assert.deepEqual(navigations, ['/account']);
  const redemptions = upstream.filter(call => call.url.endsWith('/redemption')), acknowledgments = upstream.filter(call => call.url.endsWith('/acknowledgment'));
  assert.equal(redemptions.length, 1); assert.equal(acknowledgments.length, 2); assert.deepEqual(acknowledgments[0].body, acknowledgments[1].body);
});
