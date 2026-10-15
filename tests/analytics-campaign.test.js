import test from 'node:test';
import assert from 'node:assert/strict';
import * as analytics from '../src/lib/analytics/loaders.js';
import { observeDownloadClick } from '../src/lib/download.js';

function surface(search = '') {
  const scripts = [], calls = [];
  const document = { getElementById: id => scripts.find(s => s.id === id), createElement: () => ({}), head: { appendChild: s => scripts.push(s) } };
  const window = { location: { origin: 'https://nalana.test', pathname: '/', search }, dataLayer: calls };
  return { document, window, calls, scripts };
}
const choice = { usage: true, identification: false };

test('Google tag receives commands as Arguments objects, including download events', () => {
  const s = surface();
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  analytics.trackDownloadClick({ window: s.window, platform: 'windows' });
  assert.deepEqual(s.calls.map(call => call[0]), ['consent', 'js', 'config', 'event', 'event']);
  for (const call of s.calls) {
    assert.equal(Object.prototype.toString.call(call), '[object Arguments]');
  }
});

test('GA receives campaign and creative tags without unrelated query data or fragments', () => {
  const s = surface('?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch&utm_content=Just%20Start%20Creating&utm_id=123&token=private&email=private%40example.test&fbclid=private#private');
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  for (const call of s.calls.filter(call => call[0] === 'config' || call[1] === 'page_view')) {
    const location = new URL(call[2].page_location);
    assert.equal(location.searchParams.get('utm_source'), 'facebook');
    assert.equal(location.searchParams.get('utm_medium'), 'paid_social');
    assert.equal(location.searchParams.get('utm_campaign'), 'launch');
    assert.equal(location.searchParams.get('utm_content'), 'Just Start Creating');
    assert.equal(location.searchParams.get('utm_id'), '123');
    assert.equal(location.searchParams.size, 5);
    assert.equal(location.hash, '');
  }
});

test('campaign values reject private data, unresolved Meta macros, duplicates and excessive length', () => {
  const s = surface('?utm_source=facebook&utm_source=other&utm_medium=paid_social&utm_campaign=person%40example.test&utm_content=%7B%7Bad.name%7D%7D&utm_id=' + 'x'.repeat(201));
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  assert.equal(s.calls[2][2].page_location, 'https://nalana.test/?utm_medium=paid_social');
});

test('a new campaign on the same path is measured once and navigation does not copy old tags', () => {
  const s = surface('?utm_source=facebook&utm_medium=paid_social&utm_campaign=first');
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  s.window.location.search = '?utm_source=facebook&utm_medium=paid_social&utm_campaign=second';
  analytics.trackPageView({ ...s, choice, pathname: '/', enabled: true });
  analytics.trackPageView({ ...s, choice, pathname: '/', enabled: true });
  s.window.location.pathname = '/privacy'; s.window.location.search = '';
  analytics.trackPageView({ ...s, choice, pathname: '/privacy', enabled: true });
  const views = s.calls.filter(call => call[1] === 'page_view');
  assert.equal(views.length, 3);
  assert.equal(new URL(views[1][2].page_location).searchParams.get('utm_campaign'), 'second');
  assert.equal(views[2][2].page_location, 'https://nalana.test/privacy');
});

test('download clicks require current consent and never represent completion', () => {
  assert.equal(typeof analytics.trackDownloadClick, 'function');
  const s = surface('?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch');
  analytics.trackDownloadClick({ window: s.window, platform: 'windows' });
  assert.equal(s.calls.length, 0);
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  analytics.trackDownloadClick({ window: s.window, platform: 'windows' });
  const clicks = () => s.calls.filter(call => call[1] === 'download_clicked');
  assert.equal(clicks().length, 1);
  assert.equal(clicks()[0][2].download_platform, 'windows');
  s.window.location.pathname = '/account';
  analytics.trackDownloadClick({ window: s.window, platform: 'mac' });
  s.window.location.pathname = '/';
  analytics.loadAnalytics({ ...s, choice: { usage: false }, pathname: '/', enabled: true });
  analytics.trackDownloadClick({ window: s.window, platform: 'mac' });
  assert.equal(clicks().length, 1);
  assert.equal(s.calls.some(call => ['download', 'file_download', 'install', 'sign_up'].includes(call[1])), false);
});

test('disabled analytics never records a click even with consent', () => {
  assert.equal(typeof analytics.trackDownloadClick, 'function');
  const s = surface();
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: false });
  analytics.trackDownloadClick({ window: s.window, platform: 'mac' });
  assert.equal(s.calls.length, 0);
});

test('the real CTA records a consented click and analytics failure cannot block its href', t => {
  const previousWindow = globalThis.window, previousAnchor = globalThis.HTMLAnchorElement;
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousAnchor === undefined) delete globalThis.HTMLAnchorElement; else globalThis.HTMLAnchorElement = previousAnchor;
  });
  const s = surface();
  Object.assign(globalThis, { window: s.window, HTMLAnchorElement: class { href = ''; } });
  const anchor = new globalThis.HTMLAnchorElement();
  analytics.loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  observeDownloadClick('windows', { currentTarget: anchor });
  assert.equal(s.calls.filter(call => call[1] === 'download_clicked').length, 1);
  assert.equal(anchor.href, '/api/download?platform=windows');
  s.window.gtag = () => { throw new Error('analytics unavailable'); };
  assert.doesNotThrow(() => observeDownloadClick('mac', { currentTarget: anchor }));
  assert.equal(anchor.href, '/api/download?platform=mac');
});
