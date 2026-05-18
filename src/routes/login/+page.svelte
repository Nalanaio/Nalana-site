<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth, isLoggedIn } from '$lib/stores/auth.js';
  import { authErrorMessage } from '$lib/authErrors.js';

  let mode = 'login'; // 'login' | 'signup'
  let email = '', password = '', name = '';
  let loading = false, error = '';

  onMount(() => {
    // Already logged in — redirect to account
    if ($isLoggedIn) goto('/account');
  });

  async function submit() {
    if (!email || !password) { error = 'Please fill in all fields.'; return; }
    if (mode === 'signup' && !name) { error = 'Please enter your name.'; return; }

    loading = true; error = '';
    const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'signup' ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        error = authErrorMessage(res.status, data, mode);
        loading = false;
        return;
      }
      if (!data.token || !data.user?.id) {
        error = 'Invalid response from server. Please try again.';
        loading = false;
        return;
      }
      auth.setSession(data.token, data.user);
      goto('/account');
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{mode === 'signup' ? 'Create account' : 'Log in'} — Nalana</title>
</svelte:head>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
  :global(body) { cursor: auto; background: #fafafa; }
  .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'Inter', sans-serif; }
  .card { width: 100%; max-width: 400px; background: #fff; border-radius: 28px; padding: 48px 36px 40px; box-shadow: 0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04); }

  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 36px; text-decoration: none; }
  .logo-text { font-family: 'KonkhmerSleokchher', sans-serif; font-size: 20px; color: #1085EF; }

  h1 { font-family: 'Amulya', sans-serif; font-size: 28px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.02em; margin-bottom: 8px; }
  .subtitle { font-size: 14px; color: #888; margin-bottom: 32px; }

  .field { display: block; width: 100%; padding: 13px 18px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa; font-family: 'Inter', sans-serif; font-size: 15px; color: #1a1a1a; outline: none; margin-bottom: 10px; transition: border-color .15s; }
  .field::placeholder { color: #bbb; }
  .field:focus { border-color: rgba(16,133,239,0.5); background: #fff; }

  .error { font-size: 13px; color: #e53e3e; text-align: center; margin-bottom: 10px; }

  .submit { width: 100%; padding: 15px; border-radius: 100px; border: none; background: linear-gradient(135deg,#1085EF,#6366F1); color: #fff; font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(16,133,239,0.28); transition: opacity .15s, transform .15s; margin-top: 4px; }
  .submit:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .switch { font-size: 13px; color: #888; text-align: center; margin-top: 24px; }
  .switch-link { background: none; border: none; color: #1085EF; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline; }
  .back { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #bbb; text-decoration: none; }
  .back:hover { color: #888; }
</style>

<div class="page">
  <div class="card">
    <a href="/" class="logo">
      <svg width="24" height="29" viewBox="0 0 69 82" fill="none">
        <path d="M68.5 69.3278C68.5 71.5139 66.7278 73.2861 64.5416 73.2861C62.6686 73.2861 61.07 71.9671 60.5184 70.177C59.0003 65.2496 56.2489 59.8111 52.3994 54.5664C42.7884 41.472 29.9768 34.5417 23.7842 39.0869C17.5915 43.6321 20.3627 57.9319 29.9736 71.0264C30.6518 71.9503 30.0071 73.2861 28.8611 73.2861H11.75C9.54086 73.2861 7.75 71.4953 7.75 69.2861V4C7.75 1.79086 9.54086 0 11.75 0H15.1428C17.0007 0 18.5961 1.28563 19.1747 3.05109C20.7305 7.79868 23.4053 12.9832 27.0811 17.9912C36.692 31.0856 49.5037 38.0159 55.6963 33.4707C61.8888 28.9254 59.1177 14.6256 49.5068 1.53125C49.0448 0.901696 49.4862 0 50.2671 0H64.5C66.7091 0 68.5 1.79086 68.5 4V69.3278Z" fill="#FF8C69"/>
        <path d="M61.75 69.3283C61.75 71.5142 59.978 73.2861 57.7922 73.2861C55.9194 73.2861 54.321 71.9672 53.7695 70.1774C52.2511 65.25 49.499 59.8113 45.6494 54.5664C36.0384 41.4721 23.2268 34.5417 17.0342 39.0869C10.8418 43.6323 13.6129 57.932 23.2236 71.0264C23.9019 71.9505 23.2577 73.2861 22.1114 73.2861H5C2.79086 73.2861 1 71.4953 1 69.2861V4C1 1.79086 2.79086 0 5 0H8.39283C10.2507 0 11.8461 1.28563 12.4247 3.05109C13.9805 7.79868 16.6553 12.9832 20.3311 17.9912C29.942 31.0856 42.7537 38.0159 48.9463 33.4707C55.1388 28.9254 52.3677 14.6256 42.7568 1.53125C42.2948 0.901696 42.7362 0 43.5171 0H57.75C59.9591 0 61.75 1.79086 61.75 4V69.3283Z" fill="#1085EF"/>
      </svg>
      <span class="logo-text">Nalana</span>
    </a>

    <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
    <p class="subtitle">{mode === 'signup' ? 'Free to start. No credit card required.' : 'Log in to your Nalana profile.'}</p>

    <form on:submit|preventDefault={submit}>
      {#if mode === 'signup'}
        <input class="field" type="text" placeholder="Your name" bind:value={name} autocomplete="name" disabled={loading} />
      {/if}
      <input class="field" type="email" placeholder="your@email.com" bind:value={email} autocomplete="email" disabled={loading} />
      <input class="field" type="password" placeholder="Password" bind:value={password} autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading} />
      {#if error}<p class="error">{error}</p>{/if}
      <button class="submit" type="submit" disabled={loading}>
        {loading ? 'Loading…' : mode === 'signup' ? 'Create account →' : 'Log in →'}
      </button>
    </form>

    <p class="switch">
      {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
      <button class="switch-link" on:click={() => { mode = mode === 'signup' ? 'login' : 'signup'; error = ''; }}>
        {mode === 'signup' ? 'Log in' : 'Sign up'}
      </button>
    </p>
    <a href="/" class="back">← Back to nalana.io</a>
  </div>
</div>
