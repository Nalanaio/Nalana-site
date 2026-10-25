import { getApiBase } from '#lib/server/authApi.js';
import { proxyBilling } from '#lib/server/billingApi.js';

/** GET /api/billing/catalog — GET {NALANA_API_BASE}/v1/billing/catalog */
export function GET({ request }) {
  return proxyBilling({ base: getApiBase(), request, path: '/v1/billing/catalog' });
}
