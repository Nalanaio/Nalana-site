import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const privacy = await readFile(new URL('../src/routes/privacy/+page.svelte', import.meta.url), 'utf8');
const cookies = await readFile(new URL('../src/routes/cookies/+page.svelte', import.meta.url), 'utf8');
test('privacy explains accounts and optional tracking without false anonymous or no-personal-data claims', () => {
  for (const phrase of ['account', 'email', 'operational', 'optional', 'pairing', '90 days', '30 days', '13 months', 'account lifetime', '7 days', '15 minutes', 'security']) assert.ok(privacy.toLowerCase().includes(phrase), phrase);
  for (const phrase of ['We do not collect personal information', 'not linked to your identity', 'all data is anonymized before transmission']) assert.equal(privacy.includes(phrase), false, phrase);
  assert.match(privacy, /revok[\w]*[\s\S]*historical/i);
});
test('cookie policy explains bounded dedup, separate vendor choices and reachable controls', () => {
  for (const phrase of ['24 hours', 'non-sliding', 'HttpOnly', 'Google Analytics', 'RB2B', 'nalana:privacy-settings', 'separate', 'pairing', 'default off']) assert.ok(cookies.includes(phrase), phrase);
  assert.match(cookies, /not.*unique person/i);
  assert.equal(cookies.includes('Google Analytics is the only third-party'), false);
});
