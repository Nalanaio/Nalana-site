/**
 * Billing view helpers. Credits are decimal strings on the wire and are never
 * parsed into floats for display. Nothing here grants or computes a balance:
 * the backend ledger is the only source of truth.
 */

export const PENDING_PURCHASE_KEY = 'nalana_billing_pending_v1';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const CREDITS = /^(0|[1-9][0-9]{0,15})(?:\.([0-9]{1,6}))?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @param {unknown} value @returns {string|null} "2,000" or "12.5" */
export function formatCredits(value) {
  if (typeof value !== 'string') return null;
  const match = CREDITS.exec(value.trim());
  if (!match) return null;
  const whole = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (match[2] ?? '').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/** @param {unknown} minor @param {unknown} currency */
export function formatPrice(minor, currency = 'USD') {
  if (!Number.isSafeInteger(minor) || /** @type {number} */ (minor) < 0) return null;
  const code = typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'USD';
  const amount = /** @type {number} */ (minor) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch { return null; }
}

/** Display ratio only; never used for money or credit math. */
function creditsPerMinor(product) {
  const credits = Number(product.credits_decimal);
  return Number.isFinite(credits) && product.price_minor > 0 ? credits / product.price_minor : 0;
}

/**
 * Validates the catalog response into renderable plans. Malformed products are
 * dropped rather than shown with guessed prices.
 * @param {unknown} catalog
 */
export function catalogView(catalog) {
  const data = /** @type {any} */ (catalog);
  if (!data || typeof data !== 'object' || data.checkout_enabled !== true || !Array.isArray(data.products)) {
    return { enabled: false, subscriptions: [], topUps: [] };
  }
  const products = data.products.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const price = formatPrice(entry.price_minor, entry.currency);
    const credits = formatCredits(entry.credits_decimal);
    if (!price || !credits || typeof entry.product_key !== 'string' || !['subscription', 'top_up'].includes(entry.purchase_kind)) return [];
    const name = typeof entry.display_name === 'string' && entry.display_name.trim() ? entry.display_name.trim() : entry.product_key;
    return [{ ...entry, name, price, credits, bonus: null }];
  });
  const subscriptions = products.filter((p) => p.purchase_kind === 'subscription').sort((a, b) => a.price_minor - b.price_minor);
  const topUps = products.filter((p) => p.purchase_kind === 'top_up').sort((a, b) => a.price_minor - b.price_minor);
  const base = subscriptions.length ? creditsPerMinor(subscriptions[0]) : 0;
  for (const plan of subscriptions.slice(1)) {
    const ratio = base ? creditsPerMinor(plan) / base : 0;
    // Only advertise a real, visible improvement, rounded down to two places.
    if (ratio >= 1.01) plan.bonus = `${(Math.floor(ratio * 100) / 100).toString()}× credits per dollar`;
  }
  return { enabled: products.length > 0, subscriptions, topUps };
}

/** @param {unknown} balance */
export function walletView(balance, now = Date.now()) {
  const data = /** @type {any} */ (balance);
  if (!data || typeof data !== 'object') return null;
  const subscription = formatCredits(data.subscription_available);
  const topUp = formatCredits(data.top_up_available);
  if (subscription === null || topUp === null) return null;
  const total = formatCredits(data.available_to_start) ?? formatCredits(data.unspent_total);
  const end = typeof data.cycle_end === 'string' ? new Date(data.cycle_end) : null;
  const cycleEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  return {
    subscription, topUp, total,
    cycleEnd,
    // A subscription grant whose period has not ended. Inferred from the ledger,
    // not from Stripe; the portal remains the authority on subscription state.
    activeCycle: Boolean(cycleEnd && cycleEnd.getTime() > now),
    enforced: data.billing_mode === 'enforced',
  };
}

/** @param {string|null} kind */
export function returnKind(kind) {
  return kind === 'success' || kind === 'cancel' || kind === 'portal' ? kind : null;
}

/** @param {unknown} status */
export function purchaseOutcome(status) {
  if (status === 'granted') return 'granted';
  if (status === 'needs_reconciliation') return 'attention';
  if (status === 'pending_checkout' || status === 'awaiting_payment') return 'pending';
  return 'unknown';
}

/** @param {unknown} url @param {string} hostname */
export function trustedHostedUrl(url, hostname) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === hostname && !parsed.port && !parsed.username && !parsed.password && !parsed.hash;
  } catch { return false; }
}

export function newIdempotencyKey(cryptoImpl = globalThis.crypto) {
  return `web-${cryptoImpl.randomUUID()}`;
}

/**
 * The backend success URL is static, so this tab remembers which purchase it
 * started. Scoped to the signed-in user so another account never polls it.
 * @param {Pick<Storage, 'getItem'|'setItem'|'removeItem'>|undefined} storage
 * @param {{ purchaseId: string, userId?: string|null, productKey?: string|null }} pending
 */
export function savePendingPurchase(storage, { purchaseId, userId, productKey }, now = Date.now()) {
  if (!UUID.test(purchaseId ?? '')) return;
  try { storage?.setItem(PENDING_PURCHASE_KEY, JSON.stringify({ purchaseId, userId: userId ?? null, productKey: productKey ?? null, at: now })); } catch { /* storage blocked */ }
}

export function readPendingPurchase(storage, userId, now = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem(PENDING_PURCHASE_KEY) || 'null');
    if (!value || !UUID.test(value.purchaseId ?? '') || !Number.isFinite(value.at)) return null;
    if (now - value.at > PENDING_TTL_MS || (value.userId ?? null) !== (userId ?? null)) return null;
    return { purchaseId: value.purchaseId, productKey: typeof value.productKey === 'string' ? value.productKey : null };
  } catch { return null; }
}

export function clearPendingPurchase(storage) {
  try { storage?.removeItem(PENDING_PURCHASE_KEY); } catch { /* storage blocked */ }
}

/** Poll delays in ms: quick at first (webhooks usually land in seconds), then back off. */
export const POLL_DELAYS = [1000, 1500, 2000, 3000, 3000, 5000, 5000, 8000, 8000, 10000, 10000, 15000, 15000];

/**
 * Polls a purchase until a terminal outcome or the schedule runs out.
 * @param {{ read: () => Promise<{ok: boolean, status: number, data: any}>, sleep?: (ms: number) => Promise<void>, delays?: number[], cancelled?: () => boolean, onTick?: (outcome: string) => void }} options
 * @returns {Promise<'granted'|'attention'|'pending'|'not_found'|'unauthorized'|'cancelled'>}
 */
export async function pollPurchase({ read, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), delays = POLL_DELAYS, cancelled = () => false, onTick }) {
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (cancelled()) return 'cancelled';
    let result = null;
    try { result = await read(); } catch { result = null; }
    if (cancelled()) return 'cancelled';
    if (result?.status === 404) return 'not_found';
    if (result?.status === 401) return 'unauthorized';
    if (result?.ok) {
      const outcome = purchaseOutcome(result.data?.status);
      onTick?.(outcome);
      if (outcome === 'granted' || outcome === 'attention') return outcome;
    }
    if (attempt < delays.length) await sleep(delays[attempt]);
  }
  return 'pending';
}
