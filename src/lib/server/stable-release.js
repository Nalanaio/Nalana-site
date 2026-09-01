export const STABLE_RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
export const STABLE_RELEASE_TAG = 'stable-latest';
export const STABLE_RELEASE_BASE_URL = `https://github.com/${STABLE_RELEASE_REPO}/releases/download/${STABLE_RELEASE_TAG}`;
export const STABLE_MANIFEST_URL = `${STABLE_RELEASE_BASE_URL}/build-info.json`;

const platformLabels = {
  mac: 'macOS Apple Silicon',
  windows: 'Windows x64',
};

export function resolveStableDownload({ platform, manifest, fallbackUrls = {} }) {
  const expectedPlatform = platformLabels[platform];
  if (!expectedPlatform) return null;

  if (manifest?.channel === 'stable' && manifest?.release_tag === STABLE_RELEASE_TAG) {
    const build = Array.isArray(manifest.builds)
      ? manifest.builds.find((candidate) => candidate?.platform === expectedPlatform)
      : null;

    if (
      typeof build?.download_url === 'string'
      && build.download_url.startsWith(`${STABLE_RELEASE_BASE_URL}/`)
    ) {
      return build.download_url;
    }
  }

  return fallbackUrls[platform] || null;
}
