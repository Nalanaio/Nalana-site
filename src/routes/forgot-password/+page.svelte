<script>
  import { FORGOT_PASSWORD_SUCCESS } from '$lib/authClient.js';

  let email = '';
  let loading = false;
  let error = '';
  let sent = false;

  async function submit() {
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

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
  :global(body) { cursor: auto; background: #fafafa; }
  .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .card { width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 48px 36px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04); }
  .logo-text { font-family: 'KonkhmerSleokchher', sans-serif; font-size: 20px; color: #1085EF; text-decoration: none; display: block; margin-bottom: 36px; }
  h1 { font-family: 'Amulya', sans-serif; font-size: 28px; font-weight: 700; color: #0a0a0a; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 32px; line-height: 1.5; }
  .field { display: block; width: 100%; padding: 13px 18px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa; font-size: 15px; outline: none; margin-bottom: 10px; box-sizing: border-box; }
  .error { font-size: 13px; color: #e53e3e; text-align: center; margin-bottom: 10px; }
  .success { font-size: 14px; color: #166534; background: rgba(34,197,94,0.12); border-radius: 12px; padding: 14px; line-height: 1.5; }
  .submit { width: 100%; padding: 15px; border-radius: 100px; border: none; background: linear-gradient(135deg,#1085EF,#6366F1); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  .submit:disabled { opacity: 0.5; }
  .link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #1085EF; font-weight: 600; text-decoration: none; }
  .back { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #bbb; text-decoration: none; }
</style>

<div class="page">
  <div class="card">
    <a href="/" class="logo-text">Nalana</a>

    {#if sent}
      <h1>Check your email</h1>
      <p class="success">{FORGOT_PASSWORD_SUCCESS}</p>
      <a href="/login" class="link">Back to login</a>
    {:else}
      <h1>Forgot password?</h1>
      <p class="subtitle">Enter your email and we will send a reset link if an account exists.</p>

      <form on:submit|preventDefault={submit}>
        <input class="field" type="email" placeholder="your@email.com" bind:value={email} autocomplete="email" disabled={loading} />
        {#if error}<p class="error">{error}</p>{/if}
        <button class="submit" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <a href="/login" class="link">Back to login</a>
    {/if}

    <a href="/" class="back">← Back to nalana.io</a>
  </div>
  </div>
