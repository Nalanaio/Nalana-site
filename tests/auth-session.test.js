import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from '../src/lib/auth/session.js';
import { setCsrf, cookieRequest, cancelAuthRequests } from '../src/lib/auth/cookieClient.js';
import { normalizeVerification, verificationPhase } from '../src/lib/verification/policy.js';
import { claimVerificationPrompt } from '../src/lib/verification/prompts.js';
const policy = { policy_version: 1, state: 'grace', grace_started_at: '2026-10-12T18:00:00Z', grace_expires_at: '2026-10-14T18:00:00Z', server_time: '2026-10-12T18:00:00Z', enforcement_enabled: true, cloud_actions_allowed: true, next_reminder_at: null, resend_available_at: null };
const response = (data, status = 200) => Response.json(data, { status });
setCsrf('fixture-csrf');
test('metadata-only bootstrap and refresh preserve complete user without credentials', async () => {
  const calls = [], results = [response({}, 401), response({ csrf_token: 'fixture-csrf' }), response({ user: { id: 'A', verification: policy } })];
  const controller = createSessionController({ fetch: async (path, init) => { calls.push({ path, init }); return results.shift(); } });
  assert.equal(await controller.refreshSession(), true);
  assert.equal(controller.current.user.id, 'A'); assert.deepEqual(controller.current.user.verification, policy);
  assert.equal('token' in controller.current, false); assert.equal('refreshToken' in controller.current, false);
  assert.ok(calls.every(call => !new Headers(call.init.headers).has('authorization')));
  assert.equal(new Headers(calls[1].init.headers).get('x-csrf-token'), 'fixture-csrf');
});
test('late account A response cannot overwrite account B login', async () => {
  let resolve = (_response) => {}; const controller = createSessionController({ fetch: () => new Promise(r => { resolve = r; }) });
  controller.setSession({ id: 'A' }); const pending = controller.refreshSession();
  await new Promise(r => setTimeout(r, 0)); controller.setSession({ id: 'B' }); resolve(response({ user: { id: 'A' } }));
  await pending; assert.equal(controller.current.user.id, 'B');
});
test('single-flight offline refresh preserves recovery metadata', async () => {
  let calls = 0; const controller = createSessionController({ fetch: async () => { calls++; throw new Error('offline'); } });
  controller.setSession({ id: 'A' }); await Promise.all([controller.refreshSession(), controller.refreshSession()]);
  assert.equal(calls, 1); assert.equal(controller.current.user.id, 'A'); assert.match(controller.current.error, /connection/);
});
test('legacy credentials are deleted without being adopted or parsed', () => {
  const removed = [], controller = createSessionController({ storage: { getItem: () => 'legacy-credential', removeItem: key => removed.push(key) } });
  assert.equal(controller.current.signedIn, false); assert.equal(controller.current.legacyCleared, true); assert.equal(removed.length, 4);
});
test('logout clears immediately and fences an in-flight account read', async () => {
  let resolve = (_response) => {}; const controller = createSessionController({ fetch: path => path === '/api/auth/me' ? new Promise(r => { resolve = r; }) : Promise.resolve(response({ csrf_token: 'after-logout' })) });
  controller.setSession({ id: 'A' }); const pending = controller.refreshSession(); await new Promise(r => setTimeout(r, 0));
  await controller.logout(); resolve(response({ user: { id: 'A' } })); await pending; assert.equal(controller.current.signedIn, false);
});
test('profile and verification updates respect account epoch', () => {
  const controller = createSessionController(); controller.setSession({ id: 'A' }); const epoch = controller.current.sessionEpoch;
  controller.updateVerification(policy); assert.equal(controller.current.sessionEpoch, epoch); controller.setSession({ id: 'B' }); controller.updateUser({ id: 'A' }, epoch); assert.equal(controller.current.user.id, 'B');
});
test('verification policy and prompt phases remain independent from analytics', () => {
  assert.equal(normalizeVerification({ state: 'grace' }), null); assert.equal(verificationPhase(null), 'unavailable'); assert.equal(verificationPhase({ ...policy, state: 'required', enforcement_enabled: false, cloud_actions_allowed: true }), 'initial');
  assert.equal(claimVerificationPrompt(100, 'initial'), true); assert.equal(claimVerificationPrompt(100, 'initial'), false); assert.equal(claimVerificationPrompt(100, 'warning'), true);
});

test('logout during delayed preflight aborts password submission before credentials leave the page', async () => {
  let resolve = (_response) => {}, passwordCalls = 0;
  const fetcher = async path => { if (path === '/api/auth/prepare') return new Promise(r => { resolve = r; }); passwordCalls++; return response({}); };
  const pending = cookieRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'fixture@example.test', password: 'test-only' }) }, fetcher);
  await new Promise(r => setTimeout(r, 0)); cancelAuthRequests(); resolve(response({ csrf_token: 'newer-preflight' }));
  await assert.rejects(pending, /attempt changed/); assert.equal(passwordCalls, 0);
});

test('signed-out retry notice remains reachable until a real logout retry confirms original revocation', async () => {
  let attempts = 0; const controller = createSessionController({ fetch: async () => ++attempts === 1 ? response({ revocation_pending: true, csrf_token: 'retry-csrf' }, 503) : response({ revocation_pending: false, csrf_token: 'done-csrf' }) });
  controller.setSession({ id: 'account' }); await controller.logout();
  assert.equal(controller.current.signedIn, false); assert.equal(controller.current.logoutPending, true); assert.match(controller.current.error, /revocation/);
  await controller.logout(); assert.equal(controller.current.signedIn, false); assert.equal(controller.current.logoutPending, false); assert.equal(controller.current.error, null);
});
