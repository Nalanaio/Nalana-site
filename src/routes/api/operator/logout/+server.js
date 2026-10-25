import { json } from '@sveltejs/kit';
import { OPERATOR_COOKIE, OPERATOR_CHALLENGE_COOKIE } from '#lib/server/operator-auth.js';

/** Ordinary account logout can clear its private operator browser session too. Exact Origin is the CSRF boundary. */
export function POST({ request, cookies, setHeaders }) {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, { status: 403 });
  cookies.delete(OPERATOR_COOKIE, { path: '/' });
  cookies.delete(OPERATOR_CHALLENGE_COOKIE, { path: '/' });
  return new Response(null, { status: 204 });
}
