<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { resendVerificationEmail } from '$lib/authClient.js';
  import { verificationMessage } from '$lib/verification/policy.js';
  /** @type {{server_time: string, resend_available_at: string|null, [key: string]: any}|null} */
  export let policy = null;
  let busy = false;
  let message = '';
  let error = '';
  let correcting = false;
  let newEmail = '';
  let password = '';
  let now = 0;
  let receivedAt = 0;
  $: if (policy) receivedAt = typeof performance === 'undefined' ? 0 : performance.now();
  $: wait = policy?.resend_available_at ? Math.max(0, Math.ceil((Date.parse(policy.resend_available_at) - Date.parse(policy.server_time) - Math.max(0, now - receivedAt)) / 1000)) : 0;
  async function resend() {
    if (busy || wait) return;
    busy = true; message = ''; error = '';
    const epoch = auth.current.sessionEpoch;
    try {
      const result = await resendVerificationEmail('', auth.getAuthHeader());
      if (auth.current.sessionEpoch !== epoch) return;
      if (result.data.verification) auth.updateVerification(result.data.verification);
      if (result.ok) message = result.data.status === 'already_verified' ? 'Your email is already verified.' : result.data.status === 'cooldown' ? 'Please wait before requesting another verification email.' : 'Verification email queued. Check your inbox and spam folder.';
      else error = result.message;
    } catch { error = 'Network error. Please try again.'; }
    finally { busy = false; }
  }
  async function correct() {
    if (busy) return;
    busy = true; message = ''; error = '';
    const epoch = auth.current.sessionEpoch;
    try {
      const response = await fetch('/api/auth/change-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth.getAuthHeader() }, body: JSON.stringify({ new_email: newEmail, current_password: password }), signal: AbortSignal.timeout(10000) });
      const data = await response.json().catch(() => ({}));
      if (auth.current.sessionEpoch !== epoch) return;
      if (!response.ok) { error = data.error ?? 'Could not update your email. Your current session remains available.'; return; }
      if (!data.token || !data.user?.id || !data.refresh_token) { error = 'The account response was incomplete. Check your account status again.'; return; }
      auth.setSession(data.token, data.user, data.refresh_token);
      correcting = false; newEmail = '';
      message = 'Email updated and verification email queued. Your original verification deadline still applies.';
    } catch { error = 'Network error. Please try again.'; }
    finally { password = ''; busy = false; }
  }
  function tick() { now = performance.now(); }
  onMount(() => { tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); });
</script>

<svelte:window on:focus={() => auth.refreshSession()} />
<section aria-label="Email verification" class="verification">
  <p>{verificationMessage(policy)}</p>
  <p class="email">{$auth.user?.email ?? ''}</p>
  <div class="actions">
    <button class="resend-button" type="button" disabled={busy || wait > 0} on:click={resend} on:mouseenter={tick}>{wait > 0 ? `Resend available in ${wait}s` : 'Resend verification email'}</button>
    <button type="button" disabled={busy || $auth.loading} on:click={() => auth.refreshSession()}>Check again</button>
    {#if !$auth.user?.email_verified}<button type="button" disabled={busy} on:click={() => { correcting = !correcting; password = ''; }}>Correct email address</button>{/if}
    <a href="mailto:support@nalana.io">Contact support</a>
  </div>
  {#if correcting}
    <form on:submit|preventDefault={correct}>
      <label>Correct email address <input type="email" required autocomplete="email" bind:value={newEmail} disabled={busy} /></label>
      <label>Current password <input type="password" required autocomplete="current-password" bind:value={password} disabled={busy} /></label>
      <button type="submit" disabled={busy}>Update email</button>
      <button type="button" disabled={busy} on:click={() => { correcting = false; password = ''; }}>Cancel</button>
    </form>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p role="alert" class="error">{error}</p>{/if}
</section>
<style>
  .verification { border: 1px solid #bddafb; border-radius: 16px; padding: 20px; background: #f4f8ff; margin-bottom: 24px; color: #173653; }
  p { line-height: 1.5; } .email { overflow-wrap: anywhere; margin: 8px 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  /* Keep adjacent controls still as the countdown changes or crosses 10s. */
  .resend-button { min-inline-size: min(100%, 16rem); font-variant-numeric: tabular-nums; }
  button, a { font: inherit; font-size: 14px; } button { padding: 9px 13px; background: white; color: #174d82; border: 1px solid #a7c9ec; border-radius: 8px; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; } label { display: block; margin: 14px 0; } input { display: block; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 10px; border: 1px solid #a7c9ec; border-radius: 6px; }
  .error { color: #a61b1b; }
</style>
