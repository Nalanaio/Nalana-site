import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const PRIVATE_HEADERS = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };
export const reply = (body, status = 200) => Response.json(body, { status, headers: PRIVATE_HEADERS });
function key() {
  const secret = process.env.NALANA_AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error('Website session configuration unavailable.');
  return createHash('sha256').update(secret).digest();
}
export function seal(value, purpose) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function unseal(value, purpose) {
  try {
    if (typeof value !== 'string' || value.length > 4096) return null;
    const bytes = Buffer.from(value, 'base64url'), decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
export function cookieConfig(event) {
  const url = event.url ?? new URL(event.request.url);
  const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && url.protocol !== 'https:') throw new Error('HTTPS required.');
  return { prefix: local ? 'nalana_dev_' : '__Host-nalana_', options: { path: '/', httpOnly: true, secure: !local, sameSite: 'lax' } };
}
function cookieName(event, name) { return name === 'google' ? `google_${readCookie(event, 'context')?.sid ?? 'none'}` : name; }
export function readCookie(event, name) { name = cookieName(event, name); const { prefix } = cookieConfig(event); return unseal(event.cookies.get(prefix + name), name); }
export function setCookie(event, name, value, seconds) {
  name = cookieName(event, name);
  const { prefix, options } = cookieConfig(event);
  const encoded = seal({ ...value, exp: Date.now() + seconds * 1000 }, name);
  if (encoded.length > 3900) throw new Error('Session response too large.');
  event.cookies.set(prefix + name, encoded, { ...options, maxAge: seconds });
}
export function deleteCookie(event, name) { name = cookieName(event, name); const { prefix, options } = cookieConfig(event); event.cookies.delete(prefix + name, options); }
export function browserContext(event, create = false) {
  let context = readCookie(event, 'context');
  if (!context && create) { context = { sid: randomBytes(24).toString('base64url'), csrf: randomBytes(32).toString('base64url') }; setCookie(event, 'context', context, 30 * 86400); }
  return context;
}
export function checkCsrf(event) {
  const request = event.request, context = browserContext(event);
  const origin = (event.url ?? new URL(request.url)).origin;
  const supplied = request.headers.get('x-csrf-token');
  if (request.headers.get('origin') !== origin || !context || typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(context.csrf) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(context.csrf))) return reply({ error: 'This request expired. Refresh the page and try again.' }, 403);
  return null;
}
export function credentialSid(event) {
  const context = browserContext(event); if (!context) return null;
  // Once a replacement pair was accepted (or partially delivered), never
  // restore the preflight fallback after expiry/authoritative invalidation.
  if (readCookie(event, `committed_${context.sid}`) || readCookie(event, `access_${context.sid}`) || readCookie(event, `refresh_${context.sid}`)) return context.sid;
  return context.fallbackSid ?? context.sid;
}
export const logoutGeneration = event => readCookie(event, 'logout_generation')?.value ?? 'initial';
export function tokenCookie(event, kind) {
  const sid = credentialSid(event), stored = sid ? readCookie(event, `${kind}_${sid}`) : null;
  return stored?.sid === sid && stored.generation === logoutGeneration(event) && stored.home === (process.env.NALANA_API_BASE?.replace(/\/$/, '') ?? null) && typeof stored.token === 'string' ? stored.token : null;
}
/** This short preflight runs before credentials are submitted. Auth responses
 * never replace context, so an older response cannot undo logout/new attempt. */
export function prepareContext(event) {
  const fallbackSid = tokenCookie(event, 'refresh') ? credentialSid(event) : null;
  const context = { sid: randomBytes(24).toString('base64url'), csrf: randomBytes(32).toString('base64url'), fallbackSid };
  setCookie(event, 'context', context, 30 * 86400); return context;
}
export const authorization = event => { const token = tokenCookie(event, 'access'); return token ? `Bearer ${token}` : null; };
function lifetime(token, maximum) {
  try { const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp; if (!Number.isFinite(exp)) return 0; return Math.max(0, Math.min(maximum, Math.floor(exp - Date.now() / 1000))); } catch { return 0; }
}
export function installSession(event, data, { targetSid = null } = {}) {
  const access = data.access_token ?? data.token, renewal = data.refresh_token;
  if (typeof access !== 'string' || typeof renewal !== 'string') throw new Error('Incomplete session response.');
  // JWT expiry is used only to shorten browser storage, never as authentication proof.
  const accessAge = lifetime(access, 86400), refreshAge = Math.min(86400, Math.max(60, Number(process.env.NALANA_AUTH_REFRESH_COOKIE_SECONDS) || 86400));
  if (!accessAge || !refreshAge) throw new Error('Invalid session expiry.');
  const context = browserContext(event);
  if (!context) throw new Error('Missing browser session.');
  const sid = targetSid ?? context.sid;
  // Build all encrypted values before writing any cookies.
  const values = [{kind: 'access', token: access, age: accessAge}, {kind: 'refresh', token: renewal, age: refreshAge}].map(({kind, token, age}) => ({ kind, age, encoded: seal({ sid, generation: logoutGeneration(event), home: process.env.NALANA_API_BASE?.replace(/\/$/, '') ?? null, token, exp: Date.now() + age * 1000 }, `${kind}_${sid}`) }));
  if (values.some(value => value.encoded.length > 3900)) throw new Error('Session response too large.');
  const { prefix, options } = cookieConfig(event);
  setCookie(event, `committed_${sid}`, { committed: true }, 30 * 86400);
  for (const value of values) event.cookies.set(prefix + value.kind + '_' + sid, value.encoded, { ...options, maxAge: value.age });
  return context;
}
export function clearCredentials(event) {
  const sid = credentialSid(event);
  if (sid) { deleteCookie(event, `access_${sid}`); deleteCookie(event, `refresh_${sid}`); }
}
export function discardPriorSession(event, sid) {
  if (!sid || sid === browserContext(event)?.sid) return;
  for (const kind of ['access', 'refresh', 'committed', 'google', 'google_cleanup']) deleteCookie(event, `${kind}_${sid}`);
}
export function clearSession(event) {
  clearCredentials(event); deleteCookie(event, 'google');
  // Only logout writes this fence. Stale preflight/context/refresh responses
  // cannot overwrite it, including when upstream revocation is unavailable.
  setCookie(event, 'logout_generation', { value: randomBytes(24).toString('base64url') }, 34 * 86400);
  // A late refresh response can only reinstall old-sid cookies; this independent
  // context fence prevents their use after logout or a newer account login.
  const context = { sid: randomBytes(24).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  setCookie(event, 'context', context, 30 * 86400); return context;
}
