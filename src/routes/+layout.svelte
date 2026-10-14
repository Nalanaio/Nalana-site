<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { env } from '$env/dynamic/public';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import VerificationPrompt from '$lib/components/VerificationPrompt.svelte';
  import AnalyticsConsent from '$lib/components/AnalyticsConsent.svelte';
  import { auth } from '$lib/stores/auth.js';
  import { needsDocumentBoundary, sensitivePath, browserStorage } from '$lib/analytics/consent.js';
  import { loadAnalytics, trackPageView } from '$lib/analytics/loaders.js';
  import { createFunnelSession } from '$lib/funnel/session.js';
  import { cleanAttribution } from '$lib/funnel/attribution.js';
  import { setActiveFunnel } from '$lib/funnel/permission.js';
  let funnel;
  let choice;
  function updateChoice(value) {
    choice = value;
    if (!funnel) return;
    if (value.usage && env.PUBLIC_NALANA_FUNNEL_ENABLED === 'true') void funnel.grant(); else void funnel.revoke();
    loadAnalytics({ document, window, choice: value, pathname: window.location.pathname, enabled: env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true' });
  }
  beforeNavigate(({ from, to, cancel }) => {
    if (from && to && !to.route.id?.startsWith('/api') && needsDocumentBoundary(from.url.href, to.url.href)) { cancel(); window.location.assign(to.url.href); }
  });
  afterNavigate(({ to }) => { if (choice && to) trackPageView({ window, choice, pathname: to.url.pathname, enabled: env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true' }); });
  onMount(() => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nalana-usage-v1') : null;
    funnel = createFunnelSession({ storage: browserStorage(window), broadcast: message => channel?.postMessage(message), attribution: () => cleanAttribution(new URLSearchParams(window.location.search)) });
    setActiveFunnel(funnel);
    if (channel) channel.onmessage = event => funnel.remoteChanged(event.data);
    const unsubscribe = auth.subscribe(session => { void funnel.authChanged(session.user?.id ? `${session.user.id}:${session.sessionEpoch}` : null, session.token, session.user?.id ?? null); });
    if (choice) updateChoice(choice);
    const interval = setInterval(() => { void funnel.refresh(); void funnel.queue.flush(); }, 60000);
    const flush = () => { void funnel.queue.flush(); };
    const accountStorage = event => {
      if (event.key === 'nalana_session_v1') {
        const identity = value => { try { const user = JSON.parse(value || 'null')?.user; return user ? `${user.id}:${user.email}` : null; } catch { return null; } };
        if (identity(event.oldValue) === identity(event.newValue)) return;
        funnel.remoteChanged({ kind: 'session-close' });
        // A separate document must use the latest account state before it can
        // resume an optional authenticated session or expose account controls.
        window.location.replace(window.location.pathname);
      }
    };
    window.addEventListener('online', flush); window.addEventListener('focus', flush);
    window.addEventListener('storage', accountStorage);
    return () => { unsubscribe(); clearInterval(interval); window.removeEventListener('online', flush); window.removeEventListener('focus', flush); window.removeEventListener('storage', accountStorage); channel?.close(); setActiveFunnel(null); };
  });
</script>

<svelte:head>
  <meta name="referrer" content={sensitivePath($page.url.pathname) ? 'no-referrer' : 'strict-origin'}>
</svelte:head>

<!-- Auth modal overlay — available on every page -->
<AuthModal />
<VerificationPrompt />

<slot />
<AnalyticsConsent
  onChoice={updateChoice}
  autoPrompt={env.PUBLIC_NALANA_FUNNEL_ENABLED === 'true' || env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true'}
/>
