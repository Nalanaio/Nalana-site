import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ACCESS_COOKIE = 'nalana_dev_access';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const RELEASE_REPO = 'Nalanaio/nalana-dev-builds';
const RELEASE_TAG = 'dev-latest';
const MANIFEST_URL = `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/build-info.json`;

function digest(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function secureTextEqual(left, right) {
  const leftDigest = createHmac('sha256', 'nalana-dev-password').update(left).digest();
  const rightDigest = createHmac('sha256', 'nalana-dev-password').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function sessionToken(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}`;
  return `${payload}.${digest(payload, secret)}`;
}

function hasValidSession(cookies) {
  const secret = env.DEV_PAGE_SESSION_SECRET;
  const token = cookies.get(ACCESS_COOKIE);
  if (!secret || !token) return false;

  const [version, expiresText, signature] = token.split('.');
  const payload = `${version}.${expiresText}`;
  const expires = Number(expiresText);
  if (version !== 'v1' || !Number.isFinite(expires) || expires < Date.now() / 1000 || !signature) {
    return false;
  }

  const expected = digest(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function loadManifest(fetch) {
  try {
    const response = await fetch(MANIFEST_URL, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return { manifest: null, error: `The latest dev build is not available yet (${response.status}).` };
    }

    return { manifest: await response.json(), error: null };
  } catch {
    return { manifest: null, error: 'Could not reach the dev build service. Try again shortly.' };
  }
}

export const prerender = false;

export async function load({ cookies, fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });

  const configured = Boolean(env.DEV_PAGE_PASSWORD && env.DEV_PAGE_SESSION_SECRET);
  if (!configured || !hasValidSession(cookies)) {
    return { configured, authorized: false, manifest: null, error: null };
  }

  const { manifest, error } = await loadManifest(fetch);
  return { configured, authorized: true, manifest, error };
}

export const actions = {
  default: async ({ cookies, request, url }) => {
    const formData = await request.formData();
    const action = String(formData.get('action') ?? 'login');

    if (action === 'logout') {
      cookies.delete(ACCESS_COOKIE, { path: '/dev' });
      throw redirect(303, '/dev');
    }

    if (!env.DEV_PAGE_PASSWORD || !env.DEV_PAGE_SESSION_SECRET) {
      return fail(503, { error: 'The dev download page is not configured yet.' });
    }

    const password = String(formData.get('password') ?? '');
    if (!secureTextEqual(password, env.DEV_PAGE_PASSWORD)) {
      return fail(401, { error: 'Incorrect password.' });
    }

    cookies.set(ACCESS_COOKIE, sessionToken(env.DEV_PAGE_SESSION_SECRET), {
      path: '/dev',
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      maxAge: SESSION_TTL_SECONDS,
    });

    throw redirect(303, '/dev');
  },
};
