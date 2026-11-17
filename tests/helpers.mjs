import { expect } from '@playwright/test';

const SCENARIOS = {
  forest: "button[onclick=\"loadWorld('forest')\"]",
  village: "button[onclick=\"loadWorld('village')\"]",
  island: "button[onclick=\"loadWorld('island')\"]",
  volcano: "button[onclick=\"loadWorld('volcano')\"]",
  cave: "button[onclick=\"loadWorld('cave')\"]",
  mine: "button[onclick=\"loadWorld('mine')\"]",
  ice: "button[onclick=\"loadWorld('ice')\"]",
  labyrinth: "button[onclick=\"loadWorld('labyrinth')\"]",
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);

export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  return errors;
}

/**
 * Öffnet das Spiel ohne den einmaligen Erststart-Reload und sammelt
 * Konsolenfehler, HTTP-Fehler sowie unbehandelte Ausnahmen.
 */
export async function openApp(page) {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('hasOpened', 'true');
    } catch {
      // sessionStorage kann in seltenen Kontexten gesperrt sein.
    }
  });
  await page.goto('/');
  await waitForGame(page);
  return errors;
}

export async function waitForGame(page) {
  await page.waitForFunction(() => (
    typeof ChunkEngine !== 'undefined'
    && typeof loadWorld === 'function'
    && typeof updateSetting === 'function'
  ));
  // sb-main.js startet initUI bewusst mit 100 ms Verzögerung.
  await page.waitForTimeout(200);
}

export async function openSettings(page) {
  await page.locator('button[onclick="toggleSettings()"]').click();
  await expect(page.locator('#settingsPanel')).toBeVisible();
}

export async function openWorlds(page) {
  await page.locator('button[onclick="toggleWorlds()"]').click();
  await expect(page.locator('#worldsPanel')).toBeVisible();
}

export async function loadScenario(page, name) {
  const selector = SCENARIOS[name];
  if (!selector) throw new Error(`Unbekanntes Szenario: ${name}`);
  if (!(await page.locator('#worldsPanel').isVisible())) await openWorlds(page);
  await page.locator(selector).click();
  await expect(page.locator('#worldsPanel')).toBeHidden();
}

export async function loadEmptyWorld(page) {
  await page.locator('button[onclick="resetWorld()"]').click();
}

export async function selectTool(page, label) {
  await page.locator('#tools-container button').filter({ hasText: label }).first().click();
}

export async function drawAt(page, xRatio, yRatio) {
  const box = await page.locator('#world').boundingBox();
  if (!box) throw new Error('Canvas nicht sichtbar');
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

export async function saveWorld(page, name) {
  await page.locator('button[onclick="openSaveWorldDialog()"]').click();
  await page.locator('#worldNameInput').fill(name);
  await page.locator('#saveDialog button[onclick="saveCurrentWorld()"]').click();
  await expect(page.locator('#saveDialog')).toBeHidden();
}

export async function loadUserWorld(page, name) {
  if (!(await page.locator('#worldsPanel').isVisible())) await openWorlds(page);
  await page.locator('#userWorldsList button').filter({ hasText: name.toUpperCase() }).first().click();
  await expect(page.locator('#worldsPanel')).toBeHidden();
}

export async function gridStats(page) {
  return page.evaluate(() => {
    let solid = 0;
    const counts = {};
    for (const value of ChunkEngine.grid) {
      if (value === M.AIR) continue;
      counts[value] = (counts[value] || 0) + 1;
      if (value !== M.BEDROCK) solid += 1;
    }
    return {
      solid,
      counts,
      width: ChunkEngine.worldWidth,
      height: ChunkEngine.worldHeight,
    };
  });
}

export async function countMaterial(page, materialName) {
  return page.evaluate((name) => {
    const id = M[name];
    let count = 0;
    for (const value of ChunkEngine.grid) {
      if (value === id) count += 1;
    }
    return count;
  }, materialName);
}

export async function gridChecksum(page) {
  return page.evaluate(() => {
    let hash = 2166136261;
    for (const value of ChunkEngine.grid) {
      hash ^= value & 0xff;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  });
}

export function assertNoErrors(errors, allowed = []) {
  const unexpected = errors.filter((error) => !allowed.some((pattern) => error.includes(pattern)));
  expect(unexpected).toEqual([]);
}
