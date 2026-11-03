import { getApiBase } from '#lib/server/authApi.js';
import { proxyBilling } from '#lib/server/billingApi.js';

/** GET /api/billing/catalog — GET {NALANA_API_BASE}/v1/billing/catalog */
export function GET(event) {
  const { request, params } = event;
  return proxyBilling({ base: getApiBase(), request, event, path: '/v1/billing/catalog' });
}
