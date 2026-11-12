import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDownload } from '../src/lib/server/download-handler.js';
import { mintSubject } from '../src/lib/server/download-cookie.js';
import { measureDownload } from '../src/lib/server/campaign-measurement.js';
import { readFile } from 'node:fs/promises';
const id = 'a9ee7444-6b85-4e86-8c6b-24684e20bdd4';
const env = { NALANA_ACQUISITION_RELAY:'true', NALANA_API_BASE:'https://api.test', NALANA_WEBSITE_SERVICE_TOKEN:'private', NALANA_DOWNLOAD_RELAY_BASE:'https://relay.test', NALANA_ENVIRONMENT:'test', NALANA_DOWNLOAD_COOKIE_KEY_ID:'t', NALANA_DOWNLOAD_COOKIE_KEYS:JSON.stringify({t:'a'.repeat(40)}), NALANA_WIN_URL:'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/nalana.exe' };
function event(options = {}) {
  const url = new URL(options.url || 'https://nalana.io/api/download?platform=windows&channel=stable');
  return { url, request:new Request(url, options.request), cookies:{ get:()=>null, set:()=>{} }, fetch:()=>assert.fail('unexpected request'), env, ...options };
}
test('first GET makes exactly one same-origin cookie roundtrip without backend mail or intent', async () => {
  const response = await handleDownload(event());
  assert.equal(response.status,303);
  assert.match(response.headers.get('location'), /^\/api\/download\?platform=windows&_retry=/);
  assert.equal(new URL(response.headers.get('location'), 'https://nalana.io').searchParams.get('channel'), 'stable');
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('cookie retry preserves approved group labels without click identifiers or arbitrary URL fields entering metrics', async () => {
  const counts = [], settings = { ...env, PUBLIC_CAMPAIGN_ALLOWED_LABELS: '[{"source":"facebook","medium":"paid_social","campaign":"Autumn Creators"}]' };
  const measure = args => measureDownload({ ...args, record: async value => { counts.push(value); return true; } });
  const response = await handleDownload(event({ url: new URL('https://nalana.io/api/download?platform=windows&channel=stable&utm_source=facebook&utm_medium=paid_social&utm_campaign=Autumn+Creators&fbclid=private&email=private'), env: settings, measure }));
  assert.equal(response.status, 303);
  const retry = new URL(response.headers.get('location'), 'https://nalana.io');
  assert.equal(retry.searchParams.get('utm_campaign'), 'Autumn Creators');
  assert.equal(retry.searchParams.get('utm_source'), 'facebook');
  assert.equal(retry.searchParams.get('fbclid'), null);
  assert.equal(retry.searchParams.get('email'), null);
  assert.equal(counts.length, 0);
  const final = await handleDownload(event({ url: retry, request: new Request(retry), env: settings, measure, fetch: async () => new Response(null, { status: 503 }) }));
  assert.equal(final.status, 302);
  assert.equal(counts.length, 1);
  assert.equal(counts[0].campaign.campaign, 'Autumn Creators');
});
test('blocked cookies proceed once and direct fallback makes no start/mail claims', async () => {
  const calls=[];
  const response = await handleDownload(event({ url:new URL('https://nalana.io/api/download?platform=windows&channel=stable&_retry=invalid'), fetch:async (url)=>{ calls.push(url); return new Response('',{status:503}); } }));
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),env.NALANA_WIN_URL);
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>!url.includes('resend.com')));
});
test('valid returned cookie gets validated relay ticket and handoff only', async () => {
  const calls=[];
  const expires=Math.floor(Date.now()/1000)+900;
  const response=await handleDownload(event({env:{...env,RESEND_API_KEY:'fixture-key'},cookies:{get:()=>mintSubject(env),set:()=>{}},fetch:async(url, options)=>{calls.push([url,options]);return Response.json(url.endsWith('download-intents')?{download_id:id,release_id:'r1',artifact_id:'a1',platform:'windows',observation_mode:'relay',download_url:`https://relay.test/v1/downloads/${id}?expires=${expires}&key_id=t&sig=${'a'.repeat(64)}`,expires_at:new Date(expires*1000).toISOString()}:{});}}));
  assert.equal(response.status,302);
  assert.match(response.headers.get('location'), /^https:\/\/relay.test\/v1\/downloads\//);
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1][1].body).delivery_mode,'relay');
});
test('HEAD, prefetch and invalid platform cannot create intent or notify', async()=>{
  assert.equal((await handleDownload(event({request:new Request('https://nalana.io',{method:'HEAD'})}))).status,204);
  assert.equal((await handleDownload(event({request:new Request('https://nalana.io',{headers:{'sec-purpose':'prefetch'}})}))).status,204);
  assert.equal((await handleDownload(event({url:new URL('https://nalana.io/api/download?platform=linux')}))).status,400);
});
test('unsafe configured fallback fails closed', async()=>{
  const response=await handleDownload(event({env:{...env,NALANA_ACQUISITION_RELAY:'false',NALANA_WIN_URL:'https://evil.test/file.exe'},fetch:async()=>new Response('',{status:503})}));
  assert.equal(response.status,503);
});

