<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth, currentUser } from '$lib/stores/auth.js';
  import VerificationRecovery from '$lib/components/VerificationRecovery.svelte';
  import AccountShell from '$lib/components/site/AccountShell.svelte';
  import { usageDisplay } from '$lib/account/usage-display.js';

  let verifying = true;
  let mounted = false;
  let loggingOut = false;
  let checkedEpoch = -1;
  let usage = null;
  let usageState = 'loading';
  let failedAvatar = '';
  /** @type {AbortController|null} */
  let usageRequest = null;

  onMount(() => {
    mounted = true;
    return () => { mounted = false; usageRequest?.abort(); };
  });

  // A replacement session never inherits the previous account's usage response.
  $: if (mounted && !loggingOut && checkedEpoch !== $auth.sessionEpoch) {
    checkedEpoch = $auth.sessionEpoch;
    void verifySession(checkedEpoch);
  }

  async function verifySession(epoch) {
    usageRequest?.abort();
    usage = null;
    usageState = 'loading';
    verifying = true;
    if (!auth.current.token) { goto('/login'); return; }
    const ok = await auth.refreshSession();
    if (!mounted || auth.current.sessionEpoch !== epoch) return;
    verifying = false;
    if (!ok) { goto('/login'); return; }
    void loadUsage(epoch);
  }

  async function loadUsage(epoch) {
    const header = auth.getAuthHeader();
    if (!header) { usageState = 'error'; return; }
    const request = new AbortController();
    usageRequest = request;
    try {
      const res = await fetch('/api/usage/me', { headers: { Authorization: header }, signal: request.signal });
      const data = await res.json().catch(() => null);
      if (!mounted || request.signal.aborted || auth.current.sessionEpoch !== epoch) return;
      usage = res.ok ? data : null;
      usageState = res.ok ? 'ready' : 'error';
    } catch {
      if (!mounted || request.signal.aborted || auth.current.sessionEpoch !== epoch) return;
      usageState = 'error';
    }
  }

  function logout() {
    // Clearing auth increments the epoch. Suppress this page's missing-session
    // redirect so it cannot race the user's intentional return to the homepage.
    loggingOut = true;
    auth.logout();
    goto('/');
  }
  $: entitlement = usageDisplay(usage);
  $: displayName = $currentUser?.display_name ?? $currentUser?.name ?? '';
  $: avatarUrl = $currentUser?.avatar_url ?? '';
  $: initial = (displayName?.[0] ?? $currentUser?.email?.[0] ?? '?').toUpperCase();
  $: savedBanner = $page.url.searchParams.get('saved') === '1';
</script>

<svelte:head><title>Profile — Nalana</title></svelte:head>

<AccountShell profile>
  {#if verifying}
    <div class="acct-card about-card" role="status">Loading profile…</div>
  {:else if $currentUser}
    {#if savedBanner}<p class="banner-ok" role="status">Profile updated successfully.</p>{/if}
    {#if $auth.error}<p class="banner" role="status">{$auth.error}</p>{/if}
    {#if $currentUser.email_verified === false}<VerificationRecovery policy={$currentUser.verification} />{/if}
    <section class="acct-card about-card" aria-labelledby="about-label">
      <p class="acct-label" id="about-label">ABOUT YOU</p>
      <div class="profile-head">
        <div class="avatar" aria-hidden="true">
          {#if avatarUrl && failedAvatar !== avatarUrl}<img src={avatarUrl} alt="" on:error={() => failedAvatar = avatarUrl} />{:else}{initial}{/if}
        </div>
        <div class="identity">
          <h1>{displayName || 'No display name'}</h1>
          <p class="identity-email">{$currentUser.email}</p>
          {#if $currentUser.id}<p class="identity-id">ID: {$currentUser.id}</p>{/if}
        </div>
      </div>
      <dl class="details">
        <div><dt>Display name</dt><dd>{displayName || '—'}</dd></div>
        <div><dt>Email</dt><dd>{$currentUser.email}</dd></div>
        <div><dt>Photo</dt><dd>{avatarUrl ? 'Custom photo' : 'Default'}</dd></div>
      </dl>
      <a href="/account/edit" class="acct-primary edit-btn">Edit profile</a>
    </section>
    <section class="acct-card plan-card" aria-labelledby="plan-label" aria-busy={usageState === 'loading'}>
      <p class="acct-label" id="plan-label">PLAN &amp; CREDITS</p>
      {#if usageState === 'loading'}
        <p class="usage-status" role="status">Loading plan and credits…</p>
      {:else}
        {#if entitlement.plan}<span class="plan-badge">{entitlement.plan}</span>{:else}<p class="usage-status">Plan unavailable</p>{/if}
        {#if entitlement.credits !== null}<p class="credits">{entitlement.credits} credits remaining</p>{:else}<p class="usage-status" role="status">Usage unavailable</p>{/if}
      {/if}
    </section>
    <button class="logout" type="button" on:click={logout}>Log out</button>
  {/if}
</AccountShell>
