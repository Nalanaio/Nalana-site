import { json } from '@sveltejs/kit';
import { proxyAuth } from '$lib/server/authApi.js';

/**
 * POST /api/auth/refresh
 * Proxies to POST {NALANA_API_BASE}/v1/auth/refresh
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const refresh_token = body.refresh_token ?? body.refreshToken;

  if (!refresh_token) {
    return json({ error: 'Refresh token is required.' }, { status: 400 });
  }

  return proxyAuth('/v1/auth/refresh', { refresh_token });
}
