import { sensitivePath } from './consent.js';

// Public ingestion key for PostHog project 669831. It is the same write-only key
// the Nalana app bundles in its publicProject.json, so it is not a secret.
// PUBLIC_NALANA_POSTHOG_KEY / PUBLIC_NALANA_POSTHOG_HOST may override both,
// for example to point a local build at a throwaway capture endpoint.
export const POSTHOG_KEY = 'phc_uYEEw5g9rqdCWTeV7GCCDvAFHE2Ssa4fGVfLFX3qEPXQ';
export const POSTHOG_HOST = 'https://us.i.posthog.com';

const MAX_QUEUED = 25;
// Everything PostHog stores in this origin starts with one of these prefixes.
const STORAGE_PREFIXES = ['ph_', '__ph_opt_in_out_'];
// Ad-click identifiers and campaign parameters that PostHog adds on its own.
// The site forwards only its own bounded campaign labels instead (see attribution.js).
const CAMPAIGN_KEY = /^(?:\$initial_)?(?:utm_|gclid|gad_|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|twclid|li_fat_id|mc_cid|igshid|ttclid|rdt_cid|epik|qclid|sccid|irclid|_kx)/i;
const REFERRER_KEYS = new Set(['$referrer', '$referring_domain', '$initial_referrer', '$initial_referring_domain']);
const URL_KEYS = ['$current_url', '$initial_current_url'];

/**
 * The backend keys its account events by the internal user UUID. Only that exact
 * form may become a PostHog distinct id, so an email, name or other identifier can
 * never be sent by mistake. Returns the canonical lowercase hyphenated UUID or null.
 */
