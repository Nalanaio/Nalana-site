import { sensitivePath } from './consent.js';
import { campaignLabels, campaignParameters, campaignContext } from './attribution.js';
const lastViewed = new WeakMap();
const usageEnabled = new WeakMap();

// Forward only bounded campaign labels, never arbitrary queries, click IDs,
// recovery tokens, fragments or email addresses. Ad names must be non-personal.
function pageLocation(window, pathname) {
  const location = new URL(pathname, window.location.origin);
  for (const [key, value] of Object.entries(campaignLabels(window.location.search))) location.searchParams.set(key, value);
  return location.href;
}

export function trackPageView({ window, choice, pathname, enabled = false }) {
  if (!enabled || !choice?.usage || sensitivePath(pathname) || !window.gtag) return;
  const location = pageLocation(window, pathname);
  if (lastViewed.get(window) === location) return;
  lastViewed.set(window, location);
  window.gtag('event', 'page_view', { ...campaignParameters(window, choice), page_location: location, page_path: pathname, page_referrer: '' });
}
/** Load only after explicit choice, with approved campaign labels only. */
export function loadAnalytics({ document, window, choice, pathname, enabled = false }) {
  usageEnabled.set(window, Boolean(enabled && choice?.usage && !sensitivePath(pathname)));
  if (enabled) campaignContext(window, choice);
  if (!enabled || sensitivePath(pathname)) return;
  if (choice.usage && !document.getElementById('nalana-ga')) {
    window.dataLayer = window.dataLayer || [];
    // Google tag interprets Arguments objects as commands; arrays are data-layer method calls.
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', 'G-8XMNLBLH97', { ...campaignParameters(window, choice), send_page_view: false, page_location: pageLocation(window, pathname), page_referrer: '' });
    const script = document.createElement('script'); script.id = 'nalana-ga'; script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8XMNLBLH97'; document.head.appendChild(script);
  }
  if (choice.identification && !document.getElementById('nalana-identification')) {
    const script = document.createElement('script'); script.id = 'nalana-identification'; script.async = true; script.src = 'https://ddwl4m2hdecbv.cloudfront.net/b/VN080H3PX16J/VN080H3PX16J.js.gz'; document.head.appendChild(script);
  }
  trackPageView({ window, choice, pathname, enabled });
}

/** A CTA activation, never a completed transfer, installation or signup. */
export function trackDownloadClick({ window, platform }) {
  const pathname = window.location.pathname;
  if (!usageEnabled.get(window) || !window.gtag || sensitivePath(pathname) || !['windows', 'mac'].includes(platform)) return;
  window.gtag('event', 'download_clicked', {
    download_platform: platform,
    ...campaignParameters(window, { usage: true }),
    page_location: pageLocation(window, pathname),
    page_referrer: '',
    transport_type: 'beacon'
  });
}

/** Invoked only in a fresh, credential-free completion document. */
export function trackSignup({ window, done }) {
  if (!usageEnabled.get(window) || !window.gtag || window.location.pathname !== '/signup-complete') { done(); return; }
  window.gtag('event', 'sign_up', {
    ...campaignParameters(window, { usage: true }), method: 'email',
    page_location: `${window.location.origin}/signup-complete`, page_referrer: '',
    transport_type: 'beacon', event_callback: done, event_timeout: 1000
  });
}

export function stopAnalytics({ window, document }) {
  usageEnabled.set(window, false);
  window.dataLayer?.splice(0);
  document.getElementById('nalana-ga')?.remove();
}
