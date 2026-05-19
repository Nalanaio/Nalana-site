import { json } from '@sveltejs/kit';
import { proxyBackend } from '$lib/server/authApi.js';

/**
 * POST /api/auth/reset-password
 * Proxies to POST {NALANA_API_BASE}/v1/auth/reset-password
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { token, password } = body;

  if (!token) {
    return json({ error: 'Reset link is invalid or missing.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  return proxyBackend('/v1/auth/reset-password', { token, password });
}
