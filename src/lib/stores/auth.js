import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

const TOKEN_KEY = 'nalana_token';
const USER_KEY = 'nalana_user';

function isMockToken(token) {
  return !token || token.startsWith('mock_jwt_');
}

function readStoredSession() {
  if (!browser) return { token: null, user: null };
  const token = localStorage.getItem(TOKEN_KEY);
  if (isMockToken(token)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, user: null };
  }
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    user = null;
  }
  return { token, user };
}

function createAuthStore() {
  const initial = readStoredSession();

  const store = writable({
    token: initial.token,
    user: initial.user,
    loading: false,
    error: null,
  });

  const { subscribe, set, update } = store;

  return {
    subscribe,

    setSession(token, user) {
      if (browser && !isMockToken(token)) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      set({ token, user, loading: false, error: null });
    },

    logout() {
      if (browser) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
      set({ token: null, user: null, loading: false, error: null });
    },

    setLoading(loading) {
      update((s) => ({ ...s, loading }));
    },

    setError(error) {
      update((s) => ({ ...s, loading: false, error }));
    },

    /** Validate token with backend; returns true if session is valid. */
    async refreshSession() {
      const { token } = get(store);
      if (!token || isMockToken(token)) {
        this.logout();
        return false;
      }

      this.setLoading(true);
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          this.logout();
          return false;
        }
        this.setSession(token, data.user);
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
