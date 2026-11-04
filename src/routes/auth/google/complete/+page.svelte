<script>
  import { onMount } from 'svelte';
  import { cookieRequest } from '#lib/auth/cookieClient.js';
  import { createGoogleCompletion, takeGoogleReturn } from '#lib/auth/googleCompletion.js';
  import { auth } from '#lib/stores/auth.js';
  import AccountShell from '#lib/components/site/AccountShell.svelte';
  let state = { phase: 'idle', error: '', confirmationStarted: false };
  let completion;
  onMount(() => {
    completion = createGoogleCompletion({ request: cookieRequest, navigate: path => window.location.replace(path), epoch: () => auth.current.sessionEpoch, returned: takeGoogleReturn(window), changed: next => state = next });
    void completion.mount();
    return () => completion.dispose();
  });
</script>
<svelte:head><title>Signing in — Nalana</title></svelte:head>
<AccountShell>
  <div class="acct-card signin-card">
    <div class="signin-head"><h1>Signing you in</h1><p role="status" aria-live="polite">{state.phase === 'cancelling' ? 'Going back safely…' : state.error ? 'Your sign-in needs attention.' : state.confirmationStarted ? 'Confirming your saved sign-in…' : 'Saving your Google sign-in securely…'}</p></div>
    {#if state.error}<p class="form-error" role="alert">{state.error}</p>{/if}
    <div class="form-actions">
      {#if state.phase === 'retry'}<button class="acct-primary" type="button" on:click={() => completion.retry()}>{state.confirmationStarted ? 'Retry confirmation' : 'Retry sign-in'}</button>{/if}
      <button class="secondary-button" type="button" on:click={() => completion.goBack()} disabled={state.confirmationStarted || state.phase === 'idle' || state.phase === 'cancelling' || state.phase === 'done'}>Go back</button>
    </div>
  </div>
</AccountShell>
