import { readAuthRecoveryRequest } from '#lib/server/auth-request.js';
import { json } from '@sveltejs/kit';
import { proxyAuth } from '#lib/server/authApi.js';
import { campaignEnvironment } from '#lib/server/campaign-runtime.js';
import { measureSignup } from '#lib/server/campaign-measurement.js';

/**
 * POST /api/auth/register
 * Proxies to POST {NALANA_API_BASE}/v1/auth/register
 */
export async function POST(event) {
  const { request } = event;
  const parsed = await readAuthRecoveryRequest(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const { email, password } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const response = await proxyAuth('/v1/auth/register', { email, password }, { mode: 'signup', event });
  await measureSignup({ response, campaign: body.campaign, request, env: campaignEnvironment() });
  return response;
}
