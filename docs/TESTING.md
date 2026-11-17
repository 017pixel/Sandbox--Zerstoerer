# Testen

## Ziel

Die Tests sollen schnelle Änderungen nicht ausbremsen und trotzdem die
wichtigen Daten- und Spielpfade absichern. Deshalb entscheidet zuerst die
Diff-Größe, dann die betroffenen Dateien.

## Einmalige Einrichtung

```bash
npm install
npx playwright install chromium
```

Danach reichen die npm-Skripte. Der Testserver wird von Playwright automatisch
auf Port `4173` gestartet und danach beendet. Der normale Dev-Server bleibt
davon unberührt.

## Diff-Größe

```bash
npm run release:scope
```

Das Script liest staged, unstaged und untracked Dateien. In CI akzeptiert es
`--base origin/main`.

| Ergebnis | Bedeutung |
|---|---|
| `KLEIN` | keine Datenpfade, keine echte Engine-Änderung, höchstens fünf produktive Dateien |
| `GROSS` | Datenpfad, Engine, Service Worker, Update-Flow, Abhängigkeiten, Deployment-Build, übergreifender Umbau oder mehr als fünf produktive Dateien |

Reine Kommentaränderungen in Engine-Dateien gelten nicht als echte
Engine-Änderung. Sobald Code, Verhalten oder Daten betroffen sind, ist es
GROSS.

KLEIN prüft `npm run check:quick`. GROSS prüft `npm run check`. Ein Release
läuft immer über `npm run check`, auch bei KLEIN.

## Befehle

| Befehl | Was passiert | Dauer |
|---|---|---|
| `npm run test:changed` | Nur die Specs, die zum Diff passen. | je nach Diff |
| `npm run test:smoke` | Start, Version, Zeichnen, Mobile-Layout. | ca. 2–4 s |
| `npm run test:e2e` | Alle Browser-Tests. | ca. 5–20 s |
| `npm run test:landing` | Nur Landingpage, Demo und Medien. | ca. 2 s |
| `npm run check:quick` | `check:source` plus `test:changed`, ohne Produktionsbuild. Bricht bei GROSS ab. | ca. 5–10 s |
| `npm run check` | Build, Dist-Check und alle E2E-Tests. | ca. 10–25 s |

`check:source` prüft Version, Cache, Doku-Links, Testdateien, Manifest,
Dateiverweise und Syntax. Es gibt in diesem Projekt kein separates ESLint- oder
TypeScript-Setup; diese Prüfung ist der Lint-/Typecheck-Ersatz.

Auf einem Branch mit bereits committeten Änderungen gegen den Basis-Branch:

```bash
npm run check:quick -- --base origin/main
```

## Testzuordnung

`npm run test:changed` nutzt dieselbe Zuordnung wie `release:scope`:

| Geänderte Datei | Tests |
|---|---|
| `index.html`, `sb-ui.js` | Smoke, Core |
| `sb-data.js`, `sb-chunk.js`, `sb-storage.js` | Core, Offline |
| `sb-physics.js`, `sb-renderer.js`, `sb-world.js`, `sb-main.js`, `sb-utils.js`, `sb-audio.js` | Smoke, Core, Offline |
| `sw.js`, `manifest.json`, `pwa-icon.png` | Smoke, Offline |
| `assets/game.css`, `sb-styles.css`, `assets/**` | Smoke, Landing |
| `landing-page/**` | Landing |
| `vercel.json` | Smoke, Offline |
| `tests/helpers.mjs`, `playwright.config.mjs` | alle Specs |
| eine geänderte `.spec.mjs` | genau diese Spec |
| `package.json`, `package-lock.json`, `scripts/**`, `docs/**`, `*.md` | keine Browser-Tests |

