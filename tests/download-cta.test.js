import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { observeDownloadClick } from '../src/lib/download.js';
test('download activation signal is server-safe and never blocks native links',()=>{assert.doesNotThrow(()=>observeDownloadClick('windows'));});
test('every public OS CTA uses canonical no-JS download entry without invented completion',async()=>{
  for(const path of ['src/lib/components/site/DownloadActions.svelte','src/lib/components/Nav.svelte']) {
    const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
    assert.match(source,/href="\/api\/download\?platform=mac"/);
    assert.match(source,/href="\/api\/download\?platform=windows"/);
    assert.doesNotMatch(source,/gtag|preventDefault|setTimeout\(\(\) => openAuthModal/);
  }
  const landing=await readFile(new URL('../src/routes/+page.svelte',import.meta.url),'utf8');
  const vision=await readFile(new URL('../src/lib/components/site/VisionSection.svelte',import.meta.url),'utf8');
  assert.match(landing,/<DownloadActions\s+platform=/);
  assert.match(vision,/<DownloadActions\s+\{platform\}/);
});

test('click handler keeps the rendered query (channel, utm) and resets only what it added', t => {
  const previousWindow = globalThis.window, previousAnchor = globalThis.HTMLAnchorElement;
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousAnchor === undefined) delete globalThis.HTMLAnchorElement; else globalThis.HTMLAnchorElement = previousAnchor;
  });
  Object.assign(globalThis, { window: { location: { pathname: '/', href: 'https://nalana.io/' } }, HTMLAnchorElement: class { href = ''; } });
  const anchor = new globalThis.HTMLAnchorElement();
  anchor.href = '/api/download?platform=windows&channel=beta&utm_source=newsletter';
  observeDownloadClick('windows', { currentTarget: anchor });
  assert.equal(anchor.href, '/api/download?platform=windows&channel=beta&utm_source=newsletter');
  // A stale click id from a previous activation is dropped; the channel is not.
  anchor.href += '&click_id=stale';
  observeDownloadClick('windows', { currentTarget: anchor });
  assert.doesNotMatch(anchor.href, /click_id/);
  observeDownloadClick('windows', { currentTarget: anchor });
  assert.equal(anchor.href, '/api/download?platform=windows&channel=beta&utm_source=newsletter');
  // An href re-rendered by the page (e.g. a channel switch) becomes the new base.
  anchor.href = '/api/download?platform=mac&channel=stable';
  observeDownloadClick('mac', { currentTarget: anchor });
  assert.equal(anchor.href, '/api/download?platform=mac&channel=stable');
  // Absolute hrefs, as real anchors report them, stay absolute.
  const absolute = new globalThis.HTMLAnchorElement();
  absolute.href = 'https://nalana.io/api/download?platform=mac&channel=beta';
  observeDownloadClick('mac', { currentTarget: absolute });
  assert.equal(absolute.href, 'https://nalana.io/api/download?platform=mac&channel=beta');
});
