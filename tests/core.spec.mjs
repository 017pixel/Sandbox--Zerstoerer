import { test, expect } from '@playwright/test';
import {
  SCENARIO_NAMES,
  assertNoErrors,
  drawAt,
  gridChecksum,
  gridStats,
  loadEmptyWorld,
  loadScenario,
  loadUserWorld,
  openApp,
  openSettings,
  saveWorld,
  selectTool,
  waitForGame,
} from './helpers.mjs';

test('Alle acht Szenarien bauen eine vollständige Welt', async ({ page }) => {
  const errors = await openApp(page);

  for (const name of SCENARIO_NAMES) {
    await loadScenario(page, name);
    const stats = await gridStats(page);
    expect(stats.width, name).toBe(480);
    expect(stats.height, name).toBe(300);
    expect(stats.solid, name).toBeGreaterThan(2000);

    const skyline = await page.evaluate(() => ChunkEngine.getSkyline(Math.floor(WORLD_WIDTH / 2)));
    expect(skyline, name).toBeLessThan(300);

    const atmosphere = await page.evaluate(() => worldAtmosphere.skyTop);
    expect(atmosphere, name).toHaveLength(3);
  }

  assertNoErrors(errors);
});

test('Gespeicherte Welt übersteht Reload und Laden unverändert', async ({ page }) => {
  const errors = await openApp(page);

  await loadEmptyWorld(page);
  await selectTool(page, 'STEIN');
  await drawAt(page, 0.5, 0.25);

  const beforeSave = await gridChecksum(page);
  const beforeStats = await gridStats(page);
  expect(beforeStats.solid).toBeGreaterThan(0);

  await saveWorld(page, 'Persistenz-Test');
  await page.reload();
  await waitForGame(page);
  await loadUserWorld(page, 'Persistenz-Test');

  expect(await gridChecksum(page)).toBe(beforeSave);
  expect((await gridStats(page)).solid).toBe(beforeStats.solid);
  expect(await page.evaluate(() => currentEditingWorldName)).toBe('Persistenz-Test');

  assertNoErrors(errors);
});

test('Einstellungen und erweitertes Inventar überstehen Reload', async ({ page }) => {
  const errors = await openApp(page);

  await openSettings(page);
  await page.locator('input[oninput*="brush"]').evaluate((element) => {
    element.value = '7';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => brushSize === 7);
  await expect(page.locator('#disp-brush')).toHaveText('7px');
  await page.waitForFunction(async () => {
    const state = await dbStorage.getSetting('appState');
    return state?.brushSize === 7;
  });

  await page.locator('.ergonomic-menu > button[onclick="toggleBigInventory()"]').click();
  await expect(page.locator('#bigInventory')).toHaveClass(/open/);
  await page.locator('#bigInventoryGrid button').filter({ hasText: 'TNT' }).click();
  await expect(page.locator('#tools-container button').filter({ hasText: 'TNT' })).toBeVisible();
  await page.waitForFunction(async () => {
    const state = await dbStorage.getSetting('appState');
    return state?.selectedExtraIds?.includes(M.TNT) === true;
  });

  await page.reload();
  await waitForGame(page);

  expect(await page.evaluate(() => brushSize)).toBe(7);
  await expect(page.locator('#disp-brush')).toHaveText('7px');
  expect(await page.evaluate(() => activeExtraTools.some((tool) => tool.id === M.TNT))).toBe(true);
  await expect(page.locator('#tools-container button').filter({ hasText: 'TNT' })).toBeVisible();

  assertNoErrors(errors);
});
