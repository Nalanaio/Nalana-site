// Client-safe channel helpers for the download toggle. The server resolver
// (lib/server/release-channel.js) owns manifests; this only names channels.
export const DOWNLOAD_CHANNELS = Object.freeze(['stable', 'beta']);
export const CHANNEL_STORAGE_KEY = 'nalana.download_channel';
export const CHANNEL_NAMES = Object.freeze({ stable: 'Stable', beta: 'Beta' });

/** @param {unknown} value @returns {value is 'stable' | 'beta'} */
export const isDownloadChannel = (value) => typeof value === 'string' && DOWNLOAD_CHANNELS.includes(value);

export const otherChannel = (channel) => (channel === 'beta' ? 'stable' : 'beta');

/** Every CTA names its channel, so the toggle (not the server default) decides. */
export function downloadHref(platform, channel) {
  return `/api/download?platform=${platform}&channel=${channel}`;
}

/** A page URL selecting `channel`, keeping any other query (campaign labels) and the fragment. */
export function channelPageHref(url, channel) {
  const next = new URL(url);
  next.searchParams.set('channel', channel);
  return `${next.pathname}${next.search}${next.hash}`;
}

export function readStoredChannel(window) {
  try {
    const value = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
    return isDownloadChannel(value) ? value : null;
  } catch { return null; }
}

/**
 * A functional preference set by an explicit click; storage failures are ignored.
 * `replace` is SvelteKit's replaceState in the app, so the router keeps its history entry.
 */
export function rememberChannel(window, channel, replace = (href) => window.history.replaceState(window.history.state, '', href)) {
  try { window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel); } catch { /* Private mode or blocked storage. */ }
  try { replace(channelPageHref(window.location.href, channel)); } catch { /* Optional. */ }
}

/**
 * The remembered choice to apply on mount: only when the page URL names no
 * channel, the stored channel differs, and its build is available.
 */
export function restoredChannel(window, current, releases) {
  try { if (new URL(window.location.href).searchParams.has('channel')) return null; } catch { return null; }
  const stored = readStoredChannel(window);
  return stored && stored !== current && releases?.[stored]?.available ? stored : null;
}

/** Which channel the CTA actually downloads: the selected one, or the other when it is unavailable. */
export function effectiveChannel(channel, releases) {
  if (releases?.[channel]?.available !== false) return channel;
  const other = otherChannel(channel);
  return releases?.[other]?.available ? other : channel;
}
