import { establishDownloadSubject, rememberDownload } from './download-cookie.js';
import { createIntent, recordHandoff, flagEnabled } from './acquisition-api.js';
import { loadStableManifest, resolveStableDownload } from './stable-release.js';

export const downloadHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const redirectResponse = (target, status = 302) => new Response(null, { status, headers: { ...downloadHeaders, location: target } });

/** The website observes a handoff only. Body writes are observed by the relay. */
export async function handleDownload({ fetch, url, request, cookies, enrollment = null, env = process.env }) {
  const platform = url.searchParams.get('platform');
  if (!['mac','windows'].includes(platform)) return new Response('Unknown platform. Use ?platform=mac or ?platform=windows', { status: 400, headers: downloadHeaders });
  if (request.method === 'HEAD') return new Response(null, { status: 204, headers: downloadHeaders });
  const purpose = `${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`;
  if (/prefetch|preview|prerender/i.test(purpose)) return new Response(null, { status: 204, headers: downloadHeaders });
  let subject = null;
  if (flagEnabled(env.NALANA_ACQUISITION_RELAY)) {
    const established = establishDownloadSubject({ cookies, url, platform, env });
    if (established.retryUrl) return redirectResponse(established.retryUrl, 303);
    subject = established.subject;
  }
  // Classify transiently; raw UA/IP never enters backend records or events.
  const trafficClass = /bot|crawler|spider|slackbot|facebookexternalhit|preview/i.test(request.headers.get('user-agent') || '') ? 'bot' : 'unclassified';
  const intent = await createIntent({ platform, subject, enrollment, clickId: url.searchParams.get('click_id'), trafficClass, fetch, env });
  if (intent) {
    rememberDownload(cookies, intent, env);
    await recordHandoff({ downloadId: intent.download_id, deliveryMode: 'relay', fetch, env });
    return redirectResponse(intent.download_url);
  }
  const manifest = await loadStableManifest(fetch);
  const fallback = resolveStableDownload({ platform, manifest, fallbackUrls: { mac: env.NALANA_MAC_URL, windows: env.NALANA_WIN_URL } });
  if (!fallback) return new Response('The latest Nalana download is temporarily unavailable.', { status: 503, headers: downloadHeaders });
  // No intent means no manufactured backend handoff/start. This safe fallback
  // is unobserved and can never produce a download-start email.
  return redirectResponse(fallback);
}
