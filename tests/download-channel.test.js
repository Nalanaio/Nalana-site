import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHANNEL_STORAGE_KEY, channelPageHref, downloadHref, effectiveChannel, isDownloadChannel,
  readStoredChannel, rememberChannel, restoredChannel,
} from '../src/lib/download-channel.js';
import { CHANNELS } from '../src/lib/server/release-channel.js';

function storage(entries = {}, { broken = false } = {}) {
  const values = new Map(Object.entries(entries));
  const fail = () => { throw new Error('blocked'); };
  return {
    getItem: key => broken ? fail() : values.get(key) ?? null,
    setItem: (key, value) => broken ? fail() : values.set(key, String(value)),
    values,
  };
}
const browser = (href, entries, options) => ({ location: { href }, localStorage: storage(entries, options), history: { state: null, replaceState() {} } });
const both = { stable: { label: 'Nalana 2.1', available: true }, beta: { label: 'Nalana Beta (Build 19)', available: true } };

test('client channels match the server resolver', () => {
  assert.deepEqual(Object.keys(CHANNELS), ['stable', 'beta']);
  for (const channel of Object.keys(CHANNELS)) assert.equal(isDownloadChannel(channel), true);
  for (const value of ['', 'Beta', 'nightly', null, undefined, 1]) assert.equal(isDownloadChannel(value), false);
});

test('download hrefs always name the selected channel', () => {
  assert.equal(downloadHref('mac', 'beta'), '/api/download?platform=mac&channel=beta');
  assert.equal(downloadHref('windows', 'stable'), '/api/download?platform=windows&channel=stable');
});

test('page links keep campaign labels and the fragment while switching channel', () => {
  assert.equal(channelPageHref('https://nalana.io/?utm_source=newsletter#vision', 'stable'), '/?utm_source=newsletter&channel=stable#vision');
  assert.equal(channelPageHref(new URL('https://nalana.io/?channel=stable'), 'beta'), '/?channel=beta');
});

test('an explicit choice is remembered and mirrored into ?channel=, and storage failures are harmless', () => {
  const window = browser('https://nalana.io/?utm_source=x');
  const replaced = [];
  rememberChannel(window, 'stable', href => replaced.push(href));
  assert.equal(window.localStorage.values.get(CHANNEL_STORAGE_KEY), 'stable');
  assert.deepEqual(replaced, ['/?utm_source=x&channel=stable']);
  const blocked = browser('https://nalana.io/', {}, { broken: true });
  assert.doesNotThrow(() => rememberChannel(blocked, 'beta', () => { throw new Error('router not ready'); }));
  assert.equal(readStoredChannel(blocked), null);
  assert.equal(readStoredChannel(browser('https://nalana.io/', { [CHANNEL_STORAGE_KEY]: 'nightly' })), null);
});

test('a remembered choice applies only without ?channel= and only to an available channel', () => {
  const stored = { [CHANNEL_STORAGE_KEY]: 'stable' };
  assert.equal(restoredChannel(browser('https://nalana.io/', stored), 'beta', both), 'stable');
  assert.equal(restoredChannel(browser('https://nalana.io/?channel=beta', stored), 'beta', both), null);
  assert.equal(restoredChannel(browser('https://nalana.io/', stored), 'stable', both), null);
  assert.equal(restoredChannel(browser('https://nalana.io/', {}), 'beta', both), null);
  const stableDown = { ...both, stable: { label: 'Nalana', available: false } };
  assert.equal(restoredChannel(browser('https://nalana.io/', stored), 'beta', stableDown), null);
});

test('an unavailable selected channel is offered explicitly as the other one, never when both are down', () => {
  assert.equal(effectiveChannel('beta', both), 'beta');
  const betaDown = { ...both, beta: { label: 'Nalana Beta', available: false } };
  assert.equal(effectiveChannel('beta', betaDown), 'stable');
  assert.equal(effectiveChannel('stable', betaDown), 'stable');
  assert.equal(effectiveChannel('beta', { stable: { available: false }, beta: { available: false } }), 'beta');
  assert.equal(effectiveChannel('beta', {}), 'beta');
});

test('the toggle markup is an accessible radiogroup with a no-JS link fallback and a linked live hint', async () => {
  const toggle = await readFile(new URL('../src/lib/components/site/ChannelToggle.svelte', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../src/lib/components/site/DownloadActions.svelte', import.meta.url), 'utf8');
  assert.match(toggle, /role="radiogroup" aria-label="Release channel"/);
  assert.match(toggle, /role="radio"/);
  assert.match(toggle, /aria-checked=\{channel===value\}/);
  assert.match(toggle, /tabindex=\{channel===value\?0:-1\}/);
  assert.match(toggle, /aria-disabled=\{unavailable\(value\)\?'true':undefined\}/);
  assert.match(toggle, /href=\{unavailable\(value\)\?undefined:channelPageHref\(page\.url,value\)\}/);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) assert.ok(toggle.includes(`'${key}'`), key);
  assert.match(actions, /aria-live="polite"/);
  assert.match(actions, /aria-describedby=\{described\?hintId:undefined\}/);
  assert.ok(actions.includes("<strong>Beta may be unstable.</strong></p>"));
  assert.doesNotMatch(actions, /separate beta account/);
  assert.doesNotMatch(actions, /SmartScreen/);
  assert.ok(actions.includes('builds are temporarily unavailable. Try again shortly.'));
});
