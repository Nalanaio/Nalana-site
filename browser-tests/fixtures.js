import { test as base, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';

export const consent = { version: 1, usage: false, identification: false, decided: true };
export const user = {
  id: 'synthetic-user-1', email: 'designer@example.test', display_name: 'Synthetic Designer',
  email_verified: true, avatar_url: null, tier: 'pro', credits: 23,
};

export const test = base.extend({
  audit: [async ({ context, page }, use) => {
    const errors = [], external = [], allowedVendors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await context.addInitScript(value => {
      if (!localStorage.getItem('nalana_privacy_v1')) localStorage.setItem('nalana_privacy_v1', JSON.stringify(value));
    }, consent);
    // Keep immutable chunks on ordinary HTTP: pausing every local module through
    // route.continue can create cancellation races during full-document redirects.
    // Send a selective regex to Playwright so external traffic is still blocked
    // before it leaves the browser, without intercepting loopback asset requests.
    await context.route(/^https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$))/i, route => {
      const url = new URL(route.request().url());
      if (allowedVendors.some(pattern => pattern.test(url.href))) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
      external.push(`${url.origin}${url.pathname}`);
      return route.abort('blockedbyclient');
    });
    await use({ errors, external, allowedVendors });
    expect(errors, 'no page exception or unhandled rejection').toEqual([]);
    expect(external, 'no unexpected external request').toEqual([]);
  }, { auto: true }],
});
export { expect };

// Use the real built store, without adding a production test hook or assuming a
// minifier's export name. The production account pages import this same module.
export async function replaceSession(page, identity) {
  const directory = new URL('../.svelte-kit/output/client/_app/immutable/chunks/', import.meta.url);
  const candidates = [];
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(file, directory), 'utf8');
    if (source.includes('nalana_session_v1') && source.includes('setSession(')) candidates.push(file);
  }
  expect(candidates, 'one production session-controller module').toHaveLength(1);
  await page.evaluate(async ({ file, identity }) => {
    const module = await import(`/_app/immutable/chunks/${file}`);
    const auth = Object.values(module).find(value => typeof value?.setSession === 'function' && typeof value?.getAuthHeader === 'function');
    if (!auth) throw new Error('Production auth store export was not found');
    auth.setSession('synthetic-second-access', identity, 'synthetic-second-refresh');
  }, { file: candidates[0], identity });
}

// SSR controls exist before Svelte attaches their handlers. Wait for the real
// onMount-owned controller before exercising an interactive marketing/auth page.
export async function visit(page, path) {
  const response = await page.goto(path);
  if (new URL(page.url()).port !== '5198') {
    await expect(page.locator('.grace-site[data-motion], .account-decoration[data-motion]').first()).toBeAttached();
  }
  return response;
}

export async function mockAccount(context, { usage = { plan: 'pro', credits_remaining: 23 }, usageStatus = 200, identity = user } = {}) {
  await context.addInitScript(identity => {
    if (sessionStorage.getItem('synthetic-session-seeded')) return;
    sessionStorage.setItem('synthetic-session-seeded', 'true');
    localStorage.setItem('nalana_session_v1', JSON.stringify({ token: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token', user: identity }));
  }, identity);
  await context.route('**/api/auth/me', route => route.fulfill({ json: { user: identity } }));
  await context.route('**/api/usage/me', route => route.fulfill({ status: usageStatus, json: usage }));
  await context.route('**/api/operator/logout', route => route.fulfill({ json: {} }));
}

export async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

export async function screenshot(page, testInfo, name, { javaScriptEnabled = true } = {}) {
  // Firefox does not resolve FontFaceSet.ready with JavaScript disabled.
  // SSR acceptance must not depend on running a page-side promise.
  if (javaScriptEnabled) {
    await page.evaluate(() => document.fonts.ready);
  }
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}
