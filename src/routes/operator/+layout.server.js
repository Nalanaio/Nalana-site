import { error, redirect } from '@sveltejs/kit';
import { OPERATOR_COOKIE, OperatorError } from '#lib/server/operator-auth.js';
import { operatorService } from '#lib/server/operator-runtime.js';

export async function load({ url, cookies, setHeaders }) {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow' });
  // Only this exact route is exempt; it forwards no admin capability and prevents a login redirect loop.
  if (url.pathname === '/operator/login') return { operator: null };
  try { return { operator: await operatorService.authorize(cookies.get(OPERATOR_COOKIE)) }; }
  catch (reason) {
    if (reason instanceof OperatorError && reason.status === 401) {
      cookies.delete(OPERATOR_COOKIE, { path: '/' });
      redirect(303, '/operator/login');
    }
    error(reason instanceof OperatorError ? reason.status : 503, reason instanceof OperatorError ? reason.message : 'Operator service unavailable.');
  }
}
