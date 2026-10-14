import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeVerification, verificationPhase } from '../src/lib/verification/policy.js';
import { validBrowserEvent } from '../src/lib/funnel/contract.js';
const bytes = readFileSync(new URL('./fixtures/acquisition_contract_v1.json', import.meta.url));
const contract = JSON.parse(bytes.toString('utf8'));
test('website consumes the exact reviewed golden fixture shared with backend and IDE', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6174f5cb901bd2198f8641348c85d94eea451620bd34a1aef612e463dfc4cc62');
  assert.equal(contract.schema_version, 1); assert.equal(contract.contract, 'nalana-acquisition-contract-v1');
});
test('shared policy example and enforcement rollback preserve effective permission', () => {
  const example = contract.verification.policy_example;
  assert.deepEqual(normalizeVerification(example), example);
  assert.notEqual(verificationPhase({ ...example, state: 'required', enforcement_enabled: false, cloud_actions_allowed: true }), 'required');
  assert.equal(normalizeVerification({ ...example, policy_version: '1' }), null);
});
test('website cannot emit desktop/backend/relay events from the shared registry', () => {
  for (const event of contract.events.valid_examples) assert.equal(validBrowserEvent(event, Date.parse('2026-10-12T18:00:00Z')), false);
  const ids = contract.canonical_uuid_examples;
  const event = { event_id: ids.event, event_name: 'website_download_clicked', occurred_at: '2026-10-12T18:00:00Z', web_session_id: ids.web_session, association_epoch: 0, properties: {} };
  assert.equal(validBrowserEvent(event, Date.parse(event.occurred_at)), true);
  assert.equal(validBrowserEvent({ ...event, authority: 'relay_server_write' }, Date.parse(event.occurred_at)), false);
});
