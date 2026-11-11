import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { channelManifestUrl, homepageDownloads, loadReleases, pageChannel } from '../src/lib/server/release-channel.js';

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}-build-info.json`, import.meta.url), 'utf8'));
const manifests = { stable: await fixture('stable'), beta: await fixture('beta') };

/** A manifest fetch that records requests; `down` channels answer 404 or throw. */
function manifestFetch({ down = {} } = {}) {
  const requested = [];
  let inFlight = 0, peak = 0;
  const fetch = async (url) => {
    requested.push(url);
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setImmediate(resolve));
    inFlight--;
    const channel = Object.keys(manifests).find(name => url === channelManifestUrl(name));
    if (down[channel] === 'throw') throw new Error('offline');
    if (down[channel]) return new Response('Not Found', { status: 404 });
    return Response.json(manifests[channel]);
  };
  return { fetch, requested, peak: () => peak };
}

test('the page channel comes from ?channel=, then PUBLIC_DEFAULT_DOWNLOAD_CHANNEL, then beta', () => {
  const page = (query) => new URL(`https://www.nalana.io/${query}`);
  assert.equal(pageChannel(page('?channel=stable'), { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'beta' }), 'stable');
  assert.equal(pageChannel(page('?channel=beta'), { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'stable' }), 'beta');
  assert.equal(pageChannel(page(''), { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'stable' }), 'stable');
  assert.equal(pageChannel(page(''), {}), 'beta');
  // An unknown query value is ignored rather than rendering a broken toggle.
  assert.equal(pageChannel(page('?channel=nightly'), { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'stable' }), 'stable');
});

test('both manifests load in parallel and return labels plus availability', async () => {
  const io = manifestFetch();
  const releases = await loadReleases(io.fetch, {});
  assert.deepEqual(releases, {
    stable: { label: 'Nalana 2.1', available: true },
    beta: { label: 'Nalana Beta (Build 19)', available: true },
  });
  assert.deepEqual([...io.requested].sort(), [channelManifestUrl('beta'), channelManifestUrl('stable')]);
  assert.equal(io.peak(), 2);
});

test('a missing beta manifest marks beta unavailable without borrowing stable fallbacks', async () => {
  const env = { NALANA_MAC_URL: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/a.dmg', NALANA_WIN_URL: 'https://github.com/Nalanaio/nalana-dev-builds/releases/download/stable-latest/a.exe' };
  for (const down of ['404', 'throw']) {
    const releases = await loadReleases(manifestFetch({ down: { beta: down === 'throw' ? 'throw' : true } }).fetch, env);
    assert.deepEqual(releases.beta, { label: 'Nalana Beta', available: false });
    assert.equal(releases.stable.available, true);
  }
  // Stable stays downloadable through its configured stable fallbacks, as /api/download does.
  const stableDown = await loadReleases(manifestFetch({ down: { stable: true } }).fetch, env);
  assert.deepEqual(stableDown.stable, { label: 'Nalana', available: true });
  const noFallback = await loadReleases(manifestFetch({ down: { stable: true } }).fetch, {});
  assert.deepEqual(noFallback.stable, { label: 'Nalana', available: false });
});

test('the homepage data returns the page channel and both releases', async () => {
  const run = (query, env, fetch = manifestFetch().fetch) => homepageDownloads({ fetch, url: new URL(`https://www.nalana.io/${query}`), env });
  const configured = await run('', { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'stable' });
  assert.deepEqual(configured, {
    channel: 'stable',
    releases: { stable: { label: 'Nalana 2.1', available: true }, beta: { label: 'Nalana Beta (Build 19)', available: true } },
    productLabel: 'Nalana 2.1',
  });
  const unset = await run('', {});
  assert.equal(unset.channel, 'beta');
  assert.equal(unset.productLabel, 'Nalana Beta (Build 19)');
  const shared = await run('?channel=stable', { PUBLIC_DEFAULT_DOWNLOAD_CHANNEL: 'beta' });
  assert.equal(shared.channel, 'stable');
  // The selected channel stays selected when its build is down; the page offers the other one explicitly.
  const betaDown = await run('?channel=beta', {}, manifestFetch({ down: { beta: true } }).fetch);
  assert.equal(betaDown.channel, 'beta');
  assert.deepEqual(betaDown.releases.beta, { label: 'Nalana Beta', available: false });
});

test('the homepage server load uses the shared download data and the SvelteKit environment', async () => {
  const source = await readFile(new URL('../src/routes/+page.server.js', import.meta.url), 'utf8');
  assert.match(source, /homepageDownloads\(\{ fetch, url, env: campaignEnvironment\(\) \}\)/);
});
