<script>
  import { onMount } from 'svelte';
  import { cookieRequest } from '#lib/auth/cookieClient.js';
  export let intent = 'sign_in';
  let enabled = false, busy = false, error = '';
  onMount(async () => { try { const response = await fetch('/api/auth/google/config', { cache: 'no-store' }); enabled = response.ok && (await response.json()).enabled === true; } catch { /* Password remains available. */ } });
  async function start() {
    if (busy) return; busy = true; error = '';
    try {
      const response = await cookieRequest('/api/auth/google/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent }) });
      const data = await response.json();
      if (!response.ok || !data.authorization_url) { error = data.error ?? 'Google sign-in could not start.'; busy = false; return; }
      window.location.assign(data.authorization_url);
    } catch { error = 'Could not reach Nalana. Please try again.'; busy = false; }
  }
</script>
{#if enabled}
  {#if intent === 'link'}<p>Connecting Google requires your current Nalana password and a separate confirmation in the browser.</p>{/if}
  <button class="google-button" type="button" disabled={busy} on:click={start} aria-busy={busy}><img src="/brand/google-g.png" alt="" width="20" height="20" /><span>{busy ? 'Opening Google…' : 'Continue with Google'}</span></button>
  {#if error}<p role="alert">{error}</p>{/if}
{/if}
<style>
@font-face { font-family: 'Google Sans'; font-style: normal; font-weight: 500; font-display: swap; src: url('/brand/google-sans-500.ttf') format('truetype'); }
.google-button { background: #fff; border: 1px solid #747775; border-radius: 4px; color: #1f1f1f; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 40px; width: 100%; padding: 10px 12px; font: 500 14px/20px 'Google Sans', Arial, sans-serif; cursor: pointer; margin-bottom: 20px; }
.google-button img { flex: 0 0 20px; object-fit: contain; } .google-button:focus-visible { outline: 3px solid #4285f4; outline-offset: 3px; } .google-button:disabled { opacity: .65; cursor: wait; } p { font-size: 14px; line-height: 1.5; }
</style>
