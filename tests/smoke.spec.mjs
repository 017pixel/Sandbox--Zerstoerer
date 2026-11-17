import { test, expect } from '@playwright/test';
import {
  assertNoErrors,
  countMaterial,
  drawAt,
  gridStats,
  openApp,
  openSettings,
  openWorlds,
} from './helpers.mjs';

test.describe('@smoke Grundstart', () => {
  test('Spiel lädt, Version stimmt und Zeichnen funktioniert', async ({ page }) => {
    const errors = await openApp(page);

    await expect(page).toHaveTitle('Sandbox-Zerstörer');
    const version = await page.locator('meta[name="application-version"]').getAttribute('content');
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);

    await openSettings(page);
    await expect(page.locator('#settingsPanel')).toContainText(`v${version}`);

    const before = await gridStats(page);
    expect(before.width).toBe(480);
    expect(before.height).toBe(300);

    await drawAt(page, 0.5, 0.25);
    const after = await gridStats(page);
    expect(after.solid).toBeGreaterThan(before.solid);
    expect(await countMaterial(page, 'STONE')).toBeGreaterThan(0);

    assertNoErrors(errors);
  });

  test('Mobile Layout bleibt bedienbar und ohne horizontales Überlaufen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await openApp(page);

    const layout = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);

    await openWorlds(page);
    await expect(page.locator('#worldsPanel button[onclick^="loadWorld("]')).toHaveCount(8);

    await openSettings(page);
    await expect(page.locator('#worldsPanel')).toBeHidden();
    await expect(page.locator('#settingsPanel')).toBeVisible();

    await page.locator('.ergonomic-menu > button[onclick="toggleBigInventory()"]').click();
    await expect(page.locator('#bigInventory')).toHaveClass(/open/);

    assertNoErrors(errors);
  });
});
