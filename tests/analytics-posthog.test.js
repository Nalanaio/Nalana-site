import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createPosthogAnalytics, posthogConfig, sanitizeEvent, accountDistinctId, POSTHOG_KEY, POSTHOG_HOST } from '../src/lib/analytics/posthog.js';
import { loadAnalytics, stopAnalytics, trackCtaClick, trackDownloadClick, trackPageLeave, trackPageView, trackScrollDepth } from '../src/lib/analytics/loaders.js';

const grant = { choice: { version: 1, usage: true, identification: false, decided: true }, enabled: true };
const decline = { choice: { version: 1, usage: false, identification: false, decided: true }, enabled: true };
const ACCOUNT = '0b7e2f9a-3c1d-4e5f-8a6b-7c8d9e0f1a2b';

function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  const methods = /** @type {Record<string, any>} */ ({ getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } });
  // Object.keys(storage) must list stored names, like a real Storage object.
  return new Proxy(/** @type {any} */ ({}), {
    get: (_target, key) => methods[/** @type {string} */ (key)],
    ownKeys: () => [...data.keys()],
    getOwnPropertyDescriptor: (_target, key) => (data.has(/** @type {string} */ (key)) ? { enumerable: true, configurable: true, value: data.get(/** @type {string} */ (key)) } : undefined)
  });
}

/** A stand-in for posthog-js that records what the site asks of it. */
function fakeSdk() {
  const sdk = {
    calls: [], inits: [], distinct: 'anon-1', state: 'anonymous', __loaded: false,
    config: /** @type {Record<string, any>} */ ({}), optedOut: false, onReset: /** @type {(() => void) | undefined} */ (undefined),
    init(key, config) { sdk.inits.push({ key, config }); sdk.config = { ...config }; sdk.__loaded = true; return sdk; },
    capture(name, properties) { sdk.calls.push(['capture', name, properties]); },
    identify(id) { sdk.calls.push(['identify', id]); sdk.distinct = id; sdk.state = 'identified'; },
    // Like the real SDK, reset() starts a new anonymous identity (and window id) and clears the opt-out flag.
    reset() { sdk.calls.push(['reset']); sdk.distinct = 'anon-2'; sdk.state = 'anonymous'; sdk.optedOut = false; sdk.onReset?.(); },
    opt_out_capturing() { sdk.calls.push(['opt_out']); sdk.optedOut = true; },
    opt_in_capturing() { sdk.calls.push(['opt_in']); sdk.optedOut = false; },
    set_config(/** @type {Record<string, any>} */ config) { sdk.calls.push(['set_config', config]); Object.assign(sdk.config, config); },
    // The SDK's own unload handler: reports a page leave when the document goes away.
    pagehide() { if (sdk.config.capture_pageleave && !sdk.optedOut) sdk.calls.push(['capture', '$pageleave', {}]); },
    get_distinct_id: () => sdk.distinct,
    get_property: name => (name === '$user_state' ? sdk.state : undefined)
  };
  return sdk;
}

/** @param {string} [url] @param {{ entries?: Record<string, string>, session?: Record<string, string>, load?: () => Promise<any> }} [options] */
function surface(url = 'https://www.nalana.io/', { entries, session, load } = {}) {
  const sdk = fakeSdk();
  let loads = 0;
  const window = { location: new URL(url), localStorage: storage(entries), sessionStorage: storage(session) };
  sdk.onReset = () => window.sessionStorage.setItem('ph_phc_test_window_id', '"new"');
  const controller = createPosthogAnalytics({
    window, key: 'phc_test_key', host: 'http://127.0.0.1:9',
    load: load ?? (async () => { loads++; return { default: sdk }; })
  });
  return { window, sdk, controller, loads: () => loads, events: () => sdk.calls.filter(call => call[0] === 'capture').map(call => call[1]) };
}

const SENSITIVE = ['/login', '/login?mode=signup', '/account', '/account/edit', '/verify-email', '/reset-password', '/forgot-password', '/connect-download', '/operator/acquisition', '/billing', '/api/auth/me'];

