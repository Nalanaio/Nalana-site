import { cancelGoogle, pendingGoogleCleanup, carryLogoutGoogleCleanup, discardCarriedGoogleCleanup } from '#lib/server/googleAuth.js';
import { revokeSession, carryPendingLogout } from '#lib/server/authApi.js';
import { clearSession, reply } from '#lib/server/authSession.js';
export async function POST(event) {
  const google = await cancelGoogle(event);
  const result = await revokeSession(event);
  const pending = !google.ok ? pendingGoogleCleanup(event) : [];
  discardCarriedGoogleCleanup(event);
  const context = clearSession(event);
  carryPendingLogout(event, result.pending);
  carryLogoutGoogleCleanup(event, pending);
  // Clear locally even on outage, but expose incomplete remote revocation.
  const complete = result.ok && google.ok;
  return reply({ signed_out: true, csrf_token: context.csrf, revocation_pending: !complete }, complete ? 200 : 503);
}
