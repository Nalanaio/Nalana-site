import { test, expect, visit } from './fixtures.js';

// The QA server serves synthetic stable 2.1 and beta build 19 manifests
// (tests/integration/local-outbound-guard.mjs); no GitHub request is made.
// The Figma hero has one Stable "Download For Mac" button and a "Download Beta (unstable)" link; there is no channel toggle.
const hero = page => page.locator('.hero-download');
const cta = page => hero(page).locator('a.btn[data-cta-id^="download_"]');
const betaLink = page => hero(page).getByRole('link', { name: 'Download Beta (unstable)' });
const channelOf = async locator => new URL(await locator.evaluate(node => node.href)).searchParams.get('channel');

// Desktop installers only: phones are covered by their own test below.
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name === 'touch' && !/phones/.test(testInfo.title), 'Phones are not offered a download'));

test('phones are not offered a download', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  try {
    await visit(page, '/');
    await expect(page.locator('a[href^="/api/download?"]')).toHaveCount(0);
  } finally { await context.close(); }
});

test('Linux gets the Mac button and a Windows link', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0' });
  const page = await context.newPage();
  try {
    await visit(page, '/');
    await expect(cta(page)).toHaveAccessibleName('Download For Mac');
    const windows = hero(page).getByRole('link', { name: 'Download for Windows' });
    expect(new URL(await windows.evaluate(node => node.href)).searchParams.get('platform')).toBe('windows');
  } finally { await context.close(); }
});

test('the hero matches the Figma: Stable button, copy and a beta link, with no channel toggle', async ({ page }) => {
  await visit(page, '/');
  await expect(hero(page).getByRole('radiogroup')).toHaveCount(0);
  await expect(cta(page)).toHaveCount(1);
  await expect(cta(page)).toHaveAccessibleName(/^Download For (Mac|Windows)$/);
  expect(await channelOf(cta(page))).toBe('stable');
  await expect(page.locator('.hero-sub')).toHaveText('Nalana is its own software, built on Blender.');
  expect(await channelOf(betaLink(page))).toBe('beta');
  const vision = page.locator('.vision-download a.btn');
  await expect(vision).toHaveAccessibleName(/^Download for (Mac|Windows)$/);
  expect(await channelOf(vision)).toBe('stable');
});

test.describe('stable manifest down', () => {
  test.use({ extraHTTPHeaders: { 'x-qa-manifest-down': 'stable' } });

  test('the button offers Beta explicitly and explains the Stable outage', async ({ page }) => {
    await visit(page, '/');
    await expect(cta(page)).toHaveAccessibleName(/^Download Beta For (Mac|Windows)$/);
    expect(await channelOf(cta(page))).toBe('beta');
    await expect(cta(page)).toHaveAccessibleDescription(/^Stable builds are temporarily unavailable/);
    await expect(betaLink(page)).toHaveCount(0);
  });
});

test.describe('beta manifest down', () => {
  test.use({ extraHTTPHeaders: { 'x-qa-manifest-down': 'beta' } });

  test('the Stable button stays and the beta link is hidden', async ({ page }) => {
    await visit(page, '/');
    expect(await channelOf(cta(page))).toBe('stable');
    await expect(betaLink(page)).toHaveCount(0);
  });
});
