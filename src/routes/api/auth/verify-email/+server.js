import { json } from '@sveltejs/kit';
import { proxyBackend, normalizeUser } from '$lib/server/authApi.js';

/**
 * POST /api/auth/verify-email
 * Proxies to POST {NALANA_API_BASE}/v1/auth/verify-email
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { token } = body;

  if (!token || typeof token !== 'string') {
    return json({ error: 'Verification token is required.' }, { status: 400 });
  }

  const res = await proxyBackend('/v1/auth/verify-email', { token });
  const data = await res.json();

  if (!res.ok) {
    return json(data, { status: res.status });
  }

  return json({ user: normalizeUser(data.user ?? data, data) }, { status: 200 });
}
