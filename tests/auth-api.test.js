import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthResponse, normalizeUser, safeAuthError } from '../src/lib/auth/projection.js';
const policy = { policy_version: 1, state: 'required', grace_started_at: '2026-10-12T18:00:00Z', grace_expires_at: '2026-10-14T18:00:00Z', server_time: '2026-10-14T18:00:00Z', enforcement_enabled: false, cloud_actions_allowed: true, next_reminder_at: null, resend_available_at: null };
test('normal auth and bare user preserve exact policy without backend extras', () => {
  const user = normalizeUser({ id: 2, email: 'test@example.test', verification: policy, secret: 'no' });
  assert.deepEqual(user.verification, policy);
  assert.equal(user.secret, undefined);
  assert.deepEqual(normalizeAuthResponse({ access_token: 'access', user: { id: 2, verification: policy } }).user.verification, policy);
});
test('token-only refresh never manufactures a user', () => {
  const projected = normalizeAuthResponse({ access_token: 'access', refresh_token: 'refresh', verification: policy });
  assert.equal(projected.user, undefined);
  assert.deepEqual(projected.verification, policy);
});
test('safe errors preserve old string and approved metadata only', () => {
  const error = safeAuthError(403, { detail: 'Please verify your email.', code: 'EMAIL_VERIFICATION_REQUIRED', verification: policy, retry_after_seconds: 60, request_id: 'req', access_token: 'secret', internals: 'secret' });
  assert.equal(error.error, 'Please verify your email.');
  assert.equal(error.code, 'EMAIL_VERIFICATION_REQUIRED');
  assert.equal(error.retry_after_seconds, 60);
  assert.equal(error.access_token, undefined);
  assert.equal(error.internals, undefined);
  assert.equal(typeof safeAuthError(403, { detail: { secret: 'secret' } }).error, 'string');
});
