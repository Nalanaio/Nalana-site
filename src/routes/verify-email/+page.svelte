<script>
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.js';
  import AccountShell from '$lib/components/site/AccountShell.svelte';
  import { createRecoveryProof } from '$lib/verification/recovery.js';
  import { resendVerificationEmail, RESEND_SUCCESS_MESSAGE } from '$lib/authClient.js';
  let state = 'loading';
  let proof;
  let errorDetail = '';
  let emailForResend = '';
  let resendEmailInput = '';
  let resendMsg = '';
  let resendError = '';
  let resending = false;
  onMount(() => {
    proof = createRecoveryProof(window.location.href);
    state = proof.hasToken ? 'confirm' : proof.resend ? 'resend' : 'missing';
  });
  // Initial hydration invokes onMount before the SvelteKit router is ready.
  // Keep the proof in memory, then scrub it once navigation initialization ends.
  afterNavigate(({ complete, to }) => {
    void complete.then(() => {
      const current = new URL(window.location.href);
      if (current.href === to?.url.href && current.searchParams.get('token')) {
        void goto(current.pathname, { replaceState: true, noScroll: true, keepFocus: true });
      }
    });
  });
  async function verify() {
    if (state === 'loading') return;
    state = 'loading';
    const result = await proof.confirm();
    if (!result.ok) {
      state = 'error'; errorDetail = result.data.error ?? 'Invalid or expired verification token.'; return;
    }
    if (auth.current.token) await auth.refreshSession();
    state = 'success';
  }
  async function handleResend() {
    const target = resendEmailInput.trim() || emailForResend;
    if (!target || resending) return;
    resending = true; resendMsg = ''; resendError = '';
    try {
      const result = await resendVerificationEmail(target);
      if (result.ok) resendMsg = result.message || RESEND_SUCCESS_MESSAGE;
      else resendError = result.message;
    } catch { resendError = 'Network error. Please try again.'; }
    finally { resending = false; }
  }
</script>

<svelte:head>
  <title>Verify email — Nalana</title>
  <meta name="referrer" content="no-referrer" />
</svelte:head>



<AccountShell>
  <div class="acct-card signin-card">
    {#if state === 'loading'}
      <div class="signin-head" role="status"><h1>Verifying your email…</h1><p>Please wait a moment.</p></div>
    {:else if state === 'confirm'}
      <div class="signin-head"><h1>Confirm your email</h1><p>Press the button below to verify your email address.</p></div>
      <button type="button" class="acct-primary" on:click={verify}>Verify my email</button>
    {:else if state === 'success'}
      <div class="signin-head"><span class="recovery-icon" aria-hidden="true">✦</span><h1>Email verified!</h1><p>Your email is verified. You can return to Nalana.</p></div>
      <a href={auth.current.token ? '/account' : '/login'} class="acct-primary">Continue →</a>
    {:else}
      <div class="signin-head">
        <h1>{state === 'resend' ? 'Resend verification email' : state === 'missing' ? 'Invalid link' : 'Verification failed'}</h1>
        {#if state === 'resend'}<p>Confirm your email address below to receive a new verification link.</p>
        {:else if state === 'missing'}<p>This verification link is missing a token. Open the link from your email, or request a new one below.</p>{/if}
      </div>
      {#if state === 'error'}
        <p class="form-error" role="alert">{errorDetail}</p>
        {#if proof?.hasToken}<button type="button" class="acct-primary" on:click={verify}>Try verification again</button>{/if}
      {/if}
      <form class="account-form" method="POST" on:submit|preventDefault={handleResend} aria-busy={resending}>
        <label class="field"><span>Email</span><input type="email" placeholder="you@example.com" autocomplete="email" bind:value={resendEmailInput} disabled={resending} required /></label>
        <button type="submit" class="acct-primary" disabled={resending}>{resending ? 'Sending…' : state === 'resend' ? 'Send verification email' : 'Resend verification email'}</button>
        {#if resendMsg}<p class="success-message" role="status">{resendMsg}</p>{/if}
        {#if resendError}<p class="form-error" role="alert">{resendError}</p>{/if}
      </form>
      <a href="/login" class="account-link">Back to login</a>
    {/if}
  </div>
</AccountShell>
