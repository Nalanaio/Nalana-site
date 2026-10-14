<script>
  import { onMount } from 'svelte';
  import { readChoice, writeChoice, sanitizedLocation, browserStorage, permissionsRevoked } from '$lib/analytics/consent.js';
  export let onChoice = (_choice) => {};
  let choice = { version: 1, usage: false, identification: false, decided: false };
  let open = false;
  let committed = { ...choice };
  onMount(() => {
    choice = readChoice(browserStorage(window)); committed = { ...choice }; open = !choice.decided; onChoice(choice);
    const show = () => { open = true; }; window.addEventListener('nalana:privacy-settings', show);
    const otherTab = (event) => { if (event.key === 'nalana_privacy_v1') { const old = committed; choice = readChoice(browserStorage(window)); committed = { ...choice }; onChoice(choice); if (permissionsRevoked(old, choice)) window.location.replace(sanitizedLocation(window.location.href)); } };
    window.addEventListener('storage', otherTab);
    return () => { window.removeEventListener('nalana:privacy-settings', show); window.removeEventListener('storage', otherTab); };
  });
  function save(deny = false) {
    const previous = committed;
    choice = writeChoice(browserStorage(window), { ...choice, usage: deny ? false : choice.usage, identification: deny ? false : choice.identification, decided: true });
    committed = { ...choice }; onChoice(choice); open = false;
    if (permissionsRevoked(previous, choice)) window.location.replace(sanitizedLocation(window.location.href));
  }
</script>
<button class="privacy-settings" on:click={() => open = true}>Privacy choices</button>
{#if open}
  <aside class="privacy-choice" aria-label="Privacy choices">
    <h2>Your privacy choices</h2>
    <p>Downloads and your account work with optional tracking turned off.</p>
    <label><input type="checkbox" bind:checked={choice.usage}> Allow usage analytics and optional website/app funnel linking</label>
    <label><input type="checkbox" bind:checked={choice.identification}> Allow visitor identification by RB2B</label>
    <p>App usage needs its own permission. Linking a download to the app is an additional, optional action. <a href="/privacy">Privacy details</a></p>
    <div><button on:click={() => save(true)}>Decline optional tracking</button><button on:click={() => save()}>Save choices</button></div>
  </aside>
{/if}
<style>
  .privacy-settings{position:fixed;bottom:10px;left:10px;z-index:900;background:#fff;color:#253248;border:1px solid #b4bdc9;border-radius:8px;padding:8px;cursor:pointer;font:12px system-ui}
  .privacy-choice{position:fixed;bottom:48px;left:16px;right:16px;max-width:500px;z-index:10000;background:#fff;color:#172237;box-shadow:0 4px 32px #0004;border:1px solid #cbd5e1;border-radius:16px;padding:24px;font:14px/1.5 system-ui}.privacy-choice h2{font-size:20px;margin-top:0}.privacy-choice label{display:flex;gap:10px;margin:16px 0;align-items:flex-start}.privacy-choice input{margin-top:4px}.privacy-choice button{background:#edf2f7;color:#172237;border:1px solid #bdcadb;border-radius:8px;padding:10px;cursor:pointer;margin:4px}.privacy-choice a{color:#1266b4}
</style>