test('nothing loads, stores or sends before the visitor chooses', async () => {
  const s = surface();
  assert.equal(s.controller.capture('cta clicked', {}), false);
  assert.equal(s.controller.pageview('/'), false);
  assert.equal(await s.controller.syncAccount(ACCOUNT), false);
  for (const options of /** @type {any[]} */ ([{}, { enabled: true }, { choice: grant.choice }, { choice: { usage: false, decided: false }, enabled: true },
    { choice: { usage: 'true' }, enabled: true }, { choice: { usage: true, identification: true }, enabled: 'true' }])) {
    assert.equal(await s.controller.update(options), false);
  }
  assert.equal(s.loads(), 0);
  assert.equal(s.sdk.inits.length, 0);
  assert.equal(s.controller.started, false);
});

test('declining never loads the SDK, and removes only PostHog storage', async () => {
  const s = surface('https://www.nalana.io/', { entries: { ph_phc_old_posthog: '{}', __ph_opt_in_out_phc_old: '1', nalana_privacy_v1: '{"version":1}', other: 'keep' } });
  assert.equal(await s.controller.update(decline), false);
  assert.equal(s.loads(), 0);
  assert.deepEqual(Object.keys(s.window.localStorage).sort(), ['nalana_privacy_v1', 'other']);
  // Never asked yet: nothing is deleted either.
  const fresh = surface('https://www.nalana.io/', { entries: { ph_phc_old_posthog: '{}' } });
  await fresh.controller.update({ choice: { usage: false, decided: false }, enabled: true });
  assert.deepEqual(Object.keys(fresh.window.localStorage), ['ph_phc_old_posthog']);
});

test('the vendor flag is required even with consent', async () => {
  const s = surface();
  assert.equal(await s.controller.update({ choice: grant.choice, enabled: false }), false);
  assert.equal(s.loads(), 0);
});

test('missing key and sensitive or API routes never load the SDK', async () => {
  const keyless = createPosthogAnalytics({ window: { location: new URL('https://www.nalana.io/') }, key: '', load: async () => { throw new Error('loaded'); } });
  assert.equal(await keyless.update(grant), false);
  for (const path of SENSITIVE) {
    const s = surface(`https://www.nalana.io${path}`);
    assert.equal(await s.controller.update({ ...grant, pathname: new URL(`https://x.test${path}`).pathname }), false, path);
    assert.equal(s.loads(), 0, path);
  }
});

test('granting loads the SDK once with an events-only configuration', async () => {
  const s = surface();
  await s.controller.update(grant);
  await s.controller.update(grant);
  assert.equal(s.loads(), 1);
  assert.equal(s.sdk.inits.length, 1);
  const { key, config } = s.sdk.inits[0];
  assert.equal(key, 'phc_test_key');
  assert.equal(config.api_host, 'http://127.0.0.1:9');
  for (const [name, value] of Object.entries({ persistence: 'localStorage', autocapture: false, capture_pageview: false, disable_session_recording: true,
    disable_surveys: true, disable_external_dependency_loading: true, advanced_disable_flags: true, person_profiles: 'identified_only',
    save_referrer: false, save_campaign_params: false, capture_exceptions: false, capture_heatmaps: false, capture_dead_clicks: false })) {
    assert.equal(config[name], value, name);
  }
  assert.equal(typeof config.before_send, 'function');
});

test('the built-in project key and US host match the app project', () => {
  assert.match(POSTHOG_KEY, /^phc_[A-Za-z0-9]{20,}$/);
  assert.equal(POSTHOG_HOST, 'https://us.i.posthog.com');
  const config = posthogConfig({ host: POSTHOG_HOST, window: { location: new URL('https://www.nalana.io/') } });
  assert.equal(config.api_host, 'https://us.i.posthog.com');
});

test('revoking consent while the SDK is still downloading means it never starts or sends', async () => {
  let release = /** @type {(value?: any) => void} */ (() => {});
  const gate = new Promise(resolve => { release = resolve; });
  const sdk = fakeSdk();
  const s = surface('https://www.nalana.io/', { load: async () => { await gate; return { default: sdk }; } });
  const pending = s.controller.update(grant);
  assert.equal(s.controller.pageview('/'), true, 'queued while loading');
  assert.equal(await s.controller.update(decline), false);
  release();
  assert.equal(await pending, false);
  assert.equal(sdk.inits.length, 0);
  assert.deepEqual(sdk.calls, []);
  assert.equal(s.controller.started, false);
});

