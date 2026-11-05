import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollDepthTracker, SCROLL_MILESTONES } from '../src/lib/analytics/scroll-depth.js';

function tracker({ scrollHeight = 4000, innerHeight = 1000 } = {}) {
  const reports = [];
  const window = { scrollY: 0, innerHeight };
  const document = { documentElement: { scrollHeight } };
  return { window, document, reports, depth: createScrollDepthTracker({ window, document, report: value => reports.push(value) }) };
}

test('milestones match the legacy page: 25, 50, 75 and 90 percent', () => {
  assert.deepEqual(SCROLL_MILESTONES, [25, 50, 75, 90]);
});

test('each milestone is reported once, in order, as the visitor scrolls', () => {
  const t = tracker();
  t.depth.check();
  assert.deepEqual(t.reports, [25], 'a 1000px viewport on a 4000px page already shows 25%');
  t.window.scrollY = 1000; t.depth.check(); t.depth.check();
  assert.deepEqual(t.reports, [25, 50]);
  t.window.scrollY = 3000; t.depth.check();
  assert.deepEqual(t.reports, [25, 50, 75, 90]);
  t.window.scrollY = 0; t.depth.check();
  t.window.scrollY = 3000; t.depth.check();
  assert.deepEqual(t.reports, [25, 50, 75, 90], 'no repeats');
});

test('reset() lets the next page report again', () => {
  const t = tracker();
  t.window.scrollY = 3000; t.depth.check();
  t.depth.reset();
  t.depth.check();
  assert.deepEqual(t.reports, [25, 50, 75, 90, 25, 50, 75, 90]);
});

test('an empty or unmeasurable page reports nothing', () => {
  const t = tracker({ scrollHeight: 0 });
  t.depth.check();
  const nan = tracker({ scrollHeight: Number.NaN });
  nan.depth.check();
  assert.deepEqual([...t.reports, ...nan.reports], []);
});
