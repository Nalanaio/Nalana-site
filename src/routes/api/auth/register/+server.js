import { json } from '@sveltejs/kit';

const AZURE_API = process.env.AZURE_API_URL; // e.g. https://nalana-api.azurewebsites.net

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 * Returns: { token, user: { id, email, name, plan, credits } }
 *
 * Proxies to the Azure Python backend.
 * When the backend isn't ready yet, returns a mock response for testing.
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email, password, name } = body;

  // ── Validation ──
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!name || name.trim().length < 1) {
    return json({ error: 'Name is required.' }, { status: 400 });
  }

  // ── Forward to Azure backend ──
  if (AZURE_API) {
    try {
      const res = await fetch(`${AZURE_API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      return json(data, { status: res.status });
    } catch (err) {
      console.error('Azure backend error:', err);
      return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
    }
  }

  // ── TEMP: Mock response (remove when Azure backend is wired up) ──
  // TODO: remove this block once AZURE_API_URL env var is set in Vercel
  console.warn('[auth/register] AZURE_API_URL not set — using mock response');
  return json({
    token: 'mock_jwt_' + Date.now(),
    user: {
      id: 'mock_' + Date.now(),
      email,
      name,
      plan: 'free',
      credits: 50,
    },
  });
}
