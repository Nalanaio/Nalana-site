import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Backend root URL — must match IDE NALANA_API_BASE exactly (no trailing slash).
 * Auth: POST /v1/auth/login, register, refresh, forgot-password, reset-password
 * Users: GET/PATCH /v1/users/me; GET /v1/usage/me
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

/** Normalize user object from backend (AuthResponse or /users/me). */
export function normalizeUser(rawUser, data = {}) {
  const u = rawUser ?? data;
  const tier = u.tier ?? u.plan ?? data.tier ?? data.plan ?? 'free';
  const displayName = u.display_name ?? u.name ?? data.display_name ?? data.name ?? '';
  return {
    id: u.id ?? u.user_id ?? data.user_id,
    email: u.email ?? data.email,
    name: displayName,
    display_name: displayName,
    avatar_url: u.avatar_url ?? data.avatar_url ?? '',
    email_verified: Boolean(u.email_verified ?? data.email_verified),
    plan: tier,
    tier,
    credits: u.credits ?? data.credits ?? 0,
    status: u.status ?? 'active',
  };
}

/** Normalize backend payloads (access_token vs token, nested user). */
export function normalizeAuthResponse(data) {
  const token = data.access_token ?? data.token;
  const refresh_token = data.refresh_token ?? null;
  const user = normalizeUser(data.user ?? data, data);
  return { token, refresh_token, user };
}

/** Map backend errors to user-facing messages. */
export function mapAuthError(status, data, { mode = 'login' } = {}) {
  const detail =
    data?.error ??
    data?.detail ??
    (typeof data?.message === 'string' ? data.message : null);

  if (status === 403) {
    return detail || 'Email not verified. Check your inbox or request a new verification email.';
  }
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

      const user = normalizeUser(data.user ?? data, data);
      return json({ user, token }, { status: 200 });
    } catch (err) {
      console.error(`[auth] GET ${path} error:`, err);
    }
  }

  return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
}

/** Authenticated GET/PATCH (and other methods) to backend. */
export async function proxyAuthenticated(path, request, options = {}) {
  const base = getApiBase();
  if (!base) return apiUnavailable();

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid authorization.' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token.startsWith('mock_jwt_')) {
    return json({ error: 'Invalid session. Please log in again.' }, { status: 401 });
  }

  const method = options.method ?? 'GET';
  let body;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  } else if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      body = undefined;
    }
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body,
    });

    let data = {};
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }

    if (!res.ok) {
      return json(
        { error: mapAuthError(res.status, data, options) },
        { status: res.status }
      );
    }

    if (path.includes('/users/me')) {
      const user = normalizeUser(data.user ?? data, data);
      return json({ user, token }, { status: res.status });
    }

    return json(data, { status: res.status });
  } catch (err) {
    console.error(`[auth] ${method} ${path} error:`, err);
    return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}

/** Proxy JSON to backend without auth-response normalization. */
export async function proxyBackend(path, body, options = {}) {
  const base = getApiBase();
  if (!base) {
    console.error(`[auth] ${path} — NALANA_API_BASE not set (must match IDE)`);
    return apiUnavailable();
  }

  try {
    const res = await fetch(`${base}${path}`, {
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
        data = { detail: text };
      }
    }

    if (!res.ok) {
      return json(
        { error: mapAuthError(res.status, data, options) },
        { status: res.status }
      );
    }

    return json(data, { status: res.status });
  } catch (err) {
    console.error(`[auth] ${path} backend error:`, err);
    return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
