import { getApiBase } from '$lib/server/authApi.js';
import { proxyPublicBilling } from '$lib/server/billingApi.js';

/** GET /api/billing/public-catalog — GET {NALANA_API_BASE}/v1/billing/public-catalog (no auth) */
export function GET() {
  return proxyPublicBilling({ base: getApiBase(), path: '/v1/billing/public-catalog' });
}
