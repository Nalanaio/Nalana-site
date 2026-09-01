import { redirect } from '@sveltejs/kit';
import {
  resolveStableDownload,
  STABLE_MANIFEST_URL,
} from '$lib/server/stable-release.js';

/** GET /api/download?platform=mac|windows */
export async function GET({ fetch, url }) {
  const platform = url.searchParams.get('platform');

  if (platform !== 'mac' && platform !== 'windows') {
    return new Response('Unknown platform. Use ?platform=mac or ?platform=windows', { status: 400 });
  }

  let manifest = null;
  try {
    const response = await fetch(STABLE_MANIFEST_URL, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) manifest = await response.json();
  } catch {
    // Keep the currently configured production installer available until the
    // first stable-latest release exists or during a transient GitHub outage.
  }

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

  throw redirect(302, downloadUrl);
}
