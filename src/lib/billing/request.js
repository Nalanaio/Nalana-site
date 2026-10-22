import { auth } from '$lib/stores/auth.js';
import { newIdempotencyKey, trustedHostedUrl } from './client.js';

/**
 * Authenticated JSON call to a site billing route. One 401 triggers the shared
 * session refresh and a single retry with the new token.
 * @param {string} path @param {RequestInit} [init]
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function billingRequest(path, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const header = auth.getAuthHeader();
    if (!header) return { ok: false, status: 401, data: { error: 'Please sign in to continue.' } };
    let res;
    try {
      res = await fetch(path, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: header },
        signal: init.signal ?? AbortSignal.timeout(20000),
      });
    } catch {
      return { ok: false, status: 0, data: { error: 'Could not reach Nalana. Check your connection and try again.' } };
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && attempt === 0 && (await auth.refreshSession()) && auth.getAuthHeader() !== header) continue;
    return { ok: res.ok, status: res.status, data };
  }
  return { ok: false, status: 401, data: { error: 'Please sign in to continue.' } };
}

/**
 * Opens the Stripe customer portal in this tab. Returns an error message on failure.
 * @returns {Promise<string|null>}
 */
export async function openBillingPortal() {
  const result = await billingRequest('/api/billing/portal-sessions', {
    method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  if (result.ok && trustedHostedUrl(result.data?.url, 'billing.stripe.com')) {
    window.location.assign(result.data.url);
    return null;
  }
  return result.data?.error ?? 'Could not open billing. Please try again.';
}
