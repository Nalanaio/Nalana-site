import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorService, OperatorError, OPERATOR_COOKIE, OPERATOR_CHALLENGE_COOKIE } from '../src/lib/server/operator-auth.js';

const instant = Date.parse('2026-10-12T18:00:00Z');
const config = { SITE_ACQUISITION_REPORTS_ENABLED: 'true', OPERATOR_ALLOWED_ACCOUNT_IDS: 'operator-1', OPERATOR_SESSION_KEY: 'test-key-only-012345678901234567890123456789', NALANA_API_BASE: 'http://localhost:8000' };
const user = { id: 'operator-1', email_verified: true, status: 'active', auth_version: 0 };
const request = (origin = 'https://nalana.test') => new Request('https://nalana.test/operator/login', { method: 'POST', headers: { origin } });
/** @param {any[]} responses */
function service(responses = [ { access_token: 'private-account-token', user }, user ], overrides = {}) {
  const calls = [];
  let clock = instant;
  const instance = createOperatorService({ ...config, ...overrides }, { now: () => clock, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    const item = responses.shift();
    if (item instanceof Error) throw item;
    return new Response(JSON.stringify(item ?? user), { status: item?.httpStatus ?? 200 });
  } });
  return { ...instance, calls, clock: (value) => { clock = value; } };
}
async function login(s = service()) {
  const challenge = s.createChallenge();
  const result = await s.login({ request: request(), challengeCookie: challenge.cookie, csrf: challenge.csrf, email: 'operator@example.test', password: 'test-password' });
  return { s, ...result };
}
test('operator feature is disabled without explicit flag and allowlist/key/base', () => {
  for (const override of [{ SITE_ACQUISITION_REPORTS_ENABLED: undefined }, { OPERATOR_ALLOWED_ACCOUNT_IDS: '' }, { OPERATOR_SESSION_KEY: 'short' }, { NALANA_API_BASE: '' }, { NALANA_API_BASE: 'https://api.test/path?secret=x' }]) {
    assert.throws(() => service([], override).createChallenge(), OperatorError);
  }
});
test('private session is encrypted, expires in 15 minutes, and exposes no credential', async () => {
  const { s, cookie, csrf } = await login();
  assert.equal(OPERATOR_COOKIE, '__Host-nalana-operator');
  assert.equal(OPERATOR_CHALLENGE_COOKIE, '__Host-nalana-operator-login');
  assert.equal(cookie.includes('private-account-token'), false);
  assert.equal(Buffer.from(cookie, 'base64url').toString().includes('private-account-token'), false);
  const result = await s.authorize(cookie);
  assert.deepEqual(result, { accountId: 'operator-1', csrf, reauthenticatedAt: '2026-10-12T18:00:00.000Z', expiresAt: '2026-10-12T18:15:00.000Z' });
  assert.equal(s.calls.at(-1).url, 'http://localhost:8000/v1/users/me');
  s.clock(instant + 15 * 60_000);
  await assert.rejects(s.authorize(cookie), (e) => e instanceof OperatorError && e.status === 401);
});
test('ordinary missing, tampered, stale and wrong-key cookies fail closed', async () => {
  const { s, cookie } = await login();
  for (const value of [undefined, '', 'ordinary-login', cookie.slice(0, -8) + 'tampered']) await assert.rejects(s.authorize(value), OperatorError);
  await assert.rejects(service([], { OPERATOR_SESSION_KEY: 'different-key-only-012345678901234567890' }).authorize(cookie), OperatorError);
});
test('login needs same-origin POST and matching signed challenge', async () => {
  const s = service();
  const c = s.createChallenge();
  for (const input of [{ request: request('https://attacker.test'), csrf: c.csrf, challengeCookie: c.cookie }, { request: request(), csrf: 'wrong', challengeCookie: c.cookie }, { request: new Request('https://nalana.test/operator/login'), csrf: c.csrf, challengeCookie: c.cookie }, { request: request(), csrf: c.csrf, challengeCookie: 'tamper' }]) {
    await assert.rejects(s.login({ ...input, email: 'operator@example.test', password: 'test-password' }), (e) => e instanceof OperatorError && e.status === 403);
  }
  assert.equal(s.calls.length, 0);
});
test('challenge expires and cannot be substituted for session', async () => {
  const s = service(); const c = s.createChallenge();
  await assert.rejects(s.authorize(c.cookie), OperatorError);
  s.clock(instant + 15 * 60_000);
  await assert.rejects(s.login({ request: request(), csrf: c.csrf, challengeCookie: c.cookie, email: 'x@example.test', password: 'p' }), OperatorError);
});
test('unverified, inactive, missing and unallowlisted users cannot get operator sessions', async () => {
  for (const blocked of [{ ...user, email_verified: false }, { ...user, status: 'suspended' }, { ...user, id: 'ordinary' }, { ...user, status: undefined }, {}]) {
    await assert.rejects(login(service([{ access_token: 'token', user: blocked }])), (e) => e instanceof OperatorError && e.status === 403);
  }
});
test('protected access rechecks current account, status, verification and auth version', async () => {
  for (const current of [{ ...user, email_verified: false }, { ...user, id: 'other' }, { ...user, status: 'disabled' }, { ...user, auth_version: 1 }, { httpStatus: 401 }]) {
    const { s, cookie } = await login(service([{ access_token: 'token', user }, current]));
    await assert.rejects(s.authorize(cookie), OperatorError);
  }
});
test('backend outage denies access and does not reveal provider errors', async () => {
  const { s, cookie } = await login(service([{ access_token: 'token', user }, new Error('private provider secret')]));
  await assert.rejects(s.authorize(cookie), (e) => e instanceof OperatorError && e.status === 503 && !e.message.includes('secret'));
});
test('login attempts have a bounded per-instance budget in addition to backend throttling', async () => {
  const s = service(Array.from({ length: 12 }, () => ({ httpStatus: 401 })));
  const c = s.createChallenge();
  const args = { request: request(), csrf: c.csrf, challengeCookie: c.cookie, email: 'operator@example.test', password: 'bad' };
  for (let i = 0; i < 5; i++) await assert.rejects(s.login(args), (e) => e instanceof OperatorError && e.status === 401);
  await assert.rejects(s.login(args), (e) => e instanceof OperatorError && e.status === 429);
  assert.equal(s.calls.length, 5);
});
test('session action CSRF cannot be replayed from a different operator session', async () => {
  const first = await login(); const second = await login();
  first.s.assertAction(request(), first.csrf, first.csrf);
  assert.throws(() => first.s.assertAction(request(), first.csrf, second.csrf), OperatorError);
  assert.throws(() => first.s.assertAction(request('https://attacker.test'), first.csrf, first.csrf), OperatorError);
});
