import { proxyMe } from '$lib/server/authApi.js';

/**
 * GET /api/auth/me
 * Proxies to GET {NALANA_API_BASE}/v1/users/me (falls back to /users/me)
 */
export async function GET({ request }) {
  return proxyMe(request.headers.get('Authorization'));
}
