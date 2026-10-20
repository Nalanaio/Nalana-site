import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedCampaigns, cleanCampaign, campaignFromUrl, eligibleTraffic, unknownCampaign } from '../src/lib/campaigns/labels.js';
import { campaignPage, currentCampaign, enableCampaignTotals, decorateCampaignLink, observeCampaignNavigation } from '../src/lib/campaigns/browser.js';
import { recordCampaign, readCampaignTotals, campaignWindow } from '../src/lib/server/campaign-store.js';
import { handleCampaignPageView, measureDownload, measureSignup } from '../src/lib/server/campaign-measurement.js';

const campaign = { source: 'facebook', medium: 'paid_social', campaign: 'Autumn Creators' };
const catalog = [campaign, { ...campaign, campaign: 'qa_campaign_20261019' }];
const env = { CAMPAIGN_TOTALS_ENABLED: 'true', PUBLIC_CAMPAIGN_ALLOWED_LABELS: JSON.stringify(catalog) };
const tagged = 'https://www.nalana.io/?utm_source=facebook&utm_medium=paid_social&utm_campaign=Autumn+Creators&fbclid=private-click-id';
const request = (url = tagged, options = {}) => new Request(url, { headers: { origin: 'https://www.nalana.io', 'user-agent': 'Browser', ...options.headers }, method: options.method || 'GET' });

test('only a configured campaign name and fixed source/medium taxonomy survive', () => {
  assert.deepEqual(campaignFromUrl(new URL(tagged), '', catalog), campaign);
  for (const value of ['person@example.com', 'alice', 'unique_visitor_a9b8c7', '{{campaign.name}}', 'x'.repeat(121), 'https://private.test/secret']) {
    assert.equal(cleanCampaign({ ...campaign, campaign: value }, catalog).campaign, 'unknown');
  }
  assert.deepEqual(cleanCampaign({ source: 'alice', medium: 'password', campaign: 'Autumn Creators' }), unknownCampaign());
  assert.deepEqual(allowedCampaigns('{bad'), []);
  assert.deepEqual(allowedCampaigns(Array(101).fill('label')), []);
  assert.equal(campaignFromUrl(new URL(tagged + '&utm_source=google'), '', catalog).source, 'unknown');
  assert.equal(cleanCampaign({ ...campaign, source: 'google' }, catalog).campaign, 'unknown');
  assert.equal(cleanCampaign({ ...campaign, medium: 'email' }, catalog).campaign, 'unknown');
});

test('referrers supply a coarse source without inventing ads, direct, or campaign attribution', () => {
  const url = new URL('https://www.nalana.io/');
  assert.deepEqual(campaignFromUrl(url, 'https://l.facebook.com/private-path?private=value'), { source: 'facebook', medium: 'referral', campaign: 'unknown' });
  assert.equal(campaignFromUrl(url, 'https://facebook.com.attacker.test/').source, 'referral');
  for (const ref of ['', 'not a URL', 'https://www.nalana.io/private?token=secret']) assert.deepEqual(campaignFromUrl(url, ref), unknownCampaign());
});

test('campaign context uses document memory, expires without sliding, and decorates only safe same-site destinations', () => {
  const window = { location: new URL(tagged), document: { referrer: '' } };
  Object.defineProperties(window, { localStorage: { get() { throw new Error('No browser storage'); } }, sessionStorage: { get() { throw new Error('No browser storage'); } } });
  enableCampaignTotals(window, catalog);
  assert.deepEqual(currentCampaign(window, 1000), campaign);
  window.location = new URL('https://www.nalana.io/privacy?utm_source=facebook&utm_medium=paid_social&utm_campaign=Autumn+Creators');
  assert.deepEqual(currentCampaign(window, 1000 + 29 * 60_000), campaign);
  assert.deepEqual(currentCampaign(window, 1000 + 31 * 60_000), unknownCampaign());
  const fresh = { location: new URL(tagged), document: { referrer: '' } };
  enableCampaignTotals(fresh, catalog);
  for (const path of ['/api/download?platform=windows', '/login?mode=signup', '/open-source']) {
    const anchor = { href: new URL(path, fresh.location).href, hasAttribute: () => false };
    decorateCampaignLink(anchor, fresh);
    const url = new URL(anchor.href);
    assert.equal(url.searchParams.get('utm_campaign'), 'Autumn Creators');
    assert.equal(url.searchParams.get('fbclid'), null);
  }
  for (const path of ['/account', '/operator/campaigns', '/verify-email?token=secret', 'https://foreign.test/']) {
    const anchor = { href: new URL(path, fresh.location).href, hasAttribute: () => false }, before = anchor.href;
    decorateCampaignLink(anchor, fresh);
    assert.equal(anchor.href, before);
  }
  assert.equal(campaignPage('/open-source'), true);
  for (const path of ['/dev', '/beta', '/account', '/operator/campaigns', '/login']) assert.equal(campaignPage(path), false);
});

test('client navigation counts once, excludes enter/hash/private transitions, and sends labels only', async () => {
  const sent = [], window = { location: new URL(tagged), document: {}, fetch: async (...args) => sent.push(args) };
  enableCampaignTotals(window, catalog);
  const from = { url: window.location }, to = { url: new URL('/open-source', window.location) };
  observeCampaignNavigation(window, { from: null, to: from, type: 'enter' });
  observeCampaignNavigation(window, { from, to: { url: new URL(tagged + '#demo') }, type: 'link' });
  observeCampaignNavigation(window, { from, to: { url: new URL('/account', window.location) }, type: 'link' });
  assert.equal(sent.length, 0);
  window.location = to.url;
  observeCampaignNavigation(window, { from, to, type: 'link' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], '/api/campaign/page-view');
  assert.deepEqual(JSON.parse(sent[0][1].body), campaign);
});

