import { json } from '@sveltejs/kit';
import { proxyBackend } from '$lib/server/authApi.js';

/**
 * POST /api/auth/forgot-password
 * Proxies to POST {NALANA_API_BASE}/v1/auth/forgot-password
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  return proxyBackend('/v1/auth/forgot-password', { email });
}
