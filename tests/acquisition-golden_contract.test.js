import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeVerification, verificationPhase } from '../src/lib/verification/policy.js';
import { validBrowserEvent } from '../src/lib/funnel/contract.js';

const bytes = readFileSync(new URL('./fixtures/acquisition_contract_v1.json', import.meta.url));
const contract = JSON.parse(bytes.toString('utf8'));

test('golden contract has the same reviewed digest in all clients', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6174f5cb901bd2198f8641348c85d94eea451620bd34a1aef612e463dfc4cc62');
});

for (const row of contract.verification.cases) {
  test(`golden contract projects server policy: ${row.name}`, () => {
    const policy = { ...contract.verification.policy_example, server_time: row.now, state: row.expected_state,
      enforcement_enabled: row.enforcement_enabled, cloud_actions_allowed: row.expected_allowed };
    assert.deepEqual(normalizeVerification(policy), policy);
    const phase = verificationPhase(policy);
    if (row.verified) assert.equal(phase, 'verified');
    else if (!row.expected_allowed) assert.equal(phase, 'required');
    else assert.ok(['initial', 'warning'].includes(phase));
  });
}

for (const mutation of contract.verification.invalid_policy_mutations) {
  test(`golden contract rejects malformed policy: ${JSON.stringify(mutation)}`, () => {
    assert.equal(normalizeVerification({ ...contract.verification.policy_example, ...mutation }), null);
  });
}

test('golden contract refresh projection is top-level and preserves all public fields', () => {
  const refresh = contract.verification.refresh_example;
  assert.equal('user' in refresh, false);
  assert.deepEqual(normalizeVerification(refresh.verification), contract.verification.policy_example);
  assert.deepEqual(Object.keys(normalizeVerification(refresh.verification)).sort(), [...contract.verification.policy_fields].sort());
});

for (const row of contract.events.invalid_examples) {
  test(`golden contract blocks invalid browser envelope: ${row.name}`, () => {
    assert.equal(validBrowserEvent(row.event, Date.parse(row.event.occurred_at)), false);
  });
}

test('golden contract browser event admits only the website observation and refuses server authority fields', () => {
  const event = { ...contract.events.valid_examples[0], event_name: 'website_download_clicked', app_session_id: null,
    web_session_id: contract.canonical_uuid_examples.web_session };
  const now = Date.parse(event.occurred_at);
  assert.equal(validBrowserEvent(event, now), true);
  for (const name of Object.keys(contract.events.registry)) {
    if (name !== event.event_name) assert.equal(validBrowserEvent({ ...event, event_name: name }, now), false, name);
  }
  for (const key of contract.events.server_only_keys) {
    assert.equal(validBrowserEvent({ ...event, [key]: 'untrusted' }, now), false, key);
  }
  assert.equal(validBrowserEvent({ ...event, occurred_at: new Date(now - (contract.limits.max_age_days * 86400000) - 1).toISOString() }, now), false);
  assert.equal(validBrowserEvent({ ...event, occurred_at: new Date(now + (contract.limits.future_skew_seconds * 1000) + 1).toISOString() }, now), false);
});
