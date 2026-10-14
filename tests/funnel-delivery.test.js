import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createQueue } from '../src/lib/funnel/client.js';
import { cleanAttribution } from '../src/lib/funnel/attribution.js';
const now = Date.parse('2026-10-12T18:00:00Z');
const session = randomUUID();
const binding = { web_session_id: session, association_epoch: 0 };
const event = () => ({ event_id: randomUUID(), event_name: 'website_download_clicked', occurred_at: new Date(now).toISOString(), web_session_id: session, association_epoch: 0, properties: {} });
const store = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
test('server authority and sensitive payloads never enqueue, bounds drop oldest', () => {
  const queue = createQueue({ now: () => now, storage: store(), binding: () => binding });
  assert.equal(queue.enqueue({ ...event(), event_name: 'download_transfer_started' }), false);
  assert.equal(queue.enqueue({ ...event(), properties: { email: 'private@example.test' } }), false);
  assert.equal(queue.enqueue({ ...event(), actor_ref: 'forged' }), false);
  for (const properties of [null, [], '']) assert.equal(queue.enqueue({ ...event(), properties }), false);
  for (let i = 0; i < 501; i++) queue.enqueue(event());
  assert.equal(queue.snapshot().length, 500);
});
test('partial acknowledgment removes accepted, duplicate and permanent reject only', async () => {
  const events = [event(), event(), event(), event()];
  const queue = createQueue({ now: () => now, storage: store(), binding: () => binding, request: async (_url, init) => { assert.equal(init.headers.authorization, undefined); return Response.json({ schema_version: 1, accepted: [events[0].event_id], duplicates: [events[1].event_id], rejected: [{ event_id: events[2].event_id, code: 'EVENT_ID_CONFLICT' }] }); } });
  events.forEach(e => queue.enqueue(e)); await queue.flush(); assert.deepEqual(queue.snapshot().map(e => e.event_id), [events[3].event_id]);
});
test('auth rejection pauses with no account-token substitution and revoke fences old ACK', async () => {
  let resolve = (_value) => {}; const pending = new Promise(r => resolve = r);
  const queue = createQueue({ now: () => now, binding: () => binding, request: () => pending });
  const old = event(); queue.enqueue(old); const flushing = queue.flush(); queue.purge(); const fresh = event(); queue.enqueue(fresh);
  resolve(Response.json({ schema_version: 1, accepted: [old.event_id], duplicates: [], rejected: [] })); await flushing;
  assert.equal(queue.snapshot()[0].event_id, fresh.event_id);
  const paused = createQueue({ now: () => now, binding: () => binding, request: async () => new Response(null, { status: 401 }) }); paused.enqueue(event()); await paused.flush(); assert.equal(paused.isPaused(), true);
});
test('Retry-After bounds retry and invalid timestamps never upload', async () => {
  let time = now, calls = 0;
  const queue = createQueue({ now: () => time, binding: () => binding, request: async () => { calls++; return new Response(null, { status: 429, headers: { 'retry-after': '10' } }); } });
  assert.equal(queue.enqueue({ ...event(), occurred_at: new Date(now - 8 * 86400000).toISOString() }), false);
  assert.equal(queue.enqueue({ ...event(), occurred_at: new Date(now + 300001).toISOString() }), false);
  queue.enqueue(event()); await queue.flush(); queue.resume(); await queue.flush(); assert.equal(calls, 1); time += 10000; await queue.flush(); assert.equal(calls, 2);
});
test('campaign attribution excludes URLs, emails, free text and long identifiers', () => {
  assert.deepEqual(cleanAttribution(new URLSearchParams('utm_source=class&utm_medium=organic&utm_campaign=fall_26')), { source: 'class', medium: 'organic', campaign: 'fall_26' });
  assert.deepEqual(cleanAttribution(new URLSearchParams('utm_source=https://private.test/email&utm_medium=someone@example.test&utm_campaign=123456789')), {});
});
