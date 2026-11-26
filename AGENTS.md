# AGENTS.md — Sandbox-Zerstörer

Diese Datei ist die verbindliche Arbeitsanleitung für Menschen und KI-Agenten
in diesem Repository. Sie ergänzt die globalen Regeln, ersetzt sie aber nicht.

## Was dieses Projekt ist

Sandbox-Zerstörer ist ein statisches Browser-Spiel: Vanilla JavaScript, Canvas,
Pixel-Physik und acht vorgebaute Welten. Es gibt kein Backend, keine API, keine
Konten und keine Server-Datenbank. Spielstände liegen ausschließlich im
Browser in IndexedDB. Vercel liefert nur statische Dateien aus.

Die Landingpage unter `landing-page/` ist eigenständig. Sie hat eigene Styles
und eine isolierte Demo ohne Speicherzugriff.

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm start` | Startet den lokalen Static-Server auf dem ersten freien Port ab 8080. |
| `npm start -- --open` | Startet und öffnet das Spiel im Browser. |
| `npm run stop` | Beendet genau den gestarteten Server. |
| `npm run status` | Zeigt PID, Port und URLs des laufenden Servers. |
| `npm run restart` | Startet den Server neu. |
| `npm run release:scope` | Klassifiziert den Git-Diff als KLEIN oder GROSS. |
| `npm run test:changed` | Führt nur die Browser-Tests zum aktuellen Diff aus. |
| `npm run test:smoke` | Schneller Spielstart, Version, Zeichnen, Mobile-Layout. |
| `npm run test:e2e` | Alle Browser-Tests. |
| `npm run test:landing` | Nur Landingpage, Demo und Medien. |
| `npm run check:source` | Version, Cache, Doku-Links, Testdateien, Manifest, Syntax. |
| `npm run check:quick` | `check:source` plus betroffene Tests, ohne Produktionsbuild. Bricht bei GROSS ab. |
| `npm run check` | Vollständiges Gate: Build, Dist-Check und alle E2E-Tests. |
| `npm run check:dist` | Quellprüfung plus fertiger `dist/`-Build. |
| `npm run build` | Baut `dist/` mit der Produktions-Whitelist. |
| `npm run release -- --type patch --points "..."` | Bereitet Version und Changelog vor. |

`npm install` ist nur nach dem ersten Auschecken oder nach einer
Abhängigkeitsänderung nötig. Danach reicht `npm start`.

Es gibt kein Backend und keine lokale Datenbank, die zusätzlich gestartet
werden müsste. Der Dev-Server liefert Spiel und Landingpage aus einem Prozess.
IndexedDB gehört zum Browserprofil und wird vom Server nicht angefasst.

## Diff-Größe: KLEIN oder GROSS

Die Skripte stufen den Diff in XS, S, M, L und XL ein. KLEIN/GROSS ist nur das zweistufige CI-Gate: XS/S/M = KLEIN, L/XL = GROSS.

Vor der Arbeit und vor dem Commit den Diff klassifizieren:

```bash
npm run release:scope
```

Das Script schaut auf staged, unstaged und untracked Dateien. In CI kann es
mit `--base origin/main` gegen den Basis-Branch laufen.

### KLEIN

- keine Datenpfade
- keine echte Engine-Änderung
- höchstens fünf produktive Dateien
- typisch: Copy, Farben, Abstände, kleine UI-Korrekturen in `index.html`,
  `sb-ui.js`, CSS, Landingpage, Doku, Tests oder Tooling

KLEIN heißt: kurzer Loop mit `npm run check:quick`. Bei sichtbaren
UI-Änderungen zusätzlich `npm run test:smoke`. Auf einem Branch mit
committeten Änderungen: `npm run check:quick -- --base origin/main`. Kein
Produktionsbuild, keine volle E2E-Suite.

### GROSS

- Datenpfade: `sb-storage.js`, `sb-chunk.js`, `sw.js`
- `sb-data.js` mit Material-IDs, Weltgröße oder gespeicherten Werkzeugdaten
- `sb-ui.js` mit Speicher-/Ladefunktionen
- Engine: `sb-physics.js`, `sb-renderer.js`, `sb-world.js`, `sb-main.js`,
  `sb-utils.js`, `sb-audio.js` (reine Kommentaränderungen zählen nicht)
- `index.html` mit Service-Worker- oder Engine-Einbindung
- `manifest.json` mit `start_url`, `scope`, `display` oder Icons
- `vercel.json`, `scripts/build.mjs`
- `package-lock.json` oder geänderte Dependencies, Engines, Overrides
- mehr als fünf produktive Dateien
- Spiel und Landingpage gemeinsam in JS/HTML geändert

GROSS heißt: volles Gate mit `npm run check` inklusive Produktionsbuild und
allen E2E-Tests.

Reine Versions- oder Script-Änderungen an `package.json` sind nicht groß.
Geänderte `dependencies`, `devDependencies`, `engines`, `overrides` oder
`packageManager` sind groß. Bei Script-Änderungen den geänderten Befehl
einmal manuell ausführen.

### Release

Ein Release folgt derselben Prüftiefe wie die Änderung. KLEIN nutzt
`check:source`, `test:smoke` und `build`; GROSS nutzt das volle Gate, einmal.
Details: [docs/RELEASING.md](docs/RELEASING.md).

## Arbeitsweise für Agenten

1. `AGENTS.md`, `README.md` und die betroffene Doku lesen.
2. `git status`, `git diff` und `git log --oneline -10` prüfen. Vorhandene
   Änderungen sind möglicherweise Nutzerarbeit und werden nicht überschrieben.
3. `npm run release:scope` ausführen und die Größe bestimmen. Auf einem Branch
   mit committeten Änderungen: `npm run release:scope -- --base origin/main`.
4. Die kleinste vollständige Lösung bauen. Keine unnötigen Abstraktionen,
   keine neuen Abhängigkeiten ohne klaren Grund.
5. KLEIN: `npm run check:quick`; GROSS: `npm run check`.
6. Ehrlich berichten, was geprüft wurde und was nicht.

Keine Sub-Agents für die Orientierung im Projekt. Sub-Agents nur, wenn der
Nutzer sie ausdrücklich erlaubt oder ein Skill sie vorschreibt.

## CI

`.github/workflows/verify.yml` klassifiziert jeden Pull Request:

- KLEIN: `check:quick` plus Browser-Smoke.
- GROSS: `check` mit voller E2E-Suite.
- Push auf `main`: Scope gegen den vorherigen Commit, nicht pauschal GROSS.
- Der gemeinsame Job `Gate` bleibt grün, wenn die E2E-Suite bewusst
  übersprungen wurde.

Der Gate-Job ist der verpflichtende Check für Branch Protection. E2E ist kein
Standard für jede Änderung.

## Architektur in 30 Sekunden

Die Skripte werden in `index.html` in fester Reihenfolge als klassische
`<script>`-Tags geladen. Es gibt kein Bundling und keine ES-Module im
Spielcode. Globals sind Absicht.

| Datei | Aufgabe |
|---|---|
| `sb-data.js` | Canvas, Material-IDs `M`, Farben, Weltgröße, globale Zustände, Tools. |
| `sb-chunk.js` | Fixes Raster, Export/Import, Skyline, Materialzugriff. |
| `sb-world.js` | Acht Szenarien, Terrain, Gebäude, Vegetation, Himmel. |
| `sb-renderer.js` | Zeichnet Himmel, Welt und Effekte auf das Canvas. |
| `sb-physics.js` | Simulationsschritt für Sand, Wasser, Feuer, Gas, Strom und Explosionen. |
| `sb-ui.js` | Panels, Inventar, Einstellungen, Welt speichern und laden. |
| `sb-main.js` | Eingabe, Kamera, Zoom, Animation-Loop und Start. |
| `sb-storage.js` | IndexedDB `SandboxZerstörerDB` mit `worlds` und `settings`. |
| `sb-utils.js` | Resize, Kamera, Frame, Zeichnen-Helfer, Reset. |
| `sb-audio.js` | Kleine prozedurale Klänge. |
| `sw.js` | Offline-Cache, Precache-Liste, Cache-Aufräumen. |
| `landing-page/` | Eigenständige Landingpage, eigene Demo, kein Speicher. |
| `scripts/` | Dev-Server, Build, Diff-Scope, Testauswahl und Prüfung. |
| `tests/` | Playwright-Smoke und E2E. |
| `.github/workflows/verify.yml` | KLEIN-/GROSS-Gate. |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Dateninvarianten

Diese Regeln sind nicht optional. Die Spielstände existieren nur im Browser
des Nutzers. Es gibt keinen Export, kein Backup und keine Cloud.

- **Material-IDs in `sb-data.js` niemals umnummerieren.** Die IDs stehen als
  Zahlen im gespeicherten Raster. Neue Materialien bekommen eine freie neue
  ID. ID 7 ist aktuell frei.
- **Weltgröße 480 × 300** nicht ändern, ohne `ChunkEngine.importWorld` und die
  Übernahme alter 320 × 180-Spielstände anzupassen.
- **`DB_VERSION` in `sb-storage.js` nicht erhöhen**, ohne echte Migration in
  `onupgradeneeded` und einen Nachweis, dass alte `worlds` und `settings`
  weiterhin laden. `indexedDB.deleteDatabase` ist tabu.
- **Keine Stores löschen, leeren oder umbenennen.** Keine stille
  Datenreduktion.
- **`importWorld` muss alte Formate lesen können.** Fehlende `skyline` wird
  abgeleitet, fehlende `atmosphere` fällt auf den Standard zurück.
- **Kein Autosave einbauen.** `autoSaveIfEditing` ist bewusst ein No-op.
  Ungespeicherte Änderungen gehen beim Neuladen verloren.
- **`CACHE_NAME` in `sw.js` bei jedem App-Release erhöhen.** Sonst bleibt die
  alte Fassung unter Umständen offline hängen.
- **Landingpage bleibt aus dem Service-Worker-Cache ausgenommen.**
- **`vercel.json` behält `Cache-Control: no-cache` für `/sw.js`.**
- **Kein Update-Gate und kein Artwork erfinden.** Ein kurzes optionales
  Update-Popup über `sb-update.js` ist erlaubt; standardmäßig bleibt es still.

## Code-Regeln

- Vanilla JavaScript, klassische Skripte, keine Module und kein Bundler im
  Spielcode. Die Ladereihenfolge in `index.html` ist Teil der Architektur.
- Globale Variablen und Funktionen sind bestehendes Muster. Neue Funktionen
  bekommen sprechende Namen und werden, wo nötig, über `window` erreichbar
  gemacht (`onclick`-Handler).
- Bestehende Dateien und Muster weiterführen. Keine neuen Ordner oder
  Abstraktionen für eine einzelne kleine Änderung.
- Deutsche UI-Texte, kurze Sätze, keine Emojis in neuen UI-Flächen.
- Keine Gradients. Bestehende Pixel-Optik und Farbwelt beibehalten.
- `assets/game.css` ist vorab erzeugtes Tailwind-CSS. Nur neu bauen, wenn in
  `index.html` oder `sb-*.js` neue Utility-Klassen dazukommen:
  `npx --yes tailwindcss@3.4.19 -i scripts/game-source.css -o assets/game.css --content './index.html,./sb-*.js' --minify`
- Neue Spielmodule mit `sb-`-Präfix werden vom Build erfasst, müssen aber in
  `sw.js` unter `ASSETS` und in `index.html` eingebunden werden.
- Andere neue Dateien brauchen einen Eintrag in `scripts/build.mjs`, sonst
  fehlen sie in `dist/`.
- Keine externen Schrift-, Analyse- oder CDN-Dienste. Alles wird lokal
  ausgeliefert.

## Tests

Die Teststrategie ist gestuft, nicht vollständig. Das ist Absicht.

- `tests/smoke.spec.mjs` — schneller Start, Version, Zeichnen, Mobile-Layout.
- `tests/core.spec.mjs` — alle acht Szenarien, Speichern/Laden, Einstellungen
  und erweitertes Inventar.
- `tests/offline.spec.mjs` — Service Worker, Cache-Name, Offline-Reload.
- `tests/landing.spec.mjs` — Landingpage, Demo, Medien, Mobile.
- `tests/helpers.mjs` — gemeinsame Selektoren, Warten, Grid-Statistik.

`npm run test:changed` liest den Diff und wählt die passenden Specs:

- UI-Änderungen: Smoke und Core.
- Daten- und Speicherpfade: Core und Offline.
- Engine-Änderungen: Smoke, Core und Offline.
- Landingpage: Landing.
- Doku, Tooling, reine Scripts: keine Browser-Tests.

Regeln:

- Neue Tests nutzen die Helfer und einen frischen Browser-Kontext.
- Stabile Selektoren: `onclick`-Attribute, IDs, `#tools-container`,
  `#bigInventoryGrid`. Nicht auf zufällige Textduplikate verlassen.
