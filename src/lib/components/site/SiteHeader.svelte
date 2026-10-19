<script>
  import { isLoggedIn } from '$lib/stores/auth.js';
</script>
<header class="nav">
  <a class="nav-logo" href="/" aria-label="Nalana home"><img src="/assets/site/logo.svg" width="30" height="36" alt="Nalana" /></a>
  <nav class="nav-links" aria-label="Primary">
    <a class="nav-link" href="#workflow" style="--x:34.72%">Workflow</a>
    <a class="nav-link" href="#vision" style="--x:46.27%">Features</a>
    <a class="nav-link" href="#contact" style="--x:57.82%">Contact</a>
  </nav>
  {#if $isLoggedIn}<a class="btn btn-sm" data-sveltekit-reload href="/account">Account</a>
  {:else}<a class="header-login" data-sveltekit-reload href="/login">Log in</a><a class="btn btn-sm" data-sveltekit-reload href="/login?mode=signup">Sign Up</a>{/if}
</header>
