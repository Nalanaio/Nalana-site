<script>
  import { isLoggedIn } from '#lib/stores/auth.js';
</script>
<header class="nav">
  <a class="nav-logo" href="/" aria-label="Nalana home"><img src="/assets/site/figma-logo-nav.svg" width="39" height="39" alt="Nalana" /></a>
  <nav class="nav-links" aria-label="Primary">
    <a class="nav-link" href="/#workflow" style="--x:34.72%">Workflow</a>
    <a class="nav-link" href="/#vision" style="--x:46.27%">Features</a>
    <a class="nav-link" href="/pricing" style="--x:57.82%">Pricing</a>
  </nav>
  {#if $isLoggedIn}<a class="btn btn-sm nav-cta" data-sveltekit-reload href="/account">Account</a>
  {:else}<a class="btn btn-sm nav-cta" data-sveltekit-reload href="/login?mode=signup" data-cta-id="header_signup" data-cta-location="header" data-auth-intent="signup">Sign Up</a>{/if}
</header>
