import { campaignEnvironment } from '#lib/server/campaign-runtime.js';
import { readEnrollment } from '#lib/server/funnel-api.js';
import { handleDownload } from '#lib/server/download-handler.js';

/** GET /api/download?platform=mac|windows, including ordinary no-JS links. */
export async function GET(event) {
  return handleDownload({ ...event, enrollment: readEnrollment(event.cookies), env: campaignEnvironment() });
}
export async function HEAD(event) {
  return handleDownload({ ...event, env: campaignEnvironment() });
}
