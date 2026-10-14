import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { OPERATOR_COOKIE, OperatorError } from '$lib/server/operator-auth.js';
import { operatorService } from '$lib/server/operator-runtime.js';
import { loadAcquisitionReport } from '$lib/server/acquisition-report.js';

export async function load({ url, cookies }) {
  try { return await loadAcquisitionReport({ operatorService, cookie: cookies.get(OPERATOR_COOKIE), searchParams: url.searchParams, config: env }); }
  catch (reason) {
    if (reason instanceof OperatorError && reason.status === 401) {
      cookies.delete(OPERATOR_COOKIE, { path: '/' });
      redirect(303, '/operator/login');
    }
    error(reason instanceof OperatorError ? reason.status : 503, reason instanceof OperatorError ? reason.message : 'Acquisition report unavailable.');
  }
}
