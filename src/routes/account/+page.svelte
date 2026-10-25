<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth, currentUser } from '$lib/stores/auth.js';
  import VerificationRecovery from '$lib/components/VerificationRecovery.svelte';
  import AccountShell from '$lib/components/site/AccountShell.svelte';
  import WalletCard from '$lib/components/site/WalletCard.svelte';

  let verifying = true;
  let mounted = false;
  let loggingOut = false;
  let checkedEpoch = -1;
  let failedAvatar = '';

  onMount(() => {
    mounted = true;
    return () => { mounted = false; };
  });

  $: if (mounted && !loggingOut && checkedEpoch !== $auth.sessionEpoch) {
    checkedEpoch = $auth.sessionEpoch;
    void verifySession(checkedEpoch);
  }

  async function verifySession(epoch) {
    verifying = true;
    if (!auth.current.token) { goto('/login'); return; }
    const ok = await auth.refreshSession();
    if (!mounted || auth.current.sessionEpoch !== epoch) return;
    verifying = false;
    if (!ok) { goto('/login'); return; }
  }

  function logout() {
    // Clearing auth increments the epoch. Suppress this page's missing-session
    // redirect so it cannot race the user's intentional return to the homepage.
    loggingOut = true;
    auth.logout();
    goto('/');
  }
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
    {#key $auth.sessionEpoch}<WalletCard />{/key}
    <button class="logout" type="button" on:click={logout}>Log out</button>
  {/if}
</AccountShell>
