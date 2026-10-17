import { test, expect, visit } from './fixtures.js';

test('a failed speculative error-page import preserves account redirects', async ({ context, page }) => {
  const errorModule = /\/_app\/immutable\/nodes\/1\.[^/]+\.js$/;
  let attempts = 0;
  await context.route(errorModule, route => { attempts++; return route.abort('failed'); });
  await visit(page, '/account');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  expect(attempts).toBeGreaterThan(0);

});

test('a required error page still renders', async ({ page }) => {
  const response = await page.goto('/synthetic-missing-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  await expect(page.getByText(/not found/i).first()).toBeVisible();
});