export function accountDistinctId(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase().replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Account, recovery and operator routes (SENSITIVE_PATH) plus the API prefix never report.
const privatePath = pathname => sensitivePath(pathname) || pathname.startsWith('/api/');

function pathOf(url) {
  try { return new URL(url).pathname; } catch { return null; }
}

function withoutQuery(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function scrub(bag, drop) {
  if (!bag || typeof bag !== 'object') return bag;
  const copy = { ...bag };
  for (const key of Object.keys(copy)) if (drop(key)) delete copy[key];
  return copy;
}

/**
 * Final gate before anything leaves the browser. Mirrors the GA4 setup: no query
 * strings, fragments, referrers or ad-click IDs; sensitive routes are dropped;
 * only the site's own bounded campaign labels are attached.
 * @param {{ event?: string, properties?: Record<string, any>, $set?: object, $set_once?: object } | null} event
 * @param {{ window: { location: { pathname: string } }, labels?: () => Record<string, any> }} context
 */
export function sanitizeEvent(event, { window, labels = () => ({}) }) {
  if (!event || typeof event !== 'object' || privatePath(window.location.pathname)) return null;
  const drop = key => CAMPAIGN_KEY.test(key) || REFERRER_KEYS.has(key);
  const properties = scrub(event.properties, drop) ?? {};
  for (const key of URL_KEYS) {
    if (properties[key] === undefined) continue;
    const path = pathOf(properties[key]);
    if (path === null || privatePath(path)) return null;
    properties[key] = withoutQuery(properties[key]);
  }
  Object.assign(properties, labels(), { $geoip_disable: true });
  const result = { ...event, properties };
  if (event.$set) result.$set = scrub(event.$set, drop);
  if (event.$set_once) {
    result.$set_once = scrub(event.$set_once, drop);
    for (const key of URL_KEYS) if (typeof result.$set_once[key] === 'string') {
      try { result.$set_once[key] = withoutQuery(result.$set_once[key]); } catch { delete result.$set_once[key]; }
    }
  }
  return result;
}

/** SDK options for events only: no autocapture, replay, surveys, flags or external scripts. */
export function posthogConfig({ host, window, labels = undefined }) {
  return {
    api_host: host,
    persistence: 'localStorage',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    disable_conversations: true,
    disable_product_tours: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    advanced_disable_toolbar_metrics: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    save_campaign_params: false,
    save_referrer: false,
    person_profiles: 'identified_only',
    // Low volume; sending each event at once keeps $identify and $pageleave from
    // waiting in a queue while the document is being replaced.
    request_batching: false,
    before_send: event => sanitizeEvent(event, { window, labels })
  };
}

/**
 * One controller per document. posthog-js is imported dynamically and only after
 * the visitor has granted usage analytics, so declining (or never choosing) means
 * the SDK is never downloaded, run or given storage.
 * @param {{ window: any, load?: () => Promise<any>, key?: string, host?: string, labels?: () => Record<string, any> }} options
 */
export function createPosthogAnalytics({ window, load = () => import('posthog-js'), key = POSTHOG_KEY, host = POSTHOG_HOST, labels }) {
  let granted = false;
  let client;
  let sdk;
  let booting;
  let wanted; // undefined: unknown, null: signed out, string: account UUID
  let lastPageview;
  let queue = [];

  const permitted = (pathname = window.location.pathname) =>
    granted && Boolean(key) && typeof pathname === 'string' && !privatePath(pathname);

  function purge() {
    for (const kind of ['localStorage', 'sessionStorage']) {
      try {
        const storage = window[kind];
        for (const name of Object.keys(storage)) if (STORAGE_PREFIXES.some(prefix => name.startsWith(prefix))) storage.removeItem(name);
      } catch { /* Storage may be blocked; nothing was written then. */ }
    }
  }

  function stopClient() {
    queue = [];
    wanted = undefined;
    lastPageview = undefined;
    booting = undefined;
    if (!client) return;
    const stopping = client;
    client = undefined;
    // Order matters. The SDK reports $pageleave from its own pagehide handler, and
    // reset() (which also writes a fresh id and window id) clears the opt-out flag,
    // so the handler is switched off first and the opt-out is set last.
    for (const step of [
      sdk => sdk.set_config?.({ capture_pageleave: false }),
      sdk => sdk.reset?.(),
      sdk => sdk.opt_out_capturing?.()
    ]) {
      try { step(stopping); } catch { /* Best effort. */ }
    }
  }

  function applyIdentity() {
    if (!client || wanted === undefined) return false;
    try {
      const identified = client.get_property?.('$user_state') === 'identified';
      if (wanted === null) {
        // Signed out here or in a document where PostHog never loaded.
        if (identified) client.reset();
        return true;
      }
      if (identified && client.get_distinct_id?.() !== wanted) client.reset();
      if (client.get_distinct_id?.() !== wanted) client.identify(wanted);
      return true;
    } catch { return false; }
  }

  async function boot() {
    sdk ||= await (async () => { const module = await load(); return module?.default ?? module; })();
    // Consent or the route can change while the SDK chunk is loading.
    if (!permitted()) return;
    if (!client) {
      if (sdk.__loaded && typeof sdk.opt_in_capturing === 'function') { sdk.opt_in_capturing(); client = sdk; }
      else client = sdk.init(key, posthogConfig({ host, window, labels })) ?? sdk;
    }
    applyIdentity();
    const waiting = queue; queue = [];
    for (const [name, properties] of waiting) { try { client.capture(name, properties); } catch { /* Optional analytics. */ } }
  }

  const controller = {
    get started() { return Boolean(client); },
    /**
     * Apply the current permission. Declining or revoking also removes PostHog's browser storage.
     * @param {{ choice?: any, enabled?: boolean, pathname?: string }} [options]
     */
    async update({ choice, enabled = false, pathname = window.location.pathname } = {}) {
      granted = enabled === true && choice?.usage === true;
      if (!granted) {
        // Purge after stopping: stopping the SDK writes ids and flags of its own.
        stopClient();
        if (choice?.decided === true && choice?.usage !== true) purge();
        return false;
      }
      if (client || !permitted(pathname)) return Boolean(client);
      try {
        await (booting ||= boot().finally(() => { booting = undefined; }));
        return Boolean(client);
      } catch {
        // A blocked or failed SDK must never affect pages, downloads or accounts.
        sdk = undefined; queue = [];
        return false;
      }
    },
    /** @returns {boolean} whether the event was sent or queued */
    capture(name, properties = {}) {
      if (!permitted()) return false;
      if (client) { try { client.capture(name, properties); return true; } catch { return false; } }
      if (booting && queue.length < MAX_QUEUED) { queue.push([name, properties]); return true; }
      return false;
    },
    /** One $pageview per distinct location, like the GA4 page_view. */
    pageview(pathname = window.location.pathname) {
      if (!permitted(pathname)) return false;
      const location = `${window.location.origin}${pathname}`;
      if (lastPageview === location) return false;
      lastPageview = location;
      return controller.capture('$pageview', {});
    },
    /** For in-app navigation; a real document unload is reported by the SDK itself. */
    pageleave() { return controller.capture('$pageleave', {}); },
    /**
     * Tie this browser to the signed-in account (internal UUID only) or, with null,
     * detach it. Resolves true once PostHog holds that state.
     * @param {string | null} account
     */
    async syncAccount(account) {
      const id = account === null ? null : accountDistinctId(account);
      if (account !== null && id === null) return false;
      wanted = id;
      if (!permitted()) return false;
      if (!client && booting) { try { await booting; } catch { return false; } }
      if (!client || wanted !== id) return false;
      return applyIdentity();
    }
  };
  return controller;
}
