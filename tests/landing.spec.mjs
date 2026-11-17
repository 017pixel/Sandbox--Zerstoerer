import { test, expect } from '@playwright/test';
import { assertNoErrors, trackErrors } from './helpers.mjs';

test('Landingpage, Demo und Medien laden ohne Fehler', async ({ page }) => {
  const errors = trackErrors(page);

  await page.goto('/landing-page');
  await expect(page).toHaveTitle(/Sandbox-Zerstörer/);
  await expect(page.locator('h1')).toContainText('Kleine Pixel');
  await expect(page.locator('#demo-frame')).toHaveAttribute('src', '/landing-page/demo.html');
  await expect(page.locator('#game-video')).toHaveAttribute(
    'poster',
    '/landing-page/assets/video-poster.webp',
  );
  await expect(page.locator('.world-image img')).toHaveCount(3);
  await expect(page.locator('a[href="/"]').first()).toBeVisible();

  const demo = page.frameLocator('#demo-frame');
  await expect(demo.locator('#world')).toBeVisible();
  await expect(demo.locator('#currentMat')).toHaveText('STEIN');

  await demo.locator('#tools-container button').filter({ hasText: 'SAND' }).click();
  await expect(demo.locator('#currentMat')).toHaveText('SAND');
  await demo.locator('#world').click({ position: { x: 200, y: 120 } });
  expect(await demo.locator('#world').evaluate(() => currentMaterial)).toBe(
    await demo.locator('#world').evaluate(() => M.SAND),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  assertNoErrors(errors);
});
