import { establishDownloadSubject, rememberDownload } from './download-cookie.js';
import { createIntent, recordHandoff, flagEnabled } from './acquisition-api.js';
import { defaultChannel, isChannel, loadChannelManifest, resolveChannelDownload } from './release-channel.js';
import { notifyDownload } from './download-notification.js';
import { measureDownload } from './campaign-measurement.js';
import { allowedCampaigns, campaignFromUrl } from '../campaigns/labels.js';

export const downloadHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const redirectResponse = (target, status = 302) => new Response(null, { status, headers: { ...downloadHeaders, location: target } });

/** The website observes a handoff only. Body writes are observed by the relay. */
export async function handleDownload({ fetch, url, request, cookies, enrollment = null, env = process.env, measure = measureDownload }) {
  const platform = url.searchParams.get('platform');
  if (!['mac','windows'].includes(platform)) return new Response('Unknown platform. Use ?platform=mac or ?platform=windows', { status: 400, headers: downloadHeaders });
  const channel = url.searchParams.has('channel') ? url.searchParams.get('channel') : defaultChannel(env);
  if (!isChannel(channel)) return new Response('Unknown channel. Use ?channel=stable or ?channel=beta', { status: 400, headers: downloadHeaders });
  if (request.method === 'HEAD') return new Response(null, { status: 204, headers: downloadHeaders });
  const purpose = `${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`;
  if (/prefetch|preview|prerender/i.test(purpose)) return new Response(null, { status: 204, headers: downloadHeaders });
  if (channel === 'beta') {
    // The relay mints stable intents and tickets only, so beta never touches it.
    // Never fall back to stable: beta uses a separate account system.
    const target = resolveChannelDownload({ channel, platform, manifest: await loadChannelManifest(channel, fetch) });
    if (!target) return new Response('The latest Nalana beta is temporarily unavailable. Please try again shortly.', { status: 503, headers: downloadHeaders });
    await notifyDownload({ platform, channel, request, fetch, env });
    await measure({ url, request, platform, channel, env });
    return redirectResponse(target);
  }
  let subject = null;
  if (flagEnabled(env.NALANA_ACQUISITION_RELAY)) {
    const established = establishDownloadSubject({ cookies, url, platform, env });
    if (established.retryUrl) {
      const retry = new URL(established.retryUrl, url);
      // Keep the retry on stable even when the configured default is beta.
      retry.searchParams.set('channel', channel);
      const campaign = campaignFromUrl(url, '', allowedCampaigns(env.PUBLIC_CAMPAIGN_ALLOWED_LABELS));
      for (const [key, value] of Object.entries(campaign)) if (value !== 'unknown') retry.searchParams.set(`utm_${key}`, value);
      return redirectResponse(`${retry.pathname}${retry.search}`, 303);
    }
    subject = established.subject;
  }
  // Classify transiently; raw UA/IP never enters backend records or events.
  const trafficClass = /bot|crawler|spider|slackbot|facebookexternalhit|preview/i.test(request.headers.get('user-agent') || '') ? 'bot' : 'unclassified';
  const intent = await createIntent({ platform, subject, enrollment, clickId: url.searchParams.get('click_id'), trafficClass, fetch, env });
  if (intent) {
    rememberDownload(cookies, intent, env);
    await recordHandoff({ downloadId: intent.download_id, deliveryMode: 'relay', fetch, env });
    await measure({ url, request, platform, channel, env });
    return redirectResponse(intent.download_url);
  }
  const manifest = await loadChannelManifest(channel, fetch);
  const fallback = resolveChannelDownload({ channel, platform, manifest, fallbackUrls: { mac: env.NALANA_MAC_URL, windows: env.NALANA_WIN_URL } });
  if (!fallback) return new Response('The latest Nalana download is temporarily unavailable.', { status: 503, headers: downloadHeaders });
  // A direct redirect is request evidence only; never manufacture a transfer start.
  // Relay-backed downloads retain their separate backend notification owner.
  await notifyDownload({ platform, channel, request, fetch, env });
  await measure({ url, request, platform, channel, env });
  return redirectResponse(fallback);
}
