import { backendRequest, sessionResponse } from '#lib/server/authApi.js';
import { advanceGoogleReceipt } from '#lib/server/googleAuth.js';
import { reply, tokenCookie, credentialSid } from '#lib/server/authSession.js';
export async function POST(event) {
  const targetSid = credentialSid(event);
  const refresh_token = tokenCookie(event, 'refresh'), oldAccess = tokenCookie(event, 'access');
  if (!refresh_token) return reply({ error: 'Please sign in again.' }, 401);
  const result = await backendRequest('/v1/auth/refresh', { refresh_token });
  const response = await sessionResponse(event, result, { refresh: true, targetSid });
  if (response.ok) advanceGoogleReceipt(event, oldAccess, refresh_token, result.data);
  return response;
}
