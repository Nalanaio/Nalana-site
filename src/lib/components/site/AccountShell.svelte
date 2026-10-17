<script>
  import AccountVisuals from './AccountVisuals.svelte';
  import '$lib/styles/account.css';
  export let profile = false;
</script>

<div class="grace-account-page">
  <AccountVisuals />
  <header class="account-nav">
    <a class="account-logo" href="/" aria-label="Nalana home">
      <img src="/assets/site/logo.svg" width="30" height="36" alt="Nalana" />
    </a>
    <a class="account-home" href="/">Home</a>
  </header>
  <main class="acct-main" class:profile>
    <slot />
  </main>
</div>
