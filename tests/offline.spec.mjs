import { test, expect } from '@playwright/test';
import { assertNoErrors, openApp } from './helpers.mjs';

test('Service Worker liefert das Spiel offline und räumt alte Caches auf', async ({ page }) => {
  const errors = await openApp(page);
  const version = await page.locator('meta[name="application-version"]').getAttribute('content');

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain(`sandbox-v${version}`);
  expect(await page.evaluate(() => caches.match('/landing-page').then(Boolean))).toBe(false);

  await page.context().setOffline(true);
  try {
    await page.reload({ waitUntil: 'load' });
  } finally {
    await page.context().setOffline(false);
  }

  await expect(page).toHaveTitle('Sandbox-Zerstörer');
  await expect(page.locator('#world')).toBeVisible();
  expect(await page.locator('meta[name="application-version"]').getAttribute('content')).toBe(version);
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const sandboxCaches = (await page.evaluate(() => caches.keys()))
    .filter((name) => name.startsWith('sandbox-'));
  expect(sandboxCaches).toEqual([`sandbox-v${version}`]);

  assertNoErrors(errors, ['ERR_INTERNET_DISCONNECTED']);
});
