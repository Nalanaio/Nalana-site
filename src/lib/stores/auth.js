import { derived } from 'svelte/store';
import { browser } from '$app/env';
import { createSessionController } from '../auth/session.js';
let storage;
try { storage = browser ? window.localStorage : undefined; } catch { /* blocked */ }
const channel = browser && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nalana-account-v2') : null;
export const auth = createSessionController({ storage, broadcast: () => channel?.postMessage('changed'), logout: browser ? () => fetch('/api/operator/logout', { method: 'POST', keepalive: true }) : undefined });
if (channel) channel.onmessage = () => { window.location.reload(); };
export const isLoggedIn = derived(auth, ($auth) => $auth.signedIn);
export const currentUser = derived(auth, ($auth) => $auth.user);
