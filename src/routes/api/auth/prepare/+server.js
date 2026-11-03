import { prepareContext, reply } from '#lib/server/authSession.js';
import { pendingGoogleCleanup, carryGoogleCleanup } from '#lib/server/googleAuth.js';
import { pendingLogout } from '#lib/server/authApi.js';
export function POST(event) {
  if (pendingLogout(event)) return reply({ error: 'Retry sign-out to finish revoking the previous session before signing in again.' }, 409);
  const cleanup = pendingGoogleCleanup(event);
  if (cleanup.length > 8) return reply({ error: 'Cancel the pending Google sign-in before starting again.' }, 409);
  const context = prepareContext(event); carryGoogleCleanup(event, cleanup);
  return reply({ csrf_token: context.csrf });
}
