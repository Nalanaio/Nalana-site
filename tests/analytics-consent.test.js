import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChoice, needsDocumentBoundary, sensitivePath, sanitizedLocation, permissionsRevoked } from '../src/lib/analytics/consent.js';
import { loadAnalytics, trackPageView } from '../src/lib/analytics/loaders.js';
test('unknown, malformed, denied and version drift all preserve default-off permissions', () => {
  for (const value of [null, 'not-json', '{"version":2,"usage":true}', { version: 1, usage: 'true', identification: false, decided: true }]) assert.equal(parseChoice(value).usage, false);
  assert.deepEqual(parseChoice({ version: 1, usage: true, identification: false, decided: true }), { version: 1, usage: true, identification: false, decided: true });
});

test('revocation compares the committed permission snapshot after editable choices change', () => {
  const editable = { usage: true, identification: true };
  const committed = { ...editable };
  editable.usage = false;
  assert.equal(permissionsRevoked(committed, editable), true);
  assert.equal(permissionsRevoked({usage: false, identification: true}, {usage: true, identification: false}), true);
  assert.equal(permissionsRevoked({usage: false, identification: false}, {usage: true, identification: true}), false);
});
test('sensitive SPA transitions require a fresh document both entering and leaving', () => {
  for (const path of ['/verify-email?token=private', '/reset-password', '/connect-download', '/operator/acquisition', '/account/edit', '/forgot-password']) {
    assert.equal(needsDocumentBoundary('/', path), true); assert.equal(needsDocumentBoundary(path, '/'), true);
  }
  assert.equal(needsDocumentBoundary('/privacy', '/cookies'), false);
  assert.equal(sanitizedLocation('https://nalana.test/reset-password?token=secret#email'), '/reset-password');
});
test('same-document proof cleanup is limited to the same recovery route and origin', () => {
  for (const path of ['/verify-email', '/reset-password']) {
    assert.equal(needsDocumentBoundary(`https://nalana.test${path}?token=transient`, `https://nalana.test${path}`), false);
    assert.equal(needsDocumentBoundary(`https://nalana.test${path}?token=transient`, `https://other.test${path}`), true);
    assert.equal(needsDocumentBoundary(`${path}?token=transient`, `${path}?token=replacement`), true);
    assert.equal(needsDocumentBoundary(`${path}?token=transient`, `${path}#fragment`), true);
    assert.equal(needsDocumentBoundary(`${path}?token=`, path), true);
  }
  assert.equal(needsDocumentBoundary('/login?token=transient', '/login'), true);
  assert.equal(needsDocumentBoundary('/verify-email?token=transient', '/reset-password'), true);
});
function surface() {
  const scripts = [], calls = [];
  const document = { getElementById: id => scripts.find(s => s.id === id), createElement: () => ({}), head: { appendChild: s => scripts.push(s) } };
  const window = { location: { origin: 'https://nalana.test' }, dataLayer: calls };
  return { scripts, calls, document, window };
}
test('usage grant never implies RB2B grant and GA initial config excludes query/referrer', () => {
  const s = surface(); loadAnalytics({ ...s, choice: { usage: true, identification: false }, pathname: '/', enabled: true });
  assert.equal(s.scripts.length, 1); assert.match(s.scripts[0].src, /googletagmanager/);
  assert.equal(s.calls[2][2].send_page_view, false); assert.equal(s.calls[2][2].page_referrer, ''); assert.equal(s.calls[2][2].page_location, 'https://nalana.test/');
  assert.equal(s.calls[3][1], 'page_view'); assert.equal(s.calls[3][2].page_path, '/');
});
test('manual page views follow opted-in sanitized navigation with sensitive routes excluded', () => {
  const s = surface(); const choice = { usage: true, identification: false };
  loadAnalytics({ ...s, choice, pathname: '/', enabled: true });
  trackPageView({ ...s, choice, pathname: '/privacy', enabled: true }); trackPageView({ ...s, choice, pathname: '/privacy', enabled: true }); trackPageView({ ...s, choice, pathname: '/verify-email', enabled: true });
  assert.equal(s.calls.filter(call => call[1] === 'page_view').length, 2);
  assert.equal(s.calls.at(-1)[2].page_location, 'https://nalana.test/privacy');
});
test('no third party loads on sensitive paths or with disabled feature even after grant', () => {
  for (const pathname of ['/verify-email', '/reset-password', '/connect-download', '/operator/login']) {
    const s = surface(); loadAnalytics({ ...s, choice: { usage: true, identification: true }, pathname, enabled: true }); assert.equal(s.scripts.length, 0);
  }
  const s = surface(); loadAnalytics({ ...s, choice: { usage: true, identification: true }, pathname: '/' }); assert.equal(s.scripts.length, 0);
});
