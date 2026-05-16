<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth, currentUser, isLoggedIn } from '$lib/stores/auth.js';

  onMount(() => {
    // Redirect to login if not authenticated
    if (!$isLoggedIn) goto('/login');
  });

  function logout() {
    auth.logout();
    goto('/');
  }

  const planColors = { free: '#888', pro: '#1085EF', team: '#A78ADE' };
  const planLabels = { free: 'Free', pro: 'Pro', team: 'Team' };
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

  .user-row { display: flex; align-items: center; gap: 16px; }
  .avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,#1085EF,#A78ADE); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff; flex-shrink: 0; }
  .user-name { font-size: 20px; font-weight: 700; color: #0a0a0a; }
  .user-email { font-size: 14px; color: #888; }

  .plan-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 8px; }

  .credits-bar { background: rgba(16,133,239,0.08); border-radius: 100px; height: 8px; overflow: hidden; margin: 12px 0 8px; }
  .credits-fill { height: 100%; background: linear-gradient(90deg,#1085EF,#6366F1); border-radius: 100px; transition: width .5s; }
  .credits-label { display: flex; justify-content: space-between; font-size: 13px; color: #888; }
  .credits-count { font-weight: 700; color: #1085EF; }

  .upgrade-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 100px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;
    box-shadow: 0 6px 20px rgba(16,133,239,0.28); transition: opacity .15s, transform .15s;
    margin-top: 20px;
  }
  .upgrade-btn:hover { opacity: 0.9; transform: translateY(-1px); }

  .logout-btn {
    background: none; border: 1px solid rgba(228,228,231,0.8); color: #888;
    padding: 10px 20px; border-radius: 100px; font-size: 14px; cursor: pointer;
    font-family: 'Inter', sans-serif; transition: all .15s;
  }
  .logout-btn:hover { border-color: #e53e3e; color: #e53e3e; }

  .coming-soon {
    background: #f5f5f5; border-radius: 16px; padding: 24px;
    text-align: center; font-size: 14px; color: #bbb;
  }
</style>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<div class="page">
  <div class="container">
    <a href="/" class="back">← Back to nalana.io</a>

    {#if $currentUser}
      <h1>Hi, {$currentUser.name?.split(' ')[0] ?? 'there'} 👋</h1>
      <p class="subtitle">Manage your Nalana account and credits.</p>

      <!-- Profile card -->
      <div class="card">
        <div class="card-title">Profile</div>
        <div class="user-row">
          <div class="avatar">{($currentUser.name?.[0] ?? $currentUser.email?.[0] ?? '?').toUpperCase()}</div>
          <div>
            <div class="user-name">{$currentUser.name}</div>
            <div class="user-email">{$currentUser.email}</div>
            <div class="plan-badge" style="background:{planColors[$currentUser.plan] ?? '#888'}18;color:{planColors[$currentUser.plan] ?? '#888'};">
              {planLabels[$currentUser.plan] ?? $currentUser.plan} plan
            </div>
          </div>
        </div>
      </div>

      <!-- Credits card -->
      <div class="card">
        <div class="card-title">Credits</div>
        <div class="credits-label" style="margin-bottom:4px;">
          <span>Available</span>
          <span class="credits-count">{$currentUser.credits ?? 0} credits</span>
        </div>
        <div class="credits-bar">
          <div class="credits-fill" style="width:{Math.min(100, (($currentUser.credits ?? 0) / 50) * 100)}%"></div>
        </div>
        <div class="credits-label">
          <span>Used this month</span>
          <span>{Math.max(0, 50 - ($currentUser.credits ?? 0))}/50</span>
        </div>

        {#if $currentUser.plan === 'free'}
          <button class="upgrade-btn">
            ✦ Upgrade to Pro — unlock 500 credits/mo
          </button>
        {/if}
      </div>

      <!-- Usage history (coming soon) -->
      <div class="card">
        <div class="card-title">Recent Activity</div>
        <div class="coming-soon">Usage history coming soon.</div>
      </div>

      <button class="logout-btn" on:click={logout}>Log out</button>

    {:else}
      <p style="color:#888;font-size:16px;">Loading account…</p>
    {/if}
  </div>
</div>
