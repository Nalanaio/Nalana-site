import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

const TOKEN_KEY = 'nalana_token';
const REFRESH_KEY = 'nalana_refresh_token';
const USER_KEY = 'nalana_user';

function isMockToken(token) {
  return !token || token.startsWith('mock_jwt_');
}

function readStoredSession() {
  if (!browser) return { token: null, refreshToken: null, user: null };
  const token = localStorage.getItem(TOKEN_KEY);
  if (isMockToken(token)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, refreshToken: null, user: null };
  }
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    user = null;
  }
  return {
    token,
    refreshToken: localStorage.getItem(REFRESH_KEY),
    user,
  };
}

function createAuthStore() {
  const initial = readStoredSession();

  const store = writable({
    token: initial.token,
    refreshToken: initial.refreshToken,
    user: initial.user,
    loading: false,
    error: null,
  });

  const { subscribe, set, update } = store;

  return {
    subscribe,

    setSession(token, user, refreshToken = null) {
      if (browser && !isMockToken(token)) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (refreshToken) {
          localStorage.setItem(REFRESH_KEY, refreshToken);
        }
      }
      set({
        token,
        refreshToken: refreshToken ?? get(store).refreshToken,
        user,
        loading: false,
        error: null,
      });
    },

    logout() {
      if (browser) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
      }
      set({ token: null, refreshToken: null, user: null, loading: false, error: null });
    },

    setLoading(loading) {
      update((s) => ({ ...s, loading }));
    },

    setError(error) {
      update((s) => ({ ...s, loading: false, error }));
    },

    getAuthHeader() {
      const { token } = get(store);
      return token && !isMockToken(token) ? `Bearer ${token}` : null;
    },

    /** Try refresh token, then validate session with /api/auth/me. */
    async refreshSession() {
      const { token, refreshToken } = get(store);
      if (!token || isMockToken(token)) {
        this.logout();
        return false;
      }

      this.setLoading(true);
      try {
        let activeToken = token;

        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (meRes.status === 401 && refreshToken) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshRes.ok && refreshData.token) {
            activeToken = refreshData.token;
            this.setSession(
              refreshData.token,
              refreshData.user ?? get(store).user,
              refreshData.refresh_token ?? refreshToken
            );
            const retry = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${activeToken}` },
            });
            const retryData = await retry.json().catch(() => ({}));
            if (!retry.ok) {
              this.logout();
              return false;
            }
            this.setSession(activeToken, retryData.user, refreshData.refresh_token ?? refreshToken);
            return true;
          }
        }

        const data = await meRes.json().catch(() => ({}));
        if (!meRes.ok) {
          this.logout();
          return false;
        }
        this.setSession(activeToken, data.user, refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        this.setLoading(false);
      }
    },
  };
}

export const auth = createAuthStore();

export const isLoggedIn = derived(auth, ($auth) => !!$auth.token && !isMockToken($auth.token));

export const currentUser = derived(auth, ($auth) => $auth.user);
