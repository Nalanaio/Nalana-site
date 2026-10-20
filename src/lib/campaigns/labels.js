// Campaigns describe groups, never visitors. No click/ad IDs or full URLs enter the report.
const sources = new Set(['facebook', 'instagram', 'meta', 'google', 'bing', 'linkedin', 'twitter', 'x', 'tiktok', 'youtube', 'newsletter']);
const media = new Set(['paid_social', 'social', 'organic', 'cpc', 'ppc', 'email', 'referral', 'display']);
export const unknownCampaign = () => ({ source: 'unknown', medium: 'unknown', campaign: 'unknown' });
export function allowedCampaigns(raw) {
  try {
    const values = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(values) && values.length <= 40 ? values.filter(value => value && typeof value === 'object' && sources.has(value.source) && media.has(value.medium) && typeof value.campaign === 'string' && /^[\p{L}\p{N} ._()+\-]{1,120}$/u.test(value.campaign) && !/https?|www\.|token|password|secret/i.test(value.campaign)).map(({ source, medium, campaign }) => ({ source, medium, campaign })) : [];
  } catch { return []; }
}
export function cleanCampaign(input, allowed = []) {
  const source = typeof input?.source === 'string' ? input.source.trim().toLowerCase() : '';
  const medium = typeof input?.medium === 'string' ? input.medium.trim().toLowerCase() : '';
  const campaign = typeof input?.campaign === 'string' ? input.campaign.trim() : '';
  return {
    source: sources.has(source) ? source : source === 'referral' ? 'referral' : 'unknown',
    medium: media.has(medium) ? medium : 'unknown',
    campaign: allowedCampaigns(allowed).some(value => value.source === source && value.medium === medium && value.campaign === campaign) ? campaign : 'unknown'
  };
}
export function campaignFromUrl(url, referrer = '', allowed = []) {
  const params = url.searchParams;
  if (['utm_source', 'utm_medium', 'utm_campaign'].some(key => params.has(key))) {
    return cleanCampaign(Object.fromEntries(['source', 'medium', 'campaign'].map(key => [key, params.getAll(`utm_${key}`).length === 1 ? params.get(`utm_${key}`) : null])), allowed);
  }
  try {
    const ref = new URL(referrer);
    if (ref.origin !== url.origin && ['http:', 'https:'].includes(ref.protocol)) {
      const host = ref.hostname.toLowerCase();
      const source = ['facebook', 'instagram', 'google', 'bing', 'linkedin', 'tiktok', 'youtube'].find(name => host === `${name}.com` || host.endsWith(`.${name}.com`));
      return { source: source || 'referral', medium: 'referral', campaign: 'unknown' };
    }
  } catch { /* Missing/stripped referrers remain unknown, never inferred as direct. */ }
  return unknownCampaign();
}
export function eligibleTraffic(request) {
  return !/prefetch|preview|prerender/i.test(`${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`) && !/bot|crawler|spider|slackbot|facebookexternalhit|preview/i.test(request.headers.get('user-agent') || '');
}
