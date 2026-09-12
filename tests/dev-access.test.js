import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_DEV_ALLOWED_EMAILS,
  getDevAllowedEmails,
  isDevAllowedEmail,
} from '../src/lib/server/dev-access.js';

test('DEFAULT_DEV_ALLOWED_EMAILS includes Clarence and Brian accounts', () => {
  const allowed = DEFAULT_DEV_ALLOWED_EMAILS.map((e) => e.toLowerCase());

  // Clarence
  assert.ok(allowed.includes('clarence@nalana.io'));
  assert.ok(allowed.includes('jordankeith999@gmail.com'));
  assert.ok(allowed.includes('cekeith@usc.edu'));
  assert.ok(allowed.includes('cekeith999@gmail.com'));

  // Brian
  assert.ok(allowed.includes('debriann07@gmail.com'));
  assert.ok(allowed.includes('brian@nalana.io'));
});

test('isDevAllowedEmail authorizes allowed emails regardless of casing and surrounding spaces', () => {
  assert.equal(isDevAllowedEmail('CLARENCE@NALANA.IO'), true);
  assert.equal(isDevAllowedEmail('  debriann07@gmail.com  '), true);
  assert.equal(isDevAllowedEmail('JordanKeith999@gmail.com'), true);
  assert.equal(isDevAllowedEmail('cekeith@usc.edu'), true);
});

test('isDevAllowedEmail rejects unauthorized emails', () => {
  assert.equal(isDevAllowedEmail('stranger@example.com'), false);
  assert.equal(isDevAllowedEmail('hacker@nalana.io.attacker.com'), false);
  assert.equal(isDevAllowedEmail(''), false);
  assert.equal(isDevAllowedEmail(null), false);
  assert.equal(isDevAllowedEmail(undefined), false);
  assert.equal(isDevAllowedEmail(12345), false);
});

test('isDevAllowedEmail supports additional approved emails via DEV_ALLOWED_EMAILS override', () => {
  const extraEnv = 'alice@example.com, Bob@Studio.org ';
  assert.equal(isDevAllowedEmail('alice@example.com', extraEnv), true);
  assert.equal(isDevAllowedEmail('bob@studio.org', extraEnv), true);
  // Default team emails remain authorized
  assert.equal(isDevAllowedEmail('clarence@nalana.io', extraEnv), true);
  assert.equal(isDevAllowedEmail('debriann07@gmail.com', extraEnv), true);
  // Unapproved email remains rejected
  assert.equal(isDevAllowedEmail('mallory@evil.com', extraEnv), false);
});
