import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CHANNELS,
  channelBaseUrl,
  channelLabel,
  channelManifestUrl,
  defaultChannel,
  fetchChannelManifest,
  loadChannelManifest,
  resolveChannelDownload,
  validateChannelDownload,
} from '../src/lib/server/release-channel.js';

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}-build-info.json`, import.meta.url), 'utf8'));
const manifests = { stable: await fixture('stable'), beta: await fixture('beta') };
const assets = {
  stable: {
    mac: `${channelBaseUrl('stable')}/nalana-macos-arm64-stable-2.1.0-69a28f77-r33.1.dmg`,
    windows: `${channelBaseUrl('stable')}/nalana-windows-x64-stable-2.1.0-69a28f77-r33.1.exe`,
  },
  beta: {
    mac: `${channelBaseUrl('beta')}/nalana-macos-arm64-beta-b19-154b8f6f.dmg`,
    windows: `${channelBaseUrl('beta')}/nalana-windows-x64-beta-b19-154b8f6f.exe`,
  },
};
const other = { stable: 'beta', beta: 'stable' };

test('channel config pins each channel to its own release tag', () => {
  assert.deepEqual(Object.keys(CHANNELS), ['stable', 'beta']);
  assert.equal(channelManifestUrl('stable'), 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/build-info.json');
  assert.equal(channelManifestUrl('beta'), 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/beta-latest/build-info.json');
});

for (const channel of ['stable', 'beta']) {
  test(`${channel}: resolves both platforms from the live manifest format`, () => {
    for (const platform of ['mac', 'windows']) {
      assert.equal(resolveChannelDownload({ channel, platform, manifest: manifests[channel] }), assets[channel][platform]);
    }
    assert.equal(resolveChannelDownload({ channel, platform: 'linux', manifest: manifests[channel] }), null);
  });

  test(`${channel}: rejects the other channel's manifest and mismatched channel or tag`, () => {
    const manifest = manifests[channel];
    for (const candidate of [manifests[other[channel]], { ...manifest, channel: other[channel] },
      { ...manifest, release_tag: CHANNELS[other[channel]].tag }, { ...manifest, channel: 'dev' }, { ...manifest, release_tag: 'dev-latest' }]) {
      assert.equal(resolveChannelDownload({ channel, platform: 'windows', manifest: candidate }), null);
    }
  });

  test(`${channel}: rejects a correctly labelled manifest pointing at the other channel's assets`, () => {
    const manifest = { ...manifests[channel], builds: manifests[other[channel]].builds };
    assert.equal(resolveChannelDownload({ channel, platform: 'mac', manifest }), null);
    assert.equal(resolveChannelDownload({ channel, platform: 'windows', manifest }), null);
    for (const platform of ['mac', 'windows']) {
      assert.equal(validateChannelDownload(assets[other[channel]][platform], platform, channel), null);
      assert.equal(validateChannelDownload(assets[channel][platform], platform, channel), assets[channel][platform]);
    }
  });
}

test('validation requires https github.com, the allowlisted repo, a flat filename and the platform extension', () => {
  const good = assets.beta.windows;
  for (const value of [
    good.replace('https:', 'http:'),
    good.replace('github.com', 'example.test'),
    good.replace('github.com', 'github.com:8443'),
    good.replace('https://', 'https://user:pass@'),
    good.replace('Nalanaio/nalana-dev-builds', 'Nalanaio/other-repo'),
    `${good}?x=1`,
    `${good}#x`,
    `${channelBaseUrl('beta')}/nested/file.exe`,
    `https://github.com/Nalanaio/nalana-dev-builds/releases/download/beta-latest-old/file.exe`,
    good.replace('.exe', '.dmg'),
    undefined, null, 42, '', 'not a url',
  ]) {
    assert.equal(validateChannelDownload(value, 'windows', 'beta'), null, String(value));
  }
  // Dot segments are normalised before the tag check, so traversal cannot cross channels.
  assert.equal(validateChannelDownload(`${channelBaseUrl('stable')}/../beta-latest/file.exe`, 'windows', 'stable'), null);
  assert.equal(validateChannelDownload(`${channelBaseUrl('beta')}/%2E%2E/stable-latest/file.exe`, 'windows', 'beta'), null);
  assert.equal(validateChannelDownload(assets.beta.mac, 'windows', 'beta'), null);
  assert.equal(validateChannelDownload(good, 'linux', 'beta'), null);
  assert.equal(validateChannelDownload(good, 'windows', 'nightly'), null);
});

