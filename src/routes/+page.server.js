import { loadStableManifest, stableReleaseLabel } from '$lib/server/stable-release.js';

export async function load({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  const manifest = await loadStableManifest(fetch);
  return { productLabel: stableReleaseLabel(manifest) };
}
