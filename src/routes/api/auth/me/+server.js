import { json } from '@sveltejs/kit';
import { proxyAuthenticated, proxyMe } from '$lib/server/authApi.js';

/**
 * GET /api/auth/me — GET {NALANA_API_BASE}/v1/users/me
 * PATCH /api/auth/me — PATCH {NALANA_API_BASE}/v1/users/me
 */
export async function GET({ request }) {
  return proxyMe(request.headers.get('Authorization'));
}

export async function PATCH({ request }) {
  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (typeof body.display_name === 'string') {
    patch.display_name = body.display_name.trim();
  }
  if (typeof body.avatar_url === 'string') {
    patch.avatar_url = body.avatar_url.trim();
  }

  if (!Object.keys(patch).length) {
    return json({ error: 'Nothing to update.' }, { status: 400 });
  }

  return proxyAuthenticated('/v1/users/me', request, {
    method: 'PATCH',
    body: patch,
  });
}
