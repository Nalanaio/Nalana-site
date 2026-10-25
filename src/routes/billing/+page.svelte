<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth, currentUser } from '$lib/stores/auth.js';
  import AccountShell from '$lib/components/site/AccountShell.svelte';
  import WalletCard from '$lib/components/site/WalletCard.svelte';
  import { clearPendingPurchase, pollPurchase, readPendingPurchase, returnKind } from '$lib/billing/client.js';
  import { billingRequest } from '$lib/billing/request.js';
  import { browserStorage } from '$lib/analytics/consent.js';

  // Stripe return target for ?billing=success|cancel|portal. This page only
  // reads purchase status; the backend grants credits from verified webhooks.
  let kind = returnKind($page.url.searchParams.get('billing'));
  /** checking | signed-out | polling | granted | attention | slow | untracked | not_found | cancel | portal */
  let state = 'checking';
  let mounted = false;
  let pollRun = 0;

  async function confirmPurchase() {
    const storage = browserStorage(window);
    const pending = readPendingPurchase(storage, $currentUser?.id);
    if (!pending) { state = 'untracked'; return; }
    const run = ++pollRun;
    state = 'polling';
    const outcome = await pollPurchase({
      read: () => billingRequest(`/api/billing/purchases/${pending.purchaseId}`),
      cancelled: () => !mounted || run !== pollRun,
    });
    if (outcome === 'cancelled') return;
    if (outcome === 'unauthorized') { state = 'signed-out'; return; }
    // Keep a reconciliation case so a reload still shows the support message.
    if (outcome === 'granted' || outcome === 'not_found') clearPendingPurchase(storage);
    state = outcome === 'pending' ? 'slow' : outcome;
  }

  onMount(() => {
    mounted = true;
    void (async () => {
      if (!kind) { goto('/account', { replaceState: true }); return; }
      if (kind === 'cancel') clearPendingPurchase(browserStorage(window));
      if (!auth.current.token) { state = kind === 'cancel' ? 'cancel' : 'signed-out'; return; }
      const ok = await auth.refreshSession();
      if (!mounted) return;
      if (!ok || !auth.current.token) { state = kind === 'cancel' ? 'cancel' : 'signed-out'; return; }
      if (kind === 'success') await confirmPurchase();
      else state = kind;
    })();
    return () => { mounted = false; };
  });

  $: loginHref = `/login?next=${encodeURIComponent(`/billing?billing=${kind ?? 'success'}`)}`;
</script>

<svelte:head><title>Billing — Nalana</title></svelte:head>

<AccountShell profile>
  {#if state === 'checking'}
    <div class="acct-card return-card" role="status">Loading…</div>
  {:else if state === 'signed-out'}
    <section class="acct-card return-card">
      <h1>Sign in to finish up</h1>
      <p>Sign in with the account you used at checkout to see your credits.</p>
      <a class="acct-primary" href={loginHref}>Sign in</a>
    </section>
  {:else if state === 'polling'}
    <section class="acct-card return-card" role="status" aria-live="polite">
      <h1>Confirming your payment…</h1>
      <p>Stripe is confirming the payment with Nalana. This usually takes a few seconds; you can leave this page and your credits will still arrive.</p>
    </section>
  {:else if state === 'granted'}
    <section class="acct-card return-card" role="status">
      <h1>You're all set</h1>
      <p>Your payment is confirmed and the credits are in your wallet. They're ready to use in Nalana.</p>
      <div class="return-actions"><a class="acct-primary" href="/account">Go to account</a></div>
    </section>
    <WalletCard />
  {:else if state === 'slow'}
    <section class="acct-card return-card" role="status">
      <h1>Payment still processing</h1>
      <p>Stripe hasn't confirmed this payment yet. Credits are added automatically as soon as it does, so there's nothing else you need to do.</p>
      <div class="return-actions">
        <button class="acct-primary" type="button" on:click={confirmPurchase}>Check again</button>
        <a class="secondary-button" href="/account">Go to account</a>
      </div>
    </section>
  {:else if state === 'attention'}
    <section class="acct-card return-card" role="alert">
      <h1>We're checking this payment</h1>
      <p>Your payment reached us but needs a manual review before the credits are added. Email <a href="mailto:clarence@nalana.io">clarence@nalana.io</a> and we'll sort it out.</p>
      <a class="secondary-button" href="/account">Go to account</a>
    </section>
  {:else if state === 'untracked' || state === 'not_found'}
    <section class="acct-card return-card" role="status">
      <h1>Thanks for your purchase</h1>
      <p>Credits are added once Stripe confirms the payment, usually within a minute. Your wallet below updates when they arrive.</p>
    </section>
    <WalletCard />
  {:else if state === 'cancel'}
    <section class="acct-card return-card" role="status">
      <h1>Checkout canceled</h1>
      <p>No payment was taken. You can pick a plan whenever you're ready.</p>
      <div class="return-actions">
        <a class="acct-primary" href="/pricing">Back to pricing</a>
        <a class="secondary-button" href="/account">Go to account</a>
      </div>
    </section>
  {:else if state === 'portal'}
    <WalletCard notice="Billing changes from the portal can take a moment to show here." />
    <a class="secondary-button" href="/account">Go to account</a>
  {/if}
</AccountShell>
