import { test, expect, visit } from './fixtures.js';

// The QA server serves synthetic stable 2.1 and beta build 19 manifests
// (tests/integration/local-outbound-guard.mjs); no GitHub request is made.
// PUBLIC_DEFAULT_DOWNLOAD_CHANNEL is unset there, so the default is beta.
const hero = page => page.locator('.hero-download');
const group = page => hero(page).getByRole('radiogroup', { name: 'Release channel' });
const radio = (page, name) => group(page).getByRole('radio', { name });
const ctas = page => hero(page).locator('a.btn[data-cta-id^="download_"]');
const channels = async page => (await ctas(page).evaluateAll(nodes => nodes.map(node => new URL(node.href).searchParams.get('channel'))));

test('the configured default is selected and every CTA names its channel', async ({ page }) => {
  await visit(page, '/');
  await expect(radio(page, 'Beta')).toHaveAttribute('aria-checked', 'true');
  await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'false');
  expect(await channels(page)).not.toHaveLength(0);
  expect(new Set(await channels(page))).toEqual(new Set(['beta']));
  await expect(ctas(page).first()).toHaveAccessibleName(/^Download Beta for (Mac|Windows)$/);
  await expect(page.locator('.hero-sub')).toHaveText('Nalana Beta (Build 19) is out now.');
  // The Vision CTA follows the same selection.
  const vision = page.locator('.vision-download a.btn').first();
  expect(new URL(await vision.evaluate(node => node.href)).searchParams.get('channel')).toBe('beta');
});