Die Zuordnung steht zentral in `scripts/diff-map.mjs`. Neue Spielmodule oder
Testdateien dort ergänzen, damit Scope und Testauswahl gleich bleiben.
Änderungen an `package.json`-Scripts sind KLEIN, aber den geänderten Befehl
einmal manuell ausführen; `check:source` prüft nur, dass die Scripts existieren.
Zusätzlich prüft die Auswahl Dateinamen-Treffer (`foo.spec.mjs` zu `foo.js`)
und explizite Importe in Testdateien. Die App selbst nutzt keine ES-Importe;
die semantische Map deckt die indirekten Abhängigkeiten ab.

## Testdateien

| Datei | Inhalt | Tag |
|---|---|---|
| `tests/smoke.spec.mjs` | Start, Version, Zeichnen, Mobile-Layout, Panels. | `@smoke` |
| `tests/core.spec.mjs` | Alle acht Szenarien, Speichern/Laden, Einstellungen, Inventar. | voll |
| `tests/offline.spec.mjs` | Service Worker, Cache-Name, Offline-Reload, Cache-Aufräumen. | voll |
| `tests/landing.spec.mjs` | Landingpage, Demo-iframe, Video-Poster, Galerie, Mobile. | voll |
| `tests/helpers.mjs` | Selektoren, Warten, Grid-Statistik, Fehlersammlung. | — |

Der Smoke-Lauf führt nur die mit `@smoke` markierten Tests aus. Der volle Lauf
führt alle Tests aus, inklusive Smoke.

Die Browser-Tests laufen gegen den Quellordner, nicht gegen `dist/`. Den Build
prüft `npm run check:dist`; die ausgelieferte Produktion prüft der
Release-Workflow.

## CI

`.github/workflows/verify.yml` klassifiziert jeden Pull Request:

- KLEIN: `check:quick` plus Browser-Smoke.
- GROSS: `check` mit voller E2E-Suite.
- Push auf `main`: immer GROSS.
- Der Job `Gate` bleibt grün, wenn die E2E-Suite bewusst übersprungen wurde.
- `Gate` ist der verpflichtende Branch-Protection-Check.

Damit ist E2E kein Standard für jede Änderung, aber bei Daten-, Engine- und
Release-Änderungen weiterhin Pflicht.

## Was bewusst nicht getestet wird

Diese Entscheidungen sind Absicht, nicht Lücke:

- **Keine Screenshot- oder Pixel-Vergleiche.** Pixelkunst, Fonts und Canvas
  erzeugen viele harmlose Abweichungen. Der Nutzen steht in keinem Verhältnis
  zur Wartezeit und Pflege.
- **Kein eigener Test pro Material.** Die acht Szenarien und der
  Inventar-Test decken die Materialauswahl und die wichtigsten Physikpfade ab.
  Ein neues komplexes Material bekommt gezielt einen Test, nicht jedes
  Material einen eigenen.
- **Kein eigener Test pro Szenario im Smoke-Lauf.** Der volle Lauf klappt alle
  acht Szenarien in einem Test durch. Acht einzelne Starts wären nur
  Redundanz.
- **Kein voller E2E-Lauf für Copy, Farben oder Abstände.** Dafür reicht der
  Smoke-Test.
- **Kein separater Landingpage-Lauf bei reinen Spieländerungen.** `check`
  enthält ihn ohnehin. Für eine reine Landingpage-Änderung reicht
  `npm run test:landing`.
- **Kein zusätzlicher Offline-Test für Darstellungsänderungen.** Der Service
  Worker ändert sich dabei nicht. `check` deckt ihn bei GROSS trotzdem ab.
- **Kein separater Versionstest in Playwright.** Das erledigt
  `scripts/check.mjs` schneller und genauer.
- **Keine Performance-Messung als Test.** FPS hängen vom Rechner ab. Bei
  großen Physik- oder Renderänderungen wird zusätzlich manuell auf einem
  kleinen Viewport geprüft.
- **Keine Cross-Browser-Matrix.** Der Lauf nutzt Chromium. Bei Änderungen an
  Touch, Audio, Service Worker oder Layout zusätzlich Safari und Firefox
  manuell prüfen.
