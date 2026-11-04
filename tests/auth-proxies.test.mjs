import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, authenticated, tokens } from './helpers/cookie-fixture.js';
import { browserContext, checkCsrf, authorization, installSession, clearSession, seal, unseal, tokenCookie, prepareContext, credentialSid } from '../src/lib/server/authSession.js';
import { proxyMe, proxyAuthenticated, sessionResponse } from '../src/lib/server/authApi.js';
process.env.NALANA_API_BASE = 'https://api.example.test';
test('encrypted purpose-bound HttpOnly cookie handles opaque refresh and bounded lifetimes', () => {
  const event = authenticated('/api/auth/me');
  assert.equal(tokenCookie(event, 'refresh'), 'opaque-refresh-account'); assert.equal(authorization(event), `Bearer ${tokens().access_token}`);
  for (const write of event.writes) { assert.equal(write.options.httpOnly, true); assert.equal(write.options.secure, true); assert.equal(write.options.path, '/'); assert.equal(write.options.sameSite, 'lax'); assert.ok(write.key.startsWith('__Host-')); assert.equal(write.options.domain, undefined); }
  const value = seal({ exp: Date.now() + 10000, token: 'secret' }, 'access'); assert.doesNotMatch(value, /secret/); assert.equal(unseal(value, 'refresh'), null); assert.equal(unseal(value.slice(0, -4) + 'aaaa', 'access'), null);
});
test('same-origin plus browser-bound CSRF rejects omitted/foreign/forged requests', () => {
  const event = authenticated('/api/auth/logout', { method: 'POST' }); const context = browserContext(event);
  assert.equal(checkCsrf(event).status, 403); event.request.headers.set('x-csrf-token', context.csrf); assert.equal(checkCsrf(event), null);
  event.request.headers.set('origin', 'https://evil.test'); assert.equal(checkCsrf(event).status, 403);
});
test('logout and account switch fence delayed refresh Set-Cookie without resetting context', () => {
  const event = authenticated('/api/auth/refresh', { method: 'POST' }); const stale = fixture('/api/auth/refresh', { method: 'POST', jar: new Map(event.jar) });
  installSession(stale, tokens('rotated'), { refresh: true }); clearSession(event);
  for (const write of stale.writes) if (write.value) event.jar.set(write.key, write.value);
  assert.equal(authorization(event), null); assert.equal(tokenCookie(event, 'refresh'), null);
  installSession(event, tokens('new-account')); assert.match(authorization(event), /^Bearer /);
  for (const write of stale.writes) if (write.value) event.jar.set(write.key, write.value);
  assert.equal(authorization(event), `Bearer ${tokens('new-account').access_token}`, 'stale cookie never clobbers a newer account session');
});
test('authenticated BFF ignores browser Authorization and projects user without tokens', async t => {
  const previous = globalThis.fetch; const seen = []; globalThis.fetch = async (url, init) => { seen.push({ url, init }); return Response.json({ id: 'account', email: 'account@example.test', credits: 123, tier: 'pro', password_hash: 'never' }); }; t.after(() => { globalThis.fetch = previous; });
  const event = authenticated('/api/auth/me', { headers: { Authorization: 'Bearer attacker' } });
  const response = await proxyMe(event), data = await response.json(); assert.equal(data.user.id, 'account'); assert.equal(data.user.credits, 123); assert.equal(data.user.password_hash, undefined); assert.equal(data.token, undefined); assert.notEqual(seen[0].init.headers.Authorization, 'Bearer attacker');
  const anonymous = fixture('/api/auth/me', { headers: { Authorization: 'Bearer attacker' } }); assert.equal((await proxyMe(anonymous)).status, 401);
  await proxyAuthenticated('/v1/usage/me', event, { method: 'GET' }); assert.equal(seen.at(-1).url, 'https://api.example.test/v1/usage/me');
});
test('session response has no bearer/refresh material and a malformed session cannot be saved', async () => {
  const event = fixture(); browserContext(event, true); const response = await sessionResponse(event, { ok: true, status: 200, data: tokens() }); const data = await response.json();
  assert.equal(data.user.id, 'account'); assert.ok(data.csrf_token); assert.equal(data.access_token, undefined); assert.equal(data.refresh_token, undefined); assert.equal(data.token, undefined);
  assert.equal((await sessionResponse(event, { ok: true, status: 200, data: {} })).status, 502);
});

test('authoritative invalid refresh clears only its old-sid credentials and cannot delete a newer login', async () => {
  const active = authenticated('/api/auth/refresh', { method: 'POST' }), stale = fixture('/api/auth/refresh', { method: 'POST', jar: new Map(active.jar) });
  prepareContext(active); installSession(active, tokens('newer'));
  const denied = await sessionResponse(stale, { ok: false, status: 401, data: {} }, { refresh: true }); assert.equal(denied.status, 401);
  for (const write of stale.writes) if (write.value === null) active.jar.delete(write.key);
  assert.equal(authorization(active), `Bearer ${tokens('newer').access_token}`);
  assert.equal(tokenCookie(stale, 'access'), null); assert.equal(tokenCookie(stale, 'refresh'), null);
});

