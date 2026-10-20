import { allowedCampaigns, campaignFromUrl, cleanCampaign, unknownCampaign } from './labels.js';

// Document memory only. No cookies, browser storage, random IDs, or account association.
const contexts = new WeakMap();
const TTL = 30 * 60_000;
const enabledWindows = new WeakMap();
const publicPages = new Set(['/', '/open-source', '/privacy', '/cookies', '/terms', '/eula', '/refund']);
export const campaignPage = path => publicPages.has(path);
/** @param {any} window @param {any} [catalog] */
export function enableCampaignTotals(window, catalog = []) { enabledWindows.set(window, allowedCampaigns(catalog)); }
export function currentCampaign(window, now = Date.now()) {
  const url = new URL(window.location.href);
  const tagged = ['utm_source', 'utm_medium', 'utm_campaign'].some(key => url.searchParams.has(key));
  let entry = contexts.get(window);
  const allowed = enabledWindows.get(window) || [];
  const labels = campaignFromUrl(url, window.document?.referrer, allowed);
  if (tagged && JSON.stringify(entry?.labels) !== JSON.stringify(labels)) {
    entry = { labels, at: now, url: url.href };
    contexts.set(window, entry);
  } else if (!entry) {
    entry = { labels, at: now, url: url.href };
    contexts.set(window, entry);
  }
  return now >= entry.at && now - entry.at <= TTL ? cleanCampaign(entry.labels, allowed) : unknownCampaign();
}
export function decorateCampaignLink(anchor, window) {
  if (!enabledWindows.has(window)) return;
  if (!anchor?.href || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || !(campaignPage(url.pathname) || ['/login', '/api/download'].includes(url.pathname))) return;
  if (url.pathname === window.location.pathname && url.hash) return;
  if (['utm_source', 'utm_medium', 'utm_campaign'].some(key => url.searchParams.has(key))) return;
  const labels = currentCampaign(window);
  if (Object.values(labels).every(value => value === 'unknown')) return;
  for (const [key, value] of Object.entries(labels)) if (value !== 'unknown') url.searchParams.set(`utm_${key}`, value);
  anchor.href = url.href;
}
export function observeCampaignNavigation(window, { from, to, type }) {
  if (!enabledWindows.has(window)) return;
  currentCampaign(window);
  // The server counts document requests. This covers only client-side page navigation.
  if (type === 'enter' || !from || !to || !campaignPage(to.url.pathname) || from.url.pathname === to.url.pathname && from.url.search === to.url.search) return;
  void window.fetch('/api/campaign/page-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentCampaign(window)), keepalive: true }).catch(() => {});
}
