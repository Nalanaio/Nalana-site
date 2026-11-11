import { recordDownloadClick } from './funnel/permission.js';
import { trackDownloadClick } from './analytics/loaders.js';
import { decorateCampaignLink } from './campaigns/browser.js';

// Per CTA: the href the page rendered and the href this module last assigned.
// Page-set query params (channel, utm labels) survive; params added on a
// previous activation are reset. A re-rendered href becomes the new base.
const activatedHrefs = new WeakMap();
const RELATIVE_BASE = 'https://relative.invalid';

function renderedHref(anchor) {
  const state = activatedHrefs.get(anchor);
  return state && state.assigned === anchor.href ? state.rendered : anchor.href || '/api/download';
}

function downloadHref(rendered, platform, clickId) {
  const url = new URL(rendered, RELATIVE_BASE);
  url.searchParams.set('platform', platform);
  url.searchParams.delete('click_id');
  if (clickId) url.searchParams.set('click_id', clickId);
  return url.origin === RELATIVE_BASE ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

/** A best-effort activation signal. Navigation always uses the ordinary href. */
export function observeDownloadClick(platform, event = null) {
  if (!['windows','mac'].includes(platform) || typeof window === 'undefined') return;
  let clickId = null;
  try { trackDownloadClick({ window, platform }); } catch { /* Optional analytics cannot interrupt a download. */ }
  try { clickId = recordDownloadClick(); } catch { /* Optional tracking cannot interrupt a download. */ }
  // No intercept or awaited request: keyboard, new-tab and ordinary links keep
  // their native behavior. Reset a previously consented href on every activation.
  if (event?.currentTarget instanceof HTMLAnchorElement) {
    const anchor = event.currentTarget;
    const rendered = renderedHref(anchor);
    anchor.href = downloadHref(rendered, platform, clickId);
    decorateCampaignLink(anchor, window);
    activatedHrefs.set(anchor, { rendered, assigned: anchor.href });
  }
}
