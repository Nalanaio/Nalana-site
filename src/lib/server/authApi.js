import { json } from '@sveltejs/kit';
import * as env from '$app/env/private';

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
        'Account service is unavailable. Please try again later.',
    },
    { status: 503 }
  );
}

export { normalizeUser, normalizeAuthResponse, mapAuthError } from '../auth/projection.js';
import { normalizeUser, normalizeAuthResponse, safeAuthError } from '../auth/projection.js';

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
      signal: AbortSignal.timeout(10000),
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
        data = {};
      }
    }

    if (!res.ok) {
      return json(
        safeAuthError(res.status, data, options),
        { status: res.status }
      );
    }

    return json(normalizeAuthResponse(data), { status: res.status });
  } catch (err) {
    console.error('[auth] backend request failed');
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
        signal: AbortSignal.timeout(10000),
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
          safeAuthError(res.status, data),
          { status: res.status }
        );
      }

      const user = normalizeUser(data.user ?? data, data);
      return json({ user, token }, { status: 200 });
    } catch (err) {
      console.error('[auth] account request failed');
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
      signal: AbortSignal.timeout(10000),
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
        data = {};
      }
    }

    if (!res.ok) {
      return json(
        safeAuthError(res.status, data, options),
        { status: res.status }
      );
    }

    if (path.includes('/users/me')) {
      const user = normalizeUser(data.user ?? data, data);
      return json({ user, token }, { status: res.status });
    }

    return json(options.authResponse ? normalizeAuthResponse(data) : data, { status: res.status });
  } catch (err) {
    console.error('[auth] authenticated request failed');
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
      signal: AbortSignal.timeout(10000),
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
        data = {};
      }
    }

    if (!res.ok) {
      return json(
        safeAuthError(res.status, data, options),
        { status: res.status }
      );
    }

    return json(data, { status: res.status });
  } catch (err) {
    console.error('[auth] backend request failed');
    return json({ error: 'Service unavailable. Please try again.' }, { status: 503 });
  }
}
