import { proxyAuthenticated } from '#lib/server/authApi.js';
import { readAuthRecoveryRequest } from '#lib/server/auth-request.js';
export async function POST(event) {
  const { request } = event;
  const parsed = await readAuthRecoveryRequest(request);
  if (parsed.response) return parsed.response;
  return proxyAuthenticated('/v1/auth/resend-verification/current', event, { method: 'POST', body: {} });
}
