const SESSION_KEY = 'nalana_session_v1';
const LEGACY_KEYS = ['nalana_token', 'nalana_refresh_token', 'nalana_user'];

/** Injectable transport and storage allow deterministic race tests. */
export function createSessionController(options = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const storage = options.storage;
  let state = { token: null, refreshToken: null, user: null, loading: false, error: null, sessionEpoch: 0 };
  let version = 0;
  let inFlight = null;
  const listeners = new Set();
  const publish = () => { for (const listener of listeners) listener(state); };
  function persist() {
    if (!storage) return;
    try {
      if (state.token) storage.setItem(SESSION_KEY, JSON.stringify({ token: state.token, refreshToken: state.refreshToken, user: state.user }));
      else storage.removeItem(SESSION_KEY);
      for (const key of LEGACY_KEYS) storage.removeItem(key);
    } catch {
      try { storage.removeItem(SESSION_KEY); for (const key of LEGACY_KEYS) storage.removeItem(key); } catch { /* memory only */ }
    }
  }
  try {
    const stored = JSON.parse(storage?.getItem(SESSION_KEY) || 'null');
    const token = stored?.token ?? storage?.getItem(LEGACY_KEYS[0]);
    if (token && !token.startsWith('mock_jwt_')) {
      const user = stored?.user ?? JSON.parse(storage?.getItem(LEGACY_KEYS[2]) || 'null');
      // Persisted capabilities may be stale after sleep or a policy rollout.
      state = { ...state, token, user: user ? { ...user, verification: null } : null, refreshToken: stored?.refreshToken ?? storage?.getItem(LEGACY_KEYS[1]) ?? null };
    }
  } catch { /* blocked or malformed storage */ }
  function replace(token, user, refreshToken = null, internal = false) {
    if (!internal) { version++; inFlight = null; }
    state = { token, user, refreshToken, loading: false, error: null, sessionEpoch: version };
    persist(); publish();
  }
  const controller = {
    get current() { return state; },
    /** @param {(value: {token: string|null, refreshToken: string|null, user: any, loading: boolean, error: string|null, sessionEpoch: number}) => void} listener */
    subscribe(listener) { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; },
    setSession(token, user, refreshToken = null) { if (!token || token.startsWith('mock_jwt_')) { replace(null, null); return; } replace(token, user, refreshToken); },
    updateUser(user, expectedEpoch = version) { if (version === expectedEpoch && user?.id === state.user?.id) replace(state.token, user, state.refreshToken, true); },
    updateVerification(verification) { if (state.user) replace(state.token, { ...state.user, verification: normalizeVerification(verification) }, state.refreshToken, true); },
    logout() {
      replace(null, null);
      // Browser-only request clears the independent private operator cookie too.
      try { if (options.logout) Promise.resolve(options.logout()).catch(() => {}); } catch { /* logout must stay synchronous */ }
    },
    setLoading(loading) { state = { ...state, loading }; publish(); },
    setError(error) { state = { ...state, error, loading: false }; publish(); },
    getAuthHeader() { return state.token ? `Bearer ${state.token}` : null; },
    refreshSession() {
      if (inFlight) return inFlight;
      if (!state.token) return Promise.resolve(false);
      const observedVersion = version;
      const current = () => version === observedVersion;
      const original = state;
      controller.setLoading(true);
      inFlight = (async () => {
        let activeToken = original.token;
        let activeRefresh = original.refreshToken;
        let activeUser = original.user;
        try {
          let res = await fetcher('/api/auth/me', { headers: { Authorization: `Bearer ${activeToken}` }, signal: AbortSignal.timeout(10000) });
          if (!current()) return false;
          if (res.status === 401 && activeRefresh) {
            const refreshed = await fetcher('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: activeRefresh }), signal: AbortSignal.timeout(10000) });
            const data = await refreshed.json().catch(() => ({}));
            if (!current()) return false;
            if (!refreshed.ok) {
              if ([400, 401, 403].includes(refreshed.status)) { controller.logout(); return false; }
              return true;
            }
            if (!data.token) return true;
            activeToken = data.token; activeRefresh = data.refresh_token ?? activeRefresh;
            activeUser = data.user ?? activeUser;
            if (data.verification && activeUser) activeUser = { ...activeUser, verification: data.verification };
            replace(activeToken, activeUser, activeRefresh, true);
            res = await fetcher('/api/auth/me', { headers: { Authorization: `Bearer ${activeToken}` }, signal: AbortSignal.timeout(10000) });
          }
          const data = await res.json().catch(() => ({}));
          if (!current()) return false;
          if (res.status === 401) { controller.logout(); return false; }
          if (!res.ok) { controller.setError('Account status is unavailable. You can retry without signing out.'); return true; }
          if (data.user?.id) replace(activeToken, data.user, activeRefresh, true);
          return true;
        } catch { if (current()) controller.setError('Account status is unavailable. Check your connection and retry.'); return current(); }
        finally { if (current()) { inFlight = null; controller.setLoading(false); } }
      })();
      return inFlight;
    },
  };
  return controller;
}
import { normalizeVerification } from '../verification/policy.js';