test('leaving for a sensitive route while loading drops the queue', async () => {
  let release = /** @type {(value?: any) => void} */ (() => {});
  const gate = new Promise(resolve => { release = resolve; });
  const sdk = fakeSdk();
  const s = surface('https://www.nalana.io/', { load: async () => { await gate; return { default: sdk }; } });
  const pending = s.controller.update(grant);
  s.controller.capture('cta clicked', { cta_id: 'x' });
  s.window.location = new URL('https://www.nalana.io/login');
  release();
  await pending;
  assert.equal(sdk.inits.length, 0);
  assert.deepEqual(sdk.calls, []);
});

test('revoking after the SDK started stops it, opts out and clears storage', async () => {
  const s = surface('https://www.nalana.io/', { entries: { ph_phc_test_posthog: '{}', other: 'keep' }, session: { ph_phc_test_window_id: '"old"', 'sveltekit:snapshot': '{}' } });
  await s.controller.update(grant);
  assert.equal(s.controller.capture('cta clicked', {}), true);
  await s.controller.update(decline);
  assert.deepEqual(s.sdk.calls.slice(-3), [['set_config', { capture_pageleave: false }], ['reset'], ['opt_out']]);
  assert.equal(s.controller.started, false);
  assert.equal(s.controller.capture('cta clicked', {}), false);
  assert.equal(s.controller.pageview('/pricing'), false);
  assert.deepEqual(Object.keys(s.window.localStorage), ['other']);
  // reset() wrote a new window id after the old one was gone; it must not survive either.
  assert.deepEqual(Object.keys(s.window.sessionStorage), ['sveltekit:snapshot']);
});

test('re-grant restores the current account and SDK pageleave after revocation', async () => {
  const s = surface();
  await s.controller.syncAccount(ACCOUNT);
  await s.controller.update(grant);
  await s.controller.update(decline);
  assert.notEqual(s.sdk.get_distinct_id(), ACCOUNT);
  s.sdk.pagehide();
  assert.deepEqual(s.events(), []);

  await s.controller.update(grant);
  assert.equal(s.sdk.get_distinct_id(), ACCOUNT);
  s.sdk.pagehide();
  assert.deepEqual(s.events(), ['$pageleave']);

  await s.controller.update(decline);
  assert.equal(await s.controller.syncAccount(null), false);
  await s.controller.update(grant);
  assert.notEqual(s.sdk.get_distinct_id(), ACCOUNT);
});

test('the SDK reports nothing from its own unload handler once consent is revoked', async () => {
  const s = surface();
  await s.controller.update(grant);
  s.sdk.pagehide();
  assert.deepEqual(s.events(), ['$pageleave'], 'while consented, leaving the document is reported');
  await s.controller.update(decline);
  const before = s.sdk.calls.length;
  s.sdk.pagehide(); // the revocation reloads the page, which fires pagehide
  assert.equal(s.sdk.calls.length, before);
});

test('events are sent only while permitted, and a pageview is once per location', async () => {
  const s = surface();
  await s.controller.update(grant);
  assert.equal(s.controller.pageview('/'), true);
  assert.equal(s.controller.pageview('/'), false);
  assert.equal(s.controller.pageview('/pricing'), true);
  assert.equal(s.controller.pageleave(), true);
  assert.equal(s.controller.pageview('/login'), false);
  s.window.location = new URL('https://www.nalana.io/account');
  assert.equal(s.controller.capture('cta clicked', {}), false);
  assert.deepEqual(s.events(), ['$pageview', '$pageview', '$pageleave']);
});

test('an SDK that fails to load never throws into the page and can be retried', async () => {
  let attempts = 0;
  const sdk = fakeSdk();
  const s = surface('https://www.nalana.io/', { load: async () => { if (++attempts === 1) throw new Error('blocked'); return { default: sdk }; } });
  assert.equal(await s.controller.update(grant), false);
  assert.equal(s.controller.capture('cta clicked', {}), false);
  assert.equal(await s.controller.update(grant), true);
});

