import { readAuthRecoveryRequest } from '#lib/server/auth-request.js';
import { json } from '@sveltejs/kit';
import { proxyAuth } from '#lib/server/authApi.js';

/**
 * POST /api/auth/login
 * Proxies to POST {NALANA_API_BASE}/v1/auth/login
 */
export async function POST(event) {
  const { request } = event;
  const parsed = await readAuthRecoveryRequest(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const { email, password } = body;

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  return proxyAuth('/v1/auth/login', { email, password }, { mode: 'login', event });
}
