<script>
  import { onMount, tick } from 'svelte';
  import { readChoice, writeChoice, sanitizedLocation, browserStorage, permissionsRevoked } from '#lib/analytics/consent.js';
  export let onChoice = (_choice) => {};
  export let autoPrompt = false;
  let choice = { version: 1, usage: false, identification: false, decided: false };
  let open = false;
  let expanded = false;
  let detailsHeading;
  let customizeButton;
  let opener;
  let committed = { ...choice };
  onMount(() => {
    choice = readChoice(browserStorage(window)); committed = { ...choice }; open = autoPrompt && !choice.decided; onChoice(choice);
    const show = (event) => {
      opener = event.detail?.opener || document.activeElement;
      choice = { ...committed };
      open = true;
      void customize();
    }; window.addEventListener('nalana:privacy-settings', show);
    const otherTab = (event) => { if (event.key === 'nalana_privacy_v1') { const old = committed; choice = readChoice(browserStorage(window)); committed = { ...choice }; onChoice(choice); if (permissionsRevoked(old, choice)) window.location.replace(sanitizedLocation(window.location.href)); } };
    window.addEventListener('storage', otherTab);
    return () => { window.removeEventListener('nalana:privacy-settings', show); window.removeEventListener('storage', otherTab); };
  });
  function save(deny = false) {
    const previous = committed;
    choice = writeChoice(browserStorage(window), { ...choice, usage: deny ? false : choice.usage, identification: deny ? false : choice.identification, decided: true });
    committed = { ...choice }; onChoice(choice); open = false;
    opener?.focus();
    if (permissionsRevoked(previous, choice)) window.location.replace(sanitizedLocation(window.location.href));
  }
  function allowAnalytics() {
    choice = { ...choice, usage: true, identification: false };
    save();
  }
  async function customize() {
    expanded = true;
    await tick();
    detailsHeading?.focus();
  }
  async function cancel() {
    choice = { ...committed };
    expanded = false;
    if (committed.decided) { open = false; opener?.focus(); }
    else { await tick(); customizeButton?.focus(); }
  }
</script>
{#if open}
  <aside class="privacy-choice" aria-label="Privacy choices">
    {#if expanded}
      <div class="privacy-heading">
        <h2 tabindex="-1" bind:this={detailsHeading}>Your privacy choices</h2>
        <button type="button" class="text-button" on:click={cancel}>{committed.decided ? 'Cancel' : 'Back'}</button>
      </div>
      <p>Downloads and your account work with optional tracking turned off. We keep daily campaign totals without visitor identities.</p>
      <label><input type="checkbox" bind:checked={choice.usage}> Allow usage analytics and optional website/app funnel linking</label>
      <label><input type="checkbox" bind:checked={choice.identification}> Allow visitor identification by RB2B</label>
      <p>App usage needs its own permission. Linking a download to the app is an additional, optional action. <a href="/privacy">Privacy details</a></p>
      <div class="privacy-actions">
        <button type="button" on:click={() => save(true)}>Decline optional tracking</button>
        <button type="button" on:click={() => save()}>Save choices</button>
      </div>
    {:else}
      <p>Allow optional analytics and website/app activity linking? <a href="/privacy">Privacy</a></p>
      <div class="privacy-actions">
        <button type="button" on:click={allowAnalytics}>Allow analytics</button>
        <button type="button" on:click={() => save(true)}>Decline</button>
        <button type="button" class="text-button" bind:this={customizeButton} on:click={customize}>Customize</button>
      </div>
    {/if}
  </aside>
{/if}
<style>
  .privacy-choice {
    position: fixed;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 16px;
    right: 16px;
    max-width: 448px;
    max-height: calc(100dvh - 32px - env(safe-area-inset-bottom));
    overflow-y: auto;
    z-index: 10000;
    background: #fff;
    color: var(--ink, #1a1a1a);
    box-shadow: 0 4px 16px #0002;
    border: 1px solid #d8dfe7;
    border-radius: 12px;
    padding: 16px;
    font: 14px/1.5 system-ui;
  }
  .privacy-choice p { margin: 0; }
  .privacy-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .privacy-choice h2 { font-size: 18px; margin: 0; }
  .privacy-choice label { display: flex; gap: 10px; margin: 16px 0; align-items: flex-start; cursor: pointer; }
  .privacy-choice input { margin-top: 4px; flex-shrink: 0; }
  .privacy-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .privacy-choice button {
    background: #edf2f7;
    color: inherit;
    border: 1px solid #bdcadb;
    border-radius: 8px;
    min-height: 44px;
    padding: 8px 12px;
    font: inherit;
    cursor: pointer;
  }
  .privacy-choice .text-button { background: transparent; border-color: transparent; text-decoration: underline; text-underline-offset: 3px; }
  .privacy-choice a { color: #1266b4; text-underline-offset: 3px; }
  .privacy-choice :is(button, input, a, h2):focus-visible { outline: 2px solid #1266b4; outline-offset: 3px; }
  @media (max-width: 380px) {
    .privacy-choice { left: 8px; right: 8px; padding: 12px; }
    .privacy-actions { gap: 4px; }
    .privacy-choice button { padding-inline: 8px; }
  }
</style>
