import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Backend root URL — must match IDE NALANA_API_BASE exactly (no trailing slash).
 * Auth: POST /v1/auth/login, /v1/auth/register; GET /v1/users/me
 *
 * Local: NALANA_API_BASE in .env (restart `npm run dev` after editing)
 * Vercel: same variable in project Environment Variables
 */
export function getApiBase() {
  const base =
    env.NALANA_API_BASE ||
    env.AZURE_API_URL ||
    process.env.NALANA_API_BASE ||
    process.env.AZURE_API_URL;
  return base ? base.replace(/\/$/, '') : null;
}

export function apiUnavailable() {
  return json(
    {
      error:
        'Auth service is not configured. Set NALANA_API_BASE to the same URL as the IDE (e.g. production Railway backend).',
    },
    { status: 503 }
  );
}

/** Normalize backend payloads (access_token vs token, nested user). */
export function normalizeAuthResponse(data) {
  const token = data.access_token ?? data.token;
  const rawUser = data.user ?? data;
  const user = {
    id: rawUser.id ?? rawUser.user_id ?? data.user_id,
    email: rawUser.email ?? data.email,
    name: rawUser.name ?? data.name ?? '',
    plan: rawUser.plan ?? data.plan ?? 'free',
    credits: rawUser.credits ?? data.credits ?? 0,
  };
  return { token, user };
}

/** Map backend errors to user-facing messages. */
export function mapAuthError(status, data, { mode = 'login' } = {}) {
  const detail =
    data?.error ??
    data?.detail ??
    (typeof data?.message === 'string' ? data.message : null);

  if (status === 401 && mode === 'login') {
    return detail || 'No account found. Please sign up first.';
  }
  if (status === 401) {
    return detail || 'Invalid email or password.';
  }
  if (status === 409) {
    return detail || 'An account with this email already exists.';
  }
  if (status === 400) {
    return detail || 'Please check your input and try again.';
  }
  if (status >= 500) {
    return 'Service unavailable. Please try again.';
  }
  return detail || 'Something went wrong. Please try again.';
}

export async function proxyAuth(path, body, options = {}) {
  const base = getApiBase();
  if (!base) {
    console.error(`[auth] ${path} — NALANA_API_BASE not set (must match IDE)`);
    return apiUnavailable();
  }

  const url = `${base}${path}`;

  try {
    const res = await fetch(url, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = {};
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!res.ok) {
      return json(
        { error: mapAuthError(res.status, data, options) },
        { status: res.status }
      );
    }

    return json(normalizeAuthResponse(data), { status: res.status });
  } catch (err) {
    console.error(`[auth] ${path} backend error:`, err);
    return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}

export async function proxyMe(authHeader) {
  const base = getApiBase();
  if (!base) return apiUnavailable();

  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid authorization.' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token.startsWith('mock_jwt_')) {
    return json({ error: 'Invalid session. Please log in again.' }, { status: 401 });
  }

  const paths = ['/v1/users/me', '/users/me'];

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });

      if (res.status === 404 && path !== paths[paths.length - 1]) continue;

      let data = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        return json(
          { error: mapAuthError(res.status, data) },
          { status: res.status }
        );
      }

      const { user } = normalizeAuthResponse({ user: data, ...data });
      return json({ user, token }, { status: 200 });
    } catch (err) {
      console.error(`[auth] GET ${path} error:`, err);
    }
  }

  return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
}
