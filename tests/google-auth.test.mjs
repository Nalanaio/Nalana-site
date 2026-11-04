import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { fixture, authenticated, tokens } from './helpers/cookie-fixture.js';
import { browserContext, readCookie, clearSession, authorization, setCookie, tokenCookie, installSession, prepareContext } from '../src/lib/server/authSession.js';
import { startGoogle, completeGoogle, acknowledgeGoogle, cancelGoogle, approvedLaunch, disconnectGoogle, advanceGoogleReceipt, pendingGoogleCleanup, carryGoogleCleanup, cleanupPreparedGoogle } from '../src/lib/server/googleAuth.js';
process.env.NALANA_API_BASE = 'https://api.example.test';
const googleKey = e => '__Host-nalana_google_' + browserContext(e).sid;
const event = (jar = new Map(), intent = 'sign_in') => { const e = fixture('/api/auth/google/start', { method: 'POST', body: { intent }, jar }); browserContext(e, true); return e; };
function backend(t, respond) { const old = globalThis.fetch, calls = []; globalThis.fetch = async (url, init) => { const body = init.body ? JSON.parse(init.body) : null; calls.push({ url, init, body }); return respond(url, body, init); }; t.after(() => { globalThis.fetch = old; }); return calls; }
const returnProof = 'callback-browser-return-proof-fixture-at-least-32';
async function complete(e, input) {
  const pending = readCookie(e, 'google');
  e.request = fixture('/api/auth/google/complete', { method: 'POST', body: input ?? { transaction_id: pending?.id, web_return_proof: returnProof } }).request;
  return completeGoogle(e);
}
const startResponse = id => Response.json({ transaction_id: id, authorization_url: `https://api.example.test/v1/auth/google/browser?transaction_id=${id}&launch=one-use-launch`, channel: 'web', expires_at: new Date(Date.now() + 599000).toISOString(), poll_after_seconds: 2 });
test('flag off by default; arbitrary upstream/return targets never accepted', async t => {
  delete process.env.NALANA_GOOGLE_AUTH_ENABLED; let calls = backend(t, () => { throw new Error('must not call'); }); assert.equal((await startGoogle(event())).status, 503); assert.equal(calls.length, 0);
  for (const url of ['https://evil.test/v1/auth/google/browser?launch=x', 'http://api.example.test/v1/auth/google/browser?launch=x', 'https://api.example.test/evil?launch=x', 'https://api.example.test/v1/auth/google/browser?launch=x&return_to=https://evil.test']) assert.equal(approvedLaunch(url), null);
});
test('start holds verifier/request UUID only in sealed HttpOnly transaction cookie', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID(), calls = backend(t, () => startResponse(id)), e = event();
  const response = await startGoogle(e), data = await response.json(), pending = readCookie(e, 'google');
  assert.equal(response.status, 200); assert.equal(pending.id, id); assert.equal(pending.verifier.length, 43); assert.match(pending.requestId, /^[0-9a-f-]{36}$/); assert.equal(data.handoff_verifier, undefined); assert.equal(data.request_id, undefined); assert.equal(JSON.stringify(data).includes(pending.verifier), false);
  const headers = calls[0].init.headers;
  assert.equal(headers['X-Nalana-Google-Client-IP'], '203.0.113.6');
  const message = `${headers['X-Nalana-Google-Timestamp']}\nPOST\n/v1/auth/google/transactions\n${createHash('sha256').update(calls[0].init.body).digest('hex')}\n203.0.113.6`;
  assert.equal(headers['X-Nalana-Google-Signature'], createHmac('sha256', process.env.GOOGLE_AUTH_BFF_SECRET).update(message).digest('hex'));
  assert.equal(calls[0].body.handoff_challenge, createHash('sha256').update(pending.verifier).digest('base64url')); assert.equal(calls[0].body.return_to, '/auth/google/complete'); assert.equal(calls[0].body.channel, 'web'); assert.equal(calls[0].body.intent, 'sign_in');
  assert.equal((await startGoogle(event(new Map(), 'link'))).status, 401);
});

