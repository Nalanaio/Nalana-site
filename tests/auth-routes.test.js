import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./helpers/svelte-env-loader.mjs', import.meta.url);
import { fixture, tokens, authenticated } from './helpers/cookie-fixture.js';
import { browserContext, authorization, prepareContext, tokenCookie } from '../src/lib/server/authSession.js';
import { carryGoogleCleanup, pendingGoogleCleanup } from '../src/lib/server/googleAuth.js';
import { pendingLogout } from '../src/lib/server/authApi.js';

test('actual auth routes and middleware enforce cookie+CSRF and retain password/recovery contracts', async t => {
  process.env.NALANA_API_BASE = 'https://api.example.test';
  const calls = [], previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/v1/auth/logout')) return new Response(null, { status: 204 });
    if (url.endsWith('/v1/users/me')) return Response.json(tokens().user);
    if (url.endsWith('/v1/auth/resend-verification/current')) return Response.json({ detail: 'Please wait.', code: 'RATE_LIMITED', retry_after_seconds: 60, private_field: 'never echo' }, { status: 429 });
    if (url.endsWith('/v1/auth/verify-email')) return Response.json({ id: 'account', email_verified: true });
    return Response.json(tokens(), { status: url.endsWith('/register') ? 201 : 200 });
  };
  t.after(() => { globalThis.fetch = previous; });
  const { handle } = await import('../src/hooks.server.js');
  const load = name => import(`../src/routes/api/auth/${name}/+server.js`);
  const jar = new Map();
  async function run(name, body, method = 'POST', csrf = true) {
    const event = fixture(`/api/auth/${name}`, { method, body, jar });
    const context = browserContext(event, true); if (csrf) event.request.headers.set('x-csrf-token', context.csrf);
    const route = await load(name); return handle({ event, resolve: e => route[method](e) });
  }
  assert.equal((await run('login', { email: 'account@example.test', password: 'password123' }, 'POST', false)).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await run('prepare', {})).status, 200);
  const login = await run('login', { email: 'account@example.test', password: 'password123' }); const data = await login.json();
  assert.equal(data.user.id, 'account'); assert.equal(data.user.credits, 123); assert.equal(data.token, undefined); assert.equal(data.refresh_token, undefined);
  assert.ok(authorization(fixture('/api/auth/me', { jar })));
  const me = await run('me', undefined, 'GET'); assert.equal((await me.json()).user.id, 'account');
  const refreshed = await run('refresh', { refresh_token: 'untrusted-client-token' }); assert.equal(refreshed.status, 200); assert.deepEqual(calls.at(-1).body, { refresh_token: 'opaque-refresh-account' });
  const corrected = await run('change-email', { new_email: 'corrected@example.test', current_password: 'password123', injected: 'discard' }); assert.equal(corrected.status, 200);
  const correctionCall = calls.find(call => call.url.endsWith('/change-email')); assert.deepEqual(correctionCall.body, { new_email: 'corrected@example.test', current_password: 'password123' }); assert.ok(correctionCall.init.headers.Authorization.startsWith('Bearer '));
  const resend = await run('resend-verification/current', { email: 'untrusted@example.test' }); const limited = await resend.json(); assert.equal(resend.status, 429); assert.equal(limited.retry_after_seconds, 60); assert.equal(limited.private_field, undefined); assert.deepEqual(calls.at(-1).body, {});
  for (const name of ['login', 'register', 'forgot-password', 'reset-password', 'change-email', 'verify-email']) {
    const before = calls.length, event = fixture(`/api/auth/${name}`, { method: 'POST', body: {}, jar, origin: 'https://evil.test' }); event.request.headers.set('x-csrf-token', browserContext(event).csrf);
    const route = await load(name); assert.equal((await handle({ event, resolve: e => route.POST(e) })).status, 403); assert.equal(calls.length, before);
  }
  const logout = await run('logout', {}); assert.equal(logout.status, 200); assert.equal(authorization(fixture('/api/auth/me', { jar })), null); assert.equal(calls.at(-1).url, 'https://api.example.test/v1/auth/logout');
});

