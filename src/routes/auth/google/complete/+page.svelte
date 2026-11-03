<script>
  import { cookieRequest } from '#lib/auth/cookieClient.js';
  let busy = false, error = '';
  async function finish() {
    busy = true; error = '';
    try {
      const response = await cookieRequest('/api/auth/google/complete', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || response.status === 202) { error = data.error ?? 'Sign-in is still awaiting confirmation.'; return; }
      // A second request proves the browser received its HttpOnly session cookies
      // before the backend destroys the recoverable redemption receipt.
      const ack = await cookieRequest('/api/auth/google/acknowledge', { method: 'POST' });
      if (!ack.ok) { error = 'Your sign-in was saved. Select Continue again to confirm.'; return; }
      window.location.replace('/account');
    } catch { error = 'Could not reach Nalana. Select Continue to retry safely.'; }
    finally { busy = false; }
  }
  async function cancel() { busy = true; try { await cookieRequest('/api/auth/google/cancel', { method: 'POST' }); window.location.replace('/login'); } catch { error = 'Could not cancel. Please retry.'; busy = false; } }
</script>
<svelte:head><title>Finish Google sign-in — Nalana</title></svelte:head>
<main><h1>Finish signing in to Nalana</h1><p>Continue to save the account you confirmed with Google in this browser.</p>
<button type="button" on:click={finish} disabled={busy}>{busy ? 'Finishing…' : 'Continue to Nalana'}</button>
<button type="button" on:click={cancel} disabled={busy}>Cancel</button>
{#if error}<p role="alert">{error}</p>{/if}<p><a href="/login">Return to password sign-in</a></p></main>
<style>main { max-width: 32rem; margin: 8rem auto; padding: 1.5rem; color: #173653; } button { padding: .75rem 1rem; margin: 1rem .5rem 0 0; font: inherit; cursor: pointer; } p { line-height: 1.6; }</style>
