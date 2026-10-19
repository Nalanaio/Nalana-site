import { test, expect, user, visit } from './fixtures.js';

async function recordCommands(page) {
  const commands = [];
  await page.exposeFunction('recordAnalyticsCommand', (path, command) => commands.push({ path, command }));
  await page.addInitScript(() => {
    window.dataLayer = [];
    window.dataLayer.push = function (command) {
      void window.recordAnalyticsCommand(location.pathname, Array.from(command));
      return Array.prototype.push.call(this, command);
    };
  });
  return commands;
}

async function signup(page) {
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.locator('.account-decoration[data-motion]')).toBeAttached();
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill('Synthetic-password-123!');
  await expect(page.locator('#nalana-ga')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

test('consented ad survives navigation and confirmed signup sends one clean conversion before verification', async ({ page, context, audit }) => {
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  const commands = await recordCommands(page);
  await context.route('**/api/auth/register', route => route.fulfill({ json: { token: 'synthetic-access', user: { ...user, email_verified: false } } }));
  await context.route('**/api/auth/me', route => route.fulfill({ json: { user: { ...user, email_verified: false } } }));
  await visit(page, '/?utm_source=qa&utm_medium=internal_test&utm_campaign=signup_tracking_qa&utm_content=First+ad&email=secret%40example.test');
  const choices = page.getByRole('complementary', { name: /privacy choices/i });
  await page.getByRole('button', { name: /privacy settings/i }).click();
  await choices.getByRole('checkbox', { name: /usage analytics/i }).check();
  await choices.getByRole('button', { name: /save choices/i }).click();
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole('link', { name: /back to home/i }).click();
  await expect(page.locator('.grace-site[data-motion]')).toBeAttached();
  await context.route('**/api/download?**', route => route.fulfill({ status: 200, headers: { 'content-disposition': 'attachment; filename="synthetic-download.txt"' }, contentType: 'application/octet-stream', body: 'Synthetic download fixture. No installer or production request.' }));
  const download = page.getByRole('link', { name: /Download for (Windows|Mac)/i }).first();
  const platform = (await download.innerText()).includes('Windows') ? 'windows' : 'mac';
  await Promise.all([page.waitForResponse(response => response.url().includes('/api/download?')), download.click({ noWaitAfter: true })]);
  const clicks = commands.filter(c => c.command[1] === 'download_clicked');
  expect(clicks).toHaveLength(1);
  expect(clicks[0].command[2]).toMatchObject({ campaign_source: 'qa', campaign_medium: 'internal_test', campaign_name: 'signup_tracking_qa', download_platform: platform });
  await signup(page);
  await expect(page).toHaveURL(/\/login\?created=1$/);
  await expect(page.getByRole('heading', { name: 'Account created', exact: true })).toBeVisible();
  const conversions = commands.filter(c => c.command[1] === 'sign_up');
  expect(conversions).toHaveLength(1);
  expect(conversions[0].path).toBe('/signup-complete');
  expect(conversions[0].command[2]).toMatchObject({ campaign_source: 'qa', campaign_medium: 'internal_test', campaign_name: 'signup_tracking_qa', campaign_content: 'First ad', method: 'email' });
  expect(JSON.stringify(commands)).not.toContain(user.email);
  expect(JSON.stringify(commands)).not.toContain('secret');
  expect(commands.some(c => c.path === '/login')).toBe(false);
  await expect(page.locator('#nalana-ga')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Account created', exact: true })).toBeVisible();
  expect(commands.filter(c => c.command[1] === 'sign_up')).toHaveLength(1);
  await page.goto('/signup-complete');
  await expect(page).toHaveURL(/\/login\?created=1$/);
  expect(commands.filter(c => c.command[1] === 'sign_up')).toHaveLength(1);
});

test('denied usage and failed registration never emit signup or load tags on auth pages', async ({ page, context }) => {
  const commands = await recordCommands(page);
  await context.route('**/api/auth/register', route => route.fulfill({ status: 409, json: { detail: 'Account exists' } }));
  await visit(page, '/?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch');
  await signup(page);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(commands).toEqual([]);
  await context.route('**/api/auth/register', route => route.fulfill({ json: { token: 'synthetic-access', user } }));
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account created', exact: true })).toBeVisible();
  expect(commands).toEqual([]);
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
});
