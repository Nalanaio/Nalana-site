import { writable } from 'svelte/store';

// ── MODAL STATE ──

/** Auth modal (post-download signup prompt) */
export const authModal = writable({
  open: false,
  platform: null,   // 'mac' | 'windows' — which platform they downloaded
  mode: 'signup',   // 'signup' | 'login'
});

export function openAuthModal(platform = null, mode = 'signup') {
  authModal.set({ open: true, platform, mode });
}

export function closeAuthModal() {
  authModal.update(s => ({ ...s, open: false }));
}

/** Mobile email modal (send download link to computer) */
export const emailModal = writable({
  open: false,
  platform: null,
});

export function openEmailModal(platform) {
  emailModal.set({ open: true, platform });
}

export function closeEmailModal() {
  emailModal.update(s => ({ ...s, open: false }));
}
