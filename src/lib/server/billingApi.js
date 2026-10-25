import { json } from '@sveltejs/kit';

const NO_STORE = { 'cache-control': 'private, no-store' };
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const PURCHASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_KEY = /^[A-Za-z0-9_.-]{1,128}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,79}$/;

/** Billing failures surface the backend's stable code and a fixed customer message. */
const MESSAGES = {
  IDEMPOTENCY_KEY_REQUIRED: 'Checkout could not start. Please try again.',
  INVALID_INTENT_KEY: 'Checkout could not start. Please try again.',
  INTENT_CONFLICT: 'This checkout was already started for a different plan. Refresh and try again.',
  PRODUCT_UNAVAILABLE: 'That plan is not available right now.',
  BILLING_ACCOUNT_RESTRICTED: 'Billing is restricted on this account. Contact support for help.',
  PAYMENT_CUSTOMER_NOT_FOUND: 'There is no subscription to manage on this account yet.',
  PURCHASE_NOT_FOUND: 'We could not find that purchase on this account.',
  CHECKOUT_REQUIRES_RECONCILIATION: 'This checkout needs a manual check. Contact support and we will sort it out.',
};

export const validIdempotencyKey = (value) => typeof value === 'string' && IDEMPOTENCY_KEY.test(value);
export const validPurchaseId = (value) => typeof value === 'string' && PURCHASE_ID.test(value);

/** @param {number} status @param {any} data */
export function billingError(status, data) {
  const detail = data?.detail && typeof data.detail === 'object' ? data.detail : data;
  const code = typeof detail?.code === 'string' && CODE.test(detail.code) ? detail.code : undefined;
  let error = code && MESSAGES[code];
  if (!error) {
    if (status === 401) error = 'Your session expired. Please sign in again.';
    else if (status === 429) error = 'Please wait a moment and try again.';
    else if (status >= 500) error = 'Billing is temporarily unavailable. Please try again shortly.';
    else error = 'Billing request failed. Please try again.';
  }
  return code ? { error, code } : { error };
}

const fail = (status, error, code) => json(code ? { error, code } : { error }, { status, headers: NO_STORE });

/**
 * Forwards one authenticated billing call. Card details never pass through the
 * site: checkout and the portal stay on Stripe-hosted pages.
 * @param {{ base: string|null, request: Request, path: string, method?: string, body?: unknown, idempotencyKey?: string|null, fetch?: typeof fetch }} options
 */
export async function proxyBilling({ base, request, path, method = 'GET', body, idempotencyKey = null, fetch: fetcher = fetch }) {
  if (!base) return fail(503, 'Billing is temporarily unavailable. Please try again shortly.');
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7).startsWith('mock_jwt_')) {
    return fail(401, 'Please sign in to continue.');
  }
  if (method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) {
    return fail(403, 'Invalid request origin.');
  }
  const headers = { Authorization: authHeader, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  try {
    const res = await fetcher(`${base}${path}`, {
      method, headers, signal: AbortSignal.timeout(15000),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) return json(billingError(res.status, data), { status: res.status, headers: NO_STORE });
    return json(data, { status: res.status, headers: NO_STORE });
  } catch {
    console.error(`[billing] ${method} ${path.split('/').slice(0, 4).join('/')} failed`);
    return fail(503, 'Billing is temporarily unavailable. Please try again shortly.');
  }
}

/**
 * Reads one public, unauthenticated billing document (plan copy only). The
 * visitor's credentials are never forwarded.
 * @param {{ base: string|null, path: string, fetch?: typeof fetch }} options
 */
export async function proxyPublicBilling({ base, path, fetch: fetcher = fetch }) {
  if (!base) return fail(503, 'Billing is temporarily unavailable. Please try again shortly.');
  try {
    const res = await fetcher(`${base}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) return json(billingError(res.status, data), { status: res.status, headers: NO_STORE });
    return json(data, { status: 200, headers: { 'cache-control': 'public, max-age=60' } });
  } catch {
    console.error(`[billing] GET ${path} failed`);
    return fail(503, 'Billing is temporarily unavailable. Please try again shortly.');
  }
}

/** @param {unknown} value */
export function checkoutBody(value) {
  const body = /** @type {any} */ (value);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.product_key !== 'string' || !PRODUCT_KEY.test(body.product_key)) return null;
  if (body.purchase_kind !== 'subscription' && body.purchase_kind !== 'top_up') return null;
  return { product_key: body.product_key, purchase_kind: body.purchase_kind };
}

export { fail as billingFailure };
