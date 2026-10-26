<script>
  import { onMount } from 'svelte';
  import { auth } from '#lib/stores/auth.js';
  import { walletView } from '#lib/billing/client.js';
  import { billingRequest, openBillingPortal } from '#lib/billing/request.js';

  /** Shown above the wallet, e.g. after a return from Stripe. */
  export let notice = '';

  let state = 'loading';
  /** @type {ReturnType<typeof walletView>} */
  let wallet = null;
  let portalBusy = false;
  let portalError = '';
  let mounted = false;

  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  export async function refresh() {
    const epoch = auth.current.sessionEpoch;
    state = 'loading';
    const result = await billingRequest('/api/credits/balance');
    if (!mounted || auth.current.sessionEpoch !== epoch) return;
    wallet = result.ok ? walletView(result.data) : null;
    state = wallet ? 'ready' : 'error';
  }

  async function manage() {
    portalBusy = true;
    portalError = '';
    portalError = (await openBillingPortal()) ?? '';
    // Success navigates away; only a failure re-enables the button.
    if (portalError) portalBusy = false;
  }

  onMount(() => {
    mounted = true;
    void refresh();
    return () => { mounted = false; };
  });
</script>

<section class="acct-card wallet-card" aria-labelledby="wallet-label" aria-busy={state === 'loading'}>
  <p class="acct-label" id="wallet-label">WALLET</p>
  {#if notice}<p class="banner-ok" role="status">{notice}</p>{/if}
  {#if state === 'loading'}
    <p class="usage-status" role="status">Loading credit balance…</p>
  {:else if state === 'error' || !wallet}
    <p class="usage-status" role="status">Credit balance is unavailable right now.</p>
    <button class="secondary-button" type="button" on:click={refresh}>Try again</button>
  {:else}
    {#if wallet.total !== null}
      <p class="wallet-total"><strong class="credits">{wallet.total}</strong><span>credits available</span></p>
    {/if}
    <dl class="details">
      <div><dt>Subscription credits</dt><dd>{wallet.subscription}</dd></div>
      <div><dt>Top-up credits</dt><dd>{wallet.topUp}</dd></div>
      {#if wallet.free && wallet.free !== '0'}<div><dt>Free monthly credits</dt><dd>{wallet.free}</dd></div>{/if}
      {#if wallet.activeCycle && wallet.cycleEnd}
        <div><dt>Current cycle ends</dt><dd>{dateFormat.format(wallet.cycleEnd)}</dd></div>
      {/if}
    </dl>
    {#if wallet.needsVerification}
      <p class="plan-note" role="status">Verify your email to get your free monthly credits. <a href="/account#verify-email">Resend the link</a></p>
    {/if}
    {#if portalError}<p class="form-error" role="alert">{portalError}</p>{/if}
    <div class="wallet-actions">
      {#if wallet.activeCycle}
        <button class="acct-primary" type="button" on:click={manage} disabled={portalBusy}>{portalBusy ? 'Opening…' : 'Manage subscription'}</button>
        <a class="secondary-button" href="/pricing">See plans</a>
      {:else}
        <a class="acct-primary" href="/pricing">Get credits</a>
        <button class="secondary-button" type="button" on:click={manage} disabled={portalBusy}>{portalBusy ? 'Opening…' : 'Billing history'}</button>
      {/if}
    </div>
  {/if}
</section>
