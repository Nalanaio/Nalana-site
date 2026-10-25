<script>
  import { currentCampaign } from '#lib/campaigns/browser.js';
  import { onMount } from 'svelte';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { get } from 'svelte/store';
  import * as env from '$app/env/public';
  import { queueSignupMeasurement } from '#lib/analytics/attribution.js';
  import { auth } from '#lib/stores/auth.js';
  import EmailVerifyPanel from '#lib/components/EmailVerifyPanel.svelte';
  import VerificationRecovery from '#lib/components/VerificationRecovery.svelte';
  import AccountShell from '#lib/components/site/AccountShell.svelte';
  import {
    authErrorMessage,
    isEmailNotVerifiedError,
    validatePassword,
    MIN_PASSWORD_LENGTH,
  } from '#lib/authClient.js';

  let mode = 'login';
  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let showUnverified = false;
  let signupSuccess = false;
  let resetBanner = false;
  let showPassword = false;

  function postLoginPath() {
    const next = page.url.searchParams.get('next');
    return next?.startsWith('/') && !next.startsWith('//') ? next : '/account';
  }

  onMount(() => {
    const session = get(auth);
    if (session.token && session.user) {
      if (page.url.searchParams.get('created') === '1') {
        email = session.user.email || '';
        mode = 'signup';
        signupSuccess = true;
        void auth.refreshSession();
        return;
      }
      goto(postLoginPath());
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signup') mode = 'signup';
    if (params.get('reset') === 'success') resetBanner = true;
  });

  // A client-side return to /login?reset=success does not remount the page.
  afterNavigate(({ to }) => {
    if (to?.url.searchParams.get('reset') === 'success') resetBanner = true;
  });

  async function submit() {
    if (loading) return;
    if (!email || !password) {
      error = 'Please fill in all fields.';
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      error = passwordError;
      return;
    }

    loading = true;
    error = '';
    showUnverified = false;
    signupSuccess = false;

    const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mode === 'signup' && env.PUBLIC_CAMPAIGN_TOTALS_ENABLED === 'true' ? { campaign: currentCampaign(window) } : {}) }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (mode === 'login' && isEmailNotVerifiedError(res.status, data)) {
          showUnverified = true;
        }
        error = authErrorMessage(res.status, data, mode === 'signup' ? 'signup' : 'login');
        return;
      }

      if (!data.token || !data.user?.id) {
        error = 'Invalid response from server. Please try again.';
        return;
      }

      auth.setSession(data.token, data.user, data.refresh_token);
      password = '';

      if (mode === 'signup') {
        signupSuccess = true;
        if (env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true' && auth.canRestoreSession() && queueSignupMeasurement(window)) window.location.replace('/signup-complete');
        return;
      }

      goto(postLoginPath());
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function switchMode(next) {
    if (loading) return;
    mode = next;
    error = '';
    showUnverified = false;
    signupSuccess = false;
    resetBanner = false;
    showPassword = false;
  }
</script>

<svelte:head>
  <title>{signupSuccess ? 'Account created' : mode === 'signup' ? 'Create account' : 'Log in'} — Nalana</title>
</svelte:head>



<AccountShell>
  <div class="acct-card signin-card">
    {#if signupSuccess}
      <div class="signin-head"><h1>Account created</h1></div>
      <VerificationRecovery policy={$auth.user?.verification} />
      <EmailVerifyPanel variant="signup" {email} title="You can use Nalana now" subtitle="Your account is signed in. Use the same email and password in the Nalana app.">
        <svelte:fragment slot="actions">
          <a href="/account" class="acct-primary">Go to my account</a>
        </svelte:fragment>
      </EmailVerifyPanel>
    {:else}
      <div class="signin-head">
        <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p>{mode === 'signup' ? 'One account for the Nalana website and IDE.' : 'Sign in to keep creating in your 3D workspace.'}</p>
      </div>
      {#if resetBanner && mode === 'login'}
        <p class="banner" role="status">Your password was reset. Log in with your new password.</p>
      {/if}
      <form class="account-form" method="POST" on:submit|preventDefault={submit} aria-busy={loading}>
        <div class="signin-fields">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" placeholder="you@example.com" bind:value={email} autocomplete="email" disabled={loading} required />
          </label>
          <div class="field">
            <label for="account-password">Password</label>
            <span class="field-pw">
            <input id="account-password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Password (min {MIN_PASSWORD_LENGTH} characters)" bind:value={password} autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading} required />
            <button type="button" class="pw-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} on:click={() => showPassword = !showPassword} disabled={loading}>
              <img src="/assets/site/icon-eye.svg" width="20" height="19" alt="" />
            </button>
            </span>
          </div>
          {#if mode === 'login'}<p class="forgot"><a href="/forgot-password">Forgot password?</a></p>{/if}
        </div>
        {#if showUnverified}
          <EmailVerifyPanel variant="banner" {email} title="Email not verified" subtitle={error} />
        {:else if error}<p class="form-error" role="alert">{error}</p>{/if}
        <button class="acct-primary signin-btn" type="submit" disabled={loading}>
          {loading ? 'Loading…' : mode === 'signup' ? 'Create account' : 'Sign In'}
        </button>
      </form>
      <p class="signup-row">
        {mode === 'signup' ? 'Already have an account?' : 'New to Nalana?'}
        <button class="switch-link" type="button" disabled={loading} on:click={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    {/if}
  </div>
</AccountShell>
