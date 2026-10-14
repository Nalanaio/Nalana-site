import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const OPERATOR_COOKIE = '__Host-nalana-operator';
export const OPERATOR_CHALLENGE_COOKIE = '__Host-nalana-operator-login';
export const OPERATOR_COOKIE_OPTIONS = { path: '/', httpOnly: true, secure: true, sameSite: /** @type {const} */ ('strict'), maxAge: 900 };
const TTL = 15 * 60_000;
export class OperatorError extends Error {
  constructor(status, message = 'Operator access denied.') { super(message); this.status = status; }
}

/** Fixed, configured origin only. HTTP is allowed exclusively for local test/development servers. */
export function operatorBackendBase(config) {
  let url;
  try { url = new URL(config.NALANA_API_BASE || config.AZURE_API_URL); } catch { throw new OperatorError(503, 'Operator service is not configured.'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname) || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new OperatorError(503, 'Operator service is not configured.');
  return url.origin;
}

const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length <= 256 && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Independent from ordinary browser account storage. Credentials never enter serialized page data. */
export function createOperatorService(config, { fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const attempts = new Map();
  function settings() {
    const allowed = new Set(String(config.OPERATOR_ALLOWED_ACCOUNT_IDS || '').split(',').map((v) => v.trim()).filter(Boolean));
    const secret = config.OPERATOR_SESSION_KEY;
    if (config.SITE_ACQUISITION_REPORTS_ENABLED !== 'true' || !allowed.size || typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new OperatorError(503, 'Operator reporting is not enabled.');
    return { allowed, key: createHash('sha256').update(secret).digest(), base: operatorBackendBase(config) };
  }
  function seal(payload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', settings().key, iv);
    cipher.setAAD(Buffer.from('nalana-operator-v1'));
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const value = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
    if (value.length > 3800) throw new OperatorError(503, 'Operator session could not be established.');
    return value;
  }
  function open(cookie, kind) {
    const { key } = settings();
    try {
      if (typeof cookie !== 'string' || cookie.length > 3800 || !/^[A-Za-z0-9_-]+$/.test(cookie)) throw new Error();
      const bytes = Buffer.from(cookie, 'base64url');
      if (bytes.length < 29 || bytes.toString('base64url') !== cookie) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from('nalana-operator-v1'));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
      if (payload.kind !== kind || payload.version !== 1 || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt !== payload.issuedAt + TTL || now() >= payload.expiresAt || payload.issuedAt > now() + 30_000 || typeof payload.csrf !== 'string') throw new Error();
      return payload;
    } catch { throw new OperatorError(kind === 'challenge' ? 403 : 401, 'Operator session expired or invalid. Sign in again.'); }
  }
  function assertAction(request, expected, submitted) {
    if (request.method !== 'POST' || request.headers.get('origin') !== new URL(request.url).origin || !safeEqual(expected, submitted)) throw new OperatorError(403, 'This form expired. Reload the page and try again.');
  }
  async function backend(path, options) {
    try {
      const response = await fetchImpl(`${settings().base}${path}`, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json', ...options.headers } });
      if (!response.ok) throw new OperatorError(response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : 503, response.status === 429 ? 'Too many attempts. Try again later.' : 'Operator authentication is unavailable or invalid.');
      const length = Number(response.headers.get('content-length'));
      if (length > 65_536) throw new Error();
      const text = await response.text();
      if (Buffer.byteLength(text) > 65_536) throw new Error();
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof OperatorError) throw error;
      throw new OperatorError(503, 'Operator authentication is unavailable. Try again later.');
    }
  }
  function checkUser(user) {
    if (!user || typeof user.id !== 'string' || !settings().allowed.has(user.id) || user.email_verified !== true || user.status !== 'active') throw new OperatorError(403);
  }
  return {
    createChallenge() {
      settings();
      const csrf = randomBytes(32).toString('base64url');
      const issuedAt = now();
      return { csrf, cookie: seal({ version: 1, kind: 'challenge', csrf, issuedAt, expiresAt: issuedAt + TTL }) };
    },
    challenge(cookie) { return open(cookie, 'challenge').csrf; },
    assertAction,
    assertSessionAction(cookie, request, submitted) { assertAction(request, open(cookie, 'session').csrf, submitted); },
    async login({ request, challengeCookie, csrf, email, password }) {
      const challenge = open(challengeCookie, 'challenge');
      assertAction(request, challenge.csrf, csrf);
      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 320 || password.length > 1024) throw new OperatorError(400, 'Enter your operator email and password.');
      // No raw account address/IP is kept in this supplemental limiter. Backend throttling remains authoritative across instances.
      const bucket = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
      const limit = attempts.get(bucket);
      if (limit && now() < limit.until && limit.count >= 5) throw new OperatorError(429, 'Too many attempts. Try again later.');
      if (attempts.size > 1000) for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key);
      if (attempts.size >= 2000 && !attempts.has(bucket)) throw new OperatorError(429, 'Too many attempts. Try again later.');
      attempts.set(bucket, !limit || now() >= limit.until ? { count: 1, until: now() + TTL } : { count: limit.count + 1, until: limit.until });
      const data = await backend('/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
      checkUser(data.user);
      if (typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 2500) throw new OperatorError(503, 'Operator session could not be established.');
      const issuedAt = now();
      const sessionCsrf = randomBytes(32).toString('base64url');
      return { cookie: seal({ version: 1, kind: 'session', accountId: data.user.id, authVersion: data.user.auth_version ?? null, token: data.access_token, csrf: sessionCsrf, issuedAt, expiresAt: issuedAt + TTL }), csrf: sessionCsrf };
    },
    async authorize(cookie) {
      const session = open(cookie, 'session');
      if (typeof session.token !== 'string' || typeof session.accountId !== 'string') throw new OperatorError(401);
      const user = await backend('/v1/users/me', { method: 'GET', headers: { Authorization: `Bearer ${session.token}` } });
      checkUser(user);
      if (user.id !== session.accountId || (session.authVersion !== null && user.auth_version !== session.authVersion)) throw new OperatorError(401);
      // Backend /users/me authenticates the token against the current DB auth_version, including legacy version zero.
      return { accountId: user.id, csrf: session.csrf, reauthenticatedAt: new Date(session.issuedAt).toISOString(), expiresAt: new Date(session.expiresAt).toISOString() };
    }
  };
}
