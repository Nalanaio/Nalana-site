import { test, expect, visit } from './fixtures.js';

async function firstVisit(context) {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('privacy-notice-seeded')) return;
    sessionStorage.setItem('privacy-notice-seeded', 'true');
    localStorage.setItem('nalana_privacy_v1', JSON.stringify({ version: 1, usage: false, identification: false, decided: false }));
  });
}

test('first-visit notice stays compact on desktop and mobile, and decline persists', async ({ context, page }, testInfo) => {
  await firstVisit(context);
  await visit(page, '/');
  const notice = page.getByRole('complementary', { name: 'Privacy choices' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('#nalana-ga, #nalana-identification')).toHaveCount(0);
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 568]]) {
    await page.setViewportSize({ width, height });
    const bounds = await notice.boundingBox();
    expect(bounds.height).toBeLessThan(180);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`compact-${name}.png`) });
  }
  await notice.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('#nalana-ga, #nalana-identification')).toHaveCount(0);
  const settings = page.getByRole('button', { name: 'Privacy settings', exact: true });
  await settings.click();
  await expect(notice.getByRole('checkbox', { name: /usage analytics/i })).not.toBeChecked();
  await expect(notice.getByRole('checkbox', { name: /visitor identification/i })).not.toBeChecked();
  await notice.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(settings).toBeFocused();
});

test('compact analytics opt-in keeps identification off and customization can be canceled', async ({ context, page, audit }) => {
  await firstVisit(context);
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  await visit(page, '/');
  const notice = page.getByRole('complementary', { name: 'Privacy choices' });
  await notice.getByRole('button', { name: 'Customize', exact: true }).click();
  await expect(notice.getByRole('heading', { name: 'Your privacy choices' })).toBeFocused();
  await notice.getByRole('checkbox', { name: /visitor identification/i }).check();
  await notice.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(notice.getByRole('button', { name: 'Customize', exact: true })).toBeFocused();
  await expect(page.locator('#nalana-ga, #nalana-identification')).toHaveCount(0);
  await notice.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await expect(page.locator('#nalana-ga')).toHaveCount(1);
  await expect(page.locator('#nalana-identification')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nalana_privacy_v1')))).toMatchObject({ usage: true, identification: false, decided: true });
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await notice.getByRole('checkbox', { name: /visitor identification/i }).check();
  await notice.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click();
  await expect(notice.getByRole('checkbox', { name: /visitor identification/i })).not.toBeChecked();
});

test('consent controls preserve distinct choices and vendor loading is isolated from account routes', async ({ context, page, audit }) => {
  const vendorRequests = [];
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//, /^https:\/\/ddwl4m2hdecbv\.cloudfront\.net\//);
  page.on('request', request => { if (/googletagmanager|cloudfront/.test(request.url())) vendorRequests.push(new URL(request.url()).hostname); });
  await visit(page, '/');
  expect(vendorRequests).toEqual([]);
  await page.getByRole('button', { name: /privacy settings/i }).click();
  const choices = page.getByRole('complementary', { name: /privacy choices/i });
  await expect(choices).toBeVisible();
  await choices.getByRole('checkbox', { name: /usage analytics/i }).check();
  await choices.getByRole('button', { name: /save choices/i }).click();
  await expect.poll(() => vendorRequests).toContain('www.googletagmanager.com');
  expect(vendorRequests).not.toContain('ddwl4m2hdecbv.cloudfront.net');
  const commands = await page.evaluate(() => (window.dataLayer || []).map(item => Array.from(item)));
  expect(commands.filter(command => command[0] === 'event' && command[1] === 'page_view')).toHaveLength(1);
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  expect(await page.locator('#nalana-ga').count()).toBe(0);
  expect(await page.locator('#nalana-identification').count()).toBe(0);
});

test('canonical downloads remain native, click intent is single and tracking failures cannot gate them', async ({ context, page, audit }) => {
  // Both installers are intentionally available on mobile. Desktop visibility
  // has its own OS matrix; retain both-platform activation coverage here.
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile'});
  });
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  await context.addInitScript(() => localStorage.setItem('nalana_privacy_v1', JSON.stringify({ version: 1, usage: true, identification: false, decided: true })));
  // WebKit on Windows does not emit downloads for route.fulfill attachments
  // (Playwright #28253). Real local HTTP retains the native browser behavior;
  // this rewrite exists only at the test network boundary, never in app code.
  await context.route('**/api/download?*', route => route.continue({
    url: `http://127.0.0.1:5198/__synthetic-download${new URL(route.request().url()).search}`,
  }));
  await visit(page, '/');
  await expect(page.locator('#nalana-ga')).toHaveCount(1);
  for (const platform of ['mac', 'windows']) {
    const link = page.locator(`a[href="/api/download?platform=${platform}"]`).first();
    await expect(link).toHaveAttribute('data-sveltekit-reload', '');
    const download = page.waitForEvent('download');
    await link.click();
    const attachment = await download;
    expect(attachment.suggestedFilename()).toBe('synthetic-download.txt');
    await attachment.cancel();
  }
  let events = await page.evaluate(() => (window.dataLayer || []).map(item => Array.from(item)).filter(command => command[0] === 'event' && command[1] === 'download_clicked'));
  expect(events).toHaveLength(2);
  expect(events.map(command => command[2].download_platform).sort()).toEqual(['mac', 'windows']);
  // A throwing optional analytics implementation cannot cancel the native anchor.
  await page.evaluate(() => { window.gtag = () => { throw new Error('synthetic analytics failure'); }; });
  const download = page.waitForEvent('download');
  await page.locator('a[href="/api/download?platform=mac"]').first().press('Enter');
  await (await download).cancel();
});

test('revoking a granted permission reloads and removes vendor scripts', async ({ context, page, audit }) => {
  audit.allowedVendors.push(/^https:\/\/www\.googletagmanager\.com\//);
  await context.addInitScript(() => {
    if (sessionStorage.getItem('synthetic-consent-seeded')) return;
    sessionStorage.setItem('synthetic-consent-seeded', 'true');
    localStorage.setItem('nalana_privacy_v1', JSON.stringify({ version: 1, usage: true, identification: false, decided: true }));
  });
  await visit(page, '/');
  await expect(page.locator('#nalana-ga')).toHaveCount(1);
  await page.evaluate(() => { window.__documentIdentity = 'before-revoke'; });
  await page.getByRole('button', { name: /privacy settings/i }).click();
  await page.getByRole('button', { name: /decline optional tracking/i }).click();
  await expect.poll(() => page.evaluate(() => window.__documentIdentity)).toBeUndefined();
  await expect(page.locator('#nalana-ga')).toHaveCount(0);
});
