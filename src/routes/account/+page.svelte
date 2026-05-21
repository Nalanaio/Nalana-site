<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { auth, currentUser, isLoggedIn } from '$lib/stores/auth.js';

  let verifying = true;
  let displayName = '';
  let avatarUrl = '';
  let saving = false;
  let saveMsg = '';
  let saveError = '';
  /** @type {{ credits_remaining?: number; plan?: string; tier?: string } | null} */
  let usage = null;

  onMount(async () => {
    if (!$isLoggedIn) {
      goto('/login');
      return;
    }
    const ok = await auth.refreshSession();
    verifying = false;
    if (!ok) {
      goto('/login');
      return;
    }
    const user = $currentUser;
    if (user) {
      displayName = user.display_name ?? user.name ?? '';
      avatarUrl = user.avatar_url ?? '';
    }
    loadUsage();
  });

  async function loadUsage() {
    const header = auth.getAuthHeader();
    if (!header) return;
    try {
      const res = await fetch('/api/usage/me', { headers: { Authorization: header } });
      if (res.ok) {
        usage = await res.json();
      }
    } catch {
      /* optional */
    }
  }

  async function saveProfile() {
    const header = auth.getAuthHeader();
    if (!header) {
      goto('/login');
      return;
    }

    saving = true;
    saveMsg = '';
    saveError = '';

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          Authorization: header,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        saveError = data.error || 'Could not save profile.';
        return;
      }

      const session = get(auth);
      auth.setSession(session.token, data.user, session.refreshToken);
      saveMsg = 'Profile saved.';
    } catch {
      saveError = 'Network error. Please try again.';
    } finally {
      saving = false;
    }
  }

  function logout() {
    auth.logout();
    goto('/');
  }

  const planColors = { free: '#888', pro: '#1085EF', team: '#A78ADE' };
  const planLabels = { free: 'Free', pro: 'Pro', team: 'Team' };

  $: planName =
    usage?.plan ?? usage?.tier ?? $currentUser?.plan ?? $currentUser?.tier ?? 'free';
  $: credits =
    usage?.credits_remaining ?? $currentUser?.credits ?? 0;
</script>

<svelte:head>
  <title>My Account — Nalana</title>
</svelte:head>

<style>
  :global(body) { cursor: auto; }
  .page { min-height: 100vh; background: #fafafa; padding: 80px 24px; font-family: 'Inter', sans-serif; }
  .container { max-width: 720px; margin: 0 auto; }
  .back { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: #888; font-size: 14px; font-weight: 500; margin-bottom: 40px; }
  .back:hover { color: #1085EF; }
  h1 { font-family: 'Amulya', sans-serif; font-size: 36px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.02em; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #888; margin-bottom: 48px; }

  .card {
    background: #fff; border-radius: 24px; padding: 32px;
    border: 1px solid rgba(228,228,231,0.8);
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    margin-bottom: 20px;
  }
  .card-title { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }

  .field-label { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; display: block; }
  .field {
    display: block; width: 100%; padding: 12px 16px; border-radius: 12px;
    border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa;
    font-family: 'Inter', sans-serif; font-size: 15px; margin-bottom: 16px; box-sizing: border-box;
  }
  .field:disabled { color: #888; background: #f0f0f0; }
  .field:focus { outline: none; border-color: rgba(16,133,239,0.5); background: #fff; }

  .save-btn {
    padding: 12px 24px; border-radius: 100px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff; font-size: 14px; font-weight: 600;
  }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg-ok { font-size: 13px; color: #166534; margin-top: 8px; }
  .msg-err { font-size: 13px; color: #e53e3e; margin-top: 8px; }

  .plan-badge { display: inline-flex; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
  .credits-count { font-size: 24px; font-weight: 700; color: #1085EF; }

  .verify-banner {
    font-size: 14px; color: #b45309; background: rgba(251,191,36,0.12);
    border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; line-height: 1.5;
  }

  .logout-btn {
    background: none; border: 1px solid rgba(228,228,231,0.8); color: #888;
    padding: 10px 20px; border-radius: 100px; font-size: 14px; cursor: pointer;
    font-family: 'Inter', sans-serif;
  }
  .logout-btn:hover { border-color: #e53e3e; color: #e53e3e; }
</style>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<div class="page">
  <div class="container">
    <a href="/" class="back">← Back to nalana.io</a>

    {#if verifying}
      <p style="color:#888;font-size:16px;">Loading account…</p>
    {:else if $currentUser}
      <h1>Account settings</h1>
      <p class="subtitle">Manage your profile and usage.</p>

      {#if $currentUser.email_verified === false}
        <p class="verify-banner" role="status">
          Your email is not verified yet. You may still need to verify before logging in on some clients.
        </p>
      {/if}

      <div class="card">
        <div class="card-title">Profile</div>

        <label class="field-label" for="email">Email</label>
        <input id="email" class="field" type="email" value={$currentUser.email} disabled />

        <label class="field-label" for="display-name">Display name</label>
        <input id="display-name" class="field" type="text" bind:value={displayName} placeholder="Your name" />

        <label class="field-label" for="avatar">Avatar URL</label>
        <input id="avatar" class="field" type="url" bind:value={avatarUrl} placeholder="https://…" />

        <button class="save-btn" type="button" disabled={saving} on:click={saveProfile}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {#if saveMsg}<p class="msg-ok">{saveMsg}</p>{/if}
        {#if saveError}<p class="msg-err">{saveError}</p>{/if}
      </div>

      <div class="card">
        <div class="card-title">Plan &amp; credits</div>
        <div
          class="plan-badge"
          style="background:{planColors[planName] ?? '#888'}18;color:{planColors[planName] ?? '#888'};"
        >
          {planLabels[planName] ?? planName}
        </div>
        <p class="credits-count" style="margin-top:16px;">{credits} credits remaining</p>
      </div>

      <button class="logout-btn" on:click={logout}>Log out</button>
    {/if}
  </div>
</div>
