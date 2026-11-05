import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientLabelHeaders, CLIENT_HEADER, CLIENT_LABEL } from '../src/lib/server/client-label.js';
import { createOperatorService } from '../src/lib/server/operator-auth.js';

test('only register and login carry the client label', () => {
  assert.equal(CLIENT_HEADER, 'X-Nalana-Client');
  assert.equal(CLIENT_LABEL, 'site');
  assert.deepEqual(clientLabelHeaders('/v1/auth/register'), { 'X-Nalana-Client': 'site' });
  assert.deepEqual(clientLabelHeaders('/v1/auth/login'), { 'X-Nalana-Client': 'site' });
  for (const path of ['/v1/auth/refresh', '/v1/auth/forgot-password', '/v1/auth/reset-password', '/v1/auth/verify-email', '/v1/auth/change-email', '/v1/users/me', '/v1/auth/login/extra', '']) {
    assert.deepEqual(clientLabelHeaders(path), {}, path);
  }
});

test('operator login to the backend is labelled as the site; its other calls are not', async () => {
  const calls = [];
  const operatorUser = { id: 'operator-1', email_verified: true, status: 'active', auth_version: 0 };
  const service = createOperatorService(
    { SITE_ACQUISITION_REPORTS_ENABLED: 'true', OPERATOR_ALLOWED_ACCOUNT_IDS: 'operator-1', OPERATOR_SESSION_KEY: 'test-key-only-012345678901234567890123456789', NALANA_API_BASE: 'http://localhost:8000' },
    { fetchImpl: async (url, options) => { calls.push({ url, headers: options.headers }); return new Response(JSON.stringify(calls.length === 1 ? { access_token: 'private-account-token', user: operatorUser } : operatorUser), { status: 200 }); } }
  );
  const challenge = service.createChallenge();
  const request = new Request('https://nalana.test/operator/login', { method: 'POST', headers: { origin: 'https://nalana.test' } });
  const { cookie } = await service.login({ request, challengeCookie: challenge.cookie, csrf: challenge.csrf, email: 'operator@example.test', password: 'test-password' });
  assert.equal(calls[0].url, 'http://localhost:8000/v1/auth/login');
  assert.equal(calls[0].headers['X-Nalana-Client'], 'site');
  await service.authorize(cookie);
  assert.equal(calls.at(-1).url, 'http://localhost:8000/v1/users/me');
  assert.equal(calls.at(-1).headers['X-Nalana-Client'], undefined);
});

test('proxyAuth applies the label from client-label.js and no route sets it by hand', () => {
  // The end-to-end check against a loopback backend lives in auth-routes.test.js,
  // which already owns the suite's single Vite server.
  assert.match(readFileSync('src/lib/server/authApi.js', 'utf-8'), /\.\.\.clientLabelHeaders\(path\)/);
  assert.equal(/X-Nalana-Client/i.test(readFileSync('src/lib/server/authApi.js', 'utf-8')), false);
});
