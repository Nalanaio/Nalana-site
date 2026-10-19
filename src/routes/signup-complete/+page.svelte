<script>
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { auth } from '$lib/stores/auth.js';
  import { browserStorage, readChoice, CONSENT_KEY } from '$lib/analytics/consent.js';
  import { consumeSignupMeasurement, clearCampaign } from '$lib/analytics/attribution.js';
  import { loadAnalytics, trackSignup, stopAnalytics } from '$lib/analytics/loaders.js';

  onMount(() => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.location.replace('/login?created=1');
    };
    const pending = consumeSignupMeasurement(window);
    if (!pending || !auth.current.token || !auth.current.user || env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED !== 'true') { done(); return; }
    // A blocked tag must never hold up account creation. Never load vendors in
    // the credential document or render account data in this measurement page.
    const timer = setTimeout(done, 1200);
    const revoke = event => {
      if (event.key !== CONSENT_KEY && event.key !== null) return;
      if (readChoice(browserStorage(window)).usage) return;
      clearCampaign(window);
      // Drop queued commands if the tag is still loading, then leave this
      // document. No registration retry or duplicate marker is created.
      stopAnalytics({ window, document });
      done();
    };
    window.addEventListener('storage', revoke);
    try {
      loadAnalytics({ document, window, choice: { ...readChoice(browserStorage(window)), identification: false }, pathname: '/signup-complete', enabled: true });
      trackSignup({ window, done });
    } catch { done(); }
    return () => { clearTimeout(timer); window.removeEventListener('storage', revoke); };
  });
</script>

<svelte:head><title>Account created — Nalana</title><meta name="robots" content="noindex" /></svelte:head>
<main aria-live="polite">
  <h1>Account created</h1>
  <p>Opening your account…</p>
  <a href="/login?created=1">Continue</a>
</main>
<style>main { max-width: 32rem; margin: 15vh auto; padding: 24px; font-family: sans-serif; }</style>
