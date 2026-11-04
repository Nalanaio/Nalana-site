<script>
  import { onMount } from 'svelte';
  import { cookieRequest } from '#lib/auth/cookieClient.js';
  import { createGoogleCompletion } from '#lib/auth/googleCompletion.js';
  import { auth } from '#lib/stores/auth.js';
  import AccountShell from '#lib/components/site/AccountShell.svelte';
  let state = { phase: 'cancelling', error: '' }, completion;
  onMount(() => {
    completion = createGoogleCompletion({ request: cookieRequest, navigate: path => window.location.replace(path), epoch: () => auth.current.sessionEpoch, changed: next => state = next });
    void completion.goBack();
    return () => completion.dispose();
  });
</script>
<svelte:head><title>Going back — Nalana</title></svelte:head>
<AccountShell>
  <div class="acct-card signin-card">
    <div class="signin-head"><h1>Going back</h1><p role="status">Cancelling this Google sign-in safely before returning to sign-in.</p></div>
    {#if state.error}<p class="form-error" role="alert">{state.error}</p><button class="secondary-button" type="button" on:click={() => completion.goBack()}>Retry Go back</button>{/if}
  </div>
</AccountShell>
