import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryProof } from '../src/lib/verification/recovery.js';
test('opening a scanner link never consumes proof; explicit confirmation does', async () => {
  let calls = 0;
  let replaced;
  const proof = createRecoveryProof('https://nalana.io/verify-email?token=proof&email=private@example.test', { replace: (url) => { replaced = url; }, fetch: async (_, options) => { calls++; assert.deepEqual(JSON.parse(options.body), { token: 'proof' }); return new Response('{}'); } });
  assert.equal(calls, 0);
  assert.equal(replaced, '/verify-email');
  assert.equal(proof.hasToken, true);
  assert.equal((await proof.confirm()).ok, true);
  assert.equal(calls, 1);
  assert.equal(proof.hasToken, false);
});
test('missing proof plus an email cannot verify an account', async () => {
  const proof = createRecoveryProof('https://nalana.io/verify-email?email=someone@example.test', { fetch: () => assert.fail('must not send') });
  assert.equal(proof.hasToken, false);
  assert.equal((await proof.confirm()).ok, false);
});
test('failed confirmation preserves proof for a deliberate retry and suppresses duplicate clicks', async () => {
  let resolve = (_value) => {};
  const proof = createRecoveryProof('https://nalana.io/verify-email?token=proof', { fetch: () => new Promise((r) => { resolve = r; }) });
  const first = proof.confirm();
  const second = proof.confirm();
  resolve(new Response('{}', { status: 503 }));
  await first; await second;
  assert.equal(proof.hasToken, true);
});