test('known bots and speculative requests do not become campaign observations', async () => {
  for (const headers of [{ 'user-agent': 'facebookexternalhit' }, { purpose: 'prefetch' }, { 'sec-purpose': 'prerender' }]) {
    const req = request(undefined, { headers });
    assert.equal(eligibleTraffic(req), false);
    await measureDownload({ request: req, url: new URL(tagged), platform: 'mac', env, record: () => assert.fail('must not count') });
  }
  await measureDownload({ request: request(undefined, { method: 'HEAD' }), url: new URL(tagged), platform: 'windows', env, record: () => assert.fail('HEAD') });
});

test('download and confirmed signup observations are independent of consent and exclude credentials', async () => {
  const observations = [], record = async value => { observations.push(value); return true; };
  await measureDownload({ request: request(), url: new URL(tagged), platform: 'mac', env, record });
  await measureSignup({ response: new Response(null, { status: 201 }), request: request('https://www.nalana.io/api/auth/register', { method: 'POST' }), campaign: { ...campaign, email: 'private@example.test', accountId: 'private-account' }, env, record });
  assert.deepEqual(observations.map(({ event, campaign: labels, platform }) => ({ event, labels, platform })), [{ event: 'download_request', labels: campaign, platform: 'mac' }, { event: 'signup', labels: campaign, platform: undefined }]);
  assert.doesNotMatch(JSON.stringify(observations), /private-account|private@example|fbclid|user-agent/);
  for (const status of [200, 400, 401, 409, 422, 500, 503]) await measureSignup({ response: new Response(null, { status }), request: request(), campaign, env, record: () => assert.fail('not a new account') });
});

test('database increments use fixed procedures and parameterized approved dimensions; failures do not fail business actions', async () => {
  const inputs = [], procedures = [];
  const query = { input(name, type, value) { inputs.push([name, value]); return this; }, async execute(name) { procedures.push(name); return { recordset: [] }; } };
  const connect = async () => ({ request: () => query });
  assert.equal(await recordCampaign({ event: 'signup', campaign: { ...campaign, password: 'secret', visitorId: 'individual' }, env, connect }), true);
  assert.deepEqual(Object.fromEntries(inputs), { event: 'signup', ...campaign, platform: 'web' });
  assert.deepEqual(procedures, ['dbo.record_website_campaign']);
  assert.equal(await recordCampaign({ event: 'signup', campaign, env: {}, connect: () => assert.fail('disabled') }), false);
  assert.equal(await recordCampaign({ event: 'account_data', campaign, env, connect: () => assert.fail('unsupported') }), false);
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  try { assert.equal(await recordCampaign({ event: 'page_view', campaign, env, connect: async () => { throw new Error('sensitive DB failure'); } }), false); }
  finally { console.error = originalError; }
  assert.deepEqual(errors, [['Campaign total increment failed.']]);
  await readCampaignTotals({ env, window: { start: '2026-10-01', end: '2026-10-19' }, connect });
  assert.equal(procedures[1], 'dbo.read_website_campaigns');
});

test('report windows include today and reject invalid, repeated, future, or excessive dates', () => {
  const now = new Date('2026-10-19T17:00:00Z');
  assert.deepEqual(campaignWindow(new URLSearchParams(), now), { start: '2026-10-13', end: '2026-10-19' });
  for (const query of ['end=invalid', 'end=2026-02-31', 'start=bad', 'start=2026-01-01', 'end=2026-10-20', 'start=2026-10-18&start=2026-10-19', 'email=private']) assert.throws(() => campaignWindow(new URLSearchParams(query), now));
});

test('public page-view endpoint has bounded inputs, origin fencing, no extra fields, and an explicit outage status', async () => {
  const observations = [], url = new URL('https://www.nalana.io/api/campaign/page-view');
  const post = (body, headers = {}) => new Request(url, { method: 'POST', headers: { origin: url.origin, 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const record = async value => { observations.push(value); return true; };
  const result = await handleCampaignPageView({ request: post(campaign), url, env, record });
  assert.equal(result.status, 204);
  assert.deepEqual(observations[0], { event: 'page_view', campaign, env });
  for (const [body, headers, status] of [[campaign, { origin: 'https://foreign.test' }, 403], [campaign, { origin: '' }, 403], [campaign, { 'user-agent': 'Googlebot' }, 403], [campaign, { 'content-type': 'text/plain' }, 415], ['x'.repeat(1025), {}, 413], ['{invalid', {}, 400], [[campaign], {}, 400], [{ ...campaign, email: 'private@example.test' }, {}, 400], [{ event: 'signup' }, {}, 400]]) {
    assert.equal((await handleCampaignPageView({ request: post(body, headers), url, env, record: () => assert.fail('invalid input') })).status, status);
  }
  assert.equal((await handleCampaignPageView({ request: post(campaign), url, env, record: async () => false })).status, 503);
  assert.equal((await handleCampaignPageView({ request: post(campaign), url, env: {}, record: () => assert.fail('disabled') })).status, 204);
});
