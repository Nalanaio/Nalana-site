import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STABLE_RELEASE_CHANNEL,
  resolveStableDownload,
  STABLE_RELEASE_BASE_URL,
  STABLE_RELEASE_TAG,
  loadStableManifest,
  stableReleaseLabel,
} from '../src/lib/server/stable-release.js';

const stableManifest = {
  version: '2.1.0',
  channel: 'stable',
  release_tag: 'stable-latest',
  builds: [
    {
      platform: 'Windows x64',
      download_url: `${STABLE_RELEASE_BASE_URL}/nalana-windows-x64-stable-a1b2c3d4-r42.1.exe`,
    },
    {
      platform: 'macOS Apple Silicon',
      download_url: `${STABLE_RELEASE_BASE_URL}/nalana-macos-arm64-stable-a1b2c3d4-r42.1.dmg`,
    },
  ],
};

test('labels the version actually available for both supported platforms', () => {
  assert.equal(stableReleaseLabel(stableManifest), 'Nalana 2.1');
  assert.equal(stableReleaseLabel({ ...stableManifest, version: '2.1.1' }), 'Nalana 2.1.1');
  for (const manifest of [null, { ...stableManifest, version: undefined },
    { ...stableManifest, channel: 'beta' }, { ...stableManifest, builds: [] },
    { ...stableManifest, version: '<invalid>' }]) {
    assert.equal(stableReleaseLabel(manifest), 'Nalana');
  }
});

test('manifest failures keep the homepage and configured fallback downloads available', async () => {
  for (const fetch of [async () => { throw new Error('offline'); },
    async () => ({ ok: false }), async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })]) {
    const manifest = await loadStableManifest(fetch);
    assert.equal(stableReleaseLabel(manifest), 'Nalana');
    assert.equal(resolveStableDownload({ platform: 'windows', manifest, fallbackUrls: { windows: 'https://downloads.example.test/nalana.exe' } }), 'https://downloads.example.test/nalana.exe');
  }
});

test('uses the stable release channel for public downloads', () => {
  assert.equal(STABLE_RELEASE_CHANNEL, 'stable');
  assert.equal(STABLE_RELEASE_TAG, 'stable-latest');
});

test('resolves the Windows installer from the current public manifest', () => {
  assert.equal(
    resolveStableDownload({ platform: 'windows', manifest: stableManifest }),
    `${STABLE_RELEASE_BASE_URL}/nalana-windows-x64-stable-a1b2c3d4-r42.1.exe`,
  );
});

test('resolves the Apple Silicon installer from the current public manifest', () => {
  assert.equal(
    resolveStableDownload({ platform: 'mac', manifest: stableManifest }),
    `${STABLE_RELEASE_BASE_URL}/nalana-macos-arm64-stable-a1b2c3d4-r42.1.dmg`,
  );
});

test('falls back to the configured installer when the public manifest is unavailable', () => {
  assert.equal(
    resolveStableDownload({
      platform: 'windows',
      manifest: null,
      fallbackUrls: { windows: 'https://downloads.example.test/nalana.exe' },
    }),
    'https://downloads.example.test/nalana.exe',
  );
});

test('rejects manifests from another channel or release tag', () => {
  assert.equal(
    resolveStableDownload({
      platform: 'windows',
      manifest: { ...stableManifest, channel: 'dev' },
    }),
    null,
  );
  assert.equal(
    resolveStableDownload({
      platform: 'windows',
      manifest: { ...stableManifest, release_tag: 'dev-latest' },
    }),
    null,
  );
});

test('rejects download URLs outside the stable public release', () => {
  const manifest = {
    ...stableManifest,
    builds: [
      {
        platform: 'Windows x64',
        download_url: 'https://example.test/untrusted.exe',
      },
    ],
  };

  assert.equal(resolveStableDownload({ platform: 'windows', manifest }), null);
});

test('rejects unsupported platforms', () => {
  assert.equal(resolveStableDownload({ platform: 'linux', manifest: stableManifest }), null);
});