test('stable configured fallbacks must pass stable per-tag validation; beta ignores them', () => {
  const fallbackUrls = { mac: assets.stable.mac, windows: assets.stable.windows };
  assert.equal(resolveChannelDownload({ channel: 'stable', platform: 'windows', manifest: null, fallbackUrls }), assets.stable.windows);
  assert.equal(resolveChannelDownload({ channel: 'stable', platform: 'windows', manifest: null, fallbackUrls: { windows: assets.beta.windows } }), null);
  assert.equal(resolveChannelDownload({ channel: 'stable', platform: 'windows', manifest: null, fallbackUrls: { windows: 'https://evil.test/nalana.exe' } }), null);
  assert.equal(resolveChannelDownload({ channel: 'beta', platform: 'windows', manifest: null, fallbackUrls }), null);
  assert.equal(resolveChannelDownload({ channel: 'beta', platform: 'windows', manifest: null, fallbackUrls: { windows: assets.beta.windows } }), null);
  // A valid manifest asset wins over the configured fallback.
  assert.equal(resolveChannelDownload({ channel: 'stable', platform: 'windows', manifest: manifests.stable, fallbackUrls: { windows: `${channelBaseUrl('stable')}/old.exe` } }), assets.stable.windows);
});

test('malformed manifests resolve to nothing instead of throwing', () => {
  for (const manifest of [null, undefined, 'text', 42, [], {}, { ...manifests.beta, builds: null }, { ...manifests.beta, builds: {} },
    { ...manifests.beta, builds: [null, 7, {}] }, { ...manifests.beta, builds: [{ platform: 'Windows x64', download_url: 42 }] },
    { ...manifests.beta, builds: [{ platform: 'Windows x64' }] }]) {
    assert.equal(resolveChannelDownload({ channel: 'beta', platform: 'windows', manifest }), null);
    assert.equal(channelLabel('beta', manifest), 'Nalana Beta');
    assert.equal(channelLabel('stable', manifest), 'Nalana');
  }
  assert.equal(resolveChannelDownload({ channel: 'nightly', platform: 'windows', manifest: manifests.beta }), null);
});

test('stable label shows the version available on both platforms', () => {
  assert.equal(channelLabel('stable', manifests.stable), 'Nalana 2.1');
  assert.equal(channelLabel('stable', { ...manifests.stable, version: '2.1.1' }), 'Nalana 2.1.1');
  for (const manifest of [{ ...manifests.stable, version: undefined }, { ...manifests.stable, version: '<invalid>' },
    { ...manifests.stable, builds: manifests.stable.builds.slice(0, 1) }, manifests.beta]) {
    assert.equal(channelLabel('stable', manifest), 'Nalana');
  }
});

test('beta label shows a positive integer build number only when both installers resolve', () => {
  assert.equal(channelLabel('beta', manifests.beta), 'Nalana Beta (Build 19)');
  assert.equal(channelLabel('beta', { ...manifests.beta, run_number: 20 }), 'Nalana Beta (Build 20)');
  for (const run_number of [0, -1, 1.5, '19', null, undefined, Number.NaN, Infinity]) {
    assert.equal(channelLabel('beta', { ...manifests.beta, run_number }), 'Nalana Beta', String(run_number));
  }
  assert.equal(channelLabel('beta', { ...manifests.beta, builds: manifests.beta.builds.slice(1) }), 'Nalana Beta');
  assert.equal(channelLabel('beta', manifests.stable), 'Nalana Beta');
});

test('manifest loads are uncached, time-limited and per channel', async () => {
  const calls = [];
  const fetch = async (url, options) => { calls.push({ url, options }); return Response.json(manifests.beta); };
  assert.deepEqual(await loadChannelManifest('beta', fetch), manifests.beta);
  assert.equal(calls[0].url, channelManifestUrl('beta'));
  assert.equal(calls[0].options.cache, 'no-store');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  await loadChannelManifest('stable', fetch);
  assert.equal(calls[1].url, channelManifestUrl('stable'));
  assert.equal(await loadChannelManifest('nightly', () => assert.fail('unknown channels never fetch')), null);
});

test('fetch failures, non-200 responses, invalid JSON and timeouts load as null', async () => {
  for (const fetch of [async () => { throw new Error('offline'); }, async () => new Response('', { status: 404 }),
    async () => new Response('', { status: 503 }), async () => new Response('{not json', { status: 200 }),
    async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); }]) {
    assert.equal(await loadChannelManifest('beta', fetch), null);
  }
  assert.deepEqual(await fetchChannelManifest('beta', async () => new Response('', { status: 404 })), { manifest: null, status: 404 });
  assert.deepEqual(await fetchChannelManifest('beta', async () => { throw new Error('offline'); }), { manifest: null, status: null });
});

test('default channel comes from PUBLIC_DEFAULT_DOWNLOAD_CHANNEL and falls back to beta', () => {
  assert.equal(defaultChannel({}), 'beta');
  assert.equal(defaultChannel(undefined), 'beta');
  assert.equal(defaultChannel({ PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'stable' }), 'stable');
  assert.equal(defaultChannel({ PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: ' Stable ' }), 'stable');
  assert.equal(defaultChannel({ PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'beta' }), 'beta');
  for (const value of ['', 'nightly', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(defaultChannel({ PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: value }), 'beta', value);
  }
});
