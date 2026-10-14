import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { UUID, validBrowserEvent } from '../funnel/contract.js';
import { cleanAttribution } from '../funnel/attribution.js';
export const FUNNEL_COOKIE = 'nalana_funnel';
const cookieOptions = { path: '/', httpOnly: true, secure: true, sameSite: /** @type {'strict'} */ ('strict') };
export function enabled() { return process.env.NALANA_FUNNEL_ENABLED === 'true'; }
export function sameOrigin(request, url) { return request.headers.get('origin') === url.origin; }
function key() { const secret = process.env.NALANA_FUNNEL_COOKIE_SECRET; return secret && secret.length >= 32 ? createHash('sha256').update(secret).digest() : null; }
export function seal(value) {
  const secret = key(); if (!secret) throw new Error('Private funnel cookie is not configured.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function unseal(value) {
  try { const secret = key(); if (!secret || typeof value !== 'string' || value.length > 6000) return null;
    const bytes = Buffer.from(value, 'base64url'), decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  } catch { return null; }
}
export function readEnrollment(cookies, { allowExpired = false, forRevocation = false } = {}) {
  if (!enabled() && !forRevocation) return null;
  const value = unseal(cookies.get(FUNNEL_COOKIE));
  return value && UUID.test(value.id) && typeof value.token === 'string' && typeof value.revoke_token === 'string' && (allowExpired || Date.parse(value.expires_at) > Date.now()) ? value : null;
}
export function writeEnrollment(cookies, value) { cookies.set(FUNNEL_COOKIE, seal(value), { ...cookieOptions, maxAge: 30 * 86400 }); }
export function clearEnrollment(cookies) { cookies.delete(FUNNEL_COOKIE, { path: '/' }); }
export async function backendFetch(path, { body = undefined, authorization = undefined, headers = {}, fetchImpl = fetch, method = 'POST' } = {}) {
  const base = process.env.NALANA_API_BASE?.replace(/\/$/, '');
  if (!base) return new Response(JSON.stringify({ error: 'Usage service unavailable.' }), { status: 503 });
  try { return await fetchImpl(base + path, { method, headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error' }); }
  catch { return new Response(JSON.stringify({ error: 'Usage service unavailable.' }), { status: 503 }); }
}
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
export async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > 65536) throw new Error('body');
  const reader = request.body?.getReader(); if (!reader) throw new Error('body');
  const chunks = []; let length = 0;
  try { while (true) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > 65536) { await reader.cancel(); throw new Error('body'); } chunks.push(item.value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body');
  return value;
}
async function project(response) {
  if (response.status === 204) return new Response(null, { status: 204 });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const result = json({ error: 'Usage request unavailable.', ...(typeof data.code === 'string' && /^[A-Z_]{1,64}$/.test(data.code) ? { code: data.code } : {}) }, response.status);
    const retry = response.headers.get('retry-after');
    if (retry && /^\d{1,5}$/.test(retry)) result.headers.set('retry-after', retry);
    return result;
  }
  return json(data, response.status);
}
/** Private capability cookies never enter the browser response. */
export async function enrollWeb(event) {
  if (!enabled()) return json({ error: 'Optional usage tracking is disabled.' }, 503);
  if (!sameOrigin(event.request, event.url)) return json({ error: 'Origin denied.' }, 403);
  let input; try { input = await boundedBody(event.request); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (input?.consent_state !== 'granted' || input.consent_version !== 1 || !UUID.test(input.web_visitor_id) || !UUID.test(input.web_session_id) || Object.keys(input).some(k => !['consent_state', 'consent_version', 'web_visitor_id', 'web_session_id', 'attribution'].includes(k))) return json({ error: 'Invalid consent enrollment.' }, 400);
  const attribution = cleanAttribution(new URLSearchParams(Object.entries(input.attribution ?? {}).map(([key, value]) => [`utm_${key}`, String(value)])));
  if (!key() || !process.env.NALANA_WEBSITE_SERVICE_TOKEN) return json({ error: 'Usage service unavailable.' }, 503);
  await retryPendingRevoke(event);
  // Reject concurrent accidental replacement: explicit revoke is required first.
  if (readEnrollment(event.cookies)) return json({ error: 'Active enrollment exists.' }, 409);
  const response = await backendFetch('/v1/funnel/enrollments', { body: { schema_version: 1, client: 'website', consent_state: 'granted', consent_version: 1, web_visitor_id: input.web_visitor_id, web_session_id: input.web_session_id, install_id: null, app_session_id: null, build_id: process.env.NALANA_WEBSITE_BUILD_ID || null, platform: 'web', architecture: 'unknown' }, authorization: `Bearer ${process.env.NALANA_WEBSITE_SERVICE_TOKEN}`, fetchImpl: event.fetch });
  if (!response.ok) return project(response);
  const data = await response.json();
  if (!UUID.test(data.enrollment_id) || typeof data.enrollment_token !== 'string' || typeof data.revoke_token !== 'string' || !Number.isFinite(Date.parse(data.expires_at))) return json({ error: 'Usage service unavailable.' }, 502);
  writeEnrollment(event.cookies, { id: data.enrollment_id, token: data.enrollment_token, revoke_token: data.revoke_token, expires_at: data.expires_at, web_visitor_id: input.web_visitor_id, web_session_id: input.web_session_id, session_id: null, association_epoch: 0, attribution });
  return json({ enrollment_id: data.enrollment_id, expires_at: data.expires_at }, 201);
}
export async function lifecycle(event) {
  if (!sameOrigin(event.request, event.url)) return json({ error: 'Origin denied.' }, 403);
  const actions = ['renew', 'revoke', 'sessions', 'associate', 'dissociate'];
  if (!actions.includes(event.params.action) || !UUID.test(event.params.id)) return json({ error: 'Unknown action.' }, 404);
  const enrollment = readEnrollment(event.cookies, { allowExpired: event.params.action === 'revoke', forRevocation: event.params.action === 'revoke' });
  if (!enrollment || enrollment.id !== event.params.id) return json({ error: 'Usage session unavailable.' }, 401);
  let body; try { body = await boundedBody(event.request); } catch { return json({ error: 'Invalid request.' }, 400); }
  const action = event.params.action;
  if (action === 'revoke') {
    // Clear first; leave only an encrypted capability for bounded offline revoke retry.
    clearEnrollment(event.cookies);
    const response = await backendFetch(`/v1/funnel/enrollments/${enrollment.id}/revoke`, { body: {}, authorization: `Funnel ${enrollment.revoke_token}`, fetchImpl: event.fetch });
    if (!response.ok) event.cookies.set('nalana_funnel_revoke', seal({ id: enrollment.id, token: enrollment.revoke_token, until: Date.now() + 86400000 }), { ...cookieOptions, maxAge: 86400 });
    return project(response);
  }
  if (action === 'sessions' && (Object.keys(body).sort().join(',') !== 'app_session_id,web_session_id' || body.app_session_id !== null || !UUID.test(body.web_session_id))) return json({ error: 'Invalid session.' }, 400);
  if (['associate', 'dissociate'].includes(action) && (Object.keys(body).join(',') !== 'session_id' || body.session_id !== enrollment.session_id)) return json({ error: 'Session ownership denied.' }, 403);
  if (action === 'renew' && Object.keys(body).length) return json({ error: 'Invalid request.' }, 400);
  const auth = event.request.headers.get('authorization');
  if (action === 'associate' && !auth?.startsWith('Bearer ')) return json({ error: 'Account authentication required.' }, 401);
  const response = await backendFetch(`/v1/funnel/enrollments/${enrollment.id}/${action}`, { body, authorization: action === 'associate' ? auth : `Funnel ${enrollment.token}`, headers: action === 'associate' ? { 'X-Funnel-Enrollment': enrollment.token } : {}, fetchImpl: event.fetch });
  if (!response.ok) return project(response);
  const data = response.status === 204 ? {} : await response.json();
  if (action === 'sessions') { if (!UUID.test(data.session_id) || data.association_epoch !== 0) return json({ error: 'Invalid session response.' }, 502); enrollment.session_id = data.session_id; enrollment.web_session_id = body.web_session_id; enrollment.association_epoch = 0; }
  if (action === 'associate') {
    if (data.association_epoch !== 1) return json({ error: 'Invalid association response.' }, 502);
    const me = await backendFetch('/v1/users/me', { authorization: auth, fetchImpl: event.fetch, method: 'GET' });
    const user = me.ok ? await me.json().catch(() => null) : null;
    if (typeof user?.id !== 'string' || user.id.length > 128) return json({ error: 'Account association unavailable.' }, 503);
    enrollment.association_epoch = 1; enrollment.account_id = user.id;
  }
  if (action === 'dissociate') { enrollment.session_id = null; enrollment.association_epoch = 0; enrollment.account_id = null; }
  if (action === 'renew') { if (typeof data.enrollment_token !== 'string') return json({ error: 'Invalid renewal response.' }, 502); enrollment.token = data.enrollment_token; enrollment.expires_at = data.expires_at; }
  writeEnrollment(event.cookies, enrollment);
  return response.status === 204 ? new Response(null, { status: 204 }) : json(action === 'renew' ? { enrollment_id: enrollment.id, expires_at: enrollment.expires_at } : action === 'sessions' ? { session_id: data.session_id, status: data.status, association_epoch: 0 } : { status: data.status, association_epoch: data.association_epoch });
}
export async function ingestWeb(event) {
  if (!sameOrigin(event.request, event.url)) return json({ error: 'Origin denied.' }, 403);
  const enrollment = readEnrollment(event.cookies);
  if (!enrollment?.session_id) return json({ error: 'Usage session unavailable.' }, 401);
  let body; try { body = await boundedBody(event.request); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (body?.schema_version !== 1 || Object.keys(body).sort().join(',') !== 'events,schema_version' || !Array.isArray(body.events) || !body.events.length || body.events.length > 50 || body.events.some(item => !validBrowserEvent(item) || item.web_session_id !== enrollment.web_session_id || item.association_epoch !== enrollment.association_epoch)) return json({ error: 'Invalid browser observations.' }, 400);
  const response = await backendFetch('/v1/funnel/events', { body, authorization: `Funnel ${enrollment.token}`, fetchImpl: event.fetch });
  if (!response.ok) return project(response);
  const ack = await response.json().catch(() => null);
  if (ack?.schema_version !== 1 || !Array.isArray(ack.accepted) || !Array.isArray(ack.duplicates) || !Array.isArray(ack.rejected)) return json({ error: 'Usage service unavailable.' }, 502);
  const ids = new Set(body.events.map(item => item.event_id));
  if ([...ack.accepted, ...ack.duplicates, ...ack.rejected.map(item => item.event_id)].some(id => !ids.has(id))) return json({ error: 'Invalid acknowledgment.' }, 502);
  return json({ schema_version: 1, accepted: ack.accepted, duplicates: ack.duplicates, rejected: ack.rejected.map(item => ({ event_id: item.event_id, code: typeof item.code === 'string' && /^[A-Z_]{1,64}$/.test(item.code) ? item.code : 'INVALID_EVENT' })) });
}
export async function retryPendingRevoke(event) {
  const pending = unseal(event.cookies.get('nalana_funnel_revoke'));
  if (!pending || pending.until <= Date.now() || !UUID.test(pending.id)) { event.cookies.delete('nalana_funnel_revoke', { path: '/' }); return; }
  const response = await backendFetch(`/v1/funnel/enrollments/${pending.id}/revoke`, { body: {}, authorization: `Funnel ${pending.token}`, fetchImpl: event.fetch });
  if (response.ok || response.status === 401 || response.status === 404) event.cookies.delete('nalana_funnel_revoke', { path: '/' });
}
/** Same-origin browser only receives non-secret metadata for its existing private capability. */
export function resumeWeb(event) {
  const enrollment = readEnrollment(event.cookies);
  if (!enrollment) return json({ error: 'Usage session unavailable.' }, 401);
  return json({ enrollment_id: enrollment.id, expires_at: enrollment.expires_at, web_visitor_id: enrollment.web_visitor_id, web_session_id: enrollment.web_session_id, session_id: enrollment.session_id, association_epoch: enrollment.association_epoch, account_id: enrollment.account_id ?? null });
}
/** Works during rollout rollback, with expired proof, and when client storage was lost. */
export async function revokeWeb(event) {
  if (!sameOrigin(event.request, event.url)) return json({ error: 'Origin denied.' }, 403);
  try { const body = await boundedBody(event.request); if (Object.keys(body).length) throw new Error('body'); } catch { return json({ error: 'Invalid request.' }, 400); }
  const enrollment = readEnrollment(event.cookies, { allowExpired: true, forRevocation: true });
  clearEnrollment(event.cookies);
  if (!enrollment) { await retryPendingRevoke(event); return new Response(null, { status: 204 }); }
  const response = await backendFetch(`/v1/funnel/enrollments/${enrollment.id}/revoke`, { body: {}, authorization: `Funnel ${enrollment.revoke_token}`, fetchImpl: event.fetch });
  if (!response.ok && ![401, 404].includes(response.status)) event.cookies.set('nalana_funnel_revoke', seal({ id: enrollment.id, token: enrollment.revoke_token, until: Date.now() + 86400000 }), { ...cookieOptions, maxAge: 86400 });
  return response.ok || [401, 404].includes(response.status) ? new Response(null, { status: 204 }) : project(response);
}
