import { allowedCampaigns, campaignFromUrl, cleanCampaign, eligibleTraffic } from '../campaigns/labels.js';
import { recordCampaign } from './campaign-store.js';

export async function handleCampaignPageView({ request, url, env, record = recordCampaign }) {
  const response = status => new Response(null, { status, headers: { 'cache-control': 'no-store' } });
  if (env.CAMPAIGN_TOTALS_ENABLED !== 'true') return response(204);
  if (request.method !== 'POST') return response(405);
  if (request.headers.get('origin') !== url.origin || !eligibleTraffic(request)) return response(403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415);
  const reader = request.body?.getReader();
  if (!reader) return response(400);
  let bytes = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1024) { await reader.cancel(); return response(413); }
    chunks.push(value);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return response(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['source', 'medium', 'campaign'].includes(key))) return response(400);
  const recorded = await record({ event: 'page_view', campaign: cleanCampaign(body, allowedCampaigns(env.PUBLIC_CAMPAIGN_ALLOWED_LABELS)), env });
  return response(recorded ? 204 : 503);
}

export async function measureDownload({ url, request, platform, env, record = recordCampaign }) {
  if (request.method !== 'GET' || !eligibleTraffic(request)) return;
  // Referrers are inspected transiently, never stored. Keep only group campaign labels.
  const allowed = allowedCampaigns(env?.PUBLIC_CAMPAIGN_ALLOWED_LABELS);
  let campaign = campaignFromUrl(url, '', allowed);
  if (!['utm_source', 'utm_medium', 'utm_campaign'].some(key => url.searchParams.has(key))) {
    try {
      const ref = new URL(request.headers.get('referer'));
      campaign = campaignFromUrl(ref.origin === url.origin ? ref : url, ref.href, allowed);
    } catch { /* Unknown. */ }
  }
  await record({ event: 'download_request', campaign, platform, env });
}
export async function measureSignup({ response, campaign, request, env, record = recordCampaign }) {
  // The backend contract returns 201 only after creating a new account. No auth data crosses into metrics.
  if (response.status !== 201 || !eligibleTraffic(request) || request.headers.get('origin') !== new URL(request.url).origin) return;
  await record({ event: 'signup', campaign: cleanCampaign(campaign, allowedCampaigns(env?.PUBLIC_CAMPAIGN_ALLOWED_LABELS)), env });
}
