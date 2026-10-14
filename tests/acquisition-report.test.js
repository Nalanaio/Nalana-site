import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAcquisitionReport, reportFilters, validateReport } from '../src/lib/server/acquisition-report.js';

const now = Date.parse('2026-10-12T18:00:00Z');
const row = { stage: 'app_opened_observed', unit: 'consent_session', count: 3, denominator_stage: 'download_transfer_started', denominator_count: 5, conversion_rate: 0.6, join_rule: 'Explicit pairing only' };
const report = { schema_version: 1, generated_at: '2026-10-12T18:00:00Z', window: { start: '2026-10-05T18:00:00Z', end: '2026-10-12T18:00:00Z', time_basis: 'received_at' }, filters: {}, coverage: { consented: 5, legacy: 20 }, independent_counts: [{ ...row, denominator_stage: null, denominator_count: null, conversion_rate: null, join_rule: 'Independent operational counts' }], joined_cohorts: [row], delivery_summary: { delivered: 2, bounced: 1 }, unknowns: ['Installation completion is unobserved.'] };
test('report defaults to fixed seven-day UTC window with no selectable environment', () => {
  const filters = reportFilters(new URLSearchParams(), now);
  assert.equal(filters.get('start'), report.window.start.replace('Z', '.000Z'));
  assert.equal(filters.get('end'), report.window.end.replace('Z', '.000Z'));
  assert.throws(() => reportFilters(new URLSearchParams('environment=production'), now));
});
test('report rejects unknown filters, non-UTC dates, reversed and over-90-day windows', () => {
  for (const query of ['url=https://attacker.test', 'start=2026-10-12T18:00:00%2B01:00', 'start=2026-10-13T18:00:00Z', 'start=2026-01-01T00:00:00Z', 'platform=toaster', 'cohort=' + 'x'.repeat(129), 'start=2026-02-30T00:00:00Z', 'platform=windows&platform=macos']) assert.throws(() => reportFilters(new URLSearchParams(query), now));
});
test('canonical report projection preserves explicit units, denominators and unknowns', () => {
  assert.deepEqual(validateReport(report), report);
  assert.equal(validateReport(report).independent_counts[0].conversion_rate, null);
});
test('malformed counts, impossible ratios, and credential/PII payloads are rejected', () => {
  for (const patch of [{ independent_counts: [{ ...row, count: -1 }] }, { joined_cohorts: [{ ...row, denominator_count: null }] }, { joined_cohorts: [{ ...row, conversion_rate: 6 }] }, { coverage: { email: 'private@example.test' } }, { access_token: 'private' }, { schema_version: '1' }]) assert.throws(() => validateReport({ ...report, ...patch }));
});
test('fixed report URL and admin capability are sent only after operator authorization', async () => {
  const calls = [];
  const service = { authorize: async (cookie) => { assert.equal(cookie, 'opaque'); calls.push('authorized'); return { accountId: 'operator-1' }; } };
  const result = await loadAcquisitionReport({ operatorService: service, cookie: 'opaque', searchParams: new URLSearchParams('platform=windows'), config: { NALANA_API_BASE: 'http://localhost:8000', RUN_VIEWER_ADMIN_TOKEN: 'server-admin-secret' }, now, fetchImpl: async (url, options) => { calls.push(url); assert.equal(options.headers['X-Admin-Token'], 'server-admin-secret'); assert.equal(options.redirect, 'error'); return new Response(JSON.stringify(report)); } });
  assert.equal(calls[0], 'authorized');
  assert.ok(calls[1].startsWith('http://localhost:8000/v1/admin/acquisition?'));
  assert.equal(JSON.stringify(result).includes('server-admin-secret'), false);
});
test('unauthorized operators and missing admin capability never call the admin backend', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('{}'); };
  await assert.rejects(loadAcquisitionReport({ operatorService: { authorize: async () => { throw new Error('denied'); } }, cookie: 'none', searchParams: new URLSearchParams(), config: {}, now, fetchImpl }));
  await assert.rejects(loadAcquisitionReport({ operatorService: { authorize: async () => ({}) }, cookie: 'opaque', searchParams: new URLSearchParams(), config: {}, now, fetchImpl }));
  assert.equal(calls, 0);
});
