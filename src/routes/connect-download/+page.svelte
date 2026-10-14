<script>
  import { onDestroy } from 'svelte';
  export let data;
  let code = '';
  let expiresAt = '';
  let busy = false;
  let error = '';
  let expiryTimer;
  let pending;
  async function requestCode() {
    if (busy) return;
    busy = true;
    error = '';
    pending = new AbortController();
    try {
      const response = await fetch('/api/acquisition/pairings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: pending.signal });
      const result = await response.json();
      if (!response.ok) { error = result.error || 'Unable to create a linking code.'; return; }
      code = result.code;
      expiresAt = result.expires_at;
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => { code = ''; error = 'This code expired. Request another code if you still want to link your download.'; }, Math.max(0, Date.parse(expiresAt) - Date.now()));
    } catch { error = 'Unable to reach the linking service. You can still use Nalana.'; }
    finally { busy = false; }
  }
  // The code exists only in this document's memory, never storage/history/clipboard.
  onDestroy(() => { clearTimeout(expiryTimer); pending?.abort(); code = ''; });
</script>

<svelte:head><title>Link your download — Nalana</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></svelte:head>
<main>
  <h1>Link your download to Nalana</h1>
  <p>This optional code helps us understand whether a download leads to opening the app. It does not sign you in, verify your email or prove installation.</p>
  <p>In Nalana, enable optional usage tracking and enter the code in Settings. You can skip this and use the app normally.</p>
  {#if !data.available}<p>Download linking is currently unavailable.</p>
  {:else if !data.consented}<p>Allow optional usage tracking using the privacy controls, then return here to link a download.</p>
  {:else if !data.hasDownload}<p>Start a download first, then return to this page.</p>
  {:else}
    <button on:click={requestCode} disabled={busy}>{busy ? 'Requesting…' : code ? 'Request a fresh code' : 'Get a linking code'}</button>
    {#if code}<p class="code" aria-live="polite">{code.match(/.{1,4}/g).join(' ')}</p><p>The code expires after 15 minutes. Enter it only in Nalana.</p>{/if}
  {/if}
  {#if error}<p role="alert">{error}</p>{/if}
  <p><a href="/" data-sveltekit-reload>Skip and return to Nalana</a></p>
</main>
<style>
  main { max-width: 620px; margin: 80px auto; padding: 24px; line-height: 1.6; }
  h1 { font-size: 2rem; } button { padding: 12px 18px; border-radius: 8px; cursor: pointer; }
  .code { font-family: monospace; font-size: 1.7rem; letter-spacing: .08em; overflow-wrap: anywhere; }
</style>