test('direct fallback sends one request email with relay and funnel disabled', async () => {
  const calls = [];
  const response = await handleDownload(event({ env: { RESEND_API_KEY: 'fixture-key', NALANA_WIN_URL: env.NALANA_WIN_URL }, fetch: async (url, options) => {
    calls.push({ url, options });
    return url.includes('resend.com') ? Response.json({ id: 'fixture-mail' }) : new Response('', { status: 503 });
  } }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), env.NALANA_WIN_URL);
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[1].options.body).subject, 'Nalana download requested — Windows');
  assert.ok(calls.every(call => !call.url.includes('/v1/acquisition/')));
});

test('email outage preserves the download redirect and records no transfer event', async (t) => {
  t.mock.method(console, 'error', () => {});
  const calls = [];
  const response = await handleDownload(event({ env: { RESEND_API_KEY: 'fixture-key', NALANA_WIN_URL: env.NALANA_WIN_URL }, fetch: async (url) => {
    calls.push(url);
    throw Error('network unavailable');
  } }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), env.NALANA_WIN_URL);
  assert.equal(calls.filter(url => url.includes('resend.com')).length, 1);
});

test('unavailable installer never sends an email even with notification configuration', async () => {
  const calls = [];
  const response = await handleDownload(event({ env: { RESEND_API_KEY: 'fixture-key' }, fetch: async (url) => {
    calls.push(url);
    return new Response('', { status: 503 });
  } }));
  assert.equal(response.status, 503);
  assert.ok(calls.every(url => !url.includes('resend.com')));
});

test('relay outage falls back to a request email without claiming a transfer start', async () => {
  const calls = [];
  const response = await handleDownload(event({ env: { ...env, RESEND_API_KEY: 'fixture-key' }, cookies: { get: () => mintSubject(env), set: () => {} }, fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response('', { status: 503 });
  } }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), env.NALANA_WIN_URL);
  assert.equal(calls.filter(call => call.url.includes('resend.com')).length, 1);
  assert.ok(calls.every(call => !call.url.includes('download-handoffs')));
});

const betaManifest = JSON.parse(await readFile(new URL('./fixtures/beta-build-info.json', import.meta.url), 'utf8'));
const stableManifest = JSON.parse(await readFile(new URL('./fixtures/stable-build-info.json', import.meta.url), 'utf8'));
const releases = 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/';
const betaAssets = {
  mac: `${releases}beta-latest/nalana-macos-arm64-beta-b19-154b8f6f.dmg`,
  windows: `${releases}beta-latest/nalana-windows-x64-beta-b19-154b8f6f.exe`,
};
const stableAssets = {
  mac: `${releases}stable-latest/nalana-macos-arm64-stable-2.1.0-69a28f77-r33.1.dmg`,
  windows: `${releases}stable-latest/nalana-windows-x64-stable-2.1.0-69a28f77-r33.1.exe`,
};
const noRelayCookies = { get: () => assert.fail('beta must not read relay cookies'), set: () => assert.fail('beta must not set relay cookies') };
/** Serves the channel manifests and records every outbound request. */
function releaseFetch(calls, { beta = betaManifest, stable = stableManifest } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/beta-latest/build-info.json')) return beta ? Response.json(beta) : new Response('', { status: 404 });
    if (url.endsWith('/stable-latest/build-info.json')) return stable ? Response.json(stable) : new Response('', { status: 404 });
    if (url.includes('resend.com')) return Response.json({ id: 'fixture-mail' });
    return assert.fail(`unexpected request to ${url}`);
  };
}

