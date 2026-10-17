import { test, expect, noOverflow, screenshot, visit } from './fixtures.js';

test('server HTML retains the design, content and both native download links without JavaScript', async ({ browser, browserName, baseURL }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 },userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Create/);
    for (const platform of ['mac', 'windows']) await expect(page.locator(`a[href="/api/download?platform=${platform}"]`).first()).toBeVisible();
    for (const route of ['terms', 'privacy', 'eula', 'refund', 'cookies', 'open-source']) await expect(page.locator(`a[href="/${route}"]`).first()).toBeAttached();
    await noOverflow(page);
    // Playwright also waits for fonts internally while taking a screenshot.
    // Firefox's disabled-JS font promise hangs; all SSR assertions still run.
    if (browserName !== 'firefox') await screenshot(page, testInfo, 'landing-no-javascript-375', { javaScriptEnabled: false });
  } finally { await context.close(); }
});

test('workflow keyboard selection, feature controls and pause work with runtime reduced motion', async ({ page }, testInfo) => {
  await visit(page, '/');
  const workflow = page.getByRole('tablist', { name: /workflow/i });
  const create = workflow.getByRole('tab', { name: /create/i });
  await create.focus();
  await page.keyboard.press('ArrowRight');
  await expect(workflow.getByRole('tab', { name: /iterate/i })).toBeFocused();
  await expect(workflow.getByRole('tab', { name: /iterate/i })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(workflow.getByRole('tab', { name: /fine tune/i })).toHaveAttribute('aria-selected', 'true');
  const panel = page.locator(`#${await workflow.getByRole('tab', { name: /fine tune/i }).getAttribute('aria-controls')}`);
  await expect(panel).toContainText(/material|refine|fine|scene/i);
  const pause = page.getByRole('button', { name: /pause.*motion|pause.*animation/i }).first();
  await pause.click();
  await expect(page.getByRole('button', { name: /resume.*motion|resume.*animation/i }).first()).toBeVisible();
  const features = page.getByRole('tablist', { name: /features/i });
  const featureTabs = features.getByRole('tab');
  await expect(featureTabs).toHaveCount(4);
  await featureTabs.nth(1).click();
  const selectedPanel = page.locator(`#${await featureTabs.nth(1).getAttribute('aria-controls')}`);
  await expect(selectedPanel).toHaveCSS('opacity', '1');
  await expect(selectedPanel).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workflow.getByRole('tab', { name: /create/i }).click();
  await expect(create).toHaveAttribute('aria-selected', 'true');
  await featureTabs.nth(2).click();
  await expect(featureTabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: /resume.*motion|resume.*animation/i }).first()).toBeVisible();
  await screenshot(page, testInfo, 'landing-controls');
});

test('footer material controls work without ambient animation and asset failures retain the base art', async ({ context, page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, '/');
  const controls = page.getByRole('group', { name: /balloon materials/i });
  const glAvailable = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const available = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return available;
  });
  await controls.getByRole('button', { name: 'sky', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'sky', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fn-balloon')).toBeAttached();
  if (glAvailable) {
    await expect(page.locator('.fn-balloon')).toHaveCSS('opacity', '0.15');
    await expect(page.locator('.fn-texture')).toBeVisible();
    await screenshot(page, testInfo, 'footer-static-sky-material');
  }
  await controls.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fn-balloon')).toHaveCSS('opacity', '1');
  await context.route('**/assets/site/materials/**', route => route.fulfill({ status: 404, body: 'Synthetic asset failure' }));
  await page.reload();
  await page.locator('.grace-site[data-motion]').waitFor({ state: 'attached' });
  await controls.getByRole('button', { name: 'forest', exact: true }).click();
  await expect(page.locator('.fn-balloon')).toBeVisible();
  await screenshot(page, testInfo, 'footer-static-asset-fallback');
});

test('actual WebGL context loss leaves the static river and controls usable', async ({ context, page }, testInfo) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, get: () => undefined }));
  await visit(page, '/');
  const glAvailable = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (extension) extension.loseContext();
    return !!extension;
  });
  test.skip(!glAvailable, 'Browser does not expose WebGL2 and actual context loss');
  await expect(page.locator('.hero-caustic-host canvas')).toHaveCount(1);
  const supported = await page.locator('.hero-caustic-host canvas').evaluate(canvas => {
    const context = canvas.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  test.skip(!supported, 'Browser does not expose an actual WebGL context-loss extension');
  await expect(page.locator('.hero-caustic-host canvas')).toHaveCount(0);
  await expect(page.locator('.hero .river-static')).toBeVisible();
  await page.getByRole('tablist', { name: /workflow/i }).getByRole('tab', { name: /iterate/i }).click();
  await expect(page.locator('a[href^="/api/download?platform="]').first()).toBeVisible();
});

