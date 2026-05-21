<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth, currentUser, isLoggedIn } from '$lib/stores/auth.js';

  let verifying = true;
  /** @type {{ credits_remaining?: number; plan?: string; tier?: string } | null} */
  let usage = null;

  const planColors = { free: '#888', pro: '#1085EF', team: '#A78ADE' };
  const planLabels = { free: 'Free', pro: 'Pro', team: 'Team' };

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
    loadUsage();
  });

  async function loadUsage() {
    const header = auth.getAuthHeader();
    if (!header) return;
    try {
      const res = await fetch('/api/usage/me', { headers: { Authorization: header } });
      if (res.ok) usage = await res.json();
    } catch {
      /* optional */
    }
  }

  function logout() {
    auth.logout();
    goto('/');
  }

  $: planName =
    usage?.plan ?? usage?.tier ?? $currentUser?.plan ?? $currentUser?.tier ?? 'free';
  $: credits = usage?.credits_remaining ?? $currentUser?.credits ?? 0;
  $: displayName = $currentUser?.display_name ?? $currentUser?.name ?? '';
  $: avatarUrl = $currentUser?.avatar_url ?? '';
  $: initial = (displayName?.[0] ?? $currentUser?.email?.[0] ?? '?').toUpperCase();
  $: savedBanner = $page.url.searchParams.get('saved') === '1';
</script>

<svelte:head>
  <title>Profile — Nalana</title>
</svelte:head>

<style>
  :global(body) { cursor: auto; }
  .page { min-height: 100vh; background: #fafafa; padding: 80px 24px; font-family: 'Inter', sans-serif; }
  .container { max-width: 720px; margin: 0 auto; }
  .back { display: inline-flex; text-decoration: none; color: #888; font-size: 14px; font-weight: 500; margin-bottom: 40px; }
  .back:hover { color: #1085EF; }
  h1 { font-family: 'Amulya', sans-serif; font-size: 36px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.02em; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #888; margin-bottom: 32px; }

  .banner-ok {
    font-size: 14px; color: #166534; background: rgba(34,197,94,0.12);
    border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
  }
  .verify-banner {
    font-size: 14px; color: #b45309; background: rgba(251,191,36,0.12);
    border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; line-height: 1.5;
  }

  .card {
    background: #fff; border-radius: 24px; padding: 32px;
    border: 1px solid rgba(228,228,231,0.8);
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    margin-bottom: 20px;
  }
  .card-title { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }

  .profile-row { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
  .avatar {
    width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 28px; color: #fff;
    background: linear-gradient(135deg, #1085EF, #A78ADE);
    overflow: hidden;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .profile-name { font-size: 22px; font-weight: 700; color: #0a0a0a; margin-bottom: 4px; }
  .profile-email { font-size: 14px; color: #888; }
  .profile-id { font-size: 12px; color: #bbb; margin-top: 6px; font-family: monospace; }

  .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(228,228,231,0.6); font-size: 14px; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #888; font-weight: 500; }
  .info-value { color: #1a1a1a; font-weight: 600; text-align: right; max-width: 60%; word-break: break-all; }

  .edit-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 100px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff; font-size: 14px; font-weight: 600; text-decoration: none;
    box-shadow: 0 6px 20px rgba(16,133,239,0.28);
  }
  .edit-btn:hover { opacity: 0.92; }

  .plan-badge { display: inline-flex; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .credits-count { font-size: 24px; font-weight: 700; color: #1085EF; margin-top: 12px; }

  .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 8px; }
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
      <p style="color:#888;font-size:16px;">Loading profile…</p>
    {:else if $currentUser}
      <h1>Profile</h1>
      <p class="subtitle">Your Nalana account overview.</p>

      {#if savedBanner}
        <p class="banner-ok" role="status">Profile updated successfully.</p>
      {/if}

      {#if $currentUser.email_verified === false}
        <p class="verify-banner" role="status">
          Your email is not verified yet. Some features may be limited until you verify.
        </p>
      {/if}

      <div class="card">
        <div class="card-title">About you</div>
        <div class="profile-row">
          <div class="avatar">
            {#if avatarUrl}
              <img src={avatarUrl} alt="" />
            {:else}
              {initial}
            {/if}
          </div>
          <div>
            <div class="profile-name">{displayName || 'No display name'}</div>
            <div class="profile-email">{$currentUser.email}</div>
            {#if $currentUser.id}
              <div class="profile-id">ID: {$currentUser.id}</div>
            {/if}
          </div>
        </div>

        <div class="info-row">
          <span class="info-label">Display name</span>
          <span class="info-value">{displayName || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">{$currentUser.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Photo</span>
          <span class="info-value">{avatarUrl ? 'Custom photo' : 'Default'}</span>
        </div>

        <div class="actions">
          <a href="/account/edit" class="edit-btn">Edit profile</a>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Plan &amp; credits</div>
        <div
          class="plan-badge"
          style="background:{planColors[planName] ?? '#888'}18;color:{planColors[planName] ?? '#888'};"
        >
          {planLabels[planName] ?? planName}
        </div>
        <p class="credits-count">{credits} credits remaining</p>
      </div>

      <button class="logout-btn" type="button" on:click={logout}>Log out</button>
    {/if}
  </div>
</div>
