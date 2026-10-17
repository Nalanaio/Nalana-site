import { test, expect } from './fixtures.js';

// Serve the real local build under production/dev origins without contacting
// either deployment. Only the remote intake script is stubbed; the SDK is real.
async function proxySite(context, origin) {
  await context.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/_vercel/insights/script.js') {
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    }
    const request = route.request();
    const local = new URL(`http://127.0.0.1:5197${url.pathname}${url.search}`);
    const headers = { ...request.headers(), host: local.host };
    // Match the loopback transport's origin for same-origin API checks. Firefox
    // includes Host in request.headers(), unlike the other browser engines.
    if (headers.origin) headers.origin = local.origin;
    const response = await context.request.fetch(local.href, {
      method: request.method(),
      headers,
      data: request.postDataBuffer(),
    });
    return route.fulfill({ response });
  });
}

test('production Vercel SDK follows consent, SPA navigation, revocation and account exclusions', async ({ context, page, audit }) => {
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  await proxySite(context, 'https://www.nalana.io');
  await page.goto('https://www.nalana.io/?token=private#private');
  await expect(page.locator('.grace-site[data-motion]')).toBeAttached();
  const scripts = () => page.locator('script[src*="/_vercel/insights/script.js"]');
  await expect(scripts()).toHaveCount(0);
  await page.getByRole('button', { name: /privacy settings/i }).click();
  const choices = page.getByRole('complementary', { name: /privacy choices/i });
  await choices.getByRole('checkbox', { name: /usage analytics/i }).check();
  await choices.getByRole('button', { name: /save choices/i }).click();
  await expect(scripts()).toHaveCount(1);
  await expect(scripts()).toHaveAttribute('data-disable-auto-track', '1');
  expect(await page.evaluate(() => {
    const beforeSend = window.vaq.find(([command]) => command === 'beforeSend')[1];
    return beforeSend({ type: 'pageview', url: window.location.href });
  })).toEqual({ type: 'pageview', url: 'https://www.nalana.io/' });

  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL('https://www.nalana.io/privacy');
  await expect.poll(() => page.evaluate(() => window.vaq.filter(([command, value]) =>
    command === 'pageview' && value.path === '/privacy').length)).toBe(1);
  await expect(scripts()).toHaveCount(1);

  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await choices.getByRole('checkbox', { name: /usage analytics/i }).uncheck();
  await choices.getByRole('button', { name: /save choices/i }).click();
  await expect(scripts()).toHaveCount(0);
  await expect(page.locator('#nalana-ga')).toHaveCount(0);

  await page.goto('https://www.nalana.io/');
  await page.getByRole('button', { name: /privacy settings/i }).click();
  await choices.getByRole('checkbox', { name: /usage analytics/i }).check();
  await choices.getByRole('button', { name: /save choices/i }).click();
  await expect(scripts()).toHaveCount(1);
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  await expect(page.locator('.account-decoration[data-motion]')).toBeAttached();
  await expect(scripts()).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.va)).toBe('undefined');
});

test('dev never injects Vercel Analytics even when the vendor flag and usage choice are enabled', async ({ context, page, audit }) => {
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  await proxySite(context, 'https://nalana-grace-dev.vercel.app');
  await context.addInitScript(() => localStorage.setItem('nalana_privacy_v1', JSON.stringify({
    version: 1, usage: true, identification: false, decided: true
  })));
  await page.goto('https://nalana-grace-dev.vercel.app/');
  await expect(page.locator('.grace-site[data-motion]')).toBeAttached();
  await expect(page.locator('#nalana-ga')).toHaveCount(1);
  await expect(page.locator('script[src*="/_vercel/insights/script.js"]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.va)).toBe('undefined');
});
