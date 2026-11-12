// Public downloads are resolved per request from each channel's build-info.json.
// Keep the repository allowlist and per-tag validation so a public CTA cannot
// redirect to an arbitrary URL, or to the other channel's installer.
export const RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
export const CHANNELS = Object.freeze({
  stable: Object.freeze({ channel: 'stable', tag: 'stable-latest' }),
  beta: Object.freeze({ channel: 'beta', tag: 'beta-latest' }),
});
export const FALLBACK_DEFAULT_CHANNEL = 'beta';

const platformLabels = {
  mac: 'macOS Apple Silicon',
  windows: 'Windows x64',
};
const platformExtensions = { mac: '.dmg', windows: '.exe' };

/** @param {unknown} value @returns {value is 'stable' | 'beta'} */
export const isChannel = (value) => typeof value === 'string' && Object.hasOwn(CHANNELS, value);

/** PUBLIC_DEFAULT_DOWNLOAD_CHANNEL, falling back to beta when unset or invalid. */
export function defaultChannel(env = process.env) {
  const configured = env?.PUBLIC_DEFAULT_DOWNLOAD_CHANNEL?.trim().toLowerCase();
  return isChannel(configured) ? configured : FALLBACK_DEFAULT_CHANNEL;
}

export const channelBaseUrl = (channel) => `https://github.com/${RELEASE_REPO}/releases/download/${CHANNELS[channel].tag}`;
export const channelManifestUrl = (channel) => `${channelBaseUrl(channel)}/build-info.json`;

/** Uncached manifest read; `status` is null when the service was unreachable or the body was invalid. */
export async function fetchChannelManifest(channel, fetch) {
  if (!isChannel(channel)) return { manifest: null, status: null };
  try {
    const response = await fetch(channelManifestUrl(channel), {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { manifest: null, status: response.status };
    return { manifest: await response.json(), status: response.status };
  } catch {
    return { manifest: null, status: null };
  }
}

export async function loadChannelManifest(channel, fetch) {
  return (await fetchChannelManifest(channel, fetch)).manifest;
}

export function resolveChannelDownload({ channel, platform, manifest, fallbackUrls = {} }) {
  const config = isChannel(channel) ? CHANNELS[channel] : null;
  const expectedPlatform = platformLabels[platform];
  if (!config || !expectedPlatform) return null;

  if (manifest?.channel === config.channel && manifest?.release_tag === config.tag) {
    const build = Array.isArray(manifest.builds)
      ? manifest.builds.find((candidate) => candidate?.platform === expectedPlatform)
      : null;
    const target = validateChannelDownload(build?.download_url, platform, channel);
    if (target) return target;
  }

  // Configured fallbacks are stable installers only; beta never borrows them.
  return channel === 'stable' ? validateChannelDownload(fallbackUrls[platform], platform, channel) : null;
}

/** Exact release origin/repository/tag; configured fallbacks receive the same checks. */
export function validateChannelDownload(value, platform, channel) {
  try {
    if (typeof value !== 'string' || !isChannel(channel)) return null;
    const url = new URL(value);
    const extension = platformExtensions[platform];
    const prefix = `/${RELEASE_REPO}/releases/download/`;
    if (!extension || url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    const suffix = url.pathname.slice(prefix.length).split('/');
    if (suffix.length !== 2 || suffix[0] !== CHANNELS[channel].tag || !/^[A-Za-z0-9._-]+$/.test(suffix[1]) || !suffix[1].endsWith(extension)) return null;
    return url.href;
  } catch { return null; }
}

export function channelLabel(channel, manifest) {
  const available = ['mac', 'windows'].every((platform) => resolveChannelDownload({ channel, platform, manifest }));
  if (channel === 'beta') {
    return available && Number.isSafeInteger(manifest.run_number) && manifest.run_number > 0
      ? `Nalana Beta (Build ${manifest.run_number})`
      : 'Nalana Beta';
  }
  if (!available || typeof manifest?.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) return 'Nalana';
  return `Nalana ${manifest.version.replace(/\.0$/, '')}`;
}
