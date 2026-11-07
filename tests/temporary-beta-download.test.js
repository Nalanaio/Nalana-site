import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDownload } from '../src/lib/server/download-handler.js';

const base = 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/beta-latest/';
const urls = {
  mac: `${base}nalana-macos-arm64-beta-b16-a68fea16.dmg`,
  windows: `${base}nalana-windows-x64-beta-b16-a68fea16.exe`,
};
function event(platform, options = {}) {
  const url = new URL(`https://nalana.io/api/download?platform=${platform}&channel=stable&url=https://evil.test/file.exe`);
  return {
    url, request: new Request(url),
    cookies: { get: () => assert.fail('beta must not read relay cookies'), set: () => assert.fail('beta must not set relay cookies') },
    env: { NALANA_ACQUISITION_RELAY: 'true' },
    fetch: () => assert.fail('beta must not fetch a stable manifest or create a stable intent'),
    measure: async () => {}, ...options,
  };
}

for (const platform of ['mac', 'windows']) {
  test(`${platform}: default public download uses pinned beta despite relay settings and query overrides`, async () => {
    let measurements = 0;
    const response = await handleDownload(event(platform, { measure: async () => { measurements++; } }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), urls[platform]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(measurements, 1);
  });
}

test('beta HEAD, preview and invalid platform have no side effects', async () => {
  const quiet = { measure: () => assert.fail('must not measure') };
  for (const headers of [{ purpose: 'preview' }, { 'sec-purpose': 'prefetch' }]) {
    const input = event('windows', quiet);
    input.request = new Request(input.url, { headers });
    assert.equal((await handleDownload(input)).status, 204);
  }
  const input = event('windows', quiet);
  input.request = new Request(input.url, { method: 'HEAD' });
  assert.equal((await handleDownload(input)).status, 204);
  assert.equal((await handleDownload(event('linux', quiet))).status, 400);
});

test('beta retains best-effort request notification without creating stable relay records', async () => {
  const calls = [];
  const response = await handleDownload(event('windows', {
    env: { NALANA_ACQUISITION_RELAY: 'true', RESEND_API_KEY: 'fixture-only' },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ id: 'fixture' }); },
  }));
  assert.equal(response.headers.get('location'), urls.windows);
  assert.deepEqual(calls.map(call => call.url), ['https://api.resend.com/emails']);
  assert.match(JSON.parse(calls[0].options.body).text, /not a completed download/);
});

test('removing the temporary override restores the existing stable fallback', async () => {
  const stableUrl = 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/nalana.exe';
  const response = await handleDownload(event('windows', {
    releaseOverride: null, env: { NALANA_WIN_URL: stableUrl },
    fetch: async () => new Response(null, { status: 503 }),
  }));
  assert.equal(response.headers.get('location'), stableUrl);
});
