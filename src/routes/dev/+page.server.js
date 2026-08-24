const RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
const RELEASE_TAG = 'dev-latest';
const MANIFEST_URL = `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/build-info.json`;

async function loadManifest(fetch) {
  try {
    const response = await fetch(MANIFEST_URL, {
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

export const prerender = false;

export async function load({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  return loadManifest(fetch);
}
