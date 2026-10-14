import { sensitivePath } from './consent.js';
const lastViewed = new WeakMap();
export function trackPageView({ window, choice, pathname, enabled = false }) {
  if (!enabled || !choice?.usage || sensitivePath(pathname) || !window.gtag || lastViewed.get(window) === pathname) return;
  lastViewed.set(window, pathname);
  window.gtag('event', 'page_view', { page_location: window.location.origin + pathname, page_path: pathname, page_referrer: '' });
}
/** Load only after explicit choice, with path-only GA configuration. */
export function loadAnalytics({ document, window, choice, pathname, enabled = false }) {
  if (!enabled || sensitivePath(pathname)) return;
  if (choice.usage && !document.getElementById('nalana-ga')) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args) => window.dataLayer.push(args);
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', 'G-8XMNLBLH97', { send_page_view: false, page_location: window.location.origin + pathname, page_referrer: '' });
    const script = document.createElement('script'); script.id = 'nalana-ga'; script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8XMNLBLH97'; document.head.appendChild(script);
  }
  if (choice.identification && !document.getElementById('nalana-identification')) {
    const script = document.createElement('script'); script.id = 'nalana-identification'; script.async = true; script.src = 'https://ddwl4m2hdecbv.cloudfront.net/b/VN080H3PX16J/VN080H3PX16J.js.gz'; document.head.appendChild(script);
  }
  trackPageView({ window, choice, pathname, enabled });
}
