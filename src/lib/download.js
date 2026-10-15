import { recordDownloadClick } from './funnel/permission.js';
import { trackDownloadClick } from './analytics/loaders.js';

/** A best-effort activation signal. Navigation always uses the ordinary href. */
export function observeDownloadClick(platform, event = null) {
  if (!['windows','mac'].includes(platform) || typeof window === 'undefined') return;
  let clickId = null;
  try { trackDownloadClick({ window, platform }); } catch { /* Optional analytics cannot interrupt a download. */ }
  try { clickId = recordDownloadClick(); } catch { /* Optional tracking cannot interrupt a download. */ }
  // No intercept or awaited request: keyboard, new-tab and ordinary links keep
  // their native behavior. Reset a previously consented href on every activation.
  if (event?.currentTarget instanceof HTMLAnchorElement) {
    event.currentTarget.href = `/api/download?platform=${platform}${clickId ? `&click_id=${encodeURIComponent(clickId)}` : ''}`;
  }
}
