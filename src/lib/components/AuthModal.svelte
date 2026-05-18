<script>
  import { authModal, closeAuthModal } from '$lib/stores/modal.js';
  import { auth } from '$lib/stores/auth.js';
  import { authErrorMessage } from '$lib/authErrors.js';

  let email = '';
  let password = '';
  let name = '';
  let loading = false;
  let error = '';
  let success = false;

  $: mode = $authModal.mode;       // 'signup' | 'login'
  $: platform = $authModal.platform;

  const platformLabel = { mac: 'Mac', windows: 'Windows' };
  const platformIcon  = { mac: '🍎', windows: '🪟' };

  function switchMode(m) {
    authModal.update(s => ({ ...s, mode: m }));
    error = '';
  }

  async function handleSubmit() {
    if (!email || !password) { error = 'Please fill in all fields.'; return; }
    if (mode === 'signup' && !name) { error = 'Please enter your name.'; return; }

    loading = true;
    error = '';

    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'signup'
        ? { email, password, name }
        : { email, password };

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
      success = true;

      // Auto-close after 2s
      setTimeout(() => {
        closeAuthModal();
        success = false;
        email = password = name = '';
      }, 2000);

    } catch (e) {
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

      {#if success}
        <!-- ── SUCCESS STATE ── -->
        <div class="success-state">
          <div class="success-icon">✦</div>
          <h2 class="card-title">
            {mode === 'signup' ? 'Welcome to Nalana!' : 'Welcome back!'}
          </h2>
          <p class="card-sub">You're all set.</p>
        </div>

      {:else}
        <!-- ── PLATFORM CONTEXT (only shown post-download) ── -->
        {#if platform}
          <div class="download-context">
            <span class="platform-icon">{platformIcon[platform] ?? '⬇️'}</span>
            <span class="download-badge">
              Nalana for {platformLabel[platform] ?? platform} is downloading…
            </span>
          </div>
        {/if}

        <!-- ── HEADING ── -->
        <h2 class="card-title">
          {mode === 'signup' ? 'Create your free profile' : 'Log in to Nalana'}
        </h2>
        <p class="card-sub">
          {mode === 'signup'
            ? 'Save your work, earn credits, and unlock pro features.'
            : 'Pick up where you left off.'}
        </p>

        <!-- ── FORM ── -->
        <form on:submit|preventDefault={handleSubmit}>
          {#if mode === 'signup'}
            <input
              class="field"
              type="text"
              placeholder="Your name"
              bind:value={name}
              autocomplete="name"
              disabled={loading}
            />
          {/if}

          <input
            class="field"
            type="email"
            placeholder="your@email.com"
            bind:value={email}
            autocomplete="email"
            disabled={loading}
          />

          <input
            class="field"
            type="password"
            placeholder="Password"
            bind:value={password}
            autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={loading}
          />

          {#if error}
            <p class="error">{error}</p>
          {/if}

          <button class="submit-btn" type="submit" disabled={loading}>
            {#if loading}
              <span class="spinner"></span>
            {:else}
              {mode === 'signup' ? 'Create profile →' : 'Log in →'}
            {/if}
          </button>
        </form>

        <!-- ── MODE SWITCH ── -->
        <p class="switch-mode">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
          <button
            class="switch-link"
            on:click={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? 'Log in' : 'Sign up'}
          </button>
        </p>

        {#if platform}
          <button class="skip-btn" on:click={closeAuthModal}>
            Skip for now — just download
          </button>
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
    -webkit-backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    animation: fadeOverlay .2s ease;
  }
  @keyframes fadeOverlay { from { opacity: 0 } to { opacity: 1 } }

  .card {
    width: 100%; max-width: 400px;
    background: #fff;
    border-radius: 28px;
    padding: 40px 32px 32px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05);
    position: relative;
    animation: slideUp .25s cubic-bezier(0.4,0,0.2,1);
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }

  .close {
    position: absolute; top: 16px; right: 18px;
    background: none; border: none; font-size: 18px;
    color: #bbb; cursor: pointer; padding: 6px 8px;
    border-radius: 8px; transition: color .15s;
    line-height: 1;
  }
  .close:hover { color: #555; }

  /* Download context pill */
  .download-context {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 100px;
    background: rgba(16,133,239,0.08); border: 1px solid rgba(16,133,239,0.2);
    margin-bottom: 20px;
  }
  .platform-icon { font-size: 16px; }
  .download-badge { font-size: 12px; font-weight: 600; color: #1085EF; }

  .card-title {
    font-family: 'Amulya', sans-serif;
    font-size: 26px; font-weight: 700;
    color: #0a0a0a; letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .card-sub { font-size: 14px; color: #888; line-height: 1.55; margin-bottom: 28px; }

  .field {
    display: block; width: 100%;
    padding: 13px 18px; border-radius: 100px;
    border: 1.5px solid rgba(228,228,231,0.8);
    background: #fafafa;
    font-family: 'Inter', sans-serif; font-size: 15px; color: #1a1a1a;
    outline: none; margin-bottom: 10px;
    transition: border-color .15s;
  }
  .field::placeholder { color: #bbb; }
  .field:focus { border-color: rgba(16,133,239,0.5); background: #fff; }
  .field:disabled { opacity: 0.6; cursor: not-allowed; }

  .error { font-size: 13px; color: #e53e3e; margin-bottom: 10px; text-align: center; }

  .submit-btn {
    width: 100%; padding: 15px;
    border-radius: 100px; border: none;
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff; font-family: 'Inter', sans-serif;
    font-size: 15px; font-weight: 600; cursor: pointer;
    transition: opacity .15s, transform .15s;
    display: flex; align-items: center; justify-content: center;
    gap: 8px; margin-top: 4px;
    box-shadow: 0 8px 24px rgba(16,133,239,0.3);
  }
  .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg) } }

  .switch-mode { font-size: 13px; color: #888; text-align: center; margin-top: 20px; }
  .switch-link {
    background: none; border: none; color: #1085EF;
    font-size: 13px; font-weight: 600; cursor: pointer;
    text-decoration: underline; padding: 0;
  }
  .switch-link:hover { color: #0A6FCC; }

  .skip-btn {
    display: block; width: 100%; background: none; border: none;
    font-size: 12px; color: #bbb; cursor: pointer; margin-top: 14px;
    text-align: center; transition: color .15s;
  }
  .skip-btn:hover { color: #888; }

  /* Success state */
  .success-state { text-align: center; padding: 20px 0; }
  .success-icon { font-size: 40px; color: #1085EF; margin-bottom: 16px; }
</style>
