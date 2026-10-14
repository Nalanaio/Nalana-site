import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuthRecoveryRequest } from '../src/lib/server/auth-request.js';

const request = (body, headers = {}) => new Request('https://nalana.test/api/auth/change-email', { method: 'POST', headers: { origin: 'https://nalana.test', 'content-type': 'application/json', ...headers }, body });
test('bounds UTF-8 bytes even if content length is missing or lies', async () => {
  const oversized = JSON.stringify({ padding: 'é'.repeat(5000) });
  for (const headers of [{}, { 'content-length': '2' }]) {
    const result = await readAuthRecoveryRequest(request(oversized, headers));
    assert.equal(result.response.status, 413);
    assert.deepEqual(await result.response.json(), { error: 'Request is too large.' });
  }
});
test('rejects declared oversize, malformed UTF-8, arrays and wrong content type safely', async () => {
  for (const [body, headers, status] of [ ['{}', { 'content-length': '9000' }, 413], ['[]', {}, 400], ['null', {}, 400], ['{}', { 'content-type': 'text/plain' }, 415], [new Uint8Array([0xff]), {}, 400] ]) {
    const result = await readAuthRecoveryRequest(request(body, headers));
    assert.equal(result.response.status, status);
    assert.equal(result.response.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.response.headers.get('referrer-policy'), 'no-referrer');
  }
});
test('only exact origin JSON object can reach recovery handlers', async () => {
  assert.deepEqual((await readAuthRecoveryRequest(request('{"token":"proof"}'))).body, { token: 'proof' });
  for (const origin of ['null', 'https://nalana.test.attacker.example', 'https://nalana.test:444']) {
    assert.equal((await readAuthRecoveryRequest(request('{}', { origin }))).response.status, 403);
  }
});
