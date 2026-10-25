import { error, fail, redirect } from '@sveltejs/kit';
import { OPERATOR_COOKIE, OPERATOR_CHALLENGE_COOKIE, OPERATOR_COOKIE_OPTIONS, OperatorError } from '#lib/server/operator-auth.js';
import { operatorService } from '#lib/server/operator-runtime.js';
import * as env from '$app/env/private';

export function load({ cookies }) {
  try {
    const challenge = operatorService.createChallenge();
    cookies.set(OPERATOR_CHALLENGE_COOKIE, challenge.cookie, OPERATOR_COOKIE_OPTIONS);
    return { csrf: challenge.csrf };
  } catch (reason) { error(reason instanceof OperatorError ? reason.status : 503, reason instanceof OperatorError ? reason.message : 'Operator service unavailable.'); }
}
export const actions = {
  login: async ({ request, cookies }) => {
    let result;
    try {
      const form = await request.formData();
      result = await operatorService.login({ request, challengeCookie: cookies.get(OPERATOR_CHALLENGE_COOKIE), csrf: form.get('csrf'), email: form.get('email'), password: form.get('password') });
    } catch (reason) {
      return fail(reason instanceof OperatorError ? reason.status : 503, { error: reason instanceof OperatorError ? reason.message : 'Operator authentication is unavailable.' });
    }
    cookies.set(OPERATOR_COOKIE, result.cookie, OPERATOR_COOKIE_OPTIONS);
    cookies.delete(OPERATOR_CHALLENGE_COOKIE, { path: '/' });
    redirect(303, env.CAMPAIGN_TOTALS_ENABLED === 'true' ? '/operator/campaigns' : '/operator/acquisition');
  },
  logout: async ({ request, cookies }) => {
    try {
      const form = await request.formData();
      operatorService.assertSessionAction(cookies.get(OPERATOR_COOKIE), request, form.get('csrf'));
    } catch (reason) { return fail(reason instanceof OperatorError ? reason.status : 403, { error: 'This form expired. Reload and try again.' }); }
    cookies.delete(OPERATOR_COOKIE, { path: '/' });
    cookies.delete(OPERATOR_CHALLENGE_COOKIE, { path: '/' });
    redirect(303, '/operator/login');
  }
};
