import { sensitivePath } from './lib/analytics/consent.js';
import { campaignEnvironment } from './lib/server/campaign-runtime.js';
import { campaignPage } from './lib/campaigns/browser.js';
import { allowedCampaigns, campaignFromUrl, eligibleTraffic } from './lib/campaigns/labels.js';
import { recordCampaign } from './lib/server/campaign-store.js';
export async function handle({ event, resolve }) {
  const env = campaignEnvironment();
  const response = await resolve(event);
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