test('actual logout preserves failed prepared Google cleanup for an actionable retry after context rotation', async t => {
  process.env.NALANA_API_BASE = 'https://api.example.test'; let unavailable = true;
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return new Response(null, { status: unavailable ? 503 : 204 }); };
  t.after(() => { globalThis.fetch = previous; });
  const { POST } = await import('../src/routes/api/auth/logout/+server.js');
  const e = fixture('/api/auth/logout', { method: 'POST', body: {} }); browserContext(e, true);
  const latePrepare = fixture('/api/auth/prepare', { method: 'POST', jar: new Map(e.jar) }); prepareContext(latePrepare);
  prepareContext(e); carryGoogleCleanup(e, [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', verifier: 'owner-proof' }]);
  const first = await POST(e); assert.equal(first.status, 503); assert.equal((await first.json()).revocation_pending, true);
  for (const write of latePrepare.writes) if (write.value) e.jar.set(write.key, write.value);
  assert.equal(pendingGoogleCleanup(e).length, 1);
  unavailable = false; const second = await POST(e); assert.equal(second.status, 200); assert.equal(pendingGoogleCleanup(e).length, 0);
  assert.equal(calls.length, 2);
});

test('actual logout retains original family on503 and retries it without adopting pending credentials', async t => {
  process.env.NALANA_API_BASE = 'https://api.example.test'; let unavailable = true;
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: unavailable ? 503 : 204 }); };
  t.after(() => { globalThis.fetch = previous; });
  const { POST } = await import('../src/routes/api/auth/logout/+server.js');
  const { POST: prepare } = await import('../src/routes/api/auth/prepare/+server.js');
  const e = authenticated('/api/auth/logout', { method: 'POST', body: {} });
  const latePrepare = fixture('/api/auth/prepare', { method: 'POST', jar: new Map(e.jar) }); prepareContext(latePrepare);
  const first = await POST(e), firstBody = await first.json(); assert.equal(first.status, 503); assert.equal(firstBody.revocation_pending, true);
  assert.equal(JSON.stringify(firstBody).includes('opaque-refresh'), false);
  assert.equal(authorization(e), null); assert.equal(tokenCookie(e, 'refresh'), null); assert.equal(pendingLogout(e).refresh, 'opaque-refresh-account');
  for (const write of latePrepare.writes) if (write.value) e.jar.set(write.key, write.value);
  assert.equal(pendingLogout(e).refresh, 'opaque-refresh-account', 'delayed prepare cannot hide original cancellation capability');
  assert.equal((await prepare(e)).status, 409, 'new issuance cannot replace unresolved cancellation-only capability');
  const changedHome = process.env.NALANA_API_BASE; process.env.NALANA_API_BASE = 'https://other-home.example.test';
  assert.equal((await POST(e)).status, 503); assert.equal(calls.length, 1, 'capability never goes to a changed home'); process.env.NALANA_API_BASE = changedHome;
  unavailable = false; const second = await POST(e); assert.equal(second.status, 200); assert.equal((await second.json()).revocation_pending, false);
  assert.equal(pendingLogout(e), null); assert.equal(authorization(e), null); assert.equal(tokenCookie(e, 'refresh'), null);
  assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
  assert.equal([...e.jar.keys()].filter(key => key.includes('logout_revoke_')).length, 0, 'retry cookies do not accumulate across logout contexts');
});

test('Google cancellation retry keeps its original home across configuration changes and logout carries', async t => {
  const home = 'https://api.example.test'; process.env.NALANA_API_BASE = home;
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return new Response(null, { status: 204 }); };
  t.after(() => { globalThis.fetch = previous; process.env.NALANA_API_BASE = home; });
  const { POST } = await import('../src/routes/api/auth/logout/+server.js');
  const e = fixture('/api/auth/logout', { method: 'POST', body: {} }); browserContext(e, true);
  carryGoogleCleanup(e, [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', verifier: 'owner-proof' }]);
  process.env.NALANA_API_BASE = 'https://other-home.example.test';
  assert.equal((await POST(e)).status, 503); assert.equal((await POST(e)).status, 503); assert.equal(calls.length, 0);
  assert.equal(pendingGoogleCleanup(e)[0].home, home);
  process.env.NALANA_API_BASE = home; assert.equal((await POST(e)).status, 200); assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith(home + '/')); assert.equal(pendingGoogleCleanup(e).length, 0);
});
