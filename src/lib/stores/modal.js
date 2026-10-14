import { writable } from 'svelte/store';

// ── MODAL STATE ──

/** Auth modal (post-download signup prompt) */
export const authModal = writable({
  open: false,
  platform: null,   // 'mac' | 'windows' — which platform they downloaded
  mode: 'signup',   // 'signup' | 'login'
});

export function openAuthModal(platform = null, mode = 'signup') {
  // Account entry uses a fresh sensitive document, so previously loaded vendor
  // scripts cannot observe credentials inside an inline marketing-page modal.
  if (typeof window !== 'undefined') {
    window.location.assign(`/login${mode === 'signup' ? '?mode=signup' : ''}`);
    return;
  }
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
