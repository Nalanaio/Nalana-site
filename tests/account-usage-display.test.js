import test from 'node:test';
import assert from 'node:assert/strict';
import { usageDisplay } from '../src/lib/account/usage-display.js';

test('actual zero credits is retained and a live known plan is labeled', () => {
  assert.deepEqual(usageDisplay({ plan: 'free', credits_remaining: 0 }), { plan: 'Free', credits: 0 });
});

test('missing or failed usage does not turn normalized auth defaults into entitlements', () => {
  for (const data of [null, undefined, {}, [], 'free']) {
    assert.deepEqual(usageDisplay(data), { plan: null, credits: null });
  }
});

test('unknown live tiers remain visible and do not imply Free', () => {
  assert.deepEqual(usageDisplay({ tier: 'Studio Preview', credits_remaining: 42 }), { plan: 'Studio Preview', credits: 42 });
  for(const plan of ['constructor','__proto__','toString'])assert.deepEqual(usageDisplay({plan,credits_remaining:0}),{plan,credits:0});
});

test('malformed entitlements stay unavailable while valid fields survive independently', () => {
  for (const credits_remaining of [-1, NaN, Infinity, '100', null]) {
    assert.deepEqual(usageDisplay({ plan: 'pro', credits_remaining }), { plan: 'Pro', credits: null });
  }
  assert.deepEqual(usageDisplay({ plan: ' ', tier: 'team', credits_remaining: 8 }), { plan: 'Team', credits: 8 });
});
