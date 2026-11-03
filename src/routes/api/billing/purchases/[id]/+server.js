import { getApiBase } from '#lib/server/authApi.js';
import { billingFailure, proxyBilling, validPurchaseId } from '#lib/server/billingApi.js';

/** GET /api/billing/purchases/:id — read-only purchase status for the return page. */
export function GET(event) {
  const { request, params } = event;
  if (!validPurchaseId(params.id)) return billingFailure(404, 'We could not find that purchase on this account.', 'PURCHASE_NOT_FOUND');
  return proxyBilling({ base: getApiBase(), request, event, path: `/v1/billing/purchases/${params.id}` });
}