test('identify accepts only the internal account UUID and never an email or name', async () => {
  assert.equal(accountDistinctId(ACCOUNT.toUpperCase()), ACCOUNT);
  assert.equal(accountDistinctId(ACCOUNT.replaceAll('-', '')), ACCOUNT);
  for (const value of ['person@example.test', 'Jordan', '', ' ', null, undefined, 42, {}, 'x'.repeat(32), `${ACCOUNT}0`]) assert.equal(accountDistinctId(value), null, String(value));
  const s = surface();
  await s.controller.update(grant);
  for (const value of ['person@example.test', 'Jordan Q', undefined]) assert.equal(await s.controller.syncAccount(value), false);
  assert.equal(s.sdk.calls.some(call => call[0] === 'identify'), false);
  assert.equal(await s.controller.syncAccount(ACCOUNT.toUpperCase()), true);
  assert.deepEqual(s.sdk.calls.filter(call => call[0] === 'identify'), [['identify', ACCOUNT]]);
  assert.equal(await s.controller.syncAccount(ACCOUNT), true);
  assert.equal(s.sdk.calls.filter(call => call[0] === 'identify').length, 1, 'idempotent');
});

test('sign-out resets the identity; a different account is never merged into the previous one', async () => {
  const s = surface();
  await s.controller.update(grant);
  await s.controller.syncAccount(ACCOUNT);
  await s.controller.syncAccount(null);
  assert.deepEqual(s.sdk.calls.slice(-1), [['reset']]);
  await s.controller.syncAccount(ACCOUNT);
  const other = '11111111-2222-4333-8444-555555555555';
  await s.controller.syncAccount(other);
  assert.deepEqual(s.sdk.calls.filter(call => call[0] === 'identify').map(call => call[1]), [ACCOUNT, ACCOUNT, other]);
  assert.equal(s.sdk.calls.filter(call => call[0] === 'reset').length, 2);
  assert.equal(s.sdk.distinct, other);
});

test('an account known before consent is applied only after the SDK starts, and never without consent', async () => {
  const s = surface();
  assert.equal(await s.controller.syncAccount(ACCOUNT), false);
  assert.equal(s.loads(), 0);
  await s.controller.update(grant);
  assert.deepEqual(s.sdk.calls.filter(call => call[0] === 'identify'), [['identify', ACCOUNT]]);
  const declined = surface();
  await declined.controller.syncAccount(ACCOUNT);
  await declined.controller.update(decline);
  assert.equal(declined.loads(), 0);
});

test('sanitizeEvent drops sensitive routes and strips queries, referrers and ad-click identifiers', () => {
  const window = { location: new URL('https://www.nalana.io/pricing?email=private&gclid=abc') };
  const raw = {
    event: '$pageview',
    properties: {
      $current_url: 'https://www.nalana.io/pricing?email=private&gclid=abc&token=secret#frag', $referrer: 'https://news.example/x', $referring_domain: 'news.example',
      utm_source: 'raw', gclid: 'abc', fbclid: 'f', msclkid: 'm', $initial_gclid: 'g', $initial_utm_campaign: 'c', $pathname: '/pricing', keep: 1
    },
    $set: { $referrer: 'https://news.example/x', plan: 'free' },
    $set_once: { $initial_referrer: 'https://news.example/x', $initial_current_url: 'https://www.nalana.io/?token=1', $initial_utm_source: 'raw' }
  };
  const result = sanitizeEvent(raw, { window, labels: () => ({ utm_source: 'newsletter', utm_medium: 'email' }) });
  assert.equal(result.properties.$current_url, 'https://www.nalana.io/pricing');
  assert.deepEqual(Object.keys(result.properties).filter(key => /referr|gclid|fbclid|msclkid/.test(key)), []);
  assert.equal(result.properties.utm_source, 'newsletter', 'only the site-approved labels are attached');
  assert.equal(result.properties.utm_medium, 'email');
  assert.equal(result.properties.$initial_utm_campaign, undefined);
  assert.equal(result.properties.$geoip_disable, true);
  assert.equal(result.properties.keep, 1);
  assert.deepEqual(result.$set, { plan: 'free' });
  assert.deepEqual(result.$set_once, { $initial_current_url: 'https://www.nalana.io/' });
  assert.equal(raw.properties.gclid, 'abc', 'input is not mutated');
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  for (const path of ['/login', '/account/edit', '/verify-email', '/operator/acquisition', '/api/auth/me']) {
    assert.equal(sanitizeEvent(raw, { window: { location: new URL(`https://www.nalana.io${path}`) } }), null, path);
  }
  for (const path of ['/login', '/account/edit', '/verify-email', '/operator/acquisition', '/api/auth/me']) {
    assert.equal(sanitizeEvent({ event: '$pageview', properties: { $current_url: `https://www.nalana.io${path}` } }, { window }), null, path);
  }
  assert.equal(sanitizeEvent({ event: '$pageview', properties: { $current_url: 'not a url' } }, { window }), null);
  assert.equal(sanitizeEvent(null, { window }), null);
});

