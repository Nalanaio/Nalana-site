<script>
  import { onMount } from 'svelte';
  import { cookieRequest } from '#lib/auth/cookieClient.js';
  import { auth } from '#lib/stores/auth.js';
  import GoogleSignIn from './GoogleSignIn.svelte';
  let methods = null, password = '', confirmed = false, busy = false, error = '', message = '';
  onMount(async () => { try { const response = await cookieRequest('/api/auth/methods'); if (!response.ok) throw new Error(); methods = await response.json(); } catch { error = 'Sign-in methods are unavailable. Refresh to retry.'; } });
  async function disconnect() {
    busy = true; error = ''; message = ''; const epoch = auth.current.sessionEpoch;
    try {
      const response = await cookieRequest('/api/auth/google/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ current_password: password, confirmed }) });
      const data = await response.json();
      if (auth.current.sessionEpoch !== epoch) return;
      if (!response.ok || !data.user?.id) { error = data.error ?? 'Google could not be disconnected.'; return; }
      auth.setSession(data.user, data.csrf_token); methods = { ...methods, google: { connected: false } }; confirmed = false; message = 'Google disconnected. Other Nalana sessions have been signed out.';
    } catch { error = 'Could not reach Nalana. Try again.'; }
    finally { password = ''; busy = false; }
  }
</script>
<section class="acct-card methods" aria-labelledby="methods-title">
<h2 id="methods-title">Sign-in methods</h2>
{#if methods}
<p>Password: {#if methods.has_password}Available{:else}Not set — <a href="/forgot-password">click here to set a password.</a>{/if}</p>
<p>Google: {methods.google?.connected ? 'Connected' : 'Not connected'}</p>
{#if methods.google?.connected}
  {#if methods.google.email_mismatch}<p>Your Google email differs from your Nalana email. Your Nalana account stays the same.</p>{/if}
  {#if methods.has_password}
  <form on:submit|preventDefault={disconnect}>
  <p>Disconnecting Google signs out your other Nalana sessions. This browser keeps a password-proved session.</p>
  <label>Current Nalana password<input type="password" autocomplete="current-password" required bind:value={password} disabled={busy} /></label>
  <label><input type="checkbox" required bind:checked={confirmed} disabled={busy} /> Disconnect Google from this Nalana account</label>
  <button type="submit" disabled={busy || !confirmed}>{busy ? 'Disconnecting…' : 'Disconnect Google'}</button>
  </form>
  {:else}<p>Set a password with <a href="/forgot-password">password recovery</a> before disconnecting Google. Your last sign-in method must remain available.</p>{/if}
{:else}<GoogleSignIn intent="link" />{/if}
{:else if !error}<p role="status">Loading sign-in methods…</p>{/if}
{#if error}<p role="alert">{error}</p>{/if}{#if message}<p role="status">{message}</p>{/if}
</section>
<style>.methods { padding: 24px; margin-top: 24px; } h2 { font-size: 20px; margin: 0 0 16px; } p { line-height: 1.5; overflow-wrap: anywhere; } label { display: block; margin: 16px 0; } input[type="password"] { display: block; padding: 10px; width: 100%; box-sizing: border-box; margin-top: 8px; } button { font: inherit; padding: 10px 16px; cursor: pointer; }</style>
