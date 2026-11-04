import { isIP } from 'node:net';
import { readAuthRecoveryRequest } from './auth-request.js';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import { backendRequest, getApiBase, sessionResponse, proxyAuthenticated } from './authApi.js';
import { authorization, browserContext, setCookie, readCookie, deleteCookie, reply, tokenCookie, logoutGeneration, credentialSid, discardPriorSession } from './authSession.js';
export const googleEnabled = () => process.env.NALANA_GOOGLE_AUTH_ENABLED === 'true';
const sessionDigest = (access, refresh) => createHash('sha256').update(JSON.stringify([access, refresh])).digest('base64url');
const installedSessionMatches = (event, pending) => pending?.installed && authorization(event) && pending.sessionDigest === sessionDigest(tokenCookie(event, 'access'), tokenCookie(event, 'refresh'));
const fail = () => reply({ error: 'This Google sign-in expired. Start again.', code: 'AUTH_PROOF_INVALID' }, 400);
export function approvedLaunch(value) {
  try {
    const base = new URL(getApiBase()), url = new URL(value);
    return url.protocol === 'https:' && url.origin === base.origin && url.pathname === '/v1/auth/google/browser' && !url.username && !url.password && !url.hash && [...url.searchParams.keys()].every(k => ['transaction_id', 'launch'].includes(k)) && url.searchParams.has('launch') ? url.href : null;
  } catch { return null; }
}
function attempt(event) {
  const value = readCookie(event, 'google'), context = browserContext(event);
  return value?.channel === 'web' && value.sid === context?.sid && value.generation === logoutGeneration(event) && value.home === getApiBase() && /^[0-9a-f-]{36}$/i.test(value.id) ? value : null;
}
export async function startGoogle(event) {
  if (!googleEnabled()) return reply({ error: 'Google sign-in is unavailable. Use your email and password.' }, 503);
  const parsed = await readAuthRecoveryRequest(event.request);
  if (parsed.response) return parsed.response;
  const input = parsed.body;
  if (!input || !['sign_in', 'link'].includes(input.intent) || Object.keys(input).some(k => k !== 'intent')) return reply({ error: 'Invalid sign-in request.' }, 400);
  const auth = authorization(event);
  if (input.intent === 'link' && !auth) return reply({ error: 'Sign in before connecting Google.' }, 401);
  // Starting another flow cancels the previous owner capability, including a lost receipt.
  const old = attempt(event);
  if (old) await backendRequest(`/v1/auth/google/transactions/${old.id}/cancellation`, { handoff_verifier: old.verifier });
  const verifier = randomBytes(32).toString('base64url');
  const body = { channel: 'web', intent: input.intent, handoff_challenge: createHash('sha256').update(verifier, 'ascii').digest('base64url'), handoff_challenge_method: 'S256', return_to: '/auth/google/complete' };
  const serializedBody = JSON.stringify(body), secret = process.env.GOOGLE_AUTH_BFF_SECRET;
  let clientIP;
  try { clientIP = event.getClientAddress(); } catch { return reply({ error: 'Google sign-in is temporarily unavailable.' }, 503); }
  if (!secret || secret.length < 32 || typeof clientIP !== 'string' || !isIP(clientIP)) return reply({ error: 'Google sign-in is temporarily unavailable.' }, 503);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = `${timestamp}\nPOST\n/v1/auth/google/transactions\n${createHash('sha256').update(serializedBody, 'utf8').digest('hex')}\n${clientIP}`;
  const result = await backendRequest('/v1/auth/google/transactions', body, { serializedBody, headers: { ...(input.intent === 'link' ? { Authorization: auth } : {}), 'X-Nalana-Google-Timestamp': timestamp, 'X-Nalana-Google-Client-IP': clientIP, 'X-Nalana-Google-Signature': createHmac('sha256', secret).update(signed, 'utf8').digest('hex') } });
  if (!result.ok) return reply({ error: 'Google sign-in could not start. Please try again.' }, result.status);
  const data = result.data, launch = approvedLaunch(data.authorization_url), remaining = Math.floor((Date.parse(data.expires_at) - Date.now()) / 1000);
  if (!launch || data.channel !== 'web' || !/^[0-9a-f-]{36}$/i.test(data.transaction_id) || !Number.isFinite(remaining) || remaining <= 0 || remaining > 600 || new URL(launch).searchParams.get('transaction_id') !== data.transaction_id) return reply({ error: 'Google sign-in is temporarily unavailable.' }, 502);
  setCookie(event, 'google', { id: data.transaction_id, verifier, requestId: randomUUID(), channel: 'web', sid: browserContext(event).sid, generation: logoutGeneration(event), home: getApiBase(), intent: input.intent, previousRefresh: tokenCookie(event, 'refresh'), previousSid: credentialSid(event) }, remaining);
  return reply({ authorization_url: launch });
}
export async function completeGoogle(event) {
  let pending = attempt(event); if (!pending) return fail();
  const parsed = await readAuthRecoveryRequest(event.request);
  if (parsed.response) return parsed.response;
  const input = parsed.body, supplied = Object.keys(input).length > 0;
  if (Object.keys(input).some(key => !['transaction_id', 'web_return_proof'].includes(key))) return fail();
  if (supplied) {
    if (input.transaction_id !== pending.id || typeof input.web_return_proof !== 'string' || input.web_return_proof.length > 1024 || !/^[A-Za-z0-9_-]{32,1024}={0,2}$/.test(input.web_return_proof)) return fail();
    // A resumed backend page may mint another randomized proof for this same
    // transaction. Preserve the captured proof for stable in-flight retries.
    pending = { ...pending, webReturnProof: pending.webReturnProof ?? input.web_return_proof };
    setCookie(event, 'google', pending, Math.max(1, Math.floor((pending.exp - Date.now()) / 1000)));
  }
  if (!pending.webReturnProof) return fail();
  if (installedSessionMatches(event, pending)) return reply({ installed: true });
  if (!googleEnabled()) return reply({ error: 'Google sign-in is unavailable. Go back and use your password.' }, 503);
  const result = await backendRequest(`/v1/auth/google/transactions/${pending.id}/redemption`, { handoff_verifier: pending.verifier, request_id: pending.requestId, channel: 'web', web_return_proof: pending.webReturnProof });
  if (result.status === 202 || result.status === 429) return reply({ pending: true, error: 'Finish the Google confirmation, then try again.' }, result.status);
  if (!result.ok) {
    if ([400, 401, 403, 409, 410].includes(result.status)) deleteCookie(event, 'google');
    return reply({ error: 'Google sign-in could not finish. Start again.', code: result.data.code }, result.status);
  }
  if (pending.previousRefresh) await backendRequest('/v1/auth/logout', { refresh_token: pending.previousRefresh });
  // Preserve the independent context here: late completion cookies cannot
  // overwrite a logout/new-login context and resurrect the old attempt.
  const response = await sessionResponse(event, result, { refresh: true });
  if (!response.ok) { await backendRequest(`/v1/auth/google/transactions/${pending.id}/cancellation`, { handoff_verifier: pending.verifier }); deleteCookie(event, 'google'); return response; }
  discardPriorSession(event, pending.previousSid);
  setCookie(event, 'google', { ...pending, installed: true, sessionDigest: sessionDigest(result.data.access_token, result.data.refresh_token) }, Math.min(60, Math.max(1, Math.floor((pending.exp - Date.now()) / 1000))));
  return response;
}
export async function acknowledgeGoogle(event) {
  const pending = attempt(event); if (!installedSessionMatches(event, pending)) return fail();
  const result = await backendRequest(`/v1/auth/google/transactions/${pending.id}/acknowledgment`, { handoff_verifier: pending.verifier, request_id: pending.requestId });
  if (!result.ok) return reply({ error: 'Sign-in was saved, but confirmation is pending. Retry.' }, 503);
  // Keep the existing <=60s installed receipt until natural expiry. If this
  // response is lost, exact-pair readback and idempotent upstream acknowledgment
  // remain available; deleting the marker here would make that retry impossible.
  return reply({ complete: true });
}
export async function cancelGoogle(event) {
  const entries = pendingGoogleCleanup(event);
  // Persist the capability before awaiting upstream so a failed cancellation can
  // be retried, including after prepare moved the original marker to another sid.
  carryGoogleCleanup(event, entries);
  const failure = await cleanupPreparedGoogle(event);
  if (failure) return failure;
  deleteCookie(event, 'google');
  return reply({ cancelled: true });
}
export async function disconnectGoogle(event) {
  const parsed = await readAuthRecoveryRequest(event.request);
  if (parsed.response) return parsed.response;
  const input = parsed.body;
  if (!input || input.confirmed !== true || typeof input.current_password !== 'string' || !input.current_password || input.current_password.length > 4096 || Object.keys(input).some(k => !['confirmed', 'current_password'].includes(k))) return reply({ error: 'Enter your current password and confirm disconnection.' }, 400);
  return proxyAuthenticated('/v1/auth/google/disconnection', event, { method: 'POST', body: { current_password: input.current_password, confirmed: true }, authResponse: true });
}

