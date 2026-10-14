import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntent, refreshIntent, recordHandoff, validateRelayIntent } from '../src/lib/server/acquisition-api.js';
const id = 'a9ee7444-6b85-4e86-8c6b-24684e20bdd4';
const env = { NALANA_ACQUISITION_RELAY: 'true', NALANA_API_BASE: 'https://api.example.test', NALANA_WEBSITE_SERVICE_TOKEN: 'private', NALANA_DOWNLOAD_RELAY_BASE: 'https://relay.example.test' };
const projection = () => ({ download_id: id, release_id: 'release-1', artifact_id: 'artifact-1', platform: 'windows', download_url: `https://relay.example.test/v1/downloads/${id}?expires=${Math.floor(Date.now()/1000)+900}&key_id=test&sig=${'a'.repeat(64)}`, expires_at: new Date(Date.now()+900000).toISOString(), observation_mode: 'relay' });

test('relay tickets require canonical HMAC hex, distinct from signed-cookie base64url', () => {
  const data = projection();
  assert.ok(validateRelayIntent(data, 'windows', env));
  for (const signature of ['a'.repeat(43), 'A'.repeat(64), '_'.repeat(64)]) {
    const target = new URL(data.download_url); target.searchParams.set('sig', signature);
    assert.equal(validateRelayIntent({ ...data, download_url: target.href }, 'windows', env), null);
  }
});
test('fixed intent DTO omits browser authority and uses server credential', async () => {
  const calls = [];
  const fetch = async (...args) => { calls.push(args); return Response.json(projection(), { status: 201 }); };
  const result = await createIntent({ platform: 'windows', subject: 'signed-subject', enrollment: null, fetch, env });
  assert.equal(result.download_id, id);
  assert.equal(calls[0][0], 'https://api.example.test/v1/acquisition/download-intents');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer private');
  assert.deepEqual(JSON.parse(calls[0][1].body), { schema_version: 1, platform: 'windows', channel: 'stable', click_id: null, dedup_subject: 'signed-subject', web_visitor_id: null, web_session_id: null, analytics_consent: 'unknown', attribution: {} });
});
test('malicious relay targets, credentials, unknown tickets and platform changes are rejected', () => {
  for (const value of ['https://relay.example.test.evil.test/v1/downloads/'+id, 'https://evil.test/', 'https://x:pw@relay.example.test/v1/downloads/'+id, 'https://relay.example.test/v1/downloads/'+id+'?expires=1&key_id=t&sig=x']) {
    assert.equal(validateRelayIntent({ ...projection(), download_url: value }, 'windows', env), null);
  }
  assert.equal(validateRelayIntent({ ...projection(), platform: 'mac' }, 'windows', env), null);
});
test('flags, missing config and service failures leave no manufactured intent', async () => {
  for (const config of [{}, { ...env, NALANA_ACQUISITION_RELAY: 'false' }]) assert.equal(await createIntent({ platform: 'windows', fetch: () => assert.fail(), env: config }), null);
  assert.equal(await createIntent({ platform: 'windows', fetch: async () => { throw Error('offline'); }, env }), null);
  assert.equal(await createIntent({ platform: 'windows', fetch: async () => new Response('', { status: 429 }), env }), null);
});
test('refresh requires private subject and preserves immutable identity', async () => {
  const intent = projection();
  let calls = 0;
  assert.equal(await refreshIntent({ intent, subject: null, fetch: () => assert.fail(), env }), null);
  assert.equal(await refreshIntent({ intent, subject: 'signed', fetch: async (_, options) => { calls++; assert.deepEqual(JSON.parse(options.body), { schema_version: 1, dedup_subject: 'signed' }); return Response.json({ ...intent, download_id: '22a0961e-8357-49b1-90d4-b7f2156205f0' }, { status: 201 }); }, env }), null);
  assert.equal(calls, 1);
});
test('handoff records only fixed non-transfer evidence and never sends mail', async () => {
  let body = {};
  await recordHandoff({ downloadId: id, deliveryMode: 'relay', fetch: async (url, options) => { assert.match(url, /download-handoffs$/); body=JSON.parse(options.body); return Response.json({}); }, env });
  assert.equal(body.download_id, id);
  assert.equal(body.delivery_mode, 'relay');
  assert.equal(body.schema_version, 1);
  assert.equal('bytes_written' in body, false);
});
