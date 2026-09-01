import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveStableDownload,
  STABLE_RELEASE_BASE_URL,
} from '../src/lib/server/stable-release.js';

const stableManifest = {
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

test('resolves the Windows installer from the stable manifest', () => {
  assert.equal(
    resolveStableDownload({ platform: 'windows', manifest: stableManifest }),
    `${STABLE_RELEASE_BASE_URL}/nalana-windows-x64-stable-a1b2c3d4-r42.1.exe`,
  );
});

test('resolves the Apple Silicon installer from the stable manifest', () => {
  assert.equal(
    resolveStableDownload({ platform: 'mac', manifest: stableManifest }),
    `${STABLE_RELEASE_BASE_URL}/nalana-macos-arm64-stable-a1b2c3d4-r42.1.dmg`,
  );
});

test('falls back to the configured production installer before stable-latest exists', () => {
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