test('web completion requires callback browser proof and exact pending transaction before any upstream redemption', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : Response.json(tokens()));
  const attacker = event(); await startGoogle(attacker);
  assert.equal((await complete(attacker, {})).status, 400, 'launch owner lacks callback proof');
  assert.equal((await complete(event(), { transaction_id: id, web_return_proof: returnProof })).status, 400, 'callback browser lacks initiating transaction');
  assert.equal((await complete(attacker, { transaction_id: randomUUID(), web_return_proof: returnProof })).status, 400);
  assert.equal(calls.filter(call => call.url.endsWith('/redemption')).length, 0);
  const response = await complete(attacker), body = await response.json();
  assert.equal(response.status, 200); assert.equal(JSON.stringify(body).includes(returnProof), false);
  assert.equal(calls.at(-1).body.web_return_proof, returnProof);
  assert.equal(readCookie(attacker, 'google').webReturnProof, returnProof);
  assert.equal((await complete(attacker, { transaction_id: id, web_return_proof: 'different-callback-browser-proof-at-least-32' })).status, 200);
  assert.equal(readCookie(attacker, 'google').webReturnProof, returnProof, 'same-transaction resume preserves the original proof');
  assert.equal((await complete(attacker, {})).status, 200, 'sealed proof supports a refreshed completion page');
});
test('completion POST replays same request ID after pending/lost result and acknowledges only after browser receipt', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID(); let attempts = 0;
  const calls = backend(t, (url) => {
    if (url.endsWith('/transactions')) return startResponse(id);
    if (url.endsWith('/redemption')) return ++attempts === 1 ? Response.json({ state: 'approved' }, { status: 202 }) : Response.json(tokens());
    return new Response(null, { status: 204 });
  });
  const e = event(); await startGoogle(e); const original = readCookie(e, 'google');
  assert.equal((await acknowledgeGoogle(e)).status, 400); assert.equal((await complete(e)).status, 202); assert.equal((await complete(e)).status, 200);
  assert.ok(authorization(e)); assert.equal(readCookie(e, 'google').installed, true); assert.equal(calls.some(call => call.url.endsWith('/acknowledgment')), false);
  const bodies = calls.filter(call => call.url.endsWith('/redemption')).map(call => call.body); assert.deepEqual(bodies[0], bodies[1]); assert.equal(bodies[0].request_id, original.requestId); assert.equal(bodies[0].channel, 'web');
  assert.equal((await acknowledgeGoogle(e)).status, 200); assert.equal(readCookie(e, 'google').installed, true); assert.equal(calls.at(-1).body.request_id, original.requestId);
  const writesBeforeRetry = e.writes.length;
  assert.equal((await acknowledgeGoogle(e)).status, 200, 'lost acknowledgment response retries the same exact-pair receipt');
  assert.equal(e.writes.length, writesBeforeRetry, 'ack neither deletes nor extends the bounded marker');
  assert.equal(calls.at(-1).body.request_id, original.requestId);
  const acknowledgedCalls = calls.filter(call => call.url.endsWith('/acknowledgment')).length;
  installSession(e, { ...tokens(), refresh_token: 'different-pair-for-the-same-account' });
  assert.equal((await acknowledgeGoogle(e)).status, 400, 'same account metadata cannot replace exact credential receipt');
  assert.equal(calls.filter(call => call.url.endsWith('/acknowledgment')).length, acknowledgedCalls);
});
test('wrong browser, home, expired/desktop transaction, cancellation and logout cannot adopt completion', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID(), calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : new Response(null, { status: 204 }));
  const e = event(); await startGoogle(e); const pending = readCookie(e, 'google');
  const foreign = event(); foreign.jar.set(googleKey(foreign), e.jar.get(googleKey(e))); assert.equal((await complete(foreign)).status, 400);
  setCookie(e, 'google', { ...pending, channel: 'desktop' }, 600); assert.equal((await complete(e)).status, 400);
  setCookie(e, 'google', pending, 600); assert.equal((await cancelGoogle(e)).status, 200); assert.equal(calls.at(-1).url, `https://api.example.test/v1/auth/google/transactions/${id}/cancellation`); assert.equal(readCookie(e, 'google'), null);
  setCookie(e, 'google', pending, 600); clearSession(e); assert.equal((await complete(e)).status, 400);
});
test('settings disconnect requires password+explicit confirmation and preserves same user/entitlements', async t => {
  const calls = backend(t, url => url.endsWith('/disconnection') ? Response.json(tokens()) : new Response(null, { status: 204 }));
  const e = authenticated('/api/auth/google/disconnect', { method: 'POST', body: { current_password: 'password123', confirmed: true } });
  const response = await disconnectGoogle(e), data = await response.json(); assert.equal(response.status, 200); assert.equal(data.user.id, 'account'); assert.equal(data.user.credits, 123); assert.equal(data.user.tier, 'pro'); assert.equal(data.refresh_token, undefined); assert.deepEqual(calls[0].body, { current_password: 'password123', confirmed: true });
  const invalid = authenticated('/api/auth/google/disconnect', { method: 'POST', body: { current_password: 'password123', confirmed: false } }); assert.equal((await disconnectGoogle(invalid)).status, 400);
});

