import { cleanupPreparedGoogle } from './lib/server/googleAuth.js';
import { pendingLogout } from './lib/server/authApi.js';
import { randomBytes } from 'node:crypto';
import { checkCsrf, reply } from './lib/server/authSession.js';
import { sensitivePath } from './lib/analytics/consent.js';
import { campaignEnvironment } from './lib/server/campaign-runtime.js';
import { campaignPage } from './lib/campaigns/browser.js';
import { allowedCampaigns, campaignFromUrl, eligibleTraffic } from './lib/campaigns/labels.js';
import { recordCampaign } from './lib/server/campaign-store.js';
export async function handle({ event, resolve }) {
  const path = event.url.pathname;
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
  const cookieRoute = /^\/api\/(?:auth|billing|funnel\/enrollments\/[^/]+\/associate)(?:\/|$)/.test(path);
  if (unsafe && cookieRoute) {
    try { const rejected = checkCsrf(event); if (rejected) return rejected; }
    catch { return reply({ error: 'Account service is unavailable.' }, 503); }
  }
  if (unsafe && ['/api/auth/login', '/api/auth/register', '/api/auth/google/start', '/api/auth/change-email', '/api/auth/google/disconnect'].includes(path)) { if (pendingLogout(event)) return reply({ error: 'Retry sign-out before starting another sign-in.' }, 409); const rejected = await cleanupPreparedGoogle(event); if (rejected) return rejected; }
  const env = campaignEnvironment();
  const privatePage = sensitivePath(path);
  const nonce = privatePage ? randomBytes(24).toString('base64') : null;
  const response = await resolve(event, privatePage ? { transformPageChunk: ({ html }) => html.replace(/<script(?=[\s>])/g, `<script nonce="${nonce}"`) } : undefined);
  if (privatePage) response.headers.set('content-security-policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`);
  if (env.CAMPAIGN_TOTALS_ENABLED === 'true' && campaignPage(event.url.pathname)) {
    // Public document responses must reach the server to increment request totals.
    response.headers.set('cache-control', 'private, no-store');
    if (event.request.method === 'GET' && !event.isDataRequest && response.status === 200 && response.headers.get('content-type')?.includes('text/html') && eligibleTraffic(event.request)) {
      await recordCampaign({ event: 'page_view', campaign: campaignFromUrl(event.url, event.request.headers.get('referer'), allowedCampaigns(env.PUBLIC_CAMPAIGN_ALLOWED_LABELS)), env });
    }
  }
  if (sensitivePath(event.url.pathname) || event.url.pathname.startsWith('/api/')) {
    response.headers.set('cache-control', 'no-store');
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-content-type-options', 'nosniff');
  }
  return response;
}