/** A successful refresh proves this browser supplied the installed pair. Keep
 * receipt acknowledgment bound to the exact replacement pair from that refresh. */
export function advanceGoogleReceipt(event, oldAccess, oldRefresh, refreshed) {
  const pending = attempt(event);
  if (!pending?.installed || pending.sessionDigest !== sessionDigest(oldAccess, oldRefresh)) return;
  setCookie(event, 'google', { ...pending, sessionDigest: sessionDigest(refreshed.access_token, refreshed.refresh_token) }, Math.min(60, Math.max(1, Math.floor((pending.exp - Date.now()) / 1000))));
}

export function pendingGoogleCleanup(event) {
  const context = browserContext(event), pending = readCookie(event, 'google');
  const previous = carriedGoogleCleanup(event);
  // Cancellation can retain stale-generation owner capabilities, but these
  // entries never authorize redemption or session installation.
  const owned = pending?.sid === context?.sid && typeof pending.home === 'string' ? [{ id: pending.id, verifier: pending.verifier, home: pending.home }] : [];
  return [...new Map([...previous, ...owned].map(item => [item.id, item])).values()];
}
export function carriedGoogleCleanup(event) {
  const context = browserContext(event);
  const localStore = context ? readCookie(event, `google_cleanup_${context.sid}`) : null;
  const logoutStore = readCookie(event, `google_logout_cleanup_${logoutGeneration(event)}`);
  const local = (localStore?.entries ?? []).map(entry => ({ ...entry, home: entry.home ?? localStore.home }));
  const logout = (logoutStore?.entries ?? []).map(entry => ({ ...entry, home: entry.home ?? logoutStore.home }));
  return [...new Map([...local, ...logout].map(item => [item.id, item])).values()];
}
export function carryGoogleCleanup(event, entries) {
  if (!entries.length) return;
  const context = browserContext(event);
  setCookie(event, `google_cleanup_${context.sid}`, { entries: entries.map(entry => ({ ...entry, home: entry.home ?? getApiBase() })) }, 600);
}
export function carryLogoutGoogleCleanup(event, entries) {
  if (entries.length) setCookie(event, `google_logout_cleanup_${logoutGeneration(event)}`, { entries: entries.map(entry => ({ ...entry, home: entry.home ?? getApiBase() })) }, 600);
}
export function discardCarriedGoogleCleanup(event) {
  const context = browserContext(event);
  if (context) deleteCookie(event, `google_cleanup_${context.sid}`);
  deleteCookie(event, `google_logout_cleanup_${logoutGeneration(event)}`);
}
/** Finish cancellation before sending credentials for a superseding attempt. */
export async function cleanupPreparedGoogle(event) {
  const context = browserContext(event); if (!context) return null;
  const names = [`google_cleanup_${context.sid}`, `google_logout_cleanup_${logoutGeneration(event)}`];
  const stores = names.map(name => ({ name, value: readCookie(event, name) })).filter(item => item.value);
  const entries = carriedGoogleCleanup(event);
  if (entries.some(entry => entry.home !== getApiBase())) return reply({ error: 'Restart sign-in after the account service changes.' }, 409);
  for (const entry of entries) {
    const result = await backendRequest(`/v1/auth/google/transactions/${entry.id}/cancellation`, { handoff_verifier: entry.verifier });
    if (!result.ok && ![400, 401, 404, 410].includes(result.status)) return reply({ error: 'The previous Google attempt could not be cancelled. Please retry.' }, 503);
  }
  for (const item of stores) deleteCookie(event, item.name); return null;
}
