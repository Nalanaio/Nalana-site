import { getApiBase } from '#lib/server/authApi.js';
import { billingFailure, checkoutBody, proxyBilling, validIdempotencyKey } from '#lib/server/billingApi.js';

/**
 * POST /api/billing/checkouts — POST {NALANA_API_BASE}/v1/billing/checkouts
 * Returns a hosted Stripe Checkout URL; the site never grants credits.
 */
export async function POST({ request }) {
  const key = request.headers.get('Idempotency-Key');
  if (!validIdempotencyKey(key)) return billingFailure(400, 'Checkout could not start. Please try again.', 'IDEMPOTENCY_KEY_REQUIRED');
  const body = checkoutBody(await request.json().catch(() => null));
  if (!body) return billingFailure(400, 'That plan is not available right now.', 'PRODUCT_UNAVAILABLE');
  return proxyBilling({ base: getApiBase(), request, path: '/v1/billing/checkouts', method: 'POST', body, idempotencyKey: key });
}
