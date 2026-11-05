<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import * as env from '$app/env/public';
  import AuthModal from '#lib/components/AuthModal.svelte';
  import VerificationPrompt from '#lib/components/VerificationPrompt.svelte';
  import AnalyticsConsent from '#lib/components/AnalyticsConsent.svelte';
  import { auth } from '#lib/stores/auth.js';
  import { needsDocumentBoundary, sensitivePath, browserStorage } from '#lib/analytics/consent.js';
  import { loadAnalytics, trackPageView, trackCtaClick, trackScrollDepth, trackPageLeave } from '#lib/analytics/loaders.js';
  import { captureCampaign, campaignContext } from '#lib/analytics/attribution.js';
  import { createPosthogAnalytics } from '#lib/analytics/posthog.js';
  import { createScrollDepthTracker } from '#lib/analytics/scroll-depth.js';
  import { createVercelAnalytics } from '#lib/analytics/vercel.js';
  import { createFunnelSession } from '#lib/funnel/session.js';
  import { cleanAttribution } from '#lib/funnel/attribution.js';
  import { setActiveFunnel } from '#lib/funnel/permission.js';
  import { currentCampaign, enableCampaignTotals, decorateCampaignLink, observeCampaignNavigation } from '#lib/campaigns/browser.js';
  let funnel;
  let vercelAnalytics;
  let posthog;
  let scrollDepth;
  let choice;
  function updateChoice(value) {
    choice = value;
    if (window.location.pathname === '/signup-complete') return;
    if (!funnel) return;
    if (value.usage && env.PUBLIC_NALANA_FUNNEL_ENABLED === 'true') void funnel.grant(); else void funnel.revoke();
    loadAnalytics({ document, window, choice: value, pathname: window.location.pathname, enabled: env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true', posthog });
    void vercelAnalytics?.update({ choice: value, enabled: env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true' });
  }
  beforeNavigate(({ from, to, cancel, type }) => {
    if (from && to && !to.route.id?.startsWith('/api') && needsDocumentBoundary(from.url.href, to.url.href)) { cancel(); window.location.assign(to.url.href); return; }
    // An in-app navigation replaces the page without unloading the document, so the
    // SDK would never report it. Leaving the site is reported by the SDK on pagehide.
    if (from && to && type !== 'leave') trackPageLeave({ window, to });
  });
  afterNavigate((navigation) => {
    const { to } = navigation;
    if (env.PUBLIC_CAMPAIGN_TOTALS_ENABLED === 'true') enableCampaignTotals(window, env.PUBLIC_CAMPAIGN_ALLOWED_LABELS);
    observeCampaignNavigation(window, navigation);
    if (env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true') captureCampaign(window);
    scrollDepth?.reset();
    if (choice && to && to.url.pathname !== '/signup-complete') trackPageView({ window, choice, pathname: to.url.pathname, enabled: env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true' });
  });
  onMount(() => {
    if (env.PUBLIC_CAMPAIGN_TOTALS_ENABLED === 'true') { enableCampaignTotals(window, env.PUBLIC_CAMPAIGN_ALLOWED_LABELS); currentCampaign(window); }
    const carryCampaign = event => decorateCampaignLink(event.target?.closest?.('a'), window);
    document.addEventListener('click', carryCampaign, true);
    document.addEventListener('auxclick', carryCampaign, true);
    vercelAnalytics = createVercelAnalytics({ window });
    // Loaded only after the visitor allows usage analytics (see loadAnalytics).
    posthog = createPosthogAnalytics({
      window,
      key: env.PUBLIC_NALANA_POSTHOG_KEY || undefined,
      host: env.PUBLIC_NALANA_POSTHOG_HOST || undefined,
      labels: () => campaignContext(window, { usage: true })
    });
    scrollDepth = createScrollDepthTracker({ window, document, report: depth => trackScrollDepth({ window, depth }) });
    const reportCta = event => { const element = event.target?.closest?.('[data-cta-id]'); if (element) trackCtaClick({ window, element }); };
    const reportScroll = () => scrollDepth.check();
    document.addEventListener('click', reportCta, true);
    window.addEventListener('scroll', reportScroll, { passive: true });
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nalana-usage-v1') : null;
    funnel = createFunnelSession({ storage: browserStorage(window), broadcast: message => channel?.postMessage(message), attribution: () => cleanAttribution(new URLSearchParams(window.location.search)) });
    setActiveFunnel(funnel);
    if (channel) channel.onmessage = event => funnel.remoteChanged(event.data);
    const unsubscribe = auth.subscribe(session => {
      void funnel.authChanged(session.user?.id ? `${session.user.id}:${session.sessionEpoch}` : null, session.token, session.user?.id ?? null);
      // Join this browser to the account's internal id (never email or name) once consent allows it.
      void posthog?.syncAccount(session.user?.id ?? null);
    });
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
    return () => { document.removeEventListener('click', carryCampaign, true); document.removeEventListener('auxclick', carryCampaign, true); document.removeEventListener('click', reportCta, true); window.removeEventListener('scroll', reportScroll); unsubscribe(); clearInterval(interval); window.removeEventListener('online', flush); window.removeEventListener('focus', flush); window.removeEventListener('storage', accountStorage); channel?.close(); setActiveFunnel(null); };
  });
</script>

<svelte:head>
  <meta name="referrer" content={sensitivePath(page.url.pathname) ? 'no-referrer' : 'strict-origin'}>
</svelte:head>

<!-- Auth modal overlay — available on every page -->
{#if page.url.pathname !== '/signup-complete'}
  <AuthModal />
  <VerificationPrompt />
{/if}

<slot />
{#if page.url.pathname !== '/signup-complete'}
<AnalyticsConsent
  onChoice={updateChoice}
  autoPrompt={env.PUBLIC_NALANA_FUNNEL_ENABLED === 'true' || env.PUBLIC_NALANA_VENDOR_ANALYTICS_ENABLED === 'true'}
/>
{/if}
