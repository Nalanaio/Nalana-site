import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

test('actual Svelte auth routes preserve recovery metadata and token-only refresh against loopback backend', async (t) => {
  const calls = [];
  const policy = { policy_version: 1, state: 'required', grace_started_at: '2026-10-12T18:00:00Z', grace_expires_at: '2026-10-14T18:00:00Z', server_time: '2026-10-14T18:00:00Z', enforcement_enabled: true, cloud_actions_allowed: false, next_reminder_at: null, resend_available_at: '2026-10-14T18:01:00Z' };
  const backend = createHttpServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    calls.push({ path: request.url, body: JSON.parse(text || '{}'), auth: request.headers.authorization });
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/v1/auth/refresh') response.end(JSON.stringify({ access_token: 'rotated', refresh_token: 'refresh-2', verification: policy }));
    else if (request.url === '/v1/auth/change-email') response.end(JSON.stringify({ access_token: 'replacement', refresh_token: 'replacement-refresh', user: { id: 'account', email: 'corrected@example.test', verification: policy } }));
    else if (request.url === '/v1/auth/resend-verification/current') { response.statusCode = 429; response.end(JSON.stringify({ detail: 'Please wait.', code: 'RATE_LIMITED', retry_after_seconds: 60, verification: policy, private_field: 'never echo' })); }
    else if (request.url === '/v1/auth/verify-email') response.end(JSON.stringify({ id: 'account', email_verified: true, verification: { ...policy, state: 'verified', cloud_actions_allowed: true } }));
    else { response.statusCode = 404; response.end('{}'); }
  });
  await new Promise((resolve) => backend.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = backend.address();
  assert.ok(address && typeof address !== 'string');
  const previous = process.env.NALANA_API_BASE;
  process.env.NALANA_API_BASE = `http://127.0.0.1:${address.port}`;
  const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(async () => { await vite.close(); await new Promise((resolve) => backend.close(() => resolve(undefined))); if (previous === undefined) delete process.env.NALANA_API_BASE; else process.env.NALANA_API_BASE = previous; });
  const load = (path) => vite.ssrLoadModule(`/src/routes/api/auth/${path}/+server.js`);
  const request = (path, body, auth = null) => new Request(`http://localhost/api/auth/${path}`, { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: JSON.stringify(body) });
  const refresh = await (await load('refresh')).POST({ request: request('refresh', { refresh_token: 'old' }) });
  const refreshed = await refresh.json();
  assert.equal(refreshed.token, 'rotated'); assert.equal(refreshed.user, undefined); assert.deepEqual(refreshed.verification, policy);
  const correctionRoute = await load('change-email');
  assert.equal((await correctionRoute.POST({ request: request('change-email', { new_email: 'corrected@example.test', current_password: 'test-password' }) })).status, 401);
  const correction = await correctionRoute.POST({ request: request('change-email', { new_email: 'corrected@example.test', current_password: 'test-password', injected: 'discard' }, 'Bearer current') });
  assert.equal((await correction.json()).token, 'replacement');
  assert.deepEqual(calls.at(-1).body, { new_email: 'corrected@example.test', current_password: 'test-password' });
  assert.equal(calls.at(-1).auth, 'Bearer current');
  const resend = await (await load('resend-verification/current')).POST({ request: request('resend-verification/current', { email: 'untrusted@example.test' }, 'Bearer current') });
  const limited = await resend.json();
  assert.equal(resend.status, 429); assert.equal(limited.error, 'Please wait.'); assert.equal(limited.retry_after_seconds, 60); assert.deepEqual(limited.verification, policy); assert.equal(limited.private_field, undefined); assert.deepEqual(calls.at(-1).body, {});
  await (await load('verify-email')).POST({ request: request('verify-email', { token: 'proof', email: 'untrusted@example.test' }) });
  assert.deepEqual(calls.at(-1).body, { token: 'proof' });
  for (const path of ['change-email', 'resend-verification/current', 'verify-email']) {
    const route = await load(path);
    const before = calls.length;
    const crossOrigin = request(path, { token: 'proof', new_email: 'x@example.test', current_password: 'test' }, 'Bearer current');
    crossOrigin.headers.set('origin', 'https://foreign.example');
    assert.equal((await route.POST({ request: crossOrigin })).status, 403);
    const missingOrigin = request(path, {}, 'Bearer current'); missingOrigin.headers.delete('origin');
    assert.equal((await route.POST({ request: missingOrigin })).status, 403);
    const oversized = request(path, { padding: 'x'.repeat(9000) }, 'Bearer current');
    const rejected = await route.POST({ request: oversized });
    assert.equal(rejected.status, 413);
    assert.equal(JSON.stringify(await rejected.json()).includes('xxxxxxxx'), false);
    const malformed = request(path, {}, 'Bearer current');
    const invalid = new Request(malformed, { body: '{broken' });
    assert.equal((await route.POST({ request: invalid })).status, 400);
    assert.equal(calls.length, before, 'rejected input never contacts backend');
  }
});
