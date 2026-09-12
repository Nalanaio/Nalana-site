export const DEV_RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
export const DEV_RELEASE_CHANNEL = 'developer';
export const DEV_RELEASE_TAG = 'developer-latest';
export const DEV_RELEASE_BASE_URL = `https://github.com/${DEV_RELEASE_REPO}/releases/download/${DEV_RELEASE_TAG}`;
export const DEV_MANIFEST_URL = `${DEV_RELEASE_BASE_URL}/build-info.json`;

export async function loadDevManifest(fetch) {
  try {
    const response = await fetch(DEV_MANIFEST_URL, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return { manifest: null, error: `The latest dev build is not available yet (${response.status}).` };
    }

    return { manifest: await response.json(), error: null };
  } catch {
    return { manifest: null, error: 'Could not reach the dev build service. Try again shortly.' };
  }
}
