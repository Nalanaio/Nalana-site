import { test, expect, user, visit } from './fixtures.js';

test.skip(process.env.CAMPAIGN_BROWSER_TEST !== 'true', 'Run with CAMPAIGN_BROWSER_TEST=true to enable campaign measurement.');
const tagged = '/?utm_source=facebook&utm_medium=paid_social&utm_campaign=Autumn+Creators&fbclid=private-click';
test('declining optional analytics preserves approved campaign labels for native downloads and successful signup', async ({ page, context }) => {
  const views = [], registrations = [], downloads = [];
  await context.route('**/api/campaign/page-view', route => { views.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); });
  // Complete native navigation with a fixture document; never fetch a real installer.
  await context.route('**/api/download?**', route => { downloads.push(new URL(route.request().url())); return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Synthetic installer handoff</title>' }); });
  await context.route('**/api/auth/register', route => { registrations.push(route.request().postDataJSON()); return route.fulfill({ status: 201, json: { token: 'synthetic-access', user } }); });
  await context.addInitScript(() => localStorage.setItem('nalana_privacy_v1', JSON.stringify({ version: 1, usage: false, identification: false, decided: false })));
  // A mobile visitor receives both OS links, regardless of the host test machine.
  await context.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Nalana Campaign Test mobile' }));
  await visit(page, tagged);
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  for (const platform of ['windows', 'mac']) {
    const link = page.locator(`a[href*="/api/download?platform=${platform}"]`).first();
    await link.click();
    await expect.poll(() => downloads.filter(url => url.searchParams.get('platform') === platform).length).toBe(1);
    await visit(page, tagged);
    await page.getByRole('button', { name: 'Decline', exact: true }).click();
  }
  for (const url of downloads) {
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('utm_medium')).toBe('paid_social');
    expect(url.searchParams.get('utm_campaign')).toBe('Autumn Creators');
    expect(url.searchParams.get('fbclid')).toBeNull();
    expect(url.searchParams.get('click_id')).toBeNull();
  }
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page).toHaveURL(/\/login\?.*utm_campaign=Autumn\+Creators/);
  await expect(page.locator('.account-decoration[data-motion]')).toBeAttached();
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill('Synthetic-password-123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect.poll(() => registrations.length).toBe(1);
  expect(registrations[0].campaign).toEqual({ source: 'facebook', medium: 'paid_social', campaign: 'Autumn Creators' });
  await expect(page.locator('#nalana-ga, #nalana-rb2b')).toHaveCount(0);
  const storage = await page.evaluate(() => ({ session: Object.keys(sessionStorage), local: Object.keys(localStorage), cookies: document.cookie }));
  expect(storage.session.filter(key => /campaign|funnel|visitor/.test(key))).toEqual([]);
  expect(storage.local.filter(key => /campaign|funnel|visitor/.test(key))).toEqual([]);
  expect(storage.cookies).not.toMatch(/campaign|_ga|rb2b/);
  expect(views.every(row => Object.keys(row).every(key => ['source', 'medium', 'campaign'].includes(key)))).toBe(true);
});

test('client navigations add one page view, while hash changes and private pages add none', async ({ page, context }) => {
  const views = [];
  await context.route('**/api/campaign/page-view', route => { views.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }); });
  await visit(page, tagged);
  expect(views).toEqual([]);
  await page.getByRole('link', { name: 'Features', exact: true }).first().click();
  expect(views).toEqual([]);
  await page.getByRole('link', { name: 'Open Source', exact: true }).first().click();
  await expect(page).toHaveURL(/\/open-source\?/);
  await expect.poll(() => views.length).toBe(1);
  expect(views[0]).toEqual({ source: 'facebook', medium: 'paid_social', campaign: 'Autumn Creators' });
});
