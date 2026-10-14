import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createFunnelSession } from '../src/lib/funnel/session.js';
function harness() {
  const requests = [], values = new Map();
  let clock = Date.parse('2026-10-12T18:00:00Z');
  const session = createFunnelSession({ storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, now: () => clock, request: async (path, init) => {
    const body = JSON.parse(init.body || '{}'); requests.push({ path, body, auth: init.headers.authorization });
    if (path === '/api/funnel/session') return new Response(null, { status: 401 });
    if (path.endsWith('/revoke') || path.endsWith('/dissociate')) return new Response(null, { status: 204 });
    if (path.endsWith('/sessions')) return Response.json({ session_id: randomUUID(), status: 'registered', association_epoch: 0 });
    if (path.endsWith('/associate')) return Response.json({ status: 'associated', association_epoch: 1 });
    if (path.endsWith('/events')) return Response.json({ schema_version: 1, accepted: body.events.map(e => e.event_id), duplicates: [], rejected: [] });
    return Response.json({ enrollment_id: randomUUID(), expires_at: new Date(clock + 30 * 86400000).toISOString() }, { status: 201 });
  } });
  return { session, requests, time: value => clock = value, values };
}
test('unknown permission collects no IDs/events; grant then revoke makes fresh identity', async () => {
  const h = harness(); assert.equal(h.session.click(), null); assert.equal(h.requests.length, 0);
  await h.session.grant(); const first = h.session.snapshot(); assert.ok(first.session_id); assert.equal(first.association_epoch, 0);
  await h.session.revoke(); assert.equal(h.session.snapshot(), null); assert.equal(h.session.click(), null); assert.equal(h.session.queue.snapshot().length, 0);
  await h.session.grant(); assert.notEqual(h.session.snapshot().enrollment_id, first.enrollment_id);
});
test('server resume keeps consented offline queue and restores metadata when browser storage was lost', async () => {
  const now = Date.parse('2026-10-12T18:00:00Z');
  const resumed = { enrollment_id: randomUUID(), web_visitor_id: randomUUID(), web_session_id: randomUUID(), session_id: randomUUID(), association_epoch: 0, expires_at: new Date(now + 86400000).toISOString(), account_id: null };
  const event = { event_id: randomUUID(), event_name: 'website_download_clicked', occurred_at: new Date(now).toISOString(), web_session_id: resumed.web_session_id, association_epoch: 0, properties: {} };
  const values = new Map([['nalana_usage_queue_v1', JSON.stringify([event])]]);
  const request = async (path) => { assert.equal(path, '/api/funnel/session'); return Response.json(resumed); };
  const session = createFunnelSession({ now: () => now, storage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }, request });
  await session.authChanged(null, null); await session.grant(); assert.deepEqual(session.queue.snapshot(), [event]); assert.equal(session.snapshot().session_id, resumed.session_id);
  const noStorage = createFunnelSession({ now: () => now, storage: undefined, request }); await noStorage.grant(); assert.equal(noStorage.snapshot().enrollment_id, resumed.enrollment_id);
});
test('resumed A association cannot be reused by B or a signed-out session', async () => {
  const now = Date.now(), calls = [];
  const resumed = { enrollment_id: randomUUID(), web_visitor_id: randomUUID(), web_session_id: randomUUID(), session_id: randomUUID(), association_epoch: 1, expires_at: new Date(now + 86400000).toISOString(), account_id: 'A' };
  const session = createFunnelSession({ now: () => now, storage: undefined, request: async (path) => { calls.push(path);
    if (path === '/api/funnel/session') return Response.json(resumed);
    if (path.endsWith('/dissociate')) return new Response(null, { status: 204 });
    if (path.endsWith('/sessions')) return Response.json({ session_id: randomUUID(), association_epoch: 0 });
    if (path.endsWith('/associate')) return Response.json({ association_epoch: 1 });
    throw new Error('Unexpected request');
  } });
  await session.authChanged('B:1', 'B-token'); await session.grant(); assert.ok(calls.some(path => path.endsWith('/dissociate'))); assert.notEqual(session.snapshot().session_id, resumed.session_id); assert.equal(session.snapshot().account_id, 'B');
});
test('anonymous observations never inherit later login and account A to B closes and rotates', async () => {
  const h = harness(); await h.session.grant(); const anonymous = h.session.snapshot();
  await h.session.authChanged('A:1', 'A-token'); assert.equal(h.session.snapshot().association_epoch, 1);
  const switching = h.session.authChanged('B:2', 'B-token'); assert.equal(h.session.click(), null); await switching; const b = h.session.snapshot(); assert.notEqual(b.session_id, anonymous.session_id); assert.equal(b.association_epoch, 1);
  assert.equal(h.requests.filter(r => r.path.endsWith('/dissociate')).length, 1);
  assert.equal(h.requests.filter(r => r.path.endsWith('/associate')).at(-1).auth, 'Bearer B-token');
});
test('routine auth refresh preserves binding while correction epoch forces a fresh session', async () => {
  const h = harness(); await h.session.grant(); await h.session.authChanged('A:1', 'A-token'); const before = h.session.snapshot();
  await h.session.authChanged('A:1', 'A-refreshed'); assert.equal(h.session.snapshot().session_id, before.session_id);
  await h.session.authChanged('A:2', 'A-corrected'); assert.notEqual(h.session.snapshot().session_id, before.session_id);
});
test('expired enrollment purges history and rotates IDs rather than reusing expired credential', async () => {
  const h = harness(); await h.session.grant(); const before = h.session.snapshot(); h.time(Date.parse(before.expires_at) + 1); await h.session.refresh();
  assert.notEqual(h.session.snapshot().enrollment_id, before.enrollment_id); assert.notEqual(h.session.snapshot().web_visitor_id, before.web_visitor_id);
});

test('rejected capability triggers renewal and a fresh owned session before collection resumes', async () => {
  const calls = [], expires_at = new Date(Date.now() + 30 * 86400000).toISOString();
  const session = createFunnelSession({ storage: undefined, request: async (path) => {
    calls.push(path);
    if (path === '/api/funnel/session') return new Response(null, { status: 401 });
    if (path.endsWith('/revoke') || path.endsWith('/dissociate')) return new Response(null, { status: 204 });
    if (path.endsWith('/sessions')) return Response.json({ session_id: randomUUID(), association_epoch: 0 });
    if (path.endsWith('/renew')) return Response.json({ expires_at });
    if (path.endsWith('/events')) return new Response(null, { status: 401 });
    return Response.json({ enrollment_id: randomUUID(), expires_at }, { status: 201 });
  } });
  await session.grant(); const old = session.snapshot();
  session.click(); await session.queue.flush();
  assert.equal(session.queue.isPaused(), true);
  await session.refresh();
  assert.ok(calls.some(path => path.endsWith('/renew')));
  assert.ok(calls.some(path => path.endsWith('/dissociate')));
  assert.notEqual(session.snapshot().session_id, old.session_id);
  assert.equal(session.queue.snapshot().length, 0);
  assert.equal(session.queue.isPaused(), false);
});