// ---- loaders.js: the site's existing consent gate decides, PostHog only follows ----

function page(url = 'https://www.nalana.io/') {
  const scripts = [];
  const document = {
    getElementById: id => scripts.find(script => script.id === id),
    createElement: () => ({ remove() { scripts.splice(scripts.indexOf(this), 1); } }),
    head: { appendChild: script => scripts.push(script) }
  };
  const sdk = fakeSdk();
  let loads = 0;
  const window = { location: new URL(url), dataLayer: [], localStorage: storage(), sessionStorage: storage() };
  const posthog = createPosthogAnalytics({ window, key: 'phc_test_key', host: 'http://127.0.0.1:9', load: async () => { loads++; return { default: sdk }; } });
  return { document, window, posthog, sdk, scripts, loads: () => loads, events: () => sdk.calls.filter(call => call[0] === 'capture') };
}
const element = attributes => ({ getAttribute: name => attributes[name] ?? null });
const choiceOf = (usage, decided = true) => ({ version: 1, usage, identification: false, decided });
async function settle() { await new Promise(resolve => setImmediate(resolve)); }

test('loadAnalytics follows the existing gate: flag off, no choice, or decline never loads PostHog', async () => {
  for (const options of [{ enabled: false, choice: choiceOf(true) }, { enabled: true, choice: choiceOf(false, false) }, { enabled: true, choice: choiceOf(false) }]) {
    const p = page();
    loadAnalytics({ document: p.document, window: p.window, pathname: '/', posthog: p.posthog, ...options });
    await settle();
    assert.equal(p.loads(), 0);
    trackPageView({ window: p.window, pathname: '/', ...options });
    trackDownloadClick({ window: p.window, platform: 'mac' });
    trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_login', 'data-auth-intent': 'login' }) });
    trackScrollDepth({ window: p.window, depth: 50 });
    trackPageLeave({ window: p.window });
    assert.equal(p.loads(), 0);
    assert.equal(p.events().length, 0);
  }
});

test('events are no-ops before loadAnalytics has run for the document', () => {
  const p = page();
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_login' }) });
  trackDownloadClick({ window: p.window, platform: 'mac' });
  assert.equal(p.events().length, 0);
});

test('granting reports the page view, CTA clicks, download clicks, scroll depth and page leave', async () => {
  const p = page('https://www.nalana.io/');
  loadAnalytics({ document: p.document, window: p.window, pathname: '/', enabled: true, choice: choiceOf(true), posthog: p.posthog });
  await settle();
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_signup', 'data-cta-location': 'header', 'data-auth-intent': 'signup' }) });
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_login', 'data-cta-location': 'header', 'data-auth-intent': 'login' }) });
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'pricing_signup', 'data-cta-location': 'pricing' }) });
  trackDownloadClick({ window: p.window, platform: 'mac' });
  trackDownloadClick({ window: p.window, platform: 'toaster' });
  trackScrollDepth({ window: p.window, depth: 50 });
  trackScrollDepth({ window: p.window, depth: 51 });
  trackPageLeave({ window: p.window });
  assert.deepEqual(p.events().map(([, name, props]) => [name, props]), [
    ['$pageview', {}],
    ['cta clicked', { cta_id: 'header_signup', location: 'header' }], ['signup started', { location: 'header' }],
    ['cta clicked', { cta_id: 'header_login', location: 'header' }], ['login started', { location: 'header' }],
    ['cta clicked', { cta_id: 'pricing_signup', location: 'pricing' }],
    ['download clicked', { platform: 'mac' }],
    ['scroll depth', { depth: 50 }],
    ['$pageleave', {}]
  ]);
  assert.equal(p.loads(), 1);
});

