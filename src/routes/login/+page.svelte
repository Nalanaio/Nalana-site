<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { auth } from '$lib/stores/auth.js';
  import EmailVerifyPanel from '$lib/components/EmailVerifyPanel.svelte';
  import {
    authErrorMessage,
    isEmailNotVerifiedError,
    validatePassword,
    MIN_PASSWORD_LENGTH,
  } from '$lib/authClient.js';

  let mode = 'login';
  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let showUnverified = false;
  let signupSuccess = false;
  let resetBanner = false;

  onMount(() => {
    const session = get(auth);
    if (session.token && session.user) {
      goto('/account');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signup') mode = 'signup';
    if (params.get('reset') === 'success') resetBanner = true;
  });

  $: if ($page.url.searchParams.get('reset') === 'success') {
    resetBanner = true;
  }

  async function submit() {
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (mode === 'login' && isEmailNotVerifiedError(res.status, data)) {
          showUnverified = true;
        }
        error = authErrorMessage(res.status, data, mode);
        return;
      }

      if (!data.token || !data.user?.id) {
        error = 'Invalid response from server. Please try again.';
        return;
      }

      auth.setSession(data.token, data.user, data.refresh_token);

      if (mode === 'signup') {
        signupSuccess = true;
        return;
      }

      goto('/account');
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function switchMode(next) {
    mode = next;
    error = '';
    showUnverified = false;
    signupSuccess = false;
    resetBanner = false;
  }
</script>

<svelte:head>
  <title>{signupSuccess ? 'Account created' : mode === 'signup' ? 'Create account' : 'Log in'} — Nalana</title>
</svelte:head>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
  :global(body) { cursor: auto; background: #fafafa; }
  .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .card { width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 48px 36px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04); }

  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 36px; text-decoration: none; }
  .logo-text { font-family: 'KonkhmerSleokchher', sans-serif; font-size: 20px; color: #1085EF; }

  h1 { font-family: 'Amulya', sans-serif; font-size: 28px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.02em; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 32px; line-height: 1.5; }

  .banner { font-size: 13px; color: #166534; background: rgba(34,197,94,0.12); border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; line-height: 1.45; }

  .field { display: block; width: 100%; padding: 13px 18px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa; font-family: 'Inter', sans-serif; font-size: 15px; color: #1a1a1a; outline: none; margin-bottom: 10px; transition: border-color .15s; box-sizing: border-box; }
  .field::placeholder { color: #bbb; }
  .field:focus { border-color: rgba(16,133,239,0.5); background: #fff; }

  .forgot { text-align: right; margin: -4px 0 12px; }
  .forgot a { font-size: 13px; color: #1085EF; text-decoration: none; font-weight: 500; }
  .forgot a:hover { text-decoration: underline; }

  .error { font-size: 13px; color: #e53e3e; text-align: center; margin-bottom: 10px; line-height: 1.45; }

  .submit { width: 100%; padding: 15px; border-radius: 100px; border: none; background: linear-gradient(135deg,#1085EF,#6366F1); color: #fff; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(16,133,239,0.28); transition: opacity .15s, transform .15s; margin-top: 4px; }
  .submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary { display: block; width: 100%; padding: 14px; border-radius: 100px; border: 1.5px solid rgba(16,133,239,0.35); background: #fff; color: #1085EF; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 10px; text-align: center; text-decoration: none; box-sizing: border-box; }
  .btn-secondary:hover { background: rgba(16,133,239,0.06); }

  .switch { font-size: 13px; color: #888; text-align: center; margin-top: 24px; }
  .switch-link { background: none; border: none; color: #1085EF; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline; }
  .back { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #bbb; text-decoration: none; }
  .back:hover { color: #888; }
</style>

<div class="page">
  <div class="card">
    <a href="/" class="logo">
      <span class="logo-text">Nalana</span>
    </a>

    {#if signupSuccess}
      <EmailVerifyPanel variant="signup" {email} title="Account created">
        <svelte:fragment slot="actions">
          <a href="/account" class="btn-secondary">Go to my account</a>
          <button type="button" class="switch-link" style="display:block;width:100%;margin-top:16px;" on:click={() => { signupSuccess = false; mode = 'login'; }}>
            Log in instead
          </button>
        </svelte:fragment>
      </EmailVerifyPanel>
    {:else}
      <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
      <p class="subtitle">
        {mode === 'signup'
          ? 'One account for the Nalana website and IDE.'
          : 'Log in to your Nalana profile.'}
      </p>

      {#if resetBanner && mode === 'login'}
        <p class="banner" role="status">Your password was reset. Log in with your new password.</p>
      {/if}

      <form on:submit|preventDefault={submit}>
        <input class="field" type="email" placeholder="your@email.com" bind:value={email} autocomplete="email" disabled={loading} />
        <input
          class="field"
          type="password"
          placeholder="Password (min {MIN_PASSWORD_LENGTH} characters)"
          bind:value={password}
          autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
          disabled={loading}
        />

        {#if mode === 'login'}
          <p class="forgot"><a href="/forgot-password">Forgot password?</a></p>
        {/if}

        {#if showUnverified}
          <EmailVerifyPanel variant="banner" {email} title="Email not verified" subtitle={error} />
        {:else if error}
          <p class="error">{error}</p>
        {/if}

        <button class="submit" type="submit" disabled={loading}>
          {loading ? 'Loading…' : mode === 'signup' ? 'Create account →' : 'Log in →'}
        </button>
      </form>

      <p class="switch">
        {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
        <button class="switch-link" type="button" on:click={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? 'Log in' : 'Sign up'}
        </button>
      </p>
    {/if}

    <a href="/" class="back">← Back to nalana.io</a>
  </div>
</div>