- Keine Screenshot- oder Pixel-Vergleiche. Sie sind langsam und empfindlich.
- Keine exakten Partikelzahlen. Schwellen und Materialzählungen reichen.
- Kein voller E2E-Lauf für Copy-, Farb- oder Abstandsänderungen.
- Tests dürfen nicht von echten Nutzerdaten abhängen. Jeder Test bekommt einen
  frischen Kontext und damit eine frische IndexedDB.
- Laufzeit im Blick behalten: Smoke unter fünf Sekunden, voller Lauf unter
  dreißig Sekunden.
- Browser-Specs niemals an einen Unit-Runner übergeben. `test:changed` nutzt
  direkt Playwright.

Details, Testzuordnung und bewusste Lücken: [docs/TESTING.md](docs/TESTING.md).

## Release

Für jedes App-Release den Skill `update` unter
`.agents/skills/update/SKILL.md` verwenden. Er entscheidet über Version,
Changelog, stilles Update oder Popup und Prüfumfang.

1. `npm run release:scope` **vor** dem Versions-Bump.
2. KLEIN: `npm run check:quick` plus Smoke.
3. GROSS: `npm run check`.
4. `npm run release -- --type ... --points ... --silent` oder `--announced`.
5. KLEIN-Release: `check:source`, `test:smoke`, `build`. GROSS: `npm run check`.
6. Commit und Push.

