import { sensitivePath } from './consent.js';

const productionOrigins = new Set(['https://nalana.io', 'https://www.nalana.io']);

/**
 * One controller per document; never import or inject the SDK on dev/preview.
 * @param {{ window: { location: { origin: string, pathname: string } }, load?: () => Promise<Pick<typeof import('@vercel/analytics/sveltekit'), 'injectAnalytics'>> }} options
 */
export function createVercelAnalytics({ window, load = () => import('@vercel/analytics/sveltekit') }) {
  let granted = false;
  let pending;
  let injected = false;
  const permitted = () => granted && productionOrigins.has(window.location.origin) &&
    !sensitivePath(window.location.pathname) && !window.location.pathname.startsWith('/api/');

  function beforeSend(event) {
    if (!permitted()) return null;
    try {
      const url = new URL(event.url);
      if (url.origin !== window.location.origin || sensitivePath(url.pathname) || url.pathname.startsWith('/api/')) return null;
      // Recovery tokens, email addresses and arbitrary queries never leave here.
      url.search = '';
      url.hash = '';
      return { ...event, url: url.href };
    } catch { return null; }
  }

  return {
    /** @param {{ choice?: { usage?: boolean }, enabled?: boolean }} options */
    async update({ choice, enabled = false }) {
      granted = enabled === true && choice?.usage === true;
      if (!permitted() || injected) return;
      try {
        const sdk = await (pending ||= load());
        // Permission or the route can change while the SDK chunk is loading.
        if (!permitted() || injected) return;
        sdk.injectAnalytics({ mode: 'production', debug: false, beforeSend });
        injected = true;
      } catch {
        pending = undefined;
        // Optional measurement must not affect accounts or downloads.
      }
    }
  };
}
