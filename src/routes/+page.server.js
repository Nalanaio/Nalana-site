import { channelLabel, defaultChannel, loadChannelManifest } from '#lib/server/release-channel.js';
import { campaignEnvironment } from '#lib/server/campaign-runtime.js';
import { downloadPlatform } from '#lib/download-platform.js';

export async function load({ fetch, setHeaders, request }) {
  setHeaders({ 'cache-control': 'no-store' });
  // Download buttons omit `channel`, so the label follows the configured default.
  const channel = defaultChannel(campaignEnvironment());
  const manifest = await loadChannelManifest(channel, fetch);
  return {
    productLabel: channelLabel(channel, manifest),
    downloadPlatform: downloadPlatform({
      userAgent: request.headers.get('user-agent') || '',
      mobile: request.headers.get('sec-ch-ua-mobile') === '?1',
    }),
  };
}
