import { json } from '@sveltejs/kit';
import { proxyAuthenticated } from '#lib/server/authApi.js';
import { readAuthRecoveryRequest } from '#lib/server/auth-request.js';
export async function POST({ request }) {
  const parsed = await readAuthRecoveryRequest(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (typeof body.new_email !== 'string' || body.new_email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.new_email) || typeof body.current_password !== 'string' || !body.current_password || body.current_password.length > 4096) {
    return json({ error: 'Enter a valid email address and your current password.' }, { status: 400 });
  }
  return proxyAuthenticated('/v1/auth/change-email', request, { method: 'POST', body: { new_email: body.new_email.trim(), current_password: body.current_password }, authResponse: true });
}
