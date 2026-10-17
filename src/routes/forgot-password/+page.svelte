<script>
  import { FORGOT_PASSWORD_SUCCESS } from '$lib/authClient.js';
  import AccountShell from '$lib/components/site/AccountShell.svelte';

  let email = '';
  let loading = false;
  let error = '';
  let sent = false;

  async function submit() {
    if (loading) return;
    if (!email) {
      error = 'Please enter your email address.';
      return;
    }

    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        error = data.error || 'Auth service is not available. Please try again later.';
        return;
      }

      sent = true;
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot password — Nalana</title>
</svelte:head>



<AccountShell>
  <div class="acct-card signin-card">
    {#if sent}
      <div class="signin-head"><h1>Check your email</h1></div>
      <p class="success-message" role="status">{FORGOT_PASSWORD_SUCCESS}</p>
    {:else}
      <div class="signin-head"><h1>Forgot password?</h1><p>Enter your email and we will send a reset link if an account exists.</p></div>
      <form class="account-form" method="POST" on:submit|preventDefault={submit} aria-busy={loading}>
        <label class="field"><span>Email</span><input type="email" name="email" placeholder="you@example.com" bind:value={email} autocomplete="email" disabled={loading} required /></label>
        {#if error}<p class="form-error" role="alert">{error}</p>{/if}
        <button class="acct-primary" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>
    {/if}
    <a href="/login" class="account-link">Back to login</a>
  </div>
</AccountShell>
