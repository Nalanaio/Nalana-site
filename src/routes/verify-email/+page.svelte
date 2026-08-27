<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import EmailVerifyPanel from '$lib/components/EmailVerifyPanel.svelte';
  import { resendVerificationEmail, RESEND_SUCCESS_MESSAGE } from '$lib/authClient.js';

  /** @type {'loading' | 'success' | 'error' | 'missing' | 'resend'} */
  let state = 'loading';
  let errorDetail = '';
  let emailForResend = '';
  let resendEmailInput = '';
  let resendMsg = '';
  let resendError = '';
  let resending = false;

  $: token = $page.url.searchParams.get('token') ?? '';
  $: emailParam = $page.url.searchParams.get('email') ?? '';
  $: actionParam = $page.url.searchParams.get('action') ?? '';
  $: isResendAction =
    actionParam === 'resend' ||
    $page.url.searchParams.get('resend') === 'true' ||
    $page.url.searchParams.get('resend') === '1';

  onMount(() => {
    if (emailParam) {
      resendEmailInput = emailParam;
      emailForResend = emailParam;
    }
    if (isResendAction && !token) {
      state = 'resend';
      return;
    }
    if (!token) {
      state = 'missing';
      return;
    }
    verify(token, emailParam);
  });

  async function verify(verificationToken, email = '') {
    state = 'loading';
    errorDetail = '';
    try {
      const payload = { token: verificationToken };
      if (email) payload.email = email;
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        state = 'error';
        errorDetail = data.error ?? data.detail ?? 'Invalid or expired verification token.';
        return;
      }
      state = 'success';
      emailForResend = data.user?.email ?? email;
      setTimeout(() => goto('/login'), 3000);
    } catch {
      state = 'error';
      errorDetail = 'Network error. Please try again.';
    }
  }

  async function handleResend() {
    const target = resendEmailInput.trim() || emailForResend;
    if (!target || resending) return;
    resending = true;
    resendMsg = '';
    resendError = '';
    try {
      const result = await resendVerificationEmail(target);
      if (result.ok) {
        resendMsg = result.message || RESEND_SUCCESS_MESSAGE;
      } else {
        resendError = result.message || 'Could not send email. Try again.';
      }
    } catch {
      resendError = 'Network error. Please try again.';
    } finally {
      resending = false;
    }
  }
</script>

<svelte:head>
  <title>Verify email — Nalana</title>
</svelte:head>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
  :global(body) { cursor: auto; background: #fafafa; }
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: 'Inter', sans-serif;
  }
  .card {
    width: 100%;
    max-width: 440px;
    background: #fff;
    border-radius: 28px;
    padding: 48px 36px 40px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
    text-align: center;
  }
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
    text-decoration: none;
  }
  .logo-text {
    font-family: 'KonkhmerSleokchher', sans-serif;
    font-size: 20px;
    color: #1085ef;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid rgba(16, 133, 239, 0.2);
    border-top-color: #1085ef;
    animation: spin 0.7s linear infinite;
    margin: 0 auto 20px;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  h1 {
    font-family: 'Amulya', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #0a0a0a;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  .sub {
    font-size: 14px;
    color: #888;
    line-height: 1.55;
    margin-bottom: 24px;
  }
  .error-box {
    font-size: 14px;
    color: #e53e3e;
    background: rgba(229, 62, 62, 0.08);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .field {
    display: block;
    width: 100%;
    padding: 13px 18px;
    border-radius: 100px;
    border: 1.5px solid rgba(228, 228, 231, 0.8);
    background: #fafafa;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    margin-bottom: 10px;
    outline: none;
  }
  .btn-primary {
    display: inline-block;
    padding: 14px 28px;
    border-radius: 100px;
    border: none;
    background: linear-gradient(135deg, #1085ef, #6366f1);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(16, 133, 239, 0.28);
    margin-top: 8px;
  }
  .btn-link {
    display: block;
    margin-top: 16px;
    font-size: 13px;
    color: #1085ef;
    text-decoration: none;
  }
  .success-icon {
    font-size: 40px;
    color: #1085ef;
    margin-bottom: 12px;
  }
  .msg {
    font-size: 13px;
    margin-top: 10px;
  }
  .msg.success { color: #1085ef; }
  .msg.error { color: #e53e3e; }
</style>

<div class="page">
  <div class="card">
    <a href="/" class="logo">
      <span class="logo-text">Nalana</span>
    </a>

    {#if state === 'loading'}
      <div class="spinner" aria-label="Verifying"></div>
      <h1>Verifying your email…</h1>
      <p class="sub">Please wait a moment.</p>

    {:else if state === 'success'}
      <div class="success-icon" aria-hidden="true">✦</div>
      <h1>Email verified!</h1>
      <p class="sub">Your account is ready. Redirecting to login in a few seconds…</p>
      <a href="/login" class="btn-primary">Go to login →</a>

    {:else if state === 'resend'}
      <div class="success-icon" aria-hidden="true">✉</div>
      <h1>Resend verification email</h1>
      <p class="sub">Confirm your email address below to receive a new verification link.</p>
      <input class="field" type="email" placeholder="your@email.com" bind:value={resendEmailInput} />
      <button type="button" class="btn-primary" disabled={resending} on:click={handleResend}>
        {resending ? 'Sending…' : 'Send verification email'}
      </button>
      {#if resendMsg}<p class="msg success">{resendMsg}</p>{/if}
      {#if resendError}<p class="msg error">{resendError}</p>{/if}
      <a href="/login" class="btn-link">Back to login</a>

    {:else if state === 'missing'}
      <h1>Invalid link</h1>
      <p class="sub">This verification link is missing a token. Open the link from your email, or request a new one below.</p>
      <input class="field" type="email" placeholder="your@email.com" bind:value={resendEmailInput} />
      <button type="button" class="btn-primary" disabled={resending} on:click={handleResend}>
        {resending ? 'Sending…' : 'Resend verification email'}
      </button>
      {#if resendMsg}<p class="msg success">{resendMsg}</p>{/if}
      {#if resendError}<p class="msg error">{resendError}</p>{/if}
      <a href="/login" class="btn-link">Back to login</a>

    {:else if state === 'error'}
      <h1>Verification failed</h1>
      <div class="error-box">{errorDetail}</div>
      <input class="field" type="email" placeholder="your@email.com" bind:value={resendEmailInput} />
      <button type="button" class="btn-primary" disabled={resending} on:click={handleResend}>
        {resending ? 'Sending…' : 'Resend verification email'}
      </button>
      {#if resendMsg}<p class="msg success">{resendMsg}</p>{/if}
      {#if resendError}<p class="msg error">{resendError}</p>{/if}
      <a href="/login" class="btn-link">Back to login</a>
    {/if}
  </div>
</div>
