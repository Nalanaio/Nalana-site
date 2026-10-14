import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from '../src/lib/auth/session.js';
import { normalizeVerification, verificationPhase } from '../src/lib/verification/policy.js';
import { claimVerificationPrompt } from '../src/lib/verification/prompts.js';

export const policy = { policy_version: 1, state: 'grace', grace_started_at: '2026-10-12T18:00:00Z', grace_expires_at: '2026-10-14T18:00:00Z', server_time: '2026-10-12T18:00:00Z', enforcement_enabled: true, cloud_actions_allowed: true, next_reminder_at: null, resend_available_at: null };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('token-only refresh keeps complete user and merges top-level policy', async () => {
  let calls = 0;
  const updated = { ...policy, state: 'required', cloud_actions_allowed: false };
  const controller = createSessionController({ fetch: async () => [response({}, 401), response({ token: 'new', refresh_token: 'rotated', verification: updated }), response({}, 503)][calls++] });
  controller.setSession('old', { id: 'A', email: 'a@example.test' }, 'refresh');
  assert.equal(await controller.refreshSession(), true);
  assert.equal(controller.current.user.id, 'A');
  assert.equal(controller.current.user.verification.cloud_actions_allowed, false);
  assert.equal(controller.current.refreshToken, 'rotated');
});
test('late A response cannot overwrite B login, and B never inherits A refresh', async () => {
  let resolve = (_value) => {};
  const controller = createSessionController({ fetch: () => new Promise((r) => { resolve = r; }) });
  controller.setSession('A', { id: 'A' }, 'refresh-A');
  const pending = controller.refreshSession();
  controller.setSession('B', { id: 'B' });
  resolve(response({ user: { id: 'A' } }));
  await pending;
  assert.equal(controller.current.token, 'B');
  assert.equal(controller.current.refreshToken, null);
});
test('refresh is single flight and network failure keeps recovery session', async () => {
  let calls = 0;
  const controller = createSessionController({ fetch: async () => { calls++; throw new Error('offline'); } });
  controller.setSession('A', { id: 'A' }, 'R');
  await Promise.all([controller.refreshSession(), controller.refreshSession()]);
  assert.equal(calls, 1);
  assert.equal(controller.current.token, 'A');
});
test('revoked session clears credentials and unavailable storage is harmless', async () => {
  const controller = createSessionController({ storage: { setItem() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } }, fetch: async () => response({}, 401) });
  controller.setSession('A', { id: 'A' });
  assert.equal(await controller.refreshSession(), false);
  assert.equal(controller.current.token, null);
});
test('unknown policy stays unknown and enforcement rollback uses effective permission', () => {
  assert.equal(normalizeVerification({ state: 'grace' }), null);
  assert.equal(verificationPhase(null), 'unavailable');
  assert.equal(verificationPhase({ ...policy, state: 'required', enforcement_enabled: false, cloud_actions_allowed: true }), 'initial');
  assert.equal(verificationPhase({ ...policy, server_time: '2026-10-13T18:00:00Z' }), 'warning');
  assert.equal(verificationPhase({ ...policy, state: 'required', cloud_actions_allowed: false }), 'required');
});
test('prompt is once per session and phase, independent of telemetry permission', () => {
  assert.equal(claimVerificationPrompt(100, 'initial'), true);
  assert.equal(claimVerificationPrompt(100, 'initial'), false);
  assert.equal(claimVerificationPrompt(100, 'warning'), true);
  assert.equal(claimVerificationPrompt(100, 'required'), true);
  assert.equal(claimVerificationPrompt(101, 'initial'), true);
  assert.equal(claimVerificationPrompt(101, 'unavailable'), false);
});
test('restored sessions do not trust persisted capabilities and updates do not rotate epoch', () => {
  const storage = { getItem: (key) => key === 'nalana_session_v1' ? JSON.stringify({ token: 'A', user: { id: 'A', verification: policy } }) : null, setItem() {}, removeItem() {} };
  const controller = createSessionController({ storage });
  assert.equal(controller.current.user.verification, null);
  const epoch = controller.current.sessionEpoch;
  controller.updateVerification(policy);
  assert.equal(controller.current.sessionEpoch, epoch);
  assert.deepEqual(controller.current.user.verification, policy);
});
test('logout clears immediately even if private operator-cookie cleanup fails', () => {
  const controller = createSessionController({ logout: () => { throw new Error('offline'); } });
  controller.setSession('A', { id: 'A' }, 'refresh');
  assert.doesNotThrow(() => controller.logout());
  assert.equal(controller.current.token, null);
  assert.equal(controller.current.refreshToken, null);
});
test('profile response after account replacement cannot change the new user', () => {
  const controller = createSessionController();
  controller.setSession('A', { id: 'A' }, 'refresh');
  const epoch = controller.current.sessionEpoch;
  controller.setSession('B', { id: 'B' });
  controller.updateUser({ id: 'A', display_name: 'stale' }, epoch);
  assert.equal(controller.current.user.id, 'B');
  controller.setSession('mock_jwt_bad', { id: 'fake' });
  assert.equal(controller.current.token, null);
});
