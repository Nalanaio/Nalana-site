import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignContext, captureCampaign, clearCampaign, queueSignupMeasurement, consumeSignupMeasurement } from '../src/lib/analytics/attribution.js';
import { CONSENT_KEY } from '../src/lib/analytics/consent.js';
import { loadAnalytics, trackDownloadClick, trackSignup, stopAnalytics } from '../src/lib/analytics/loaders.js';
import { createSessionController } from '../src/lib/auth/session.js';

const choice = { version: 1, usage: true, identification: false, decided: true };
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
function surface() {
  const scripts = [];
  return {
    window: { location: { origin: 'https://nalana.test', pathname: '/', search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch&utm_content=First+ad' }, sessionStorage: storage(), localStorage: storage() },
    document: { getElementById: id => scripts.find(s => s.id === id), createElement: () => ({}), head: { appendChild: s => scripts.push(s) } }
  };
}

test('landing tags wait in memory until consent and survive navigation and a fresh signup document', () => {
  const s = surface();
  captureCampaign(s.window, 1000);
  assert.equal(s.window.sessionStorage.values.size, 0);
  s.window.location.search = '';
  s.window.location.pathname = '/privacy';
  assert.equal(campaignContext(s.window, choice, 2000).utm_content, 'First ad');
  const next = { ...s.window, location: { ...s.window.location, pathname: '/login' } };
  assert.equal(campaignContext(next, choice, 3000).utm_campaign, 'launch');
  assert.deepEqual(campaignContext(next, choice, 1801001), {});
});

test('a new campaign replaces every old label, invalid new touches cannot inherit an old ad', () => {
  const s = surface();
  campaignContext(s.window, choice);
  s.window.location.search = '?utm_source=instagram&utm_medium=paid_social&utm_campaign=second';
  assert.deepEqual(campaignContext(s.window, choice), { utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'second' });
  s.window.location.search = '?utm_campaign={{campaign.name}}';
  assert.deepEqual(campaignContext(s.window, choice), {});
  s.window.location.search = '';
  assert.deepEqual(campaignContext(s.window, choice), {});
});

test('reading conversion attribution does not renew a tagged landing timestamp', () => {
  const s = surface();
  assert.equal(campaignContext(s.window, choice, 1000).utm_source, 'facebook');
  assert.equal(campaignContext(s.window, choice, 1801000).utm_source, 'facebook');
  assert.deepEqual(campaignContext(s.window, choice, 1801001), {});
});

test('denial and revocation erase attribution and pending signup, no pre-consent persistence', () => {
  const s = surface();
  s.window.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
  campaignContext(s.window, choice);
  assert.equal(queueSignupMeasurement(s.window), true);
  campaignContext(s.window, { usage: false, decided: true });
  assert.equal(s.window.sessionStorage.values.size, 0);
  s.window.location.search = '';
  assert.deepEqual(campaignContext(s.window, choice), {});
  clearCampaign(s.window);
});

test('signup marker is consented, one-shot, short-lived and contains no identity', () => {
  const s = surface();
  assert.equal(queueSignupMeasurement(s.window, 100), false);
  s.window.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
  assert.equal(queueSignupMeasurement(s.window, 100), true);
  assert.equal(consumeSignupMeasurement(s.window, 200), true);
  assert.equal(consumeSignupMeasurement(s.window, 201), false);
  queueSignupMeasurement(s.window, 100);
  assert.equal(consumeSignupMeasurement(s.window, 60101), false);
  queueSignupMeasurement(s.window, 100);
  assert.equal(consumeSignupMeasurement(s.window, 99), false);
  queueSignupMeasurement(s.window, 100);
  s.window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...choice, usage: false }));
  assert.equal(consumeSignupMeasurement(s.window, 200), false);
});

test('blocked browser storage never prevents registration', () => {
  const window = { get localStorage() { throw new Error('blocked'); }, get sessionStorage() { throw new Error('blocked'); } };
  assert.equal(queueSignupMeasurement(window), false);
  assert.equal(consumeSignupMeasurement(window), false);
});

test('measurement document navigation requires a session that survived a storage read-back', () => {
  const saved = storage();
  const auth = createSessionController({ storage: saved });
  assert.equal(auth.canRestoreSession(), false);
  auth.setSession('synthetic-token', { id: 'synthetic-user' });
  assert.equal(auth.canRestoreSession(), true);
  saved.removeItem('nalana_session_v1');
  assert.equal(auth.canRestoreSession(), false);
  const memoryOnly = createSessionController({ storage: { ...storage(), setItem() { throw new Error('quota'); } } });
  memoryOnly.setSession('synthetic-token', { id: 'synthetic-user' });
  assert.equal(memoryOnly.canRestoreSession(), false);
  assert.equal(memoryOnly.current.token, 'synthetic-token');
});

test('download and signup retain campaign after URL cleanup; signup cannot fire on credential pages', () => {
  const s = surface();
  loadAnalytics({ ...s, pathname: '/', choice, enabled: true });
  s.window.location.search = '';
  trackDownloadClick({ window: s.window, platform: 'mac' });
  const click = s.window.dataLayer.find(call => call[1] === 'download_clicked');
  assert.equal(click[2].campaign_source, 'facebook');
  assert.equal(click[2].campaign_content, 'First ad');
  s.window.location.pathname = '/login';
  let done = 0;
  trackSignup({ window: s.window, done: () => done++ });
  assert.equal(done, 1);
  assert.equal(s.window.dataLayer.some(call => call[1] === 'sign_up'), false);
  s.window.location.pathname = '/signup-complete';
  trackSignup({ window: s.window, done: () => done++ });
  const signup = s.window.dataLayer.find(call => call[1] === 'sign_up');
  assert.equal(signup[2].campaign_source, 'facebook');
  assert.equal(signup[2].method, 'email');
  assert.equal(signup[2].page_location, 'https://nalana.test/signup-complete');
  assert.equal(JSON.stringify(signup).includes('email_address'), false);
});

test('revocation drops queued commands and blocks additional conversion dispatch', () => {
  const s = surface();
  loadAnalytics({ ...s, pathname: '/', choice, enabled: true });
  s.document.getElementById('nalana-ga').remove = () => {};
  stopAnalytics(s);
  assert.equal(s.window.dataLayer.length, 0);
  trackDownloadClick({ window: s.window, platform: 'windows' });
  s.window.location.pathname = '/signup-complete';
  let finished = false;
  trackSignup({ window: s.window, done: () => { finished = true; } });
  assert.equal(finished, true);
  assert.equal(s.window.dataLayer.length, 0);
});
