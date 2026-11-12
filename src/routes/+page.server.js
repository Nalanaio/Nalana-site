import { homepageDownloads } from '#lib/server/release-channel.js';
import { campaignEnvironment } from '#lib/server/campaign-runtime.js';
import { downloadPlatform } from '#lib/download-platform.js';

export async function load({ fetch, setHeaders, request, url }) {
  setHeaders({ 'cache-control': 'no-store' });
  return {
    ...(await homepageDownloads({ fetch, url, env: campaignEnvironment() })),
    downloadPlatform: downloadPlatform({
      userAgent: request.headers.get('user-agent') || '',
      mobile: request.headers.get('sec-ch-ua-mobile') === '?1',
    }),
  };
}
