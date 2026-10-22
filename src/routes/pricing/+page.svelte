<script>
  import { onMount } from 'svelte';
  import { auth, currentUser } from '$lib/stores/auth.js';
  import AccountShell from '$lib/components/site/AccountShell.svelte';
  import { catalogView, newIdempotencyKey, savePendingPurchase, trustedHostedUrl, walletView } from '$lib/billing/client.js';
  import { billingRequest, openBillingPortal } from '$lib/billing/request.js';
  import { browserStorage } from '$lib/analytics/consent.js';

  // Teams is sold by hand: custom price and credits, no self-serve checkout.
  const TEAMS_CONTACT = 'mailto:clarence@nalana.io?subject=' + encodeURIComponent('Nalana Teams plan');

  let state = 'checking';
  let view = catalogView(null);
  let wallet = null;
  let error = '';
  /** @type {string|null} */
  let busyKey = null;
  let mounted = false;
  // One intent key per product per visit, so a retried click reuses the same
  // backend purchase instead of minting a second checkout.
  /** @type {Record<string, string>} */
  const intentKeys = {};

  async function load() {
    error = '';
    if (!auth.current.token) { state = 'signed-out'; return; }
    state = 'loading';
    const ok = await auth.refreshSession();
    if (!mounted) return;
    if (!ok || !auth.current.token) { state = 'signed-out'; return; }
    const [catalog, balance] = await Promise.all([
      billingRequest('/api/billing/catalog'),
      billingRequest('/api/credits/balance'),
    ]);
    if (!mounted) return;
    if (catalog.status === 401) { state = 'signed-out'; return; }
    wallet = balance.ok ? walletView(balance.data) : null;
    if (!catalog.ok) { error = catalog.data?.error ?? 'Plans are unavailable right now.'; state = 'error'; return; }
    view = catalogView(catalog.data);
    state = view.enabled ? 'ready' : 'unavailable';
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
  $: featured = view.subscriptions.length > 1 ? view.subscriptions[view.subscriptions.length - 1].product_key : null;
</script>

<svelte:head>
  <title>Pricing — Nalana</title>
  <meta name="description" content="Nalana plans and credits." />
</svelte:head>

<AccountShell wide>
  <header class="pricing-head">
    <h1>Pricing</h1>
    <p>Credits power Nalana's AI features. Subscribe for a monthly allowance; checkout is handled securely by Stripe.</p>
  </header>

  {#if state === 'checking' || state === 'loading'}
    <div class="acct-card return-card" role="status">Loading plans…</div>
  {:else if state === 'signed-out'}
    <section class="acct-card return-card">
      <h1>Sign in to see plans</h1>
      <p>Plans and checkout are tied to your Nalana account, so your credits land in the same wallet the app uses.</p>
      <div class="return-actions">
        <a class="acct-primary" href="/login?next=%2Fpricing">Sign in or create an account</a>
      </div>
    </section>
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
    <p class="fine-print">Prices in USD. Subscriptions renew monthly until canceled. See the <a href="/refund">refund policy</a> and <a href="/terms">terms</a>.</p>
  {/if}
</AccountShell>
