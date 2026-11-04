let csrf = null;
let bootstrap = null;
let attemptVersion = 0;
let revocationPending = false;
export const pendingRevocation = () => revocationPending;
export function setPendingRevocation(value) { revocationPending = value === true; }
export function cancelAuthRequests() { attemptVersion++; }
export function setCsrf(value) { if (typeof value === 'string') csrf = value; }
export async function csrfToken(fetcher = fetch) {
  if (csrf) return csrf;
  if (!bootstrap) bootstrap = (async () => { const response = await fetcher('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' }); const data = await response.json(); if (!response.ok || typeof data.csrf_token !== 'string') throw new Error('Session unavailable.'); csrf = data.csrf_token; revocationPending = data.revocation_pending === true; return csrf; })().finally(() => { bootstrap = null; });
  return bootstrap;
}
export async function cookieRequest(path, init = {}, fetcher = fetch) {
  // A browser can call only this site's BFF, never choose an authentication home.
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid site request.');
  const method = (init.method ?? 'GET').toUpperCase(), headers = new Headers(init.headers);
  if (path === '/api/auth/logout') cancelAuthRequests();
  if (method === 'POST' && ['/api/auth/login', '/api/auth/register', '/api/auth/change-email', '/api/auth/google/start', '/api/auth/google/disconnect'].includes(path)) {
    const observed = ++attemptVersion;
    const prepared = await cookieRequest('/api/auth/prepare', { method: 'POST' }, fetcher);
    const data = await prepared.json();
    if (!prepared.ok || observed !== attemptVersion) throw new Error('Sign-in attempt changed. Please try again.');
    setCsrf(data.csrf_token);
  }
  headers.delete('authorization');
  if (!['GET', 'HEAD'].includes(method)) headers.set('x-csrf-token', await csrfToken(fetcher));
  return fetcher(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
}
