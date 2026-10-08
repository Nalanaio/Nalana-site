import { redirect } from '@sveltejs/kit';
import { notifyDownload } from '$lib/server/download-notification.js';
import {
  resolveStableDownload,
  loadStableManifest,
} from '$lib/server/stable-release.js';

/** GET /api/download?platform=mac|windows */
export async function GET({ fetch, url, request, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  const platform = url.searchParams.get('platform');

  if (platform !== 'mac' && platform !== 'windows') {
    return new Response('Unknown platform. Use ?platform=mac or ?platform=windows', { status: 400 });
  }

  const manifest = await loadStableManifest(fetch);

  const downloadUrl = resolveStableDownload({
    platform,
    manifest,
    fallbackUrls: {
      mac: process.env.NALANA_MAC_URL,
      windows: process.env.NALANA_WIN_URL,
    },
  });

  if (!downloadUrl) {
    return new Response('The latest Nalana download is temporarily unavailable.', { status: 503 });
  }

  await notifyDownload({ platform, request, fetch });
  throw redirect(302, downloadUrl);
}
