<script>
  import { onMount } from 'svelte';
  import { auth, currentUser } from '#lib/stores/auth.js';
  import AccountShell from '#lib/components/site/AccountShell.svelte';
  import {
    STATIC_PLANS, catalogView, newIdempotencyKey, pricingResumePath, publicPlansView, savePendingPurchase,
    trustedHostedUrl, validProductKey, walletView,
  } from '#lib/billing/client.js';
  import { billingRequest, openBillingPortal } from '#lib/billing/request.js';
  import { browserStorage } from '#lib/analytics/consent.js';

  // Teams is sold by hand: custom price and credits, no self-serve checkout.
  const TEAMS_CONTACT = 'mailto:clarence@nalana.io?subject=' + encodeURIComponent('Nalana Teams plan');

  let state = 'checking';
  let view = catalogView(null);
  // Plan copy anyone can see; the live catalog drives checkout once signed in.
  let plans = publicPlansView(null);
  let wallet = null;
  let error = '';
  /** @type {string|null} */
  let busyKey = null;
  let mounted = false;
  // One intent key per product per visit, so a retried click reuses the same
  // backend purchase instead of minting a second checkout.
  /** @type {Record<string, string>} */
  const intentKeys = {};

  async function loadPublic() {
    try {
      const res = await fetch('/api/billing/public-catalog', { signal: AbortSignal.timeout(10000) });
      const data = res.ok ? await res.json() : null;
      if (mounted) plans = publicPlansView(data);
    } catch { /* static plan copy stays */ }
  }

  async function load() {
    error = '';
    const publicPlans = loadPublic();
    if (!auth.current.token) { await publicPlans; state = 'signed-out'; return; }
    state = 'loading';
    const ok = await auth.refreshSession();
    if (!mounted) return;
    if (!ok || !auth.current.token) { await publicPlans; state = 'signed-out'; return; }
    const [catalog, balance] = await Promise.all([
      billingRequest('/api/billing/catalog'),
      billingRequest('/api/credits/balance'),
      publicPlans,
    ]);
    if (!mounted) return;
    if (catalog.status === 401) { state = 'signed-out'; return; }
    wallet = balance.ok ? walletView(balance.data) : null;
    if (!catalog.ok) { error = catalog.data?.error ?? 'Plans are unavailable right now.'; state = 'error'; return; }
    view = catalogView(catalog.data);
    state = view.enabled ? 'ready' : 'unavailable';
    if (state === 'ready') resumeChosenPlan();
  }

  // A signed-out "Get Super" click comes back here as /pricing?plan=<key> after
  // sign-up or log-in: start that checkout once, then drop the parameter so a
  // back navigation from Stripe does not reopen it.
  function resumeChosenPlan() {
    const url = new URL(window.location.href);
    const key = url.searchParams.get('plan');
    if (!key) return;
    url.searchParams.delete('plan');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    const plan = validProductKey(key) ? [...view.subscriptions, ...view.topUps].find((p) => p.product_key === key) : null;
    if (plan && !(subscribed && plan.purchase_kind === 'subscription')) void buy(plan);
  }

  /** @param {string} productKey @param {'signup'|'login'} mode */
  function authPath(productKey, mode) {
    const next = encodeURIComponent(pricingResumePath(productKey));
    return mode === 'signup' ? `/login?mode=signup&next=${next}` : `/login?next=${next}`;
  }

  /** @param {{product_key: string, purchase_kind: string}} product */
  async function buy(product) {
    if (busyKey) return;
    busyKey = product.product_key;
    error = '';
    const key = intentKeys[product.product_key] ??= newIdempotencyKey();
    const result = await billingRequest('/api/billing/checkouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ product_key: product.product_key, purchase_kind: product.purchase_kind }),
    });
    if (result.ok && trustedHostedUrl(result.data?.url, 'checkout.stripe.com') && typeof result.data?.purchase_id === 'string') {
      savePendingPurchase(browserStorage(window), { purchaseId: result.data.purchase_id, userId: $currentUser?.id, productKey: product.product_key });
      window.location.assign(result.data.url);
      return;
    }
    if (result.data?.code === 'INTENT_CONFLICT') delete intentKeys[product.product_key];
    error = result.ok ? 'Checkout could not start. Please try again.' : (result.data?.error ?? 'Checkout could not start. Please try again.');
    busyKey = null;
  }

  async function manage() {
    busyKey = 'portal';
    error = (await openBillingPortal()) ?? '';
    if (error) busyKey = null;
  }

  onMount(() => {
    mounted = true;
    void load();
    return () => { mounted = false; };
  });

  $: subscribed = Boolean(wallet?.activeCycle);
  $: subscribedNotice = `You already have an active subscription${wallet?.cycleEnd ? ` through ${wallet.cycleEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}. Change or cancel it from the billing portal.`;
  $: featured = view.subscriptions.length ? view.subscriptions[view.subscriptions.length - 1].product_key : null;
  $: freeCredits = plans.freeMonthlyCredits;
</script>

<svelte:head>
  <title>Pricing — Nalana</title>
  <meta name="description" content="Nalana pricing: free credits every month, or 2,000 credits a month with Nalana Super for $20." />
</svelte:head>

<AccountShell wide>
  <header class="pricing-head">
    <h1>Pricing</h1>
    <p>Credits power Nalana's AI features. {freeCredits ? 'Every account gets free credits each month; subscribe' : 'Subscribe'} for a bigger monthly allowance. Checkout is handled securely by Stripe.</p>
  </header>

  {#if state === 'checking' || state === 'loading'}
    <div class="acct-card return-card" role="status">Loading plans…</div>
  {:else if state === 'signed-out'}
    <div class="plan-grid">
      {#if freeCredits}
        <section class="acct-card plan-option" aria-labelledby="plan-free">
          <p class="acct-label">FREE</p>
          <h2 id="plan-free">Free</h2>
          <p class="plan-price">$0</p>
          <p class="plan-credits">{freeCredits} credits every month</p>
          <p class="plan-note">Refills to {freeCredits} each month. No card needed.</p>
          <a class="acct-primary" href="/login?mode=signup">Create a free account</a>
        </section>
      {/if}
      {#each plans.subscriptions as plan (plan.product_key)}
        <section class="acct-card plan-option featured" aria-labelledby="plan-{plan.product_key}">
          <p class="acct-label">MONTHLY</p>
          <h2 id="plan-{plan.product_key}">{plan.name}</h2>
          <p class="plan-price">{plan.price}<span> / month</span></p>
          <p class="plan-credits">{plan.credits} credits every month</p>
          <p class="plan-note">{freeCredits ? 'On top of your free credits. ' : ''}Cancel anytime.</p>
          <a class="acct-primary" href={authPath(plan.product_key, 'signup')}>Get {plan.name}</a>
          <p class="plan-note">Have an account? <a href={authPath(plan.product_key, 'login')}>Log in to subscribe</a></p>
        </section>
      {/each}
      <section class="acct-card plan-option" aria-labelledby="plan-teams">
        <p class="acct-label">TEAMS</p>
        <h2 id="plan-teams">Teams</h2>
        <p class="plan-price">Custom</p>
        <p class="plan-credits">Credits sized to your team</p>
        <a class="acct-primary" href={TEAMS_CONTACT}>Contact us</a>
      </section>
    </div>
    <p class="fine-print">Prices in USD. Subscriptions renew monthly until canceled.{freeCredits ? ` Unused free credits roll over but never exceed ${freeCredits}.` : ''} See the <a href="/refund">refund policy</a> and <a href="/terms">terms</a>.</p>
  {:else if state === 'error'}
    <section class="acct-card return-card">
      <p class="form-error" role="alert">{error}</p>
      <button class="secondary-button" type="button" on:click={load}>Try again</button>
    </section>
  {:else if state === 'unavailable'}
    <section class="acct-card return-card">
      <h1>Plans are coming soon</h1>
      <p>Purchasing isn't open on this account yet. Your existing credits keep working as usual.</p>
      <a class="secondary-button" href="/account">Back to account</a>
    </section>
  {:else}
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    {#if subscribed}
      <p class="banner" role="status">
        {subscribedNotice}
      </p>
    {/if}
    {#if view.subscriptions.length}
      <div class="plan-grid">
        {#if freeCredits}
          <section class="acct-card plan-option" aria-labelledby="plan-free">
            <p class="acct-label">FREE</p>
            <h2 id="plan-free">Free</h2>
            <p class="plan-price">$0</p>
            <p class="plan-credits">{freeCredits} credits every month</p>
            <p class="plan-note">Included with your account and refilled each month.</p>
            {#if wallet?.needsVerification}<p class="plan-note">Verify your email to get these credits. <a href="/account">Resend the link</a></p>
            {:else if wallet?.free}<p class="plan-note">You have {wallet.free} free credits right now.</p>{/if}
          </section>
        {/if}
        {#each view.subscriptions as plan (plan.product_key)}
          <section class="acct-card plan-option" class:featured={plan.product_key === featured} aria-labelledby="plan-{plan.product_key}">
            <p class="acct-label">MONTHLY</p>
            <h2 id="plan-{plan.product_key}">{plan.name}</h2>
            <p class="plan-price">{plan.price}<span> / month</span></p>
            <p class="plan-credits">{plan.credits} credits every month</p>
            {#if plan.savingsPercent}<p class="plan-savings">Save {plan.savingsPercent}% per credit</p>{/if}
            {#if subscribed}
              <button class="acct-primary" type="button" on:click={manage} disabled={busyKey !== null}>{busyKey === 'portal' ? 'Opening…' : 'Manage subscription'}</button>
            {:else}
              <button class="acct-primary" type="button" on:click={() => buy(plan)} disabled={busyKey !== null}>
                {busyKey === plan.product_key ? 'Opening checkout…' : `Subscribe to ${plan.name}`}
              </button>
            {/if}
          </section>
        {/each}
        <section class="acct-card plan-option" aria-labelledby="plan-teams">
          <p class="acct-label">TEAMS</p>
          <h2 id="plan-teams">Teams</h2>
          <p class="plan-price">Custom</p>
          <p class="plan-credits">Credits sized to your team</p>
          <a class="acct-primary" href={TEAMS_CONTACT}>Contact us</a>
        </section>
      </div>
    {/if}
    {#if view.topUps.length}
      <p class="acct-label">CREDIT PACKS</p>
      <div class="plan-grid">
        {#each view.topUps as pack (pack.product_key)}
          <section class="acct-card plan-option" aria-labelledby="pack-{pack.product_key}">
            <h2 id="pack-{pack.product_key}">{pack.name}</h2>
            <p class="plan-price">{pack.price}</p>
            <p class="plan-credits">{pack.credits} credits</p>
            <button class="acct-primary" type="button" on:click={() => buy(pack)} disabled={busyKey !== null}>
              {busyKey === pack.product_key ? 'Opening checkout…' : 'Buy credits'}
            </button>
          </section>
        {/each}
      </div>
    {/if}
    <p class="fine-print">Prices in USD. Subscriptions renew monthly until canceled.{freeCredits ? ` Free credits refill monthly up to ${freeCredits}.` : ''} See the <a href="/refund">refund policy</a> and <a href="/terms">terms</a>.</p>
  {/if}
</AccountShell>
