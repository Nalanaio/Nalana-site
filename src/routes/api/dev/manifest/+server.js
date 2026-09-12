import { json } from '@sveltejs/kit';
import { proxyMe } from '$lib/server/authApi.js';
import { loadDevManifest } from '$lib/server/dev-release.js';
import { isDevAllowedEmail } from '$lib/server/dev-access.js';

export async function GET({ request, fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Sign in to access dev builds.' }, { status: 401 });
  }

  const meRes = await proxyMe(authHeader);
  if (!meRes.ok) {
    return json({ error: 'Invalid or expired session. Please sign in again.' }, { status: 401 });
  }

  const meData = await meRes.json().catch(() => ({}));
  const email = meData.user?.email;

  if (!email || !isDevAllowedEmail(email)) {
    return json(
      {
        error: 'Access restricted. Your account is not authorized for internal developer builds.',
        email: email || null,
        unauthorized: true,
      },
      { status: 403 }
    );
  }

  const { manifest, error } = await loadDevManifest(fetch);
  if (error) {
    return json({ error, user: meData.user }, { status: 503 });
  }

  return json({ manifest, user: meData.user });
}
