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
