import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEV_RELEASE_REPO,
  DEV_RELEASE_CHANNEL,
  DEV_RELEASE_TAG,
  DEV_MANIFEST_URL,
  loadDevManifest,
} from '../src/lib/server/dev-release.js';

test('dev download route targets the new developer release channel and tag', () => {
  assert.equal(DEV_RELEASE_REPO, 'Nalanaio/nalana-dev-builds');
  assert.equal(DEV_RELEASE_CHANNEL, 'developer');
  assert.equal(DEV_RELEASE_TAG, 'developer-latest');
  assert.equal(
    DEV_MANIFEST_URL,
    'https://github.com/Nalanaio/nalana-dev-builds/releases/download/developer-latest/build-info.json',
  );
});

test('loadDevManifest loads and parses the developer manifest on success', async () => {
  const fakeManifest = {
    channel: 'developer',
    release_tag: 'developer-latest',
    run_number: 351,
    commit: '1fac0c3ee80d08858c59e8cd42207bf701cd71b2',
    builds: [
      {
        platform: 'Windows x64',
        filename: 'nalana-windows-x64-developer-b351-1fac0c3e.exe',
        download_url: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/developer-latest/nalana-windows-x64-developer-b351-1fac0c3e.exe',
      },
    ],
  };

  const mockFetch = async (url, options) => {
    assert.equal(url, DEV_MANIFEST_URL);
    assert.equal(options.headers.accept, 'application/json');
    assert.equal(options.cache, 'no-store');
    return {
      ok: true,
      status: 200,
      json: async () => fakeManifest,
    };
  };

  const result = await loadDevManifest(mockFetch);
  assert.equal(result.error, null);
  assert.deepEqual(result.manifest, fakeManifest);
});

test('loadDevManifest returns user-friendly error message on 404 or non-200 status', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 404,
  });

  const result = await loadDevManifest(mockFetch);
  assert.equal(result.manifest, null);
  assert.equal(result.error, 'The latest dev build is not available yet (404).');
});

test('loadDevManifest returns graceful error on fetch exception', async () => {
  const mockFetch = async () => {
    throw new Error('Connection refused');
  };

  const result = await loadDevManifest(mockFetch);
  assert.equal(result.manifest, null);
  assert.equal(result.error, 'Could not reach the dev build service. Try again shortly.');
});
