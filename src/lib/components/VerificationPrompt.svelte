<script>
  import { onMount, tick } from 'svelte';
  import { auth } from '#lib/stores/auth.js';
  import { verificationPhase } from '#lib/verification/policy.js';
  import { claimVerificationPrompt } from '#lib/verification/prompts.js';
  import VerificationRecovery from './VerificationRecovery.svelte';
  let mounted = false;
  let visible = false;
  let dialog;
  let closeButton;
  let previousFocus;
  let elapsed = 0;
  let receivedAt = 0;
  let observedPolicy;
  $: if ($auth.user?.verification !== observedPolicy) { observedPolicy = $auth.user?.verification; receivedAt = mounted ? performance.now() : 0; elapsed = 0; }
  $: phase = verificationPhase($auth.user?.verification, elapsed);
  $: if (mounted && $auth.token && claimVerificationPrompt($auth.sessionEpoch, phase)) open();
  $: if (!$auth.token || phase === 'verified') visible = false;
  async function open() { previousFocus = document.activeElement; visible = true; await tick(); closeButton?.focus(); }
  function close() { visible = false; previousFocus?.focus?.(); }
  function keydown(event) {
    if (!visible) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const nodes = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)')];
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  onMount(() => {
    mounted = true; receivedAt = performance.now();
    let lastCheck = 0;
    const timer = setInterval(() => {
      elapsed = Math.max(0, performance.now() - receivedAt);
      if (document.visibilityState === 'visible' && performance.now() - lastCheck >= 60000 && $auth.token) { lastCheck = performance.now(); auth.refreshSession(); }
    }, 1000);
    return () => clearInterval(timer);
  });
</script>
<svelte:window on:keydown={keydown} />
{#if visible}
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="verification-prompt-title" bind:this={dialog}>
      <button bind:this={closeButton} class="close" type="button" on:click={close} aria-label="Close verification reminder">×</button>
      <h2 id="verification-prompt-title">{phase === 'required' ? 'Verify to continue cloud work' : 'Verify your email'}</h2>
      <VerificationRecovery policy={$auth.user?.verification} />
      <button type="button" on:click={close}>Continue to my account</button>
    </div>
  </div>
{/if}
<style>
  .overlay { position: fixed; inset: 0; z-index: 3100; background: #0008; display: grid; place-items: center; padding: 24px; cursor: auto; }
  .dialog { position: relative; background: white; padding: 28px; border-radius: 20px; width: min(100%, 480px); max-height: 85vh; overflow: auto; color: #172b3d; }
  h2 { margin: 0 24px 20px 0; } button { font: inherit; padding: 8px 12px; cursor: pointer; } .close { position: absolute; right: 16px; top: 12px; }
</style>
