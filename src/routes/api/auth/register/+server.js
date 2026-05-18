import { json } from '@sveltejs/kit';
import { proxyAuth } from '$lib/server/authApi.js';

/**
 * POST /api/auth/register
 * Proxies to POST {NALANA_API_BASE}/v1/auth/register
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email, password, name } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!name || name.trim().length < 1) {
    return json({ error: 'Name is required.' }, { status: 400 });
  }

  return proxyAuth(
    '/v1/auth/register',
    { email, password, name: name.trim() },
    { mode: 'signup' }
  );
}
