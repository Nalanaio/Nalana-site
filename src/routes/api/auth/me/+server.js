import { json } from '@sveltejs/kit';
import { proxyAuthenticated, proxyMe } from '#lib/server/authApi.js';

/**
 * GET /api/auth/me — GET {NALANA_API_BASE}/v1/users/me
 * PATCH /api/auth/me — PATCH {NALANA_API_BASE}/v1/users/me
 */
export async function GET(event) {
  return proxyMe(event);
}

export async function PATCH(event) {
  const { request } = event;
  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (typeof body.display_name === 'string') {
    patch.display_name = body.display_name.trim();
  }
  if (body.avatar_url === null || body.avatar_url === '') {
    patch.avatar_url = null;
  } else if (typeof body.avatar_url === 'string') {
    patch.avatar_url = body.avatar_url.trim();
  }

  if (!Object.keys(patch).length) {
    return json({ error: 'Nothing to update.' }, { status: 400 });
  }

  return proxyAuthenticated('/v1/users/me', event, {
    method: 'PATCH',
    body: patch,
  });
}