- Version, `version.json`, `index.html`, `sw.js`, `README.md` und `CHANGELOG.md`
  gehören in denselben Release-Commit.
- Kein `dist/`, `temp/`, `.dev/`, `.vercel/`, `node_modules/` committen.
- Kein Force-Push, keine Hooks umgehen.
- Vercel deployed bei einem Push auf `main`. Danach die Produktionsversion
  prüfen.

Details: [docs/RELEASING.md](docs/RELEASING.md).

## Doku

- [README.md](README.md) — Einstieg, Schnellstart, Befehle.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Aufbau und Erweiterung.
- [docs/TESTING.md](docs/TESTING.md) — Teststufen, Diff-Scope und CI.
- [docs/RELEASING.md](docs/RELEASING.md) — Release, Deploy, Rollback.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel und Produktionsbetrieb.
- [docs/archive/](docs/archive/) — alte Notizen. Historisch, nicht bindend.

`npm run check:source` prüft, ob die lokalen Links in der aktuellen Doku noch
auf vorhandene Dateien zeigen. Doku-Änderungen also immer mit
`npm run check:quick` abschließen.

## Nicht anfassen

- `dist/`, `.dev/`, `temp/`, `.vercel/`, `node_modules/` und Browser-Profile
  sind generiert oder lokal.
- Laufende Preview-Server, `wrapt-preview-*`, tmux-Sitzungen und belegte Ports
  des Nutzers nicht verändern. Für Tests den eigenen Dev-Server oder
  Playwright verwenden.
- Keine Secrets, `.env*` oder Zugangsdaten committen.
- Alte Dateien in `docs/archive/` nicht als aktuelle Anleitung behandeln.

## Definition of Done

- [ ] Die Änderung ist vollständig und passt zum bestehenden Muster.
- [ ] `npm run release:scope` wurde ausgeführt.
- [ ] KLEIN: `npm run check:quick` ist grün.
- [ ] GROSS: `npm run check` ist grün.
- [ ] Release: passende Stufe grün (KLEIN `check:source` + Smoke + Build,
      GROSS `npm run check`).
- [ ] Neue oder geänderte Datenpfade sind getestet oder ausdrücklich als
      ungetestet gemeldet.
- [ ] `CHANGELOG.md` und Version sind nur bei einem App-Release geändert.
- [ ] Keine generierten oder lokalen Dateien sind gestaged.
- [ ] Der Abschlussbericht nennt Ergebnis, Prüfungen und offene Punkte.
