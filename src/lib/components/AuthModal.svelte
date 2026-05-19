<script>
  import { authModal, closeAuthModal } from '$lib/stores/modal.js';
  import { auth } from '$lib/stores/auth.js';
  import { authErrorMessage, isEmailNotVerifiedError, validatePassword } from '$lib/authClient.js';

  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let showUnverified = false;
  let signupSuccess = false;

  $: mode = $authModal.mode;
  $: platform = $authModal.platform;

  const platformLabel = { mac: 'Mac', windows: 'Windows' };
  const platformIcon = { mac: '🍎', windows: '🪟' };

  function switchMode(m) {
    authModal.update((s) => ({ ...s, mode: m }));
    error = '';
    showUnverified = false;
    signupSuccess = false;
  }

  async function handleSubmit() {
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

    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
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

      closeAuthModal();
      email = password = '';
      window.location.href = '/account';
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeAuthModal();
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) closeAuthModal();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $authModal.open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" on:click={handleOverlayClick}>
    <div class="card" role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Create your Nalana profile' : 'Log in to Nalana'}>

      <button class="close" on:click={closeAuthModal} aria-label="Close">✕</button>

      {#if signupSuccess}
        <h2 class="card-title">Account created</h2>
        <p class="card-sub">Your Nalana account is ready. Use the same email in the IDE and on the website.</p>
        <a href="/account" class="submit-btn" style="text-decoration:none;text-align:center;">Go to account</a>
        <button type="button" class="skip-btn" on:click={closeAuthModal}>Close</button>
      {:else}
        {#if platform}
          <div class="download-context">
            <span class="platform-icon">{platformIcon[platform] ?? '⬇️'}</span>
            <span class="download-badge">Nalana for {platformLabel[platform] ?? platform} is downloading…</span>
          </div>
        {/if}

        <h2 class="card-title">{mode === 'signup' ? 'Create your free profile' : 'Log in to Nalana'}</h2>
        <p class="card-sub">
          {mode === 'signup' ? 'One account for the website and IDE.' : 'Pick up where you left off.'}
        </p>

        <form on:submit|preventDefault={handleSubmit}>
          <input class="field" type="email" placeholder="your@email.com" bind:value={email} autocomplete="email" disabled={loading} />
          <input class="field" type="password" placeholder="Password (min 8 characters)" bind:value={password} autocomplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading} />

          {#if mode === 'login'}
            <p class="forgot-link"><a href="/forgot-password" on:click={closeAuthModal}>Forgot password?</a></p>
          {/if}

          {#if showUnverified}
            <p class="error warn">{error} <a href="/">Back to home</a></p>
          {:else if error}
            <p class="error">{error}</p>
          {/if}

          <button class="submit-btn" type="submit" disabled={loading}>
            {#if loading}<span class="spinner"></span>{:else}{mode === 'signup' ? 'Create profile →' : 'Log in →'}{/if}
          </button>
        </form>

        <p class="switch-mode">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
          <button class="switch-link" type="button" on:click={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>

        {#if platform}
          <button class="skip-btn" type="button" on:click={closeAuthModal}>Skip for now — just download</button>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 3000;
    background: rgba(10,10,10,0.55);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 400px;
    background: #fff; border-radius: 28px; padding: 40px 32px 32px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.22);
    position: relative;
  }
  .close { position: absolute; top: 16px; right: 18px; background: none; border: none; font-size: 18px; color: #bbb; cursor: pointer; }
  .download-context { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; background: rgba(16,133,239,0.08); margin-bottom: 20px; }
  .download-badge { font-size: 12px; font-weight: 600; color: #1085EF; }
  .card-title { font-family: 'Amulya', sans-serif; font-size: 26px; font-weight: 700; margin-bottom: 8px; }
  .card-sub { font-size: 14px; color: #888; margin-bottom: 28px; line-height: 1.55; }
  .field { display: block; width: 100%; padding: 13px 18px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa; font-size: 15px; margin-bottom: 10px; box-sizing: border-box; }
  .forgot-link { text-align: right; margin: -4px 0 8px; font-size: 13px; }
  .forgot-link a { color: #1085EF; text-decoration: none; }
  .error { font-size: 13px; color: #e53e3e; margin-bottom: 10px; text-align: center; }
  .error.warn { color: #b45309; text-align: left; }
  .error.warn a { color: #1085EF; }
  .submit-btn { width: 100%; padding: 15px; border-radius: 100px; border: none; background: linear-gradient(135deg, #1085EF, #6366F1); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .submit-btn:disabled { opacity: 0.5; }
  .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .switch-mode { font-size: 13px; color: #888; text-align: center; margin-top: 20px; }
  .switch-link { background: none; border: none; color: #1085EF; font-weight: 600; cursor: pointer; text-decoration: underline; }
  .skip-btn { display: block; width: 100%; background: none; border: none; font-size: 12px; color: #bbb; cursor: pointer; margin-top: 14px; }
</style>
