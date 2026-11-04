import { normalizeUser, normalizeAuthResponse, safeAuthError } from '../auth/projection.js';
import { authorization, installSession, reply, tokenCookie, clearCredentials, credentialSid, discardPriorSession, readCookie, setCookie, deleteCookie, logoutGeneration } from './authSession.js';
export { normalizeUser, normalizeAuthResponse, mapAuthError } from '../auth/projection.js';
export function getApiBase() {
  const base = process.env.NALANA_API_BASE;
  if (!base) return null;
  try { const url = new URL(base); const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null; return base.replace(/\/$/, ''); } catch { return null; }
}
export const apiUnavailable = () => reply({ error: 'Account service is unavailable. Please try again later.' }, 503);
export async function backendRequest(path, body, options = {}) {
  const base = getApiBase(); if (!base) return { status: 503, ok: false, data: {} };
  try {
    const response = await fetch(base + path, { method: options.method ?? 'POST', signal: AbortSignal.timeout(15000), redirect: 'error', headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, body: options.serializedBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
    return { status: response.status, ok: response.ok, data: await response.json().catch(() => ({})) };
  } catch { return { status: 503, ok: false, data: {} }; }
}
export async function revokeSession(event) {
  const retained = pendingLogout(event), sid = credentialSid(event);
  if (retained) deleteCookie(event, `logout_revoke_${logoutGeneration(event)}`);
  const stored = sid ? readCookie(event, `refresh_${sid}`) : null;
  const token = retained?.refresh ?? tokenCookie(event, 'refresh');
  if (!token) return { ok: true };
  const pending = retained ?? { refresh: token, home: getApiBase(), until: Math.min(stored?.exp ?? Date.now(), Date.now() + 86400000) };
  if (pending.home !== getApiBase()) return { ok: false, pending };
  const result = await backendRequest('/v1/auth/logout', { refresh_token: token });
  return result.status === 204 ? { ok: true } : { ok: false, pending };
}
export function pendingLogout(event) {
  const value = readCookie(event, `logout_revoke_${logoutGeneration(event)}`);
  return value && value.until > Date.now() && typeof value.refresh === 'string' ? value : null;
}
export function carryPendingLogout(event, pending) {
  if (!pending || pending.until <= Date.now()) return;
  setCookie(event, `logout_revoke_${logoutGeneration(event)}`, { refresh: pending.refresh, home: pending.home, until: pending.until }, Math.max(1, Math.floor((pending.until - Date.now()) / 1000)));
}
export async function sessionResponse(event, result, options = {}) {
  if (!result.ok) { if (options.refresh && [400, 401, 403].includes(result.status)) clearCredentials(event); return reply(safeAuthError(result.status, result.data, options), result.status); }
  try {
    // Authentication success replaces/revokes the previous website family.
    const oldRefresh = options.refresh ? null : tokenCookie(event, 'refresh');
    const oldSid = options.refresh ? null : credentialSid(event);
    const context = installSession(event, result.data, options);
    discardPriorSession(event, oldSid);
    if (oldRefresh) await backendRequest('/v1/auth/logout', { refresh_token: oldRefresh });
    const normalized = normalizeAuthResponse(result.data);
    return reply({ ...(normalized.user ? { user: normalized.user } : {}), ...(normalized.verification ? { verification: normalized.verification } : {}), csrf_token: context.csrf }, result.status);
  } catch { return reply({ error: 'The sign-in response could not be saved. Please sign in again.' }, 502); }
}
export async function proxyAuth(path, body, options = {}) {
  const result = await backendRequest(path, body, options);
  return sessionResponse(options.event, result, options);
}
export async function proxyMe(event) {
  const auth = authorization(event); if (!auth) return reply({ error: 'Please sign in again.' }, 401);
  const result = await backendRequest('/v1/users/me', undefined, { method: 'GET', headers: { Authorization: auth } });
  return result.ok ? reply({ user: normalizeUser(result.data.user ?? result.data, result.data) }) : reply(safeAuthError(result.status, result.data), result.status);
}
export async function proxyAuthenticated(path, event, options = {}) {
  const auth = authorization(event); if (!auth) return reply({ error: 'Please sign in again.' }, 401);
  const result = await backendRequest(path, options.body, { ...options, headers: { Authorization: auth } });
  if (options.authResponse) return sessionResponse(event, result, options);
  if (!result.ok) return reply(safeAuthError(result.status, result.data), result.status);
  return reply(path.includes('/users/me') ? { user: normalizeUser(result.data.user ?? result.data, result.data) } : result.data, result.status);
}
export async function proxyBackend(path, body, options = {}) {
  const result = await backendRequest(path, body, options);
  return reply(result.ok ? result.data : safeAuthError(result.status, result.data, options), result.status);
}
