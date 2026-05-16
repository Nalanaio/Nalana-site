import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// ── AUTH STATE ──
// Persists JWT in localStorage; hydrates on page load
function createAuthStore() {
  const stored = browser ? localStorage.getItem('nalana_token') : null;
  const storedUser = browser ? JSON.parse(localStorage.getItem('nalana_user') || 'null') : null;

  const { subscribe, set, update } = writable({
    token: stored,
    user: storedUser,  // { id, email, name, plan, credits }
    loading: false,
    error: null,
  });

  return {
    subscribe,

    /** Call after successful login/register */
    setSession(token, user) {
      if (browser) {
        localStorage.setItem('nalana_token', token);
        localStorage.setItem('nalana_user', JSON.stringify(user));
      }
      set({ token, user, loading: false, error: null });
    },

    /** Clear session (logout) */
    logout() {
      if (browser) {
        localStorage.removeItem('nalana_token');
        localStorage.removeItem('nalana_user');
      }
      set({ token: null, user: null, loading: false, error: null });
    },

    setLoading(loading) {
      update(s => ({ ...s, loading }));
    },

    setError(error) {
      update(s => ({ ...s, loading: false, error }));
    },
  };
}

export const auth = createAuthStore();

/** True when user is logged in */
export const isLoggedIn = derived(auth, $auth => !!$auth.token);

/** Current user object or null */
export const currentUser = derived(auth, $auth => $auth.user);
