<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { auth, currentUser, isLoggedIn } from '#lib/stores/auth.js';
  import { fileToAvatarDataUrl, validateAvatarFile } from '#lib/avatarUpload.js';
  import AccountShell from '#lib/components/site/AccountShell.svelte';

  let verifying = true;
  let mounted = false;
  let checkedEpoch = -1;
  let displayName = '';
  /** @type {string} Saved or pending avatar (data URL or https URL) */
  let avatarUrl = '';
  let previewUrl = '';
  let saving = false;
  let saveError = '';
  let avatarImgError = false;
  let uploadingAvatar = false;
  /** @type {HTMLInputElement | null} */
  let fileInput = null;

  $: initial = (displayName?.[0] ?? $currentUser?.email?.[0] ?? '?').toUpperCase();
  $: showPreview = previewUrl && !avatarImgError;

  onMount(() => {
    mounted = true;
    return () => { mounted = false; };
  });

  $: if (mounted && checkedEpoch !== $auth.sessionEpoch) {
    checkedEpoch = $auth.sessionEpoch;
    void verifySession(checkedEpoch);
  }

  async function verifySession(epoch) {
    verifying = true;
    displayName = ''; avatarUrl = ''; previewUrl = '';
    avatarImgError = false;
    saving = false; uploadingAvatar = false; saveError = '';
    if (!$isLoggedIn) { goto('/login'); return; }
    const ok = await auth.refreshSession();
    if (!mounted || auth.current.sessionEpoch !== epoch) return;
    verifying = false;
    if (!ok) { goto('/login'); return; }
    const user = get(auth).user;
    if (user) {
      displayName = user.display_name ?? user.name ?? '';
      avatarUrl = user.avatar_url ?? '';
      previewUrl = avatarUrl;
    }
  }

  /** @param {Event} e */
  async function onAvatarSelected(e) {
    const input = /** @type {HTMLInputElement} */ (e.currentTarget);
    const file = input.files?.[0];
    const epoch = auth.current.sessionEpoch;
    if (!file) return;

    const err = validateAvatarFile(file);
    if (err) {
      saveError = err;
      input.value = '';
      return;
    }

    uploadingAvatar = true;
    saveError = '';
    avatarImgError = false;

    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (!mounted || auth.current.sessionEpoch !== epoch) return;
      avatarUrl = dataUrl;
      previewUrl = dataUrl;
    } catch (ex) {
      if (!mounted || auth.current.sessionEpoch !== epoch) return;
      saveError = ex instanceof Error ? ex.message : 'Could not process image.';
    } finally {
      if (mounted && auth.current.sessionEpoch === epoch) { uploadingAvatar = false; input.value = ''; }
    }
  }

  function removeAvatar() {
    avatarUrl = '';
    previewUrl = '';
    avatarImgError = false;
    if (fileInput) fileInput.value = '';
  }

  async function saveProfile() {
    if (saving || uploadingAvatar) return;
    const session = get(auth);
    const header = auth.getAuthHeader();
    if (!header) {
      goto('/login');
      return;
    }

    saving = true;
    saveError = '';

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: {
          Authorization: header,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!mounted || get(auth).sessionEpoch !== session.sessionEpoch) return;
      if (!res.ok) {
        saveError = data.error || 'Could not save profile.';
        return;
      }

      if (get(auth).sessionEpoch !== session.sessionEpoch) return;
      auth.updateUser(data.user, session.sessionEpoch);
      goto('/account?saved=1');
    } catch {
      if (!mounted || get(auth).sessionEpoch !== session.sessionEpoch) return;
      saveError = 'Network error. Please try again.';
    } finally {
      if (mounted && get(auth).sessionEpoch === session.sessionEpoch) saving = false;
    }
  }
</script>

<svelte:head>
  <title>Edit profile — Nalana</title>
</svelte:head>

<AccountShell profile>
  {#if verifying}
    <div class="acct-card about-card" role="status">Loading profile…</div>
  {:else if $currentUser}
    <form class="acct-card about-card" method="POST" on:submit|preventDefault={saveProfile} aria-busy={saving || uploadingAvatar}>
      <div class="signin-head"><h1>Edit profile</h1><p>Update your photo and display name.</p></div>
      <div class="avatar-block">
        <div class="avatar" aria-hidden="true">
          {#if showPreview}<img src={previewUrl} alt="" on:error={() => avatarImgError = true} />{:else}{initial}{/if}
        </div>
        <div class="avatar-actions">
          <input bind:this={fileInput} class="file-input" type="file" aria-label="Profile photo" accept="image/jpeg,image/png,image/webp,image/gif" on:change={onAvatarSelected} disabled={uploadingAvatar || saving} />
          <button type="button" class="acct-primary" disabled={uploadingAvatar || saving} on:click={() => fileInput?.click()}>{uploadingAvatar ? 'Processing…' : 'Upload photo'}</button>
          {#if previewUrl}<button type="button" class="secondary-button" disabled={uploadingAvatar || saving} on:click={removeAvatar}>Remove photo</button>{/if}
          <p class="photo-hint">JPG, PNG, WebP or GIF · max 5 MB. Photo is saved when you tap Save changes.</p>
        </div>
      </div>
      <div class="edit-fields">
        <label class="field"><span>Email</span><input type="email" value={$currentUser.email} autocomplete="email" disabled /></label>
        <label class="field"><span>Display name</span><input name="display-name" type="text" bind:value={displayName} placeholder="Your name" autocomplete="nickname" disabled={saving} /></label>
      </div>
      {#if saveError}<p class="form-error" role="alert">{saveError}</p>{/if}
      <div class="form-actions">
        <button class="acct-primary" type="submit" disabled={saving || uploadingAvatar}>{saving ? 'Saving…' : 'Save changes'}</button>
        <a href="/account" class="secondary-button">Cancel</a>
      </div>
    </form>
  {/if}
</AccountShell>