test('arrow, Home and End keys move the roving selection and update hrefs, URL and storage', async ({ page }) => {
  await visit(page, '/');
  const beta = radio(page, 'Beta'), stable = radio(page, 'Stable');
  await expect(beta).toHaveAttribute('tabindex', '0');
  await expect(stable).toHaveAttribute('tabindex', '-1');
  await beta.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(stable).toBeFocused();
  await expect(stable).toHaveAttribute('aria-checked', 'true');
  await expect(stable).toHaveAttribute('tabindex', '0');
  await expect(beta).toHaveAttribute('aria-checked', 'false');
  await expect(beta).toHaveAttribute('tabindex', '-1');
  await expect.poll(() => channels(page)).toEqual(expect.arrayContaining(['stable']));
  expect(new Set(await channels(page))).toEqual(new Set(['stable']));
  await expect(ctas(page).first()).toHaveAccessibleName(/^Download for (Mac|Windows)$/);
  await expect(page.locator('.hero-sub')).toHaveText('Nalana 2.1 is out now.');
  await expect(page).toHaveURL(/\?channel=stable$/);
  expect(await page.evaluate(() => localStorage.getItem('nalana.download_channel'))).toBe('stable');
  // The Vision CTA updates with the hero selection.
  await expect(page.locator('.vision-download').getByRole('radio', { name: 'Stable' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('End');
  await expect(beta).toBeFocused();
  await expect(beta).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Home');
  await expect(stable).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(beta).toHaveAttribute('aria-checked', 'true');
  await expect(page).toHaveURL(/\?channel=beta$/);
  expect(new Set(await channels(page))).toEqual(new Set(['beta']));
  // Tab leaves the group in a single stop and lands on the CTA.
  await page.keyboard.press('Tab');
  await expect(ctas(page).first()).toBeFocused();
});

test('?channel=stable is rendered by the server and wins over a remembered choice', async ({ context, page, request }) => {
  const html = await (await request.get('/?channel=stable')).text();
  expect(html).toMatch(/data-channel-option="stable"[^>]*aria-checked="true"/);
  expect(html).toContain('channel=stable');
  expect(html).not.toMatch(/\/api\/download\?platform=\w+&amp;channel=beta/);
  await context.addInitScript(() => localStorage.setItem('nalana.download_channel', 'beta'));
  await visit(page, '/?channel=stable');
  await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
  expect(new Set(await channels(page))).toEqual(new Set(['stable']));
  await expect(page.locator('.channel-hint').first()).toBeEmpty();
});

test('an explicit choice is remembered across visits without a query', async ({ page }) => {
  await visit(page, '/');
  await radio(page, 'Stable').click();
  await expect(page).toHaveURL(/\?channel=stable$/);
  await visit(page, '/');
  await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
  expect(new Set(await channels(page))).toEqual(new Set(['stable']));
  // The remembered choice does not rewrite a URL that names no channel.
  await expect(page).toHaveURL(/\/$/);
});

test('the beta note is a polite live hint linked from the CTA', async ({ page }) => {
  await visit(page, '/?channel=stable');
  const cta = ctas(page).first();
  await expect(cta).not.toHaveAttribute('aria-describedby', /.+/);
  await radio(page, 'Beta').click();
  const hintId = await cta.getAttribute('aria-describedby');
  expect(hintId).toBeTruthy();
  const hint = page.locator(`#${hintId}`);
  await expect(hint).toHaveAttribute('aria-live', 'polite');
  await expect(hint).toHaveText("Beta may be unstable. It uses a separate beta account, so your stable sign-in won't carry over.");
  await expect(cta).toHaveAccessibleDescription(/separate beta account/);
  await expect(hint).toBeVisible();
});

test.describe('beta manifest down', () => {
  test.use({ extraHTTPHeaders: { 'x-qa-manifest-down': 'beta' } });

  test('Beta is disabled with a hint and the CTA offers Stable explicitly', async ({ page }) => {
    await visit(page, '/');
    const beta = radio(page, 'Beta');
    // Beta is still the selected (default) channel; it is never silently swapped.
    await expect(beta).toHaveAttribute('aria-checked', 'true');
    await expect(beta).toHaveAttribute('aria-disabled', 'true');
    await expect(beta).not.toHaveAttribute('href', /.*/);
    const hintId = await beta.getAttribute('aria-describedby');
    await expect(page.locator(`#${hintId}`)).toHaveText('Beta builds are temporarily unavailable. Try again shortly. You can download Stable instead.');
    await expect(beta).toHaveAccessibleDescription(/Beta builds are temporarily unavailable/);
    await expect(ctas(page).first()).toHaveAccessibleName(/^Download Stable for (Mac|Windows)$/);
    expect(new Set(await channels(page))).toEqual(new Set(['stable']));
    await expect(page.locator('.hero-sub')).toHaveText('Nalana 2.1 is out now.');
    // A disabled segment cannot be chosen by click or keys.
    await radio(page, 'Stable').click();
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(beta).toBeFocused();
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    await beta.click({ force: true });
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => localStorage.getItem('nalana.download_channel'))).toBe('stable');
  });

  test('with Stable selected the Beta outage is still explained, and a remembered Beta is not restored', async ({ context, page }) => {
    await context.addInitScript(() => localStorage.setItem('nalana.download_channel', 'beta'));
    await visit(page, '/?channel=stable');
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    await visit(page, '/');
    await expect(radio(page, 'Beta')).toHaveAttribute('aria-disabled', 'true');
    expect(new Set(await channels(page))).toEqual(new Set(['stable']));
    await visit(page, '/?channel=stable');
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.channel-hint').first()).toHaveText('Beta builds are temporarily unavailable. Try again shortly.');
  });
});

test.describe('stable manifest down', () => {
  test.use({ extraHTTPHeaders: { 'x-qa-manifest-down': 'stable' } });

  test('a Beta CTA offered in place of Stable still carries the separate-account warning', async ({ page }) => {
    await visit(page, '/?channel=stable');
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-disabled', 'true');
    await expect(ctas(page).first()).toHaveAccessibleName(/^Download Beta for (Mac|Windows)$/);
    expect(new Set(await channels(page))).toEqual(new Set(['beta']));
    await expect(page.locator('#hero-channel-hint .beta-note')).toHaveText("Beta may be unstable. It uses a separate beta account, so your stable sign-in won't carry over.");
    await expect(ctas(page).first()).toHaveAccessibleDescription(/separate beta account/);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the segments are server links that select a channel by reload', async ({ page }) => {
    await page.goto('/');
    await expect(radio(page, 'Beta')).toHaveAttribute('aria-checked', 'true');
    await radio(page, 'Stable').click();
    await expect(page).toHaveURL(/\?channel=stable$/);
    await expect(radio(page, 'Stable')).toHaveAttribute('aria-checked', 'true');
    expect(new Set(await channels(page))).toEqual(new Set(['stable']));
  });
});
