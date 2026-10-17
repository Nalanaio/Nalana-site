import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { kitPreloadErrors } from '../vite-plugins/kit-preload-errors.js';

const id = '/node_modules/@sveltejs/kit/src/runtime/client/client.js';

test('installed Kit speculative imports own their rejections while awaited loads remain unchanged', async () => {
  const source = await readFile(new URL('../node_modules/@sveltejs/kit/src/runtime/client/client.js', import.meta.url), 'utf8');
  const result = kitPreloadErrors().transform(source, id, { ssr: false });
  assert.ok(result.code.includes('void default_layout_loader().catch(() => {});'));
  assert.ok(result.code.includes('void default_error_loader().catch(() => {});'));
  // Required loads must retain their original error path; only these two
  // unused, speculative import promises may acquire rejection handlers.
  assert.equal(result.code.replaceAll('.catch(() => {});', ';'), source);
});

test('Kit runtime drift fails with a maintenance instruction', () => {
  assert.throws(() => kitPreloadErrors().transform('void a_new_loader();', id, {}), /Recheck.*compatibility/);
});

test('server and application modules are never transformed', () => {
  const plugin = kitPreloadErrors();
  assert.equal(plugin.transform('source', id, { ssr: true }), undefined);
  assert.equal(plugin.transform('source', '/src/app.js', {}), undefined);
});
