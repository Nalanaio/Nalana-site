import { browserContext, reply } from '#lib/server/authSession.js';
import { pendingLogout } from '#lib/server/authApi.js';
import { carriedGoogleCleanup } from '#lib/server/googleAuth.js';
export function GET(event) {
  try { return reply({ csrf_token: browserContext(event, true).csrf, revocation_pending: Boolean(pendingLogout(event) || carriedGoogleCleanup(event).length) }); }
  catch { return reply({ error: 'Account service is unavailable.' }, 503); }
}