test('ack rejects partial-cookie delivery and old logged-in pair; exact replay restores issued pair', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : url.endsWith('/redemption') ? Response.json(tokens('google-account')) : new Response(null, { status: 204 }));
  const e = authenticated('/api/auth/google/start', { method: 'POST', body: { intent: 'link' } });
  await startGoogle(e); const before = new Map(e.jar); await complete(e);
  const installed = e.jar.get(googleKey(e));
  e.jar.clear(); for (const [key, value] of before) e.jar.set(key, value); e.jar.set(googleKey(e), installed);
  assert.equal((await acknowledgeGoogle(e)).status, 400); assert.equal(calls.some(call => call.url.endsWith('/acknowledgment')), false);
  assert.equal((await complete(e)).status, 200); assert.equal((await acknowledgeGoogle(e)).status, 200);
  assert.equal(calls.filter(call => call.url.endsWith('/redemption')).length, 2);
});

test('a legitimate refresh before acknowledgment advances exact browser receipt proof', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : url.endsWith('/redemption') ? Response.json(tokens('google-account')) : new Response(null, { status: 204 }));
  const e = event(); await startGoogle(e); await complete(e);
  const oldAccess = tokenCookie(e, 'access'), oldRefresh = tokenCookie(e, 'refresh'), rotated = tokens('rotated-google-account');
  installSession(e, rotated, { refresh: true }); advanceGoogleReceipt(e, oldAccess, oldRefresh, rotated);
  assert.equal((await complete(e)).status, 200);
  assert.equal(calls.filter(call => call.url.endsWith('/redemption')).length, 1, 'does not reinstall the pre-rotation pair');
  assert.equal((await acknowledgeGoogle(e)).status, 200);
});

test('lost installed marker with accepted session cookies never revokes its issued family on replay', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : url.endsWith('/redemption') ? Response.json(tokens('issued-google')) : new Response(null, { status: 204 }));
  const e = authenticated('/api/auth/google/start', { method: 'POST', body: { intent: 'link' } });
  await startGoogle(e); const originalMarker = e.jar.get(googleKey(e));
  await complete(e); e.jar.set(googleKey(e), originalMarker);
  await complete(e); assert.equal((await acknowledgeGoogle(e)).status, 200);
  const logouts = calls.filter(call => call.url.endsWith('/logout'));
  assert.ok(logouts.length > 0); assert.ok(logouts.every(call => call.body.refresh_token === 'opaque-refresh-account'));
  assert.ok(logouts.every(call => call.body.refresh_token !== 'opaque-refresh-issued-google'));
});

test('preflight carries previous Google cancellation proof across sid rotation and resolves it before new credentials', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : new Response(null, { status: 204 }));
  const e = event(); await startGoogle(e); const cleanup = pendingGoogleCleanup(e); assert.equal(cleanup.length, 1);
  prepareContext(e); carryGoogleCleanup(e, cleanup); assert.equal(readCookie(e, 'google'), null);
  assert.equal(await cleanupPreparedGoogle(e), null); assert.equal(calls.at(-1).url, `https://api.example.test/v1/auth/google/transactions/${id}/cancellation`);
  assert.equal(pendingGoogleCleanup(e).length, 0);
});

test('logout cancellation drains carried Google proof even without a subsequent credential submission', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID(); let unavailable = true;
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : new Response(null, { status: unavailable ? 503 : 204 }));
  const e = event(); await startGoogle(e); const cleanup = pendingGoogleCleanup(e);
  prepareContext(e); carryGoogleCleanup(e, cleanup);
  assert.equal((await cancelGoogle(e)).status, 503); assert.equal(pendingGoogleCleanup(e).length, 1);
  unavailable = false;
  assert.equal((await cancelGoogle(e)).status, 200); assert.equal(pendingGoogleCleanup(e).length, 0);
  assert.equal(calls.filter(call => call.url.endsWith(`/${id}/cancellation`)).length, 2);
});

test('delayed pre-logout context and Google marker cannot redeem using a fresh logout generation', async t => {
  process.env.NALANA_GOOGLE_AUTH_ENABLED = 'true'; const id = randomUUID();
  const calls = backend(t, url => url.endsWith('/transactions') ? startResponse(id) : Response.json(tokens()));
  const e = event(); await startGoogle(e); const context = e.jar.get('__Host-nalana_context'), markerKey = googleKey(e), marker = e.jar.get(markerKey);
  clearSession(e); e.jar.set('__Host-nalana_context', context); e.jar.set(markerKey, marker);
  assert.equal((await complete(e)).status, 400);
  assert.equal(calls.filter(call => call.url.endsWith('/redemption')).length, 0);
  assert.equal(authorization(e), null);
});
