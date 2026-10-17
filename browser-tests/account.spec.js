import { test, expect, mockAccount, user, noOverflow, screenshot, visit, replaceSession } from './fixtures.js';

test('sign in uses the existing endpoint, handles errors and guards pending submissions', async ({ context, page }) => {
  let calls = 0, complete;
  const pending = new Promise(resolve => { complete = resolve; });
  await context.route('**/api/auth/login', async route => {
    calls++;
    await pending;
    await route.fulfill({ status: 401, json: { error: 'Invalid email or password.' } });
  });
  await visit(page, '/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123!');
  const visibility = page.getByRole('button', { name: /show password/i });
  await visibility.click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: /hide password/i }).click();
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect.poll(() => calls).toBe(1);
  complete();
  await expect(page.getByText(/invalid email|incorrect|invalid credentials/i)).toBeVisible();
});

test('successful login follows a safe internal next path and account shows live zero', async ({ context, page }, testInfo) => {
  await context.route('**/api/auth/login', route => route.fulfill({ json: { token: 'synthetic-access-token', user } }));
  await context.route('**/api/auth/me', route => route.fulfill({ json: { user } }));
  await context.route('**/api/usage/me', route => route.fulfill({ json: { plan: 'team', credits_remaining: 0 } }));
  await visit(page, '/login?next=/account');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123!');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Synthetic Designer', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/0 credits remaining/i)).toBeVisible();
  await expect(page.getByText('Team', { exact: true })).toBeVisible();
  await screenshot(page, testInfo, 'account-live-zero');
});

test('signup retains its signed-in success and verification guidance', async ({ context, page }) => {
  const unverified = { ...user, email_verified: false, verification: { state: 'grace', can_use: true } };
  let calls = 0;
  await context.route('**/api/auth/register', route => { calls++; return route.fulfill({ status: 201, json: { token: 'synthetic-access-token', user: unverified } }); });
  await visit(page, '/login?mode=signup');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123!');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Account created' })).toBeVisible();
  await expect(page.getByRole('link', { name: /go to my account/i })).toHaveAttribute('href', '/account');
  await expect(page.getByText(/account is signed in/i)).toBeVisible();
  expect(calls).toBe(1);
});

test('failed usage shows unavailable rather than invented entitlements', async ({ context, page }) => {
  await mockAccount(context, { usage: { error: 'Synthetic unavailable' }, usageStatus: 503 });
  await visit(page, '/account');
  await expect(page.getByText(/usage unavailable|credits unavailable/i)).toBeVisible();
  await expect(page.getByText(/plan unavailable/i)).toBeVisible();
  await expect(page.getByText(/100 credits|0 credits remaining/i)).toHaveCount(0);
});

test('profile edit saves the existing PATCH shape and handles an API failure', async ({ context, page }) => {
  await mockAccount(context);
  let saved = false, payload;
  await context.route('**/api/auth/me', async route => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: { user: saved ? { ...user, display_name: 'Edited Designer' } : user } });
    payload = route.request().postDataJSON();
    if (!saved) { saved = true; return route.fulfill({ status: 503, json: { error: 'Synthetic save error' } }); }
    return route.fulfill({ json: { user: { ...user, display_name: payload.display_name, avatar_url: payload.avatar_url } } });
  });
  await visit(page, '/account/edit');
  await page.getByLabel('Display name', { exact: true }).fill('Edited Designer');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Synthetic save error')).toBeVisible();
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page).toHaveURL(/\/account\?saved=1$/);
  expect(payload).toEqual({ display_name: 'Edited Designer', avatar_url: null });
  await expect(page.getByText(/profile updated successfully/i)).toBeVisible();
});

test('avatar validation, upload and removal remain functional', async ({ context, page }) => {
  await mockAccount(context);
  let payload, identity = { ...user };
  await context.route('**/api/auth/me', route => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: { user: identity } });
    payload = route.request().postDataJSON();
    identity = { ...identity, ...payload };
    return route.fulfill({ json: { user: identity } });
  });
  await visit(page, '/account/edit');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') });
  await expect(page.getByText('Use a JPG, PNG, WebP, or GIF image.', { exact: true })).toBeVisible();
  // Valid 16x16 RGB PNG with correct chunk CRCs. The previous 1px sample had
  // a corrupt IDAT checksum and relied on browser-specific decoder tolerance.
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGMQaH1PEmIY1TCqYfhqAABmz4QQILdfjQAAAABJRU5ErkJggg==', 'base64');
  await input.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('button', { name: /remove/i })).toBeEnabled();
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page).toHaveURL(/\/account\?saved=1$/);
  expect(payload.avatar_url).toMatch(/^data:image\//);
  await page.getByRole('link', { name: /edit profile/i }).click();
  await page.getByRole('button', { name: /remove/i }).click();
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page).toHaveURL(/\/account\?saved=1$/);
  expect(payload.avatar_url).toBeNull();
});

test('verification scrubs the proof and only verifies after explicit confirmation', async ({ context, page }) => {
  let calls = 0;
  await context.route('**/api/auth/verify-email', route => { calls++; return route.fulfill({ json: { ok: true } }); });
  await visit(page, '/verify-email?token=synthetic-proof');
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: /confirm|verify/i }).click();
  await expect(page.getByRole('heading', { name: /verified|confirmed/i })).toBeVisible();
  expect(calls).toBe(1);
});

