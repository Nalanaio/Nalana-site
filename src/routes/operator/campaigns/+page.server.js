import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { OPERATOR_COOKIE, OperatorError } from '$lib/server/operator-auth.js';
import { operatorService } from '$lib/server/operator-runtime.js';
import { campaignWindow, readCampaignTotals } from '$lib/server/campaign-store.js';

export async function load({ url, cookies }) {
  let operator;
  try { operator = await operatorService.authorize(cookies.get(OPERATOR_COOKIE)); }
  catch (reason) {
    if (reason instanceof OperatorError && reason.status === 401) {
      cookies.delete(OPERATOR_COOKIE, { path: '/' });
      redirect(303, '/operator/login');
    }
    error(reason instanceof OperatorError ? reason.status : 503, 'Operator access is unavailable.');
  }
  let window;
  try { window = campaignWindow(url.searchParams); }
  catch { error(400, 'Choose valid UTC dates, at most 90 days, ending today or earlier.'); }
  try { return { operator, window, rows: await readCampaignTotals({ env, window }) }; }
  catch { error(503, 'Campaign totals are unavailable. Try again later.'); }
}
