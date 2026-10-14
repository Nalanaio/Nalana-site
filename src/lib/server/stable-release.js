// Keep the repository allowlist and manifest validation so a public CTA cannot
// redirect to an arbitrary URL from an unexpected manifest.
export const STABLE_RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
export const STABLE_RELEASE_CHANNEL = 'stable';
export const STABLE_RELEASE_TAG = 'stable-latest';
export const STABLE_RELEASE_BASE_URL = `https://github.com/${STABLE_RELEASE_REPO}/releases/download/${STABLE_RELEASE_TAG}`;
export const STABLE_MANIFEST_URL = `${STABLE_RELEASE_BASE_URL}/build-info.json`;

const platformLabels = {
  mac: 'macOS Apple Silicon',
  windows: 'Windows x64',
};

export async function loadStableManifest(fetch) {
  try {
    const response = await fetch(STABLE_MANIFEST_URL, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export function stableReleaseLabel(manifest) {
  if (
    !resolveStableDownload({ platform: 'mac', manifest })
    || !resolveStableDownload({ platform: 'windows', manifest })
    || typeof manifest?.version !== 'string'
    || !/^\d+\.\d+\.\d+$/.test(manifest.version)
  ) return 'Nalana';

  return `Nalana ${manifest.version.replace(/\.0$/, '')}`;
}

export function resolveStableDownload({ platform, manifest, fallbackUrls = {} }) {
  const expectedPlatform = platformLabels[platform];
  if (!expectedPlatform) return null;

  if (manifest?.channel === STABLE_RELEASE_CHANNEL && manifest?.release_tag === STABLE_RELEASE_TAG) {
    const build = Array.isArray(manifest.builds)
      ? manifest.builds.find((candidate) => candidate?.platform === expectedPlatform)
      : null;

    if (
      typeof build?.download_url === 'string'
      && build.download_url.startsWith(`${STABLE_RELEASE_BASE_URL}/`)
      && validateStableDownload(build.download_url, platform)
    ) {
      return build.download_url;
    }
  }

  return validateStableDownload(fallbackUrls[platform], platform);
}

/** Exact release origin/repository; configured fallbacks receive the same checks. */
export function validateStableDownload(value, platform) {
  try {
    const url = new URL(value);
    const extension = platform === 'windows' ? '.exe' : platform === 'mac' ? '.dmg' : null;
    const prefix = `/${STABLE_RELEASE_REPO}/releases/download/`;
    if (!extension || url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    const suffix = url.pathname.slice(prefix.length).split('/');
    if (suffix.length !== 2 || !/^[A-Za-z0-9._-]+$/.test(suffix[0]) || !/^[A-Za-z0-9._-]+$/.test(suffix[1]) || !suffix[1].endsWith(extension)) return null;
    return url.href;
  } catch { return null; }
}
