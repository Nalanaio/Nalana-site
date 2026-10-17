import { test, expect, mockAccount, user, visit } from './fixtures.js';

test('verification recovery retains resend errors, cooldown and verified account refresh', async ({ context, page }) => {
  const time = Date.now();
  const policy = { policy_version: 1, state: 'required', enforcement_enabled: true,
    cloud_actions_allowed: false, server_time: new Date(time).toISOString(),
    grace_started_at: new Date(time - 49 * 3600000).toISOString(),
    grace_expires_at: new Date(time - 3600000).toISOString(), next_reminder_at: null, resend_available_at: null };
  let identity = { ...user, email_verified: false, verification: policy };
  await mockAccount(context, { identity });
  await context.route('**/api/auth/me', route => route.fulfill({ json: { user: identity } }));
  let calls = 0;
  await context.route('**/api/auth/resend-verification/current', route => {
    calls++;
    expect(route.request().headers().authorization).toBe('Bearer synthetic-access-token');
    expect(route.request().postDataJSON()).toEqual({});
    return route.fulfill(calls === 1
      ? { status: 503, json: { error: 'Synthetic mail service unavailable' } }
      : { json: { status: 'queued', verification: { ...policy, resend_available_at: new Date(time + 60000).toISOString() } } });
  });
  await visit(page, '/account');
  const reminder = page.getByRole('dialog', { name: 'Verify to continue cloud work' });
  await expect(reminder).toBeVisible();
  await reminder.getByRole('button', { name: 'Close verification reminder' }).click();
  const recovery = page.getByRole('region', { name: 'Email verification' });
  await expect(recovery.getByText(/account and local projects remain available/)).toBeVisible();
  await expect(page.getByText('23 credits remaining')).toBeVisible();
  await recovery.getByRole('button', { name: 'Resend verification email' }).click();
  await expect(recovery.getByRole('alert')).toHaveText('Synthetic mail service unavailable');
  await recovery.getByRole('button', { name: 'Resend verification email' }).click();
  await expect(recovery.getByText(/email queued/)).toBeVisible();
  const cooldown = recovery.getByRole('button', { name: /Resend available in \d+s/ });
  await expect(cooldown).toBeDisabled();
  const checkAgain = recovery.getByRole('button', { name: 'Check again' });
  const beforeTick = await checkAgain.boundingBox();
  const countdownText = await cooldown.textContent();
  await expect(cooldown).not.toHaveText(countdownText);
  expect(await checkAgain.boundingBox(), 'countdown must not move the adjacent account control').toEqual(beforeTick);
  expect(calls).toBe(2);
  identity = { ...identity, email_verified: true, verification: { ...policy, state: 'verified', cloud_actions_allowed: true } };
  await checkAgain.click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Synthetic Designer' })).toBeVisible();
});

test('account reload uses the current balance and unknown plan from usage, never stored auth credits', async ({ context, page }) => {
  await mockAccount(context);
  let usage = { plan: 'Studio Preview', credits_remaining: 9 };
  await context.route('**/api/usage/me', route => route.fulfill({ json: usage }));
  await visit(page, '/account');
  await expect(page.getByText('Studio Preview', { exact: true })).toBeVisible();
  await expect(page.getByText('9 credits remaining')).toBeVisible();
  await expect(page.getByText('23 credits remaining')).toHaveCount(0);
  usage = { plan: 'team', credits_remaining: 0 };
  await visit(page, '/account');
  await expect(page.getByText('Team', { exact: true })).toBeVisible();
  await expect(page.getByText('0 credits remaining')).toBeVisible();
  await expect(page.getByText('9 credits remaining')).toHaveCount(0);
});
