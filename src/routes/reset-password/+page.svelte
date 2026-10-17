<script>
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiDetail, validatePassword, MIN_PASSWORD_LENGTH } from '$lib/authClient.js';
  import AccountShell from '$lib/components/site/AccountShell.svelte';

  let token = '';
  let password = '';
  let confirm = '';
  let loading = false;
  let error = '';

  onMount(() => {
    token = $page.url.searchParams.get('token') ?? '';
    if (!token) {
      error = 'Reset link is invalid or missing. Request a new link below.';
    }
  });
  afterNavigate(({ complete, to }) => {
    void complete.then(() => {
      const current = new URL(window.location.href);
      if (current.href === to?.url.href && current.searchParams.get('token')) {
        void goto(current.pathname, { replaceState: true, noScroll: true, keepFocus: true });
      }
    });
  });

  async function submit() {
    if (loading) return;
    const passwordError = validatePassword(password, confirm);
    if (passwordError) {
      error = passwordError;
      return;
    }
    if (!token) {
      error = 'Reset link is invalid or missing.';
      return;
    }

    loading = true;
    error = '';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        error = apiDetail(data) || 'Could not reset password. The link may have expired.';
        return;
      }

      token = ''; password = ''; confirm = '';
      goto('/login?reset=success');
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset password — Nalana</title>
  <meta name="referrer" content="no-referrer" />
</svelte:head>



<AccountShell>
  <div class="acct-card signin-card">
    <div class="signin-head"><h1>Set a new password</h1><p>Choose a password with at least {MIN_PASSWORD_LENGTH} characters.</p></div>
    <form class="account-form" method="POST" on:submit|preventDefault={submit} aria-busy={loading}>
      <label class="field"><span>New password</span><input name="password" type="password" placeholder="New password" bind:value={password} autocomplete="new-password" disabled={loading || !token} required /></label>
      <label class="field"><span>Confirm password</span><input name="confirm-password" type="password" placeholder="Confirm password" bind:value={confirm} autocomplete="new-password" disabled={loading || !token} required /></label>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button class="acct-primary" type="submit" disabled={loading || !token}>{loading ? 'Saving…' : 'Reset password'}</button>
    </form>
    <a href="/forgot-password" class="account-link">Request a new reset link</a>
    <a href="/login" class="account-link">Back to login</a>
  </div>
</AccountShell>
