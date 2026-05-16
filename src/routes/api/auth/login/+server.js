import { json } from '@sveltejs/kit';

const AZURE_API = process.env.AZURE_API_URL;

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, email, name, plan, credits } }
 */
export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // ── Forward to Azure backend ──
  if (AZURE_API) {
    try {
      const res = await fetch(`${AZURE_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return json(data, { status: res.status });
    } catch (err) {
      console.error('Azure backend error:', err);
      return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
    }
  }

  // ── TEMP: Mock response ──
  console.warn('[auth/login] AZURE_API_URL not set — using mock response');
  return json({
    token: 'mock_jwt_' + Date.now(),
    user: {
      id: 'mock_' + Date.now(),
      email,
      name: email.split('@')[0],
      plan: 'free',
      credits: 50,
    },
  });
}
