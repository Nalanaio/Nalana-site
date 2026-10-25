import { getApiBase } from '$lib/server/authApi.js';
import { proxyBilling } from '$lib/server/billingApi.js';

/** GET /api/credits/balance — GET {NALANA_API_BASE}/v1/credits/balance */
export function GET({ request }) {
  return proxyBilling({ base: getApiBase(), request, path: '/v1/credits/balance' });
}
