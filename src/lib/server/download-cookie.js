import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SUBJECT_COOKIE = 'nalana_download_subject';
export const INTENT_COOKIE = 'nalana_download_intent';
const DAY = 86400;

function signingConfig(env) {
  try {
    const keys = JSON.parse(env.NALANA_DOWNLOAD_COOKIE_KEYS || '{}');
    const kid = env.NALANA_DOWNLOAD_COOKIE_KEY_ID;
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(kid || '') || typeof keys[kid] !== 'string' || keys[kid].length < 32 || !env.NALANA_ENVIRONMENT) return null;
    return { keys, kid, environment: env.NALANA_ENVIRONMENT };
  } catch { return null; }
}

export function signDownloadState(payload, env = process.env) {
  const config = signingConfig(env);
  if (!config) return null;
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signed = `${config.kid}.${encoded}`;
  return `${signed}.${createHmac('sha256', config.keys[config.kid]).update(signed).digest('base64url')}`;
}

export function readDownloadState(token, env = process.env, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const config = signingConfig(env);
  if (!config) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
  const key = config.keys[parts[0]];
  if (typeof key !== 'string' || key.length < 32) return null;
  const expected = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.v !== 1 || payload.environment !== config.environment || !Number.isInteger(payload.issued_at) || !Number.isInteger(payload.expires_at) || payload.issued_at > now + 300 || payload.expires_at <= now || payload.expires_at <= payload.issued_at || payload.expires_at - payload.issued_at > DAY) return null;
    return payload;
  } catch { return null; }
}

export function mintSubject(env = process.env, now = Math.floor(Date.now() / 1000)) {
  return signDownloadState({ v: 1, subject: randomBytes(16).toString('hex'), environment: env.NALANA_ENVIRONMENT, issued_at: now, expires_at: now + DAY }, env);
}

export function verifySubject(token, env = process.env, now = Math.floor(Date.now() / 1000)) {
  const payload = readDownloadState(token, env, now);
  return payload && /^[a-f0-9]{32}$/.test(payload.subject || '') && !payload.purpose ? payload : null;
}

export function mintRetry(platform, env = process.env, now = Math.floor(Date.now() / 1000)) {
  return signDownloadState({ v: 1, purpose: 'cookie_retry', platform, channel: 'stable', attempt: 1, environment: env.NALANA_ENVIRONMENT, issued_at: now, expires_at: now + 300 }, env);
}

export function verifyRetry(token, platform, env = process.env, now = Math.floor(Date.now() / 1000)) {
  const payload = readDownloadState(token, env, now);
  return !!payload && payload.purpose === 'cookie_retry' && payload.platform === platform && payload.channel === 'stable' && payload.attempt === 1 && payload.expires_at - payload.issued_at <= 300;
}

export function establishDownloadSubject({ cookies, url, platform, env = process.env, now = Math.floor(Date.now() / 1000) }) {
  const existing = cookies.get(SUBJECT_COOKIE);
  if (verifySubject(existing, env, now)) return { subject: existing, retryUrl: null };
  // Any retry marker terminates the round trip. Only a returned valid cookie
  // can confer eligibility; forged or blocked-cookie retries get no subject.
  if (url.searchParams.has('_retry')) return { subject: null, retryUrl: null };
  const subject = mintSubject(env, now);
  const retry = mintRetry(platform, env, now);
  if (!subject || !retry) return { subject: null, retryUrl: null };
  cookies.set(SUBJECT_COOKIE, subject, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: DAY });
  const clickId = url.searchParams.get('click_id');
  const clickQuery = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clickId || '') ? `&click_id=${clickId}` : '';
  return { subject: null, retryUrl: `/api/download?platform=${platform}&_retry=${encodeURIComponent(retry)}${clickQuery}` };
}

export function rememberDownload(cookies, intent, env = process.env, now = Math.floor(Date.now() / 1000)) {
  const token = signDownloadState({ v: 1, purpose: 'owned_intent', download_id: intent.download_id, artifact_id: intent.artifact_id, release_id: intent.release_id, platform: intent.platform, environment: env.NALANA_ENVIRONMENT, issued_at: now, expires_at: now + DAY }, env);
  if (token) cookies.set(INTENT_COOKIE, token, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: DAY });
}

export function ownedDownload(cookies, env = process.env, now = Math.floor(Date.now() / 1000)) {
  const state = readDownloadState(cookies.get(INTENT_COOKIE), env, now);
  return state?.purpose === 'owned_intent' && ['windows', 'mac'].includes(state.platform) ? state : null;
}
