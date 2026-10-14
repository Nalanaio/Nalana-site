import { json } from '@sveltejs/kit';
import { proxyBackend, normalizeUser } from '$lib/server/authApi.js';
import { readAuthRecoveryRequest } from '$lib/server/auth-request.js';

/**
 * POST /api/auth/verify-email
 * Proxies to POST {NALANA_API_BASE}/v1/auth/verify-email
 */
export async function POST({ request }) {
  const parsed = await readAuthRecoveryRequest(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const { token } = body;

  if (!token || typeof token !== 'string' || token.length > 4096) {
    return json({ error: 'Verification token is required.' }, { status: 400 });
  }

  const payload = { token };

  const res = await proxyBackend('/v1/auth/verify-email', payload);
  const data = await res.json();

  if (!res.ok) {
    return json(data, { status: res.status });
  }

  return json({ user: normalizeUser(data.user ?? data, data) }, { status: 200 });
}