test('cookie credentials are pinned to the configured private authentication home', () => {
  const event = authenticated('/api/auth/me'), original = process.env.NALANA_API_BASE;
  process.env.NALANA_API_BASE = 'https://other-home.example.test';
  try { assert.equal(authorization(event), null); assert.equal(tokenCookie(event, 'refresh'), null); }
  finally { process.env.NALANA_API_BASE = original; }
});

test('late password success after logout cannot replace context or authenticate', async () => {
  const active = fixture('/api/auth/login'); browserContext(active, true); prepareContext(active);
  const pending = fixture('/api/auth/login', { method: 'POST', jar: new Map(active.jar) });
  clearSession(active);
  assert.equal((await sessionResponse(pending, { ok: true, status: 200, data: tokens('late-password') })).status, 200);
  assert.ok(pending.writes.every(write => !write.key.endsWith('_context')));
  for (const write of pending.writes) if (write.value) active.jar.set(write.key, write.value);
  assert.equal(authorization(active), null);
});
test('later Google attempt wins over delayed password success and its cookie deletion', async () => {
  const active = fixture('/api/auth/login'); browserContext(active, true); prepareContext(active);
  const password = fixture('/api/auth/login', { method: 'POST', jar: new Map(active.jar) });
  prepareContext(active); installSession(active, tokens('google-winner'));
  await sessionResponse(password, { ok: true, status: 200, data: tokens('late-password') });
  for (const write of password.writes) if (write.value) active.jar.set(write.key, write.value); else active.jar.delete(write.key);
  assert.equal(authorization(active), `Bearer ${tokens('google-winner').access_token}`);
});
test('preflight preserves existing account while failed replacement is pending; its refresh writes only prior sid', () => {
  const active = authenticated('/api/auth/prepare'), previousSid = credentialSid(active);
  prepareContext(active); assert.equal(authorization(active), `Bearer ${tokens().access_token}`);
  const refresh = fixture('/api/auth/refresh', { method: 'POST', jar: new Map(active.jar) });
  const targetSid = credentialSid(refresh); assert.equal(targetSid, previousSid);
  installSession(active, tokens('winner')); installSession(refresh, tokens('old-family-rotation'), { targetSid });
  for (const write of refresh.writes) if (write.value) active.jar.set(write.key, write.value);
  assert.equal(authorization(active), `Bearer ${tokens('winner').access_token}`);
});

test('accepted replacement cannot restore preflight fallback after authoritative invalidation even when old logout failed', async () => {
  const event = authenticated('/api/auth/prepare'); prepareContext(event);
  assert.equal(tokenCookie(event, 'refresh'), 'opaque-refresh-account');
  installSession(event, tokens('replacement'));
  await sessionResponse(event, { ok: false, status: 401, data: {} }, { refresh: true });
  assert.equal(authorization(event), null); assert.equal(tokenCookie(event, 'refresh'), null);
  assert.ok([...event.jar.keys()].some(key => key.includes('refresh_')), 'old fallback cookie still exists to exercise refusal');
});

test('independent logout generation defeats delayed prepare plus old-family refresh even while upstream logout is offline', () => {
  const active = authenticated('/api/auth/prepare');
  const pendingPrepare = fixture('/api/auth/prepare', { method: 'POST', jar: new Map(active.jar) });
  const pendingRefresh = fixture('/api/auth/refresh', { method: 'POST', jar: new Map(active.jar) });
  prepareContext(pendingPrepare);
  installSession(pendingRefresh, tokens('old-family-rotated'), { targetSid: credentialSid(pendingRefresh) });
  clearSession(active);
  for (const stale of [pendingPrepare, pendingRefresh]) for (const write of stale.writes) if (write.value) active.jar.set(write.key, write.value); else active.jar.delete(write.key);
  assert.equal(authorization(active), null); assert.equal(tokenCookie(active, 'refresh'), null);
  assert.ok([...active.jar.keys()].some(key => key.endsWith('logout_generation')));
});

test('successful replacement prunes captured previous cookies while failure preserves the active fallback', async t => {
  const previous = globalThis.fetch; globalThis.fetch = async () => new Response(null, { status: 503 }); t.after(() => { globalThis.fetch = previous; });
  const event = authenticated('/api/auth/login'), oldSid = credentialSid(event); prepareContext(event);
  assert.equal((await sessionResponse(event, { ok: false, status: 401, data: {} })).status, 401);
  assert.equal(tokenCookie(event, 'refresh'), 'opaque-refresh-account');
  assert.equal((await sessionResponse(event, { ok: true, status: 200, data: tokens('replacement') })).status, 200);
  for (const kind of ['access', 'refresh', 'committed']) assert.equal(event.jar.has(`__Host-nalana_${kind}_${oldSid}`), false);
  assert.equal(tokenCookie(event, 'refresh'), 'opaque-refresh-replacement');
});