for (const platform of ['mac', 'windows']) {
  test(`${platform}: channel=beta redirects to the live beta asset without touching the relay`, async () => {
    const calls = [], measured = [];
    const url = new URL(`https://nalana.io/api/download?platform=${platform}&channel=beta&url=https://evil.test/file.exe`);
    const response = await handleDownload(event({ url, request: new Request(url), cookies: noRelayCookies, fetch: releaseFetch(calls), measure: async (args) => { measured.push(args); } }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), betaAssets[platform]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.deepEqual(calls.map(call => call.url), [`${releases}beta-latest/build-info.json`]);
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(measured.length, 1);
    assert.equal(measured[0].channel, 'beta');
    assert.equal(measured[0].platform, platform);
  });
}

test('beta keeps the request notification but never creates relay intents, handoffs or tickets', async () => {
  const calls = [];
  const response = await handleDownload(event({
    url: new URL('https://nalana.io/api/download?platform=windows&channel=beta'),
    env: { ...env, RESEND_API_KEY: 'fixture-only' }, cookies: noRelayCookies, fetch: releaseFetch(calls),
  }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), betaAssets.windows);
  assert.deepEqual(calls.map(call => call.url), [`${releases}beta-latest/build-info.json`, 'https://api.resend.com/emails']);
  assert.ok(calls.every(call => !call.url.includes('/v1/acquisition/') && !call.url.includes('relay.test')));
  const mail = JSON.parse(calls[1].options.body);
  assert.match(mail.text, /Channel: Beta/);
  assert.match(mail.text, /not a completed download/);
});

test('beta manifest outage returns 503 and never falls back to stable or configured URLs', async () => {
  for (const beta of [null, { ...betaManifest, channel: 'stable' }, { ...betaManifest, builds: stableManifest.builds }]) {
    const calls = [];
    const response = await handleDownload(event({
      url: new URL('https://nalana.io/api/download?platform=windows&channel=beta'),
      env: { ...env, RESEND_API_KEY: 'fixture-only', NALANA_WIN_URL: stableAssets.windows }, cookies: noRelayCookies,
      fetch: releaseFetch(calls, { beta }), measure: () => assert.fail('must not measure an unavailable download'),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /beta is temporarily unavailable/);
    assert.deepEqual(calls.map(call => call.url), [`${releases}beta-latest/build-info.json`]);
  }
});

test('unknown channel is rejected before any side effect', async () => {
  for (const channel of ['', 'Stable', 'nightly', 'constructor']) {
    const url = new URL(`https://nalana.io/api/download?platform=windows&channel=${channel}`);
    const response = await handleDownload(event({ url, request: new Request(url), cookies: noRelayCookies, measure: () => assert.fail('must not measure') }));
    assert.equal(response.status, 400, channel);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('beta HEAD and prefetch stay side-effect free', async () => {
  const quiet = { cookies: noRelayCookies, measure: () => assert.fail('must not measure') };
  const url = new URL('https://nalana.io/api/download?platform=windows&channel=beta');
  assert.equal((await handleDownload(event({ ...quiet, url, request: new Request(url, { method: 'HEAD' }) }))).status, 204);
  for (const headers of [{ purpose: 'preview' }, { 'sec-purpose': 'prefetch' }]) {
    assert.equal((await handleDownload(event({ ...quiet, url, request: new Request(url, { headers }) }))).status, 204);
  }
});

test('missing channel uses PUBLIC_DEFAULT_DOWNLOAD_CHANNEL, defaulting to beta when unset or invalid', async () => {
  const url = new URL('https://nalana.io/api/download?platform=mac');
  const relayOff = { NALANA_MAC_URL: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/nalana.dmg' };
  for (const [setting, expected] of [[undefined, betaAssets.mac], ['beta', betaAssets.mac], ['nightly', betaAssets.mac], ['', betaAssets.mac], ['stable', stableAssets.mac]]) {
    const calls = [];
    const response = await handleDownload(event({ url, request: new Request(url), env: { ...relayOff, PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: setting }, fetch: releaseFetch(calls) }));
    assert.equal(response.status, 302, String(setting));
    assert.equal(response.headers.get('location'), expected, String(setting));
  }
});

test('explicit channel overrides the configured default either way', async () => {
  for (const [channel, setting, expected] of [['stable', 'beta', stableAssets.windows], ['beta', 'stable', betaAssets.windows]]) {
    const url = new URL(`https://nalana.io/api/download?platform=windows&channel=${channel}`);
    const response = await handleDownload(event({ url, request: new Request(url), env: { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: setting }, fetch: releaseFetch([]) }));
    assert.equal(response.headers.get('location'), expected);
  }
});

test('stable resolves the live stable manifest and its configured fallback must be a stable asset', async () => {
  const response = await handleDownload(event({ env: { NALANA_WIN_URL: env.NALANA_WIN_URL }, fetch: releaseFetch([]) }));
  assert.equal(response.headers.get('location'), stableAssets.windows);
  const betaFallback = await handleDownload(event({ env: { NALANA_WIN_URL: betaAssets.windows }, fetch: releaseFetch([], { stable: null }) }));
  assert.equal(betaFallback.status, 503);
  const betaManifestAsStable = await handleDownload(event({ env: {}, fetch: releaseFetch([], { stable: betaManifest }) }));
  assert.equal(betaManifestAsStable.status, 503);
});
