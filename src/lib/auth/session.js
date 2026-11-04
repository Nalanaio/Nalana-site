import { normalizeVerification } from '../verification/policy.js';
import { cookieRequest, csrfToken, setCsrf, cancelAuthRequests, pendingRevocation, setPendingRevocation } from './cookieClient.js';
import { clearLegacyAuth } from '../authMigration.js';
/** Browser state contains metadata only. HttpOnly cookies own all credentials. */
export function createSessionController(options = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  let version = 0, inFlight = null;
  let state = { signedIn: false, user: null, loading: false, error: null, logoutPending: false, sessionEpoch: 0, initialized: false, legacyCleared: clearLegacyAuth(options.storage) };
  const listeners = new Set();
  const publish = () => { for (const listener of listeners) listener(state); };
  function replace(user, internal = false) {
    if (!internal) { version++; inFlight = null; }
    state = { ...state, user, signedIn: Boolean(user?.id), loading: false, error: null, initialized: true, sessionEpoch: version }; publish();
  }
  const controller = {
    get current() { return state; },
    /** @param {(value: any) => void} listener */
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    setSession(user, csrf) { setCsrf(csrf); replace(user); options.broadcast?.(); },
    updateUser(user, expectedEpoch = version) { if (version === expectedEpoch && user?.id === state.user?.id) replace(user, true); },
    updateVerification(verification) { if (state.user) replace({ ...state.user, verification: normalizeVerification(verification) }, true); },
    async logout() {
      cancelAuthRequests(); replace(null); options.broadcast?.(); const observed = version;
      try { const response = await cookieRequest('/api/auth/logout', { method: 'POST' }, fetcher); const data = await response.json(); if (version === observed) { setCsrf(data.csrf_token); setPendingRevocation(!response.ok || data.revocation_pending === true); state = { ...state, logoutPending: pendingRevocation() }; if (!response.ok) controller.setError('Signed out here. Remote session revocation could not be confirmed.'); else publish(); } }
      catch { if (version === observed) { state = { ...state, logoutPending: true }; controller.setError('Sign-out could not reach the server. Retry before leaving a shared device.'); } }
      options.broadcast?.();
      try { await options.logout?.(); } catch { /* independent operator cookie */ }
    },
    setLoading(loading) { state = { ...state, loading }; publish(); },
    setError(error) { state = { ...state, error, loading: false }; publish(); },
    canRestoreSession() { return state.signedIn; },
    refreshSession() {
      if (inFlight) return inFlight;
      const observed = version;
      const current = () => version === observed;
      controller.setLoading(true);
      inFlight = (async () => {
        try {
          await csrfToken(fetcher);
          if (current() && pendingRevocation()) { state = { ...state, logoutPending: true }; publish(); }
          let response = await cookieRequest('/api/auth/me', {}, fetcher);
          if (!current()) return false;
          if (response.status === 401) {
            const refreshed = await cookieRequest('/api/auth/refresh', { method: 'POST' }, fetcher);
            const data = await refreshed.json().catch(() => ({}));
            if (!current()) return false;
            if (!refreshed.ok) {
              if ([400, 401, 403].includes(refreshed.status)) { replace(null, true); return false; }
              controller.setError('Account status is unavailable. Retry when connected.'); return state.signedIn;
            }
            setCsrf(data.csrf_token);
            response = await cookieRequest('/api/auth/me', {}, fetcher);
          }
          const data = await response.json().catch(() => ({}));
          if (!current()) return false;
          if (response.status === 401) { replace(null, true); return false; }
          if (!response.ok || !data.user?.id) { controller.setError('Account status is unavailable. You can retry without signing out.'); return state.signedIn; }
          replace(data.user, true); return true;
        } catch { if (current()) controller.setError('Account status is unavailable. Check your connection and retry.'); return current() && state.signedIn; }
        finally { if (current()) { inFlight = null; state = { ...state, initialized: true }; controller.setLoading(false); } }
      })(); return inFlight;
    },
  }; return controller;
}
