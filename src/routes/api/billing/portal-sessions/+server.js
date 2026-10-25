import { getApiBase } from '$lib/server/authApi.js';
import { billingFailure, proxyBilling, validIdempotencyKey } from '$lib/server/billingApi.js';

/** POST /api/billing/portal-sessions — hosted Stripe customer portal URL. */
export function POST({ request }) {
  const key = request.headers.get('Idempotency-Key');
  if (!validIdempotencyKey(key)) return billingFailure(400, 'Could not open billing. Please try again.', 'IDEMPOTENCY_KEY_REQUIRED');
  return proxyBilling({ base: getApiBase(), request, path: '/v1/billing/portal-sessions', method: 'POST', idempotencyKey: key });
}
