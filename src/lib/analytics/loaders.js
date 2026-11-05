import { sensitivePath } from './consent.js';
import { campaignLabels, campaignParameters, campaignContext } from './attribution.js';
import { SCROLL_MILESTONES } from './scroll-depth.js';
const lastViewed = new WeakMap();
const usageEnabled = new WeakMap();
// Optional PostHog controller per document, registered by loadAnalytics.
const posthogs = new WeakMap();
const CTA_TOKEN = /^[a-z0-9_]{1,40}$/;

/** The controller only while this document holds usage permission on a non-sensitive route. */
function posthogFor(window) {
  return usageEnabled.get(window) && !sensitivePath(window.location.pathname) ? posthogs.get(window) : undefined;
}

// Forward only bounded campaign labels, never arbitrary queries, click IDs,
// recovery tokens, fragments or email addresses. Ad names must be non-personal.
function pageLocation(window, pathname) {
  const location = new URL(pathname, window.location.origin);
  for (const [key, value] of Object.entries(campaignLabels(window.location.search))) location.searchParams.set(key, value);
  return location.href;
}

export function trackPageView({ window, choice, pathname, enabled = false }) {
  if (!enabled || !choice?.usage || sensitivePath(pathname)) return;
  posthogs.get(window)?.pageview(pathname);
  if (!window.gtag) return;
  const location = pageLocation(window, pathname);
  if (lastViewed.get(window) === location) return;
  lastViewed.set(window, location);
  window.gtag('event', 'page_view', { ...campaignParameters(window, choice), page_location: location, page_path: pathname, page_referrer: '' });
}
/** Load only after explicit choice, with approved campaign labels only. */
export function loadAnalytics({ document, window, choice, pathname, enabled = false, posthog = undefined }) {
  usageEnabled.set(window, Boolean(enabled && choice?.usage && !sensitivePath(pathname)));
  if (enabled) campaignContext(window, choice);
  // PostHog follows the same gate as GA4 (flag + usage choice + non-sensitive route).
  // update() also removes its browser storage when the visitor has declined.
  if (posthog) { posthogs.set(window, posthog); void posthog.update({ choice, enabled, pathname }); }
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
  if (!usageEnabled.get(window) || sensitivePath(pathname) || !['windows', 'mac'].includes(platform)) return;
  posthogFor(window)?.capture('download clicked', { platform });
  if (!window.gtag) return;
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

/**
 * A click on an element tagged data-cta-id (and data-cta-location). Elements that
 * also carry data-auth-intent="signup|login" start that flow: the form itself lives
 * on /login, where no vendor is allowed to load, so the intent is recorded here.
 */
export function trackCtaClick({ window, element }) {
  const posthog = posthogFor(window);
  const ctaId = element?.getAttribute?.('data-cta-id');
  if (!posthog || !CTA_TOKEN.test(ctaId ?? '')) return;
  const rawLocation = element.getAttribute('data-cta-location');
  const location = CTA_TOKEN.test(rawLocation ?? '') ? rawLocation : 'unknown';
  posthog.capture('cta clicked', { cta_id: ctaId, location });
  const intent = element.getAttribute('data-auth-intent');
  if (intent === 'signup') posthog.capture('signup started', { location });
  else if (intent === 'login') posthog.capture('login started', { location });
}

export function trackScrollDepth({ window, depth }) {
  if (SCROLL_MILESTONES.includes(depth)) posthogFor(window)?.capture('scroll depth', { depth });
}

/**
 * In-app navigation only; leaving the document is reported by the SDK on pagehide.
 * `to` is the navigation target: a link to a server endpoint (a download, for
 * example) does not replace the page, so it is not a page leave.
 * @param {{ window: any, to?: { route?: { id?: string | null } } | null }} options
 */
export function trackPageLeave({ window, to = null }) {
  if (to?.route?.id?.startsWith('/api')) return;
  posthogFor(window)?.pageleave();
}

export function stopAnalytics({ window, document }) {
  usageEnabled.set(window, false);
  void posthogs.get(window)?.update({ choice: { usage: false, decided: true }, enabled: false });
  window.dataLayer?.splice(0);
  document.getElementById('nalana-ga')?.remove();
}