test('a link to a server endpoint (a download) is not a page leave; a page navigation is', async () => {
  const p = page('https://www.nalana.io/');
  loadAnalytics({ document: p.document, window: p.window, pathname: '/', enabled: true, choice: choiceOf(true), posthog: p.posthog });
  await settle();
  trackPageLeave({ window: p.window, to: { route: { id: '/api/download' } } });
  assert.equal(p.events().filter(([, name]) => name === '$pageleave').length, 0);
  trackPageLeave({ window: p.window, to: { route: { id: '/pricing' } } });
  trackPageLeave({ window: p.window, to: { route: { id: null } } });
  assert.equal(p.events().filter(([, name]) => name === '$pageleave').length, 2);
});

test('untagged, malformed or free-text CTA attributes are not reported', async () => {
  const p = page();
  loadAnalytics({ document: p.document, window: p.window, pathname: '/', enabled: true, choice: choiceOf(true), posthog: p.posthog });
  await settle();
  const before = p.events().length;
  trackCtaClick({ window: p.window, element: element({}) });
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'Sign up now!' }) });
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'person@example.test' }) });
  trackCtaClick({ window: p.window, element: null });
  assert.equal(p.events().length, before);
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'hero_try', 'data-cta-location': 'Free text here' }) });
  assert.deepEqual(p.events().at(-1).slice(1), ['cta clicked', { cta_id: 'hero_try', location: 'unknown' }]);
});

test('CTA, download and page events never fire on sensitive routes', async () => {
  for (const path of SENSITIVE.map(value => value.split('?')[0])) {
    const p = page(`https://www.nalana.io${path}`);
    loadAnalytics({ document: p.document, window: p.window, pathname: path, enabled: true, choice: choiceOf(true), posthog: p.posthog });
    await settle();
    trackPageView({ window: p.window, pathname: path, enabled: true, choice: choiceOf(true) });
    trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_login', 'data-auth-intent': 'login' }) });
    trackDownloadClick({ window: p.window, platform: 'windows' });
    assert.equal(p.loads(), 0, path);
    assert.equal(p.events().length, 0, path);
  }
});

test('declining later (or stopAnalytics) stops events and clears PostHog storage', async () => {
  const p = page();
  p.window.localStorage.setItem('ph_phc_test_posthog', '{}');
  loadAnalytics({ document: p.document, window: p.window, pathname: '/', enabled: true, choice: choiceOf(true), posthog: p.posthog });
  await settle();
  loadAnalytics({ document: p.document, window: p.window, pathname: '/', enabled: true, choice: choiceOf(false), posthog: p.posthog });
  await settle();
  trackDownloadClick({ window: p.window, platform: 'mac' });
  trackCtaClick({ window: p.window, element: element({ 'data-cta-id': 'header_login' }) });
  assert.equal(p.events().filter(([, name]) => name !== '$pageview').length, 0);
  assert.deepEqual(Object.keys(p.window.localStorage), []);

  const q = page();
  loadAnalytics({ document: q.document, window: q.window, pathname: '/', enabled: true, choice: choiceOf(true), posthog: q.posthog });
  await settle();
  stopAnalytics({ window: q.window, document: q.document });
  await settle();
  trackDownloadClick({ window: q.window, platform: 'mac' });
  assert.equal(q.events().some(([, name]) => name === 'download clicked'), false);
  assert.equal(q.posthog.started, false);
});

test('PostHog is only ever imported dynamically, so it cannot load before consent', () => {
  const offenders = [];
  const walk = directory => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.(?:js|svelte|ts|html)$/.test(name)) continue;
      const text = readFileSync(path, 'utf-8');
      if (/^\s*import\s[^;]*['"]posthog-js(?:\/[^'"]*)?['"]/m.test(text) || /<script[^>]+posthog/i.test(text)) offenders.push(path);
    }
  };
  walk('src');
  assert.deepEqual(offenders, []);
  assert.match(readFileSync('src/lib/analytics/posthog.js', 'utf-8'), /import\('posthog-js'\)/);
  assert.equal(/posthog/i.test(readFileSync('src/app.html', 'utf-8')), false);
});