- **Keine echten Geräte.** Mobile wird über den Viewport 390 × 844
  simuliert. Ein echter Gerätetest bleibt bei Input- und Performancefragen
  sinnvoll.
- **Keine datierten Audit-Snapshots, keine Quelltext-Scans auf exakte Zeilen
  und keine doppelten Einmal-Prüfungen.** Version, Cache und Assets prüft
  `check:source` einmal zentral.

## Zusammengelegt statt dupliziert

- Alle acht Szenarien laufen in einem Test durch, nicht in acht Tests mit
  jeweils eigenem Browserstart.
- Es gibt ein Browser-Projekt. Mobile wird über den Viewport im jeweiligen Test
  geprüft, nicht über ein zweites komplettes Projekt.
- Alle Tests teilen sich denselben automatisch gestarteten Dev-Server.
- Selektoren, Warten und Grid-Helfer liegen zentral in `tests/helpers.mjs`.
- Version, Cache, Manifest, Assets und Doku-Links prüft `scripts/check.mjs`.
  Dafür gibt es keinen zweiten Playwright-Test.
- `release:scope` und `test:changed` teilen sich `scripts/diff-map.mjs`.
- Der frühere doppelte Check im `app-update`-Skill ist entfernt.

## Testregeln

- Jeder Test bekommt einen frischen Browser-Kontext und damit eine frische
  IndexedDB. Echte Spielstände werden nie berührt.
- `openApp()` setzt `sessionStorage.hasOpened`, damit der bewusste
  Erststart-Reload den Test nicht stört.
- Nach dem Laden auf `waitForGame()` warten. Die App startet `initUI` mit
  100 ms Verzögerung.
- Stabile Selektoren verwenden: `onclick`-Attribute, IDs, `#tools-container`,
  `#bigInventoryGrid`. Nicht auf doppelte Button-Texte verlassen.
- Keine exakten Partikelzahlen. Schwellen, Materialzählungen und Checksummen
  reichen.
- Keine `waitForTimeout`-Kette als Ersatz für echtes Warten. Die 200 ms in
  `waitForGame()` sind die einzige bewusste Pause.
- Keine Testabhängigkeit von der Reihenfolge. Jeder Test muss allein laufen.
- Keine Tests löschen oder abschwächen, nur weil sie rot sind. Ursache
  beheben.
- Neue sichtbare Features brauchen einen Test. Neue Datenpfade brauchen einen
  Regressionstest mit altem Datensatz.
- Browser-Specs niemals an einen Unit-Runner übergeben. `test:changed` nutzt
  direkt Playwright. Sobald Unit-Tests dazukommen, werden sie dort getrennt.

## Gezielt testen

```bash
# Nur die Tests zum aktuellen Diff
npm run test:changed

# Nur anzeigen, was laufen würde
npm run test:changed -- --list

# Nur Smoke
npm run test:smoke

# Nur eine Datei
npx playwright test tests/core.spec.mjs

# Nur Landingpage
npm run test:landing

# Nur ein Testmuster
npx playwright test --grep "Persistenz"

# Mit sichtbarem Browser
npx playwright test --headed

# Interaktiver Runner
npm run test:e2e:ui

# Trace eines Fehlschlags
npx playwright show-trace test-results/<ordner>/trace.zip
```

## Aufbau eines Tests

```js
import { test, expect } from '@playwright/test';
import { openApp, loadScenario, assertNoErrors } from './helpers.mjs';

test('Beispiel', async ({ page }) => {
  const errors = await openApp(page);
  await loadScenario(page, 'island');
  expect(await page.evaluate(() => ChunkEngine.worldWidth)).toBe(480);
  assertNoErrors(errors);
});
```

Regeln für neue Helfer:

- Nur Dinge aufnehmen, die in mindestens zwei Tests gebraucht werden.
- Selektoren zentral pflegen, nicht in jedem Test neu erfinden.
- Keine Helfer, die Testverhalten verstecken. Der Test soll lesbar bleiben.
