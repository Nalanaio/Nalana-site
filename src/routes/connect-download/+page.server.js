import * as env from '$app/env/private';
import { readEnrollment } from '#lib/server/funnel-api.js';
import { ownedDownload } from '#lib/server/download-cookie.js';
import { downloadHeaders } from '#lib/server/download-handler.js';
import { flagEnabled } from '#lib/server/acquisition-api.js';

export function load({ cookies, setHeaders }) {
  setHeaders(downloadHeaders);
  return { available: flagEnabled(env.NALANA_ACQUISITION_PAIRING), consented: !!readEnrollment(cookies), hasDownload: !!ownedDownload(cookies, env) };
}
