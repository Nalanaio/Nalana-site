<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { auth, currentUser, isLoggedIn } from '$lib/stores/auth.js';
  import { fileToAvatarDataUrl, validateAvatarFile } from '$lib/avatarUpload.js';

  let verifying = true;
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
    const user = get(auth).user;
    if (user) {
      displayName = user.display_name ?? user.name ?? '';
      avatarUrl = user.avatar_url ?? '';
      previewUrl = avatarUrl;
    }
  });

  /** @param {Event} e */
  async function onAvatarSelected(e) {
    const input = /** @type {HTMLInputElement} */ (e.currentTarget);
    const file = input.files?.[0];
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
      avatarUrl = dataUrl;
      previewUrl = dataUrl;
    } catch (ex) {
      saveError = ex instanceof Error ? ex.message : 'Could not process image.';
    } finally {
      uploadingAvatar = false;
      input.value = '';
    }
  }

  function removeAvatar() {
    avatarUrl = '';
    previewUrl = '';
    avatarImgError = false;
    if (fileInput) fileInput.value = '';
  }

  async function saveProfile() {
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

      if (!res.ok) {
        saveError = data.error || 'Could not save profile.';
        return;
      }

      const session = get(auth);
      auth.setSession(session.token, data.user, session.refreshToken);
      goto('/account?saved=1');
    } catch {
      saveError = 'Network error. Please try again.';
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Edit profile — Nalana</title>
</svelte:head>

<style>
  :global(body) { cursor: auto; }
  .page { min-height: 100vh; background: #fafafa; padding: 80px 24px; font-family: 'Inter', sans-serif; }
  .container { max-width: 720px; margin: 0 auto; }
  .back { display: inline-flex; text-decoration: none; color: #888; font-size: 14px; font-weight: 500; margin-bottom: 40px; }
  .back:hover { color: #1085EF; }
  h1 { font-family: 'Amulya', sans-serif; font-size: 36px; font-weight: 700; color: #0a0a0a; letter-spacing: -0.02em; margin-bottom: 8px; }
  .subtitle { font-size: 16px; color: #888; margin-bottom: 32px; }

  .card {
    background: #fff; border-radius: 24px; padding: 32px;
    border: 1px solid rgba(228,228,231,0.8);
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    margin-bottom: 20px;
  }
  .card-title { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }

  .avatar-block { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; flex-wrap: wrap; }
  .avatar {
    width: 80px; height: 80px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 28px; color: #fff;
    background: linear-gradient(135deg, #1085EF, #A78ADE);
    overflow: hidden;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-actions { display: flex; flex-direction: column; gap: 8px; }
  .file-input { display: none; }

  .photo-btn, .remove-btn {
    padding: 10px 18px; border-radius: 100px; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; border: none;
  }
  .photo-btn {
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff;
  }
  .photo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .remove-btn {
    background: #fff; color: #888;
    border: 1.5px solid rgba(228,228,231,0.8);
  }
  .remove-btn:hover { color: #e53e3e; border-color: #e53e3e; }
  .photo-hint { font-size: 13px; color: #888; line-height: 1.45; max-width: 280px; }

  .field-label { font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; display: block; }
  .field {
    display: block; width: 100%; padding: 12px 16px; border-radius: 12px;
    border: 1.5px solid rgba(228,228,231,0.8); background: #fafafa;
    font-family: 'Inter', sans-serif; font-size: 15px; margin-bottom: 16px; box-sizing: border-box;
  }
  .field:disabled { color: #888; background: #f0f0f0; }
  .field:focus { outline: none; border-color: rgba(16,133,239,0.5); background: #fff; }

  .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 8px; }
  .save-btn {
    padding: 12px 24px; border-radius: 100px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #1085EF, #6366F1);
    color: #fff; font-size: 14px; font-weight: 600;
  }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .cancel-btn {
    padding: 12px 24px; border-radius: 100px; border: 1.5px solid rgba(228,228,231,0.8);
    background: #fff; color: #555; font-size: 14px; font-weight: 600;
    text-decoration: none; cursor: pointer;
  }
  .msg-err { font-size: 13px; color: #e53e3e; margin-top: 8px; }
</style>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<div class="page">
  <div class="container">
    <a href="/account" class="back">← Back to profile</a>

    {#if verifying}
      <p style="color:#888;font-size:16px;">Loading…</p>
    {:else if $currentUser}
      <h1>Edit profile</h1>
      <p class="subtitle">Update your photo and display name.</p>

      <div class="card">
        <div class="card-title">Profile</div>

        <div class="avatar-block">
          <div class="avatar">
            {#if showPreview}
              <img src={previewUrl} alt="" on:error={() => (avatarImgError = true)} />
            {:else}
              {initial}
            {/if}
          </div>
          <div class="avatar-actions">
            <input
              bind:this={fileInput}
              class="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              on:change={onAvatarSelected}
            />
            <button
              type="button"
              class="photo-btn"
              disabled={uploadingAvatar || saving}
              on:click={() => fileInput?.click()}
            >
              {uploadingAvatar ? 'Processing…' : 'Upload photo'}
            </button>
            {#if previewUrl}
              <button type="button" class="remove-btn" disabled={saving} on:click={removeAvatar}>
                Remove photo
              </button>
            {/if}
            <p class="photo-hint">JPG, PNG, WebP or GIF · max 5 MB. Photo is saved when you tap Save changes.</p>
          </div>
        </div>

        <label class="field-label" for="email">Email</label>
        <input id="email" class="field" type="email" value={$currentUser.email} disabled />

        <label class="field-label" for="display-name">Display name</label>
        <input id="display-name" class="field" type="text" bind:value={displayName} placeholder="Your name" />

        {#if saveError}<p class="msg-err">{saveError}</p>{/if}

        <div class="actions">
          <button class="save-btn" type="button" disabled={saving || uploadingAvatar} on:click={saveProfile}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <a href="/account" class="cancel-btn">Cancel</a>
        </div>
      </div>
    {/if}
  </div>
</div>