test('forgot and reset password retain neutral messaging and token scrubbing', async ({ context, page }) => {
  await context.route('**/api/auth/forgot-password', route => route.fulfill({ status: 200, json: {} }));
  await visit(page, '/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test');
  await page.getByRole('button', { name: /send reset/i }).click();
  await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
  await expect(page.getByText(/if.*account|if.*email/i).first()).toBeVisible();
  let calls = 0;
  await context.route('**/api/auth/reset-password', route => { calls++; expect(route.request().postDataJSON().token).toBe('synthetic-proof'); return route.fulfill({ json: {} }); });
  await visit(page, '/reset-password?token=synthetic-proof');
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill('Synthetic-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic-password-123!');
  await page.getByRole('button', { name: /^reset password$/i }).click();
  await expect(page).toHaveURL(/\/login\?reset=success$/);
  await expect(page.getByText(/password was reset/i)).toBeVisible();
  expect(calls).toBe(1);
});

test('long profile values fit a narrow screen and logout clears access', async ({ context, page }, testInfo) => {
  await mockAccount(context, { identity: { ...user, display_name: 'A long synthetic display name '.repeat(4), email: `${'long'.repeat(20)}@example.test`, id: 'synthetic-id-'.repeat(8) } });
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, '/account');
  await expect(page.getByRole('link', { name: /edit profile/i })).toBeVisible();
  await noOverflow(page);
  await screenshot(page, testInfo, 'account-long-values-375');
  await page.getByRole('button', { name: /log out|sign out/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.grace-site[data-motion]')).toBeAttached();
  await visit(page, '/account');
  await expect(page).toHaveURL(/\/login$/);
});

test('a late usage response cannot replace another account in the same document', async ({ context, page }) => {
  await mockAccount(context);
  const second = { ...user, id: 'synthetic-user-2', display_name: 'Second Designer', email: 'second@example.test' };
  await context.route('**/api/auth/me', route => route.fulfill({ json: { user: route.request().headers().authorization?.includes('second-access') ? second : user } }));
  let release, started = false, finished = false;
  const pending = new Promise(resolve => { release = resolve; });
  await context.route('**/api/usage/me', async route => {
    if (route.request().headers().authorization?.includes('second-access')) return route.fulfill({ json: { plan: 'team', credits_remaining: 5 } });
    started = true;
    await pending;
    try { await route.fulfill({ json: { plan: 'pro', credits_remaining: 777 } }); } catch { /* aborted by account replacement */ }
    finished = true;
  });
  await visit(page, '/account');
  await expect.poll(() => started).toBe(true);
  await expect(page.getByText('Loading plan and credits…')).toBeVisible();
  await replaceSession(page, second);
  await expect(page.getByRole('heading', { name: 'Second Designer' })).toBeVisible();
  await expect(page.getByText('5 credits remaining')).toBeVisible();
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(page.getByText('777 credits remaining')).toHaveCount(0);
  await expect(page.getByText('5 credits remaining')).toBeVisible();
});

test('a late profile save cannot overwrite a replacement session', async ({ context, page }) => {
  await mockAccount(context);
  const second = { ...user, id: 'synthetic-user-2', display_name: 'Second Designer', email: 'second@example.test' };
  let release, started = false, finished = false;
  const pending = new Promise(resolve => { release = resolve; });
  await context.route('**/api/auth/me', async route => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: { user: route.request().headers().authorization?.includes('second-access') ? second : user } });
    started = true;
    await pending;
    await route.fulfill({ json: { user: { ...user, display_name: 'Late First Designer' } } });
    finished = true;
  });
  await visit(page, '/account/edit');
  await page.getByLabel('Display name', { exact: true }).fill('Late First Designer');
  await page.getByRole('button', { name: /save/i }).click();
  await expect.poll(() => started).toBe(true);
  await replaceSession(page, second);
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Second Designer');
  release();
  await expect.poll(() => finished).toBe(true);
  await expect(page).toHaveURL(/\/account\/edit$/);
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Second Designer');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nalana_session_v1')).user.id)).toBe(second.id);
});

test('expired refresh clears access and returns to login', async ({ context, page }) => {
  await mockAccount(context);
  await context.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Synthetic expired session' } }));
  let refreshed = 0;
  await context.route('**/api/auth/refresh', route => { refreshed++; return route.fulfill({ status: 401, json: { error: 'Synthetic expired refresh' } }); });
  await visit(page, '/account');
  await expect(page).toHaveURL(/\/login$/);
  expect(refreshed).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('nalana_session_v1'))).toBeNull();
});

test('verification and reset API errors retain recovery controls', async ({ context, page }) => {
  await context.route('**/api/auth/verify-email', route => route.fulfill({ status: 400, json: { error: 'Synthetic verification expired' } }));
  await visit(page, '/verify-email?token=synthetic-expired-proof');
  await page.getByRole('button', { name: /verify my email/i }).click();
  await expect(page.getByText('Synthetic verification expired')).toBeVisible();
  await expect(page.getByRole('button', { name: /resend verification email/i })).toBeVisible();
  await context.route('**/api/auth/reset-password', route => route.fulfill({ status: 400, json: { error: 'Synthetic reset expired' } }));
  await visit(page, '/reset-password?token=synthetic-expired-proof');
  await page.getByLabel('New password', { exact: true }).fill('Synthetic-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Synthetic-password-123!');
  await page.getByRole('button', { name: /^reset password$/i }).click();
  await expect(page.getByText('Synthetic reset expired')).toBeVisible();
  await expect(page.getByRole('link', { name: /request a new reset link/i })).toBeVisible();
});
