import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createGoogleCompletion } from '../src/lib/auth/googleCompletion.js';
const complete = '/api/auth/google/complete', ack = '/api/auth/google/acknowledge', cancel = '/api/auth/google/cancel';
const deferred = () => { let resolve = () => {}; const promise = new Promise(r => resolve = () => r(undefined)); return { promise, resolve }; };

test('mount automatically completes then acknowledges cookie readback once before account navigation', async () => {
  const wait = deferred(), calls = [], navigations = [];
  const flow = createGoogleCompletion({ request: async (path, init) => { calls.push([path, init.method]); if (path === complete) await wait.promise; return new Response(null, { status: 200 }); }, navigate: path => navigations.push(path) });
  const run = flow.mount(); flow.mount(); flow.retry();
  assert.deepEqual(calls, [[complete, 'POST']]); assert.deepEqual(navigations, []);
  wait.resolve(); await run;
  assert.deepEqual(calls, [[complete, 'POST'], [ack, 'POST']]); assert.deepEqual(navigations, ['/account']);
});

test('transient completion and acknowledgment failures wait for explicit retry without loops or repeated redemption', async () => {
  const calls = []; let attempt = 0;
  const flow = createGoogleCompletion({ request: async path => { calls.push(path); return new Response(null, { status: ++attempt === 1 || attempt === 3 ? 503 : 200 }); }, navigate() {} });
  await flow.mount(); assert.equal(flow.current.phase, 'retry'); assert.equal(calls.length, 1);
  await flow.retry(); assert.equal(flow.current.phase, 'retry'); assert.deepEqual(calls, [complete, complete, ack]);
  await flow.retry(); assert.equal(flow.current.phase, 'done'); assert.deepEqual(calls, [complete, complete, ack, ack]);
});

test('network loss can be retried while terminal expiry stops redemption', async () => {
  let calls = 0;
  const flow = createGoogleCompletion({ request: async () => { if (++calls === 1) throw new Error('offline'); return new Response(null, { status: 400 }); }, navigate() {} });
  await flow.mount(); assert.equal(flow.current.phase, 'retry');
  await flow.retry(); assert.equal(flow.current.phase, 'terminal');
  await flow.retry(); flow.mount(); assert.equal(calls, 2);
});

test('callback proof survives an offline first POST and is never sent to acknowledgment', async () => {
  const returned = { transaction_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', web_return_proof: 'callback-proof-fixture-at-least-32-chars' }, calls = [];
  const flow = createGoogleCompletion({ returned, request: async (path, init) => { calls.push({ path, body: init.body }); if (calls.length === 1) throw new Error('offline before BFF'); return new Response(null, { status: 200 }); }, navigate() {} });
  await flow.mount(); await flow.retry();
  assert.deepEqual(JSON.parse(calls[0].body), returned); assert.equal(calls[1].body, calls[0].body); assert.equal(calls[2].body, undefined);
});

test('Go back is irreversible once acknowledgment is dispatched, including a lost acknowledgment response', async () => {
  const wait = deferred(), calls = [], navigations = []; let firstAck = true;
  const flow = createGoogleCompletion({ request: async path => { calls.push(path); if (path === ack && firstAck) { firstAck = false; await wait.promise; throw new Error('lost ack'); } return new Response(null, { status: 200 }); }, navigate: path => navigations.push(path) });
  const run = flow.mount(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(flow.current.confirmationStarted, true); await flow.goBack(); assert.deepEqual(calls, [complete, ack]);
  wait.resolve(); await run; await flow.goBack(); assert.equal(flow.current.phase, 'retry'); assert.deepEqual(navigations, []); assert.deepEqual(calls, [complete, ack]);
  await flow.retry(); assert.deepEqual(calls, [complete, ack, ack]); assert.deepEqual(navigations, ['/account']);
});

test('Go back waits for in-flight completion, skips acknowledgment and navigates only after cancellation acknowledgment', async () => {
  const wait = deferred(), calls = [], navigations = []; let cancelStatus = 503;
  const flow = createGoogleCompletion({ request: async path => { calls.push(path); if (path === complete) await wait.promise; return new Response(null, { status: path === cancel ? cancelStatus : 200 }); }, navigate: path => navigations.push(path) });
  const run = flow.mount(), back = flow.goBack(); assert.deepEqual(calls, [complete]);
  wait.resolve(); await Promise.all([run, back]);
  assert.deepEqual(calls, [complete, cancel]); assert.deepEqual(navigations, []); assert.equal(flow.current.phase, 'cancel-error');
  cancelStatus = 200; await flow.goBack(); assert.deepEqual(navigations, ['/login']);
});

test('unmount and logout epoch changes stop late acknowledgment and navigation', async () => {
  for (const change of ['unmount', 'logout']) {
    let epoch = 0; const wait = deferred(), calls = [], navigations = [];
    const flow = createGoogleCompletion({ request: async path => { calls.push(path); await wait.promise; return new Response(null, { status: 200 }); }, navigate: path => navigations.push(path), epoch: () => epoch });
    const run = flow.mount(); if (change === 'unmount') flow.dispose(); else epoch++;
    wait.resolve(); await run; assert.deepEqual(calls, [complete]); assert.deepEqual(navigations, []);
  }
});

test('ordinary Google entry visibly explains account creation and Terms/Privacy before the button on both auth surfaces', async () => {
  const source = await readFile(new URL('../src/lib/components/GoogleSignIn.svelte', import.meta.url), 'utf8');
  assert.match(source, /sign in or create an account/); assert.match(source, /agree to Nalana/);
  for (const path of ['/terms', '/privacy']) assert.ok(source.indexOf(`href="${path}"`) < source.indexOf('<button class="google-button"'));
  for (const path of ['../src/routes/login/+page.svelte', '../src/lib/components/AuthModal.svelte']) assert.match(await readFile(new URL(path, import.meta.url), 'utf8'), /<GoogleSignIn\s*\/>/);
  const page = await readFile(new URL('../src/routes/auth/google/complete/+page.svelte', import.meta.url), 'utf8');
  assert.match(page, /onMount/); assert.match(page, /completion\.mount\(\)/); assert.match(page, />Go back</); assert.doesNotMatch(page, />Cancel<|Continue to Nalana/);
});

test('callback fragment is synchronously stripped before all application scripts and captured only once', async () => {
  const html = await readFile(new URL('../src/app.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(html.indexOf('</script>') < html.indexOf('%sveltekit.head%'));
  for (const fragment of ['#transaction_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&web_return_proof=callback-proof-fixture-at-least-32-chars', '#transaction_id=bad&web_return_proof=secret', '#transaction_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&web_return_proof=x&web_return_proof=y', '#' + 'x'.repeat(1201)]) {
    let replaced = false;
    const browser = { location: { pathname: '/auth/google/complete', hash: fragment }, history: { state: {}, replaceState(_state, _title, path) { assert.equal(path, '/auth/google/complete'); replaced = true; browser.location.hash = ''; } } };
    runInNewContext(script, { window: browser, URLSearchParams });
    assert.equal(replaced, true); assert.equal(browser.location.hash, ''); assert.equal(Object.keys(browser).includes('__nalanaTakeGoogleReturn'), false);
    const returned = browser.__nalanaTakeGoogleReturn();
    assert.equal(browser.__nalanaTakeGoogleReturn, undefined);
    if (fragment.includes('at-least-32')) assert.equal(returned.web_return_proof, 'callback-proof-fixture-at-least-32-chars'); else assert.equal(returned.invalid, true);
  }
});