test('real legal links unmount and remount in one document; sensitive login replaces it', async ({ page }) => {
  await page.addInitScript(() => {
    const seen = new WeakSet();
    window.__visualDraws = { detached: 0 };
    for (const api of [window.CanvasRenderingContext2D, window.WebGL2RenderingContext]) {
      if (!api) continue;
      // Clearing a detached canvas is legitimate destructor work. A stroke or
      // GPU draw after detachment would demonstrate a surviving visual owner.
      const method = api === window.CanvasRenderingContext2D ? 'stroke' : 'drawArrays';
      const original = api.prototype[method];
      api.prototype[method] = function (...args) {
        if (this.canvas.isConnected) seen.add(this.canvas);
        else if (seen.has(this.canvas)) window.__visualDraws.detached++;
        return original.apply(this, args);
      };
    }
  });
  await visit(page, '/');
  await page.evaluate(() => { window.__documentIdentity = 'same-document-marker'; });
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('a[href="/privacy"]').first().click();
    await expect(page).toHaveURL(/\/privacy$/);
    expect(await page.evaluate(() => window.__documentIdentity)).toBe('same-document-marker');
    await page.getByRole('link', { name: /back to|nalana|home/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Create/);
    expect(await page.evaluate(() => window.__documentIdentity)).toBe('same-document-marker');
    await expect(page.locator('.objects-layer')).toHaveCount(1);
    expect(await page.evaluate(() => window.__visualDraws.detached)).toBe(0);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: /sign up/i }).first().click();
  await expect(page).toHaveURL(/\/login\?mode=signup$/);
  expect(await page.evaluate(() => window.__documentIdentity)).toBeUndefined();
});

test('paused and offscreen regions stop continuous canvas updates', async ({ page }) => {
  await page.addInitScript(() => {
    window.__regionDraws = { hero: 0, footer: 0 };
    for (const api of [window.CanvasRenderingContext2D, window.WebGL2RenderingContext]) {
      if (!api) continue;
      const method = api === window.CanvasRenderingContext2D ? 'clearRect' : 'drawArrays';
      const original = api.prototype[method];
      api.prototype[method] = function (...args) {
        if (this.canvas.closest('.hero')) window.__regionDraws.hero++;
        if (this.canvas.closest('.footer')) window.__regionDraws.footer++;
        return original.apply(this, args);
      };
    }
  });
  await visit(page, '/');
  await expect.poll(() => page.evaluate(() => window.__regionDraws.hero)).toBeGreaterThan(2);
  await page.getByRole('button', { name: /pause.*motion|pause.*animation/i }).first().click();
  await page.waitForTimeout(100);
  const paused = await page.evaluate(() => window.__regionDraws.hero);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__regionDraws.hero)).toBe(paused);
  await page.getByRole('button', { name: /resume.*motion|resume.*animation/i }).first().click();
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const offscreen = await page.evaluate(() => window.__regionDraws.hero);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__regionDraws.hero)).toBe(offscreen);
});

test('GPU and observer unavailability preserve tabs, content and native downloads', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, get: () => undefined });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...options) { return /webgl|webgpu/.test(kind) ? null : getContext.call(this, kind, ...options); };
  });
  await visit(page, '/');
  // SvelteKit itself requires IntersectionObserver during router startup. Remove
  // the observers after that, then mount a fresh visual root through real links.
  await page.evaluate(() => { delete window.IntersectionObserver; delete window.ResizeObserver; });
  await page.locator('a[href="/privacy"]').first().click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole('link', { name: /back to home/i }).click();
  await expect(page.locator('.grace-site[data-motion]')).toBeAttached();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Create/);
  await page.getByRole('tablist', { name: /workflow/i }).getByRole('tab', { name: /iterate/i }).click();
  await expect(page.locator('a[href^="/api/download?platform="]').first()).toBeVisible();
});

test('actual Svelte teardown disposes a late result and does not stop another root', async ({ page }) => {
  await visit(page, 'http://127.0.0.1:5198');
  await page.getByRole('button', { name: 'Destroy A' }).click();
  await page.getByRole('button', { name: 'Resolve B' }).click();
  const ledger = () => page.getByTestId('ledger').textContent().then(JSON.parse);
  await expect.poll(async () => (await ledger()).B.draw).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Resolve A' }).click();
  await expect.poll(async () => (await ledger()).A.released).toBe(1);
  const value = await ledger();
  expect(value.A.allocated).toBe(1);
  expect(value.A.draw).toBe(0);
  expect(value.A.write).toBe(0);
  expect(value.detached).toBe(0);
  await page.getByRole('button', { name: 'Destroy B' }).click();
  await expect.poll(async () => (await ledger()).B.released).toBe(1);
});

for (const width of [375, 768, 1440]) test(`layout remains usable at ${width}px and every legal URL resolves`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, '/');
  await noOverflow(page);
  if (width <= 820) {
    const stage = await page.locator('.hero .stage').boundingBox();
    expect(stage.width, 'hero art must retain the full mobile stage').toBeCloseTo(width, 0);
    expect(stage.x).toBeCloseTo(0, 0);
  }
  for (const route of ['terms', 'privacy', 'eula', 'refund', 'cookies', 'open-source']) {
    const link = page.locator(`a[href="/${route}"]`).first();
    await expect(link).toBeAttached();
    const response = await page.request.get(`/${route}`);
    expect(response.status()).toBe(200);
  }
  await screenshot(page, testInfo, `landing-${width}`);
});
