<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiDetail, validatePassword, MIN_PASSWORD_LENGTH } from '$lib/authClient.js';

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

  async function submit() {
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
</svelte:head>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
  :global(body) { cursor: auto; background: #fafafa; }
  .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .card { width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 48px 36px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04); }
  .logo-text { font-family: 'KonkhmerSleokchher', sans-serif; font-size: 20px; color: #1085EF; text-decoration: none; display: block; margin-bottom: 36px; }
  h1 { font-family: 'Amulya', sans-serif; font-size: 28px; font-weight: 700; color: #0a0a0a; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 32px; }
  .field { display: block; width: 100%; padding: 13px 18px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa; font-size: 15px; outline: none; margin-bottom: 10px; box-sizing: border-box; }
  .error { font-size: 13px; color: #e53e3e; text-align: center; margin-bottom: 10px; line-height: 1.45; }
  .submit { width: 100%; padding: 15px; border-radius: 100px; border: none; background: linear-gradient(135deg,#1085EF,#6366F1); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  .submit:disabled { opacity: 0.5; }
  .link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #1085EF; font-weight: 600; text-decoration: none; }
  .back { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #bbb; text-decoration: none; }
</style>

<div class="page">
  <div class="card">
    <a href="/" class="logo-text">Nalana</a>

    <h1>Set a new password</h1>
    <p class="subtitle">Choose a password with at least {MIN_PASSWORD_LENGTH} characters.</p>

    <form on:submit|preventDefault={submit}>
      <input
        class="field"
        type="password"
        placeholder="New password"
        bind:value={password}
        autocomplete="new-password"
        disabled={loading || !token}
      />
      <input
        class="field"
        type="password"
        placeholder="Confirm password"
        bind:value={confirm}
        autocomplete="new-password"
        disabled={loading || !token}
      />
      {#if error}<p class="error">{error}</p>{/if}
      <button class="submit" type="submit" disabled={loading || !token}>
        {loading ? 'Saving…' : 'Reset password'}
      </button>
    </form>

    <a href="/forgot-password" class="link">Request a new reset link</a>
    <a href="/login" class="back">Back to login</a>
  </div>
</div>
