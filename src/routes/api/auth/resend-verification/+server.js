import { json } from '@sveltejs/kit';
import { proxyBackend } from '$lib/server/authApi.js';

/**
 * POST /api/auth/resend-verification
 * Proxies to POST {NALANA_API_BASE}/v1/auth/resend-verification
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address.' }, { status: 400 });
  }

  return proxyBackend('/v1/auth/resend-verification', { email });
}
