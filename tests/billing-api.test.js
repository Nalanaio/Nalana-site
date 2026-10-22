import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyBilling, billingError, checkoutBody, validIdempotencyKey, validPurchaseId } from '../src/lib/server/billingApi.js';

const ORIGIN = 'https://www.nalana.io';
const req = (path, { method = 'GET', auth = 'Bearer tok', origin = ORIGIN } = {}) =>
  new Request(`${ORIGIN}${path}`, { method, headers: { ...(auth ? { Authorization: auth } : {}), ...(origin ? { origin } : {}) } });
const backend = (status, body, seen = []) => async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify(body), { status }); };

test('forwards bearer, idempotency key, and body to the backend', async () => {
  const seen = [];
  const res = await proxyBilling({ base: 'https://api.test', request: req('/api/billing/checkouts', { method: 'POST' }), path: '/v1/billing/checkouts', method: 'POST',
    body: { product_key: 'pro_monthly', purchase_kind: 'subscription' }, idempotencyKey: 'web-abcdefghijklmnop', fetch: backend(200, { purchase_id: 'p', url: 'https://checkout.stripe.com/x', status: 'awaiting_payment' }, seen) });
  assert.equal(res.status, 200);
  assert.equal(seen[0].url, 'https://api.test/v1/billing/checkouts');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(seen[0].init.headers['Idempotency-Key'], 'web-abcdefghijklmnop');
  assert.deepEqual(JSON.parse(seen[0].init.body), { product_key: 'pro_monthly', purchase_kind: 'subscription' });
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
});

test('rejects missing auth, cross-origin writes, and missing base without calling the backend', async () => {
  const seen = [];
  const f = backend(200, {}, seen);
  assert.equal((await proxyBilling({ base: 'https://api.test', request: req('/x', { auth: null }), path: '/v1/x', fetch: f })).status, 401);
  assert.equal((await proxyBilling({ base: 'https://api.test', request: req('/x', { auth: 'Bearer mock_jwt_1' }), path: '/v1/x', fetch: f })).status, 401);
  assert.equal((await proxyBilling({ base: 'https://api.test', request: req('/x', { method: 'POST', origin: 'https://evil.io' }), path: '/v1/x', method: 'POST', fetch: f })).status, 403);
  assert.equal((await proxyBilling({ base: null, request: req('/x'), path: '/v1/x', fetch: f })).status, 503);
  assert.equal(seen.length, 0);
});

test('FastAPI detail codes map to fixed customer messages', async () => {
  const res = await proxyBilling({ base: 'https://api.test', request: req('/x'), path: '/v1/billing/portal-sessions',
    fetch: backend(404, { detail: { code: 'PAYMENT_CUSTOMER_NOT_FOUND', message: 'PAYMENT_CUSTOMER_NOT_FOUND' } }) });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'There is no subscription to manage on this account yet.', code: 'PAYMENT_CUSTOMER_NOT_FOUND' });
  assert.deepEqual(billingError(503, { detail: { code: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' } }), { error: 'Billing is temporarily unavailable. Please try again shortly.', code: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' });
  assert.deepEqual(billingError(400, { detail: 'raw <b>html</b>' }), { error: 'Billing request failed. Please try again.' });
});

test('network failure is a 503, not a leak', async () => {
  const res = await proxyBilling({ base: 'https://api.test', request: req('/x'), path: '/v1/credits/balance', fetch: async () => { throw new Error('ECONNREFUSED secret'); } });
  assert.equal(res.status, 503);
  assert.doesNotMatch(JSON.stringify(await res.json()), /secret/);
});

test('input validators', () => {
  assert.deepEqual(checkoutBody({ product_key: 'pro_monthly', purchase_kind: 'subscription', extra: 1 }), { product_key: 'pro_monthly', purchase_kind: 'subscription' });
  for (const bad of [null, [], { product_key: '', purchase_kind: 'subscription' }, { product_key: 'a/b', purchase_kind: 'subscription' }, { product_key: 'p', purchase_kind: 'gift' }]) assert.equal(checkoutBody(bad), null);
  assert.equal(validIdempotencyKey('web-3f0c9a4e-1b2d-4c5e-8f90-123456789abc'), true);
  for (const bad of [null, 'short', 'has space in it ok?', 'x'.repeat(129)]) assert.equal(validIdempotencyKey(bad), false);
  assert.equal(validPurchaseId('3f0c9a4e-1b2d-4c5e-8f90-123456789abc'), true);
  assert.equal(validPurchaseId('../../v1/admin'), false);
});
