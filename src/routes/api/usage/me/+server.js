import { proxyAuthenticated } from '#lib/server/authApi.js';

/**
 * GET /api/usage/me
 * Proxies to GET {NALANA_API_BASE}/v1/usage/me
 */
export async function GET(event) {
  return proxyAuthenticated('/v1/usage/me', event, { method: 'GET' });
}
