import test from 'node:test';
import assert from 'node:assert/strict';
import { createVercelAnalytics } from '../src/lib/analytics/vercel.js';

const grant = { choice: { usage: true }, enabled: true };
function surface(url = 'https://www.nalana.io/') {
  const calls = [];
  let loads = 0;
  const window = { location: new URL(url) };
  const controller = createVercelAnalytics({ window, load: async () => {
    loads++;
    return { injectAnalytics: options => calls.push(options) };
  } });
  return { window, controller, calls, loads: () => loads };
}

test('dev, preview, localhost and lookalike origins never load the SDK even with consent', async () => {
  for (const origin of ['https://nalana-grace-dev.vercel.app', 'https://nalana-site-preview.vercel.app',
    'http://localhost:5197', 'https://dev.nalana.io', 'https://www.nalana.io.other.test', 'http://www.nalana.io']) {
    const s = surface(origin);
    await s.controller.update(grant);
    assert.equal(s.loads(), 0, origin);
  }
});

test('production still requires the enabled flag and explicit usage consent', async () => {
  const s = surface();
  for (const options of [{}, { choice: { usage: true } }, { enabled: true },
    { enabled: true, choice: { usage: false, identification: true } }]) await s.controller.update(options);
  assert.equal(s.loads(), 0);
  await s.controller.update(grant);
  await s.controller.update(grant);
  assert.equal(s.loads(), 1);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].mode, 'production');
});

test('neither production origin loads analytics on account, recovery, operator or API routes', async () => {
  for (const origin of ['https://www.nalana.io', 'https://nalana.io']) {
    for (const path of ['/account', '/account/edit', '/login', '/verify-email', '/reset-password',
      '/forgot-password', '/connect-download', '/operator/acquisition', '/api/auth/me']) {
      const s = surface(origin + path);
      await s.controller.update(grant);
      assert.equal(s.loads(), 0, path);
    }
    const s = surface(origin);
    await s.controller.update(grant);
    assert.equal(s.calls.length, 1);
  }
});

test('dispatch strips queries and fragments and rejects private routes or other origins', async () => {
  const s = surface();
  await s.controller.update(grant);
  const send = s.calls[0].beforeSend;
  assert.deepEqual(send({ type: 'pageview', url: 'https://www.nalana.io/?email=private&token=secret#private' }),
    { type: 'pageview', url: 'https://www.nalana.io/' });
  for (const url of ['https://www.nalana.io/login', 'https://www.nalana.io/account/profile',
    'https://www.nalana.io/api/auth/me', 'https://other.test/', 'not-a-url']) {
    assert.equal(send({ type: 'pageview', url }), null, url);
  }
  s.window.location = new URL('https://www.nalana.io/account');
  assert.equal(send({ type: 'pageview', url: 'https://www.nalana.io/' }), null);
});

test('revocation blocks an already loaded tracker and snapshots committed choices', async () => {
  const s = surface();
  const choice = { usage: true };
  await s.controller.update({ choice, enabled: true });
  const event = { type: 'pageview', url: 'https://www.nalana.io/' };
  const send = s.calls[0].beforeSend;
  choice.usage = false; // An unsaved checkbox change is not a committed choice.
  assert.ok(send(event));
  await s.controller.update({ choice, enabled: true });
  assert.equal(send(event), null);
  await s.controller.update(grant);
  assert.ok(send(event));
  assert.equal(s.calls.length, 1);
  await s.controller.update({ choice: { usage: true }, enabled: false });
  assert.equal(send(event), null);
});

test('SDK import completing after revocation or sensitive navigation cannot inject', async () => {
  for (const change of ['revoke', 'navigate']) {
    const window = { location: new URL('https://www.nalana.io/') };
    /** @type {((sdk: Pick<typeof import('@vercel/analytics/sveltekit'), 'injectAnalytics'>) => void) | undefined} */
    let resolveLoad;
    const calls = [];
    const controller = createVercelAnalytics({ window, load: () => new Promise(resolve => { resolveLoad = resolve; }) });
    const pending = controller.update(grant);
    if (change === 'revoke') await controller.update({ choice: { usage: false }, enabled: true });
    else window.location = new URL('https://www.nalana.io/login');
    assert.ok(resolveLoad);
    resolveLoad({ injectAnalytics: options => { calls.push(options); } });
    await pending;
    assert.equal(calls.length, 0);
  }
});

test('concurrent grants inject once and a failed optional load permits a later retry', async () => {
  const s = surface();
  await Promise.all([s.controller.update(grant), s.controller.update(grant)]);
  assert.equal(s.calls.length, 1);
  let attempts = 0;
  const controller = createVercelAnalytics({ window: s.window, load: async () => {
    if (++attempts === 1) throw new Error('synthetic chunk failure');
    return { injectAnalytics: () => {} };
  } });
  await assert.doesNotReject(controller.update(grant));
  await controller.update(grant);
  assert.equal(attempts, 2);
});
