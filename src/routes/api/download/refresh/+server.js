import * as env from '$app/env/private';
import { ownedDownload, verifySubject, SUBJECT_COOKIE } from '#lib/server/download-cookie.js';
import { refreshIntent, UUID } from '#lib/server/acquisition-api.js';
import { downloadHeaders } from '#lib/server/download-handler.js';

export async function POST({ request, url, cookies, fetch }) {
  if (request.headers.get('origin') !== url.origin) return new Response('Invalid request origin.', { status: 403, headers: downloadHeaders });
  const owned = ownedDownload(cookies, env);
  if (!owned || !UUID.test(owned.download_id)) return new Response('Start a new download to get a fresh link.', { status: 404, headers: downloadHeaders });
  const subject = cookies.get(SUBJECT_COOKIE);
  const refreshed = verifySubject(subject, env) ? await refreshIntent({ intent: owned, subject, fetch, env }) : null;
  // No valid proof means an honestly new intent through the canonical entry.
  const target = refreshed?.download_url || `/api/download?platform=${owned.platform}`;
  return new Response(null, { status: 303, headers: { ...downloadHeaders, location: target } });
}
