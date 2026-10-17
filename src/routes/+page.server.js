import { loadStableManifest, stableReleaseLabel } from '$lib/server/stable-release.js';
import { downloadPlatform } from '$lib/download-platform.js';

export async function load({ fetch, setHeaders, request }) {
  setHeaders({ 'cache-control': 'no-store' });
  const manifest = await loadStableManifest(fetch);
  return {
    productLabel: stableReleaseLabel(manifest),
    downloadPlatform: downloadPlatform({
      userAgent: request.headers.get('user-agent') || '',
      mobile: request.headers.get('sec-ch-ua-mobile') === '?1',
    }),
  };
}
