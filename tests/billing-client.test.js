import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogView, formatCredits, formatPrice, walletView, purchaseOutcome, pollPurchase, returnKind,
  trustedHostedUrl, savePendingPurchase, readPendingPurchase, clearPendingPurchase, newIdempotencyKey,
} from '../src/lib/billing/client.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const PID = '3f0c9a4e-1b2d-4c5e-8f90-123456789abc';

test('credits format from decimal strings without float math', () => {
  assert.equal(formatCredits('2000'), '2,000');
  assert.equal(formatCredits('6250.000000'), '6,250');
  assert.equal(formatCredits('12.500000'), '12.5');
  assert.equal(formatCredits('0.000001'), '0.000001');
  for (const bad of [2000, '-1', '1e3', '01', '', null, '1.1234567']) assert.equal(formatCredits(bad), null);
});

test('prices format from minor units', () => {
  assert.equal(formatPrice(2000, 'USD'), '$20');
  assert.equal(formatPrice(4999, 'usd'), '$49.99');
  for (const bad of [-1, 1.5, '2000', null]) assert.equal(formatPrice(bad), null);
});

test('catalog splits plans, sorts by price, and labels the better rate', () => {
  const view = catalogView({ checkout_enabled: true, products: [
    { product_key: 'super_monthly', purchase_kind: 'subscription', display_name: 'Super', currency: 'USD', price_minor: 5000, credits_decimal: '6250' },
    { product_key: 'pro_monthly', purchase_kind: 'subscription', display_name: 'Pro', currency: 'USD', price_minor: 2000, credits_decimal: '2000' },
    { product_key: 'pack_500', purchase_kind: 'top_up', display_name: '', currency: 'USD', price_minor: 500, credits_decimal: '500' },
    { product_key: 'broken', purchase_kind: 'subscription', currency: 'USD', price_minor: 'x', credits_decimal: '1' },
  ] });
  assert.equal(view.enabled, true);
  assert.deepEqual(view.subscriptions.map((p) => [p.name, p.price, p.credits, p.bonus]), [
    ['Pro', '$20', '2,000', null], ['Super', '$50', '6,250', '1.25× credits per dollar'],
  ]);
  assert.deepEqual(view.topUps.map((p) => p.name), ['pack_500']);
});

test('disabled or malformed catalog shows nothing purchasable', () => {
  for (const data of [null, {}, { checkout_enabled: false, products: [] }, { checkout_enabled: true, products: 'x' }, { checkout_enabled: true, products: [] }]) {
    assert.equal(catalogView(data).enabled, false);
  }
});

test('wallet reads balance fields and infers an active cycle only from a future end', () => {
  const now = Date.parse('2026-10-21T00:00:00Z');
  const base = { billing_mode: 'enforced', subscription_available: '2000.000000', top_up_available: '0.000000', available_to_start: '2000.000000', cycle_end: '2026-11-20T00:00:00Z' };
  const w = walletView(base, now);
  assert.equal(w.subscription, '2,000'); assert.equal(w.topUp, '0'); assert.equal(w.total, '2,000'); assert.equal(w.activeCycle, true);
  assert.equal(walletView({ ...base, cycle_end: '2026-10-01T00:00:00Z' }, now).activeCycle, false);
  assert.equal(walletView({ ...base, cycle_end: null }, now).activeCycle, false);
  assert.equal(walletView({ ...base, subscription_available: 5 }, now), null);
  assert.equal(walletView(null), null);
});

test('return kinds and purchase outcomes are closed sets', () => {
  assert.deepEqual(['success', 'cancel', 'portal', 'x', null].map(returnKind), ['success', 'cancel', 'portal', null, null]);
  assert.deepEqual(['granted', 'needs_reconciliation', 'pending_checkout', 'awaiting_payment', 'weird'].map(purchaseOutcome), ['granted', 'attention', 'pending', 'pending', 'unknown']);
});

test('hosted redirects must be exact https Stripe hosts', () => {
  assert.equal(trustedHostedUrl('https://checkout.stripe.com/c/pay/cs_test_1', 'checkout.stripe.com'), true);
  for (const url of ['http://checkout.stripe.com/x', 'https://checkout.stripe.com.evil.io/x', 'https://evil.io/?checkout.stripe.com', 'https://u:p@checkout.stripe.com/', 'https://checkout.stripe.com:444/', 'https://checkout.stripe.com/#x', 'javascript:alert(1)', null]) {
    assert.equal(trustedHostedUrl(url, 'checkout.stripe.com'), false, String(url));
  }
});

test('pending purchase is scoped to the user and expires', () => {
  const s = memory(); const t = 1_000_000;
  savePendingPurchase(s, { purchaseId: PID, userId: 'u1', productKey: 'pro_monthly' }, t);
  assert.deepEqual(readPendingPurchase(s, 'u1', t + 1000), { purchaseId: PID, productKey: 'pro_monthly' });
  assert.equal(readPendingPurchase(s, 'u2', t + 1000), null);
  assert.equal(readPendingPurchase(s, 'u1', t + 25 * 3600 * 1000), null);
  clearPendingPurchase(s);
  assert.equal(readPendingPurchase(s, 'u1', t), null);
  savePendingPurchase(s, { purchaseId: '../etc', userId: 'u1' }, t);
  assert.equal(readPendingPurchase(s, 'u1', t), null);
});

test('idempotency keys match the server route pattern', () => {
  assert.match(newIdempotencyKey(), /^[A-Za-z0-9_-]{16,128}$/);
});

const noSleep = async () => {};
const reads = (...results) => { let i = 0; return async () => results[Math.min(i++, results.length - 1)]; };

test('poll stops at granted after pending responses', async () => {
  const ticks = [];
  const outcome = await pollPurchase({ sleep: noSleep, onTick: (o) => ticks.push(o), read: reads(
    { ok: true, status: 200, data: { status: 'awaiting_payment' } },
    { ok: false, status: 503, data: {} },
    { ok: true, status: 200, data: { status: 'granted' } },
  ) });
  assert.equal(outcome, 'granted');
  assert.deepEqual(ticks, ['pending', 'granted']);
});

test('poll reports attention, not_found, unauthorized, timeout, and cancel', async () => {
  assert.equal(await pollPurchase({ sleep: noSleep, read: reads({ ok: true, status: 200, data: { status: 'needs_reconciliation' } }) }), 'attention');
  assert.equal(await pollPurchase({ sleep: noSleep, read: reads({ ok: false, status: 404, data: {} }) }), 'not_found');
  assert.equal(await pollPurchase({ sleep: noSleep, read: reads({ ok: false, status: 401, data: {} }) }), 'unauthorized');
  let calls = 0;
  assert.equal(await pollPurchase({ sleep: noSleep, delays: [1, 1], read: async () => { calls++; return { ok: true, status: 200, data: { status: 'awaiting_payment' } }; } }), 'pending');
  assert.equal(calls, 3);
  assert.equal(await pollPurchase({ sleep: noSleep, cancelled: () => true, read: reads({ ok: true, status: 200, data: { status: 'granted' } }) }), 'cancelled');
  assert.equal(await pollPurchase({ sleep: noSleep, delays: [], read: async () => { throw new Error('net'); } }), 'pending');
});
