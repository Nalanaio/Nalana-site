import { derived } from 'svelte/store';
import { browser } from '$app/env';
import { createSessionController } from '../auth/session.js';
let storage;
try { storage = browser ? window.localStorage : undefined; } catch { /* blocked */ }
export const auth = createSessionController({ storage, logout: browser ? () => fetch('/api/operator/logout', { method: 'POST', keepalive: true }) : undefined });
export const isLoggedIn = derived(auth, ($auth) => !!$auth.token);
export const currentUser = derived(auth, ($auth) => $auth.user);
