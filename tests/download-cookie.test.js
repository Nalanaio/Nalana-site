import assert from 'node:assert/strict';
import test from 'node:test';
import { mintSubject, verifySubject, mintRetry, verifyRetry, establishDownloadSubject } from '../src/lib/server/download-cookie.js';

const env = { NALANA_DOWNLOAD_COOKIE_KEYS: JSON.stringify({ current: 'a'.repeat(48), old: 'b'.repeat(48) }), NALANA_DOWNLOAD_COOKIE_KEY_ID: 'current', NALANA_ENVIRONMENT: 'test' };
const now = 1_800_000_000;
test('subject is signed, deployment bound and expires after a non-sliding day', () => {
  const token = mintSubject(env, now);
  const subject = verifySubject(token, env, now);
  assert.match(subject.subject, /^[a-f0-9]{32}$/);
  assert.equal(subject.expires_at - subject.issued_at, 86400);
  assert.equal(verifySubject(token, env, now + 86400), null);
  assert.equal(verifySubject(token + 'x', env, now), null);
  assert.equal(verifySubject(token, { ...env, NALANA_ENVIRONMENT: 'production' }, now), null);
  assert.equal(verifySubject(token, env, now - 301), null);
});
test('one signed platform-bound retry does not turn into a redirect loop', () => {
  const token = mintRetry('windows', env, now);
  assert.equal(verifyRetry(token, 'windows', env, now), true);
  assert.equal(verifyRetry(token, 'mac', env, now), false);
  assert.equal(verifyRetry(token, 'windows', env, now + 301), false);
  assert.equal(verifyRetry('1', 'windows', env, now), false);
  const values = new Map();
  const writes = [];
  const cookies = { get: name => values.get(name), set: (...args) => writes.push(args) };
  const first = establishDownloadSubject({ cookies, url: new URL('https://nalana.io/api/download?platform=windows&return=https://evil.test'), platform: 'windows', env, now });
  assert.match(first.retryUrl, /^\/api\/download\?platform=windows&_retry=/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][2].httpOnly, true);
  assert.equal(writes[0][2].secure, true);
  const second = establishDownloadSubject({ cookies, url: new URL(first.retryUrl, 'https://nalana.io'), platform: 'windows', env, now });
  assert.equal(second.retryUrl, null);
  assert.equal(second.subject, null);
});
test('returned cookie proves eligibility without refreshing its expiration', () => {
  const token = mintSubject(env, now);
  const cookies = { get: () => token, set: () => assert.fail('must not slide cookie lifetime') };
  const result = establishDownloadSubject({ cookies, url: new URL('https://nalana.io/api/download?platform=mac'), platform: 'mac', env, now: now + 100 });
  assert.equal(result.subject, token);
  assert.equal(result.retryUrl, null);
});
test('missing signing configuration proceeds without alert eligibility', () => {
  const result = establishDownloadSubject({ cookies: { get: () => null, set: () => assert.fail() }, url: new URL('https://nalana.io/api/download?platform=mac'), platform: 'mac', env: {}, now });
  assert.deepEqual(result, { subject: null, retryUrl: null });
});
test('key rotation accepts retained old key and rejects it once removed', () => {
  const token = mintSubject({ ...env, NALANA_DOWNLOAD_COOKIE_KEY_ID: 'old' }, now);
  assert.ok(verifySubject(token, env, now));
  assert.equal(verifySubject(token, { ...env, NALANA_DOWNLOAD_COOKIE_KEYS: JSON.stringify({ current: 'a'.repeat(48) }) }, now), null);
});
