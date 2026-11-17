---
name: app-update
description: Liefert Sandbox-Zerstörer aus, wenn der Nutzer ausdrücklich ein Produktionsupdate oder eine Veröffentlichung beauftragt, etwa mit "app-update", "App updaten", "Update ausliefern", "neue Version rausbringen", "release" oder "veröffentlichen". Klassifiziert den Diff als KLEIN oder GROSS, nutzt im Entwicklungs-Loop die passende Prüfung und beim Release immer das volle Gate. Reine Release-Fragen starten keine Auslieferung.
---

# App-Update: Sandbox-Zerstörer ausliefern

Nur für dieses Projekt. Reine Fragen zum Update beantworten, ohne den Workflow
zu starten. Keine Änderungen aus dem Chat annehmen, sondern am echten Git-Stand
prüfen.

Dieses Projekt hat **kein Artwork, kein Update-Popup, kein Update-Gate und
keine Admin-Version**. Jedes Release ist still: Die neue Fassung wird beim
nächsten vollständigen Laden aktiv. Kein Bild generieren, kein Popup bauen,
keine Update-UI erfinden.

## Projektfakten

| Punkt | Wert |
|---|---|
| Repo | `https://github.com/017pixel/Sandbox--Zerstoerer`, Branch `main` |
| Produktion | `https://sandbox-zerstoerer.vercel.app/` |
| Landingpage | `https://sandbox-zerstoerer.vercel.app/landing-page` |
| Deploy | Vercel, Auto-Deploy bei Push auf `main` |
| Dev | `npm start`, Stopp mit `npm run stop` |
| Scope | `npm run release:scope` |
| Tests | `npm run test:changed`, `npm run test:smoke`, `npm run test:e2e` |
| Schnellprüfung | `npm run check:quick` |
| Vollprüfung | `npm run check` |
| CI | `.github/workflows/verify.yml`, Gate-Job `Gate` |
| Version | `index.html`, `sw.js`, `CHANGELOG.md`, `README.md` |
| Spielstände | IndexedDB `SandboxZerstörerDB`, Stores `worlds` und `settings` |
| Backend | keins. Keine API, keine Datenbank, keine Konten. |

Es gibt keinen Backend-Deploy und keine lokale Datenbank. Der Dev-Server
startet nur den Static-Server.

## Schritt 1: Diff-Größe bestimmen

**Vor** dem Versions-Bump ausführen:

```bash
npm run release:scope
```

Das Script liest staged, unstaged und untracked Dateien. In CI kann es mit
`--base origin/main` gegen den Basis-Branch laufen.

| Scope | Wann | Prüfung im Entwicklungs-Loop | Release |
|---|---|---|---|
| **KLEIN** | keine Datenpfade, keine echte Engine-Änderung, höchstens fünf produktive Dateien | `npm run check:quick` plus `npm run test:smoke` | trotzdem volles Gate |
| **GROSS** | Datenpfad, Engine, Service Worker, Update-Flow, Abhängigkeiten, Deployment-Build, übergreifender Umbau oder mehr als fünf produktive Dateien | `npm run check` | volles Gate |

Wichtig:

- **Ein Release oder Produktionsupdate läuft immer über `npm run check`.**
  Auch ein KLEIN-Patch wird beim Ausliefern voll geprüft. Der kurze Loop gilt
  für die Entwicklung davor.
- **Scope vor dem Bump.** Das Release-Script ändert `sw.js`; danach wäre der
  Diff durch die Versionierung immer ein Update-Pfad und damit GROSS.
- **KLEIN ist kein Freifahrtschein für Daten.** `sb-storage.js`,
  `sb-chunk.js`, `sw.js`, `sb-data.js` mit Material-/Weltdaten und
  Speicherfunktionen in `sb-ui.js` sind immer GROSS.
- Unklar? Dann GROSS.

Details: [docs/RELEASING.md](../../../docs/RELEASING.md).

## Schritt 2: Pflicht-Skills

OpenCode: Skill-Tool. Codex: `$skill-name`.

- `versionierungen` – semantische Version, CHANGELOG-Struktur, Storage-Versionen
- `commit-and-push-workflow-xxl` – logische Commits, Doku, Push
- `github-infos` – vor jeder GitHub-Operation

Die CI prüft Pull Requests gestuft. Der Release-Workflow selbst läuft lokal
über das volle Gate und danach gegen die Produktion.

Bei GROSS mit Datenbezug zusätzlich `references/data-safety.md` vollständig
lesen.

## Schritt 3: Ist-Zustand ermitteln

```bash
git status
git diff
git diff --staged
git log --oneline -12
git branch --show-current
git remote -v
npm run release:scope
```

Zusätzlich lesen: `index.html` (Version und Settings-Footer), `sw.js` (Cache
und `ASSETS`), die obersten 40 Zeilen von `CHANGELOG.md`, `README.md`,
`scripts/build.mjs` und bei Datenänderungen `sb-storage.js` und `sb-chunk.js`.

- Keine Änderungen vorhanden: melden, dass nichts auszuliefern ist, und stoppen.
  Nicht nur die Version hochziehen.
- Änderungen in Spiel, Landingpage und interne Änderungen trennen.
- Nichts erfinden, was nicht im Diff steht. Interne Aufräumarbeiten gehören
  unter `Technisch`, nicht unter `Erstellt`.

## Schritt 4: Release vorbereiten

Das Script schreibt Version, Changelog-Block und alle Versionsstellen in einem
Schritt. Nicht von Hand in `index.html`, `sw.js`, `README.md` und
`CHANGELOG.md` pflegen.

```bash
npm run release -- \
  --type patch \
  --points "fixed:Wasser läuft nicht mehr aus dem Weltrand|technical:Offline-Cache erneuert"
```

| Schalter | Wirkung |
|---|---|
| `--type patch\|minor\|major` | Versionsstufe. Pflicht. |
| `--points "typ:Text\|..."` | Mindestens ein Punkt. Pflicht. Typen: `new`, `improved`, `fixed`, `removed`, `technical`. |
| `--date YYYY-MM-DD` | Release-Datum. Standard ist heute. |
| `--dry-run` | Nur anzeigen, nichts schreiben. |

Punkt-Typen:

| Typ | Changelog-Abschnitt |
|---|---|
| `new` | Erstellt |
| `improved`, `fixed` | Verändert |
| `removed` | Gelöscht |
| `technical` | Technisch |

Regeln:

- Deutsch, für Endnutzer verständlich, kein Code, keine Emojis.
- Nur die wichtigsten Änderungen. Bei einem kleinen Patch reicht ein Punkt.
- Keine erfundenen Punkte, keine Wiederholung des Versionsnamens.
- Höchstens zehn Punkte. Das Script lehnt Emojis, doppelte Punkte und falsche
  Typen ab.

Das Script ändert:

| Datei | Stelle |
|---|---|
| `index.html` | `<meta name="application-version" content="X.Y.Z">` |
| `index.html` | `<span>vX.Y.Z</span>` im Einstellungsfenster |
| `sw.js` | `const CACHE_NAME = 'sandbox-vX.Y.Z';` |
| `CHANGELOG.md` | neuer Block `## [X.Y.Z] - YYYY-MM-DD` oben |
| `README.md` | `Aktuell: **X.Y.Z**` |

Wenn der Release abgebrochen werden soll, die geänderten Dateien auf den
letzten Git-Stand zurücksetzen und nicht mit einem halben Release committen.

## Schritt 5: Prüfung

### Entwicklungs-Loop KLEIN

```bash
npm run check:quick
npm run test:smoke
```

`check:quick` enthält `check:source` und `npm run test:changed`. Es baut nicht
die Produktion und startet nicht die volle E2E-Suite. Bei einem GROSS-Diff
bricht es mit dem Hinweis auf `npm run check` ab. Auf einem Branch mit
committeten Änderungen: `npm run check:quick -- --base origin/main`. Smoke ist
der Browser-Basischeck.

### GROSS

```bash
npm run check
```

Das ist das vollständige Gate: Quellprüfung, Produktionsbuild, Dist-Check und
alle E2E-Tests.

### Release

Nach dem Release-Script immer:

```bash
npm run check
```

Auch bei KLEIN. Das prüft die neuen Versionsstellen, den Build und alle
E2E-Tests.

### Daten oder Breaking

Zusätzlich zu `npm run check`:

- `references/data-safety.md` vollständig abarbeiten.
- Einen alten Spielstand oder einen bestehenden Testdatensatz laden.
- Prüfen, dass `worlds` und `settings` erhalten bleiben.
- Prüfen, dass `importWorld` alte Formate liest.
- Ergebnis im Abschlussbericht nennen.
- Ohne ausdrückliche Freigabe nicht ausliefern.

### Nur Landingpage

```bash
npm run check:quick
```

`test:changed` wählt dann die Landingpage-Spec. Für einen expliziten Lauf:

```bash
npm run test:landing
```

### Tailwind

Nur wenn in `index.html` oder `sb-*.js` neue Utility-Klassen dazugekommen sind:

```bash
npx --yes tailwindcss@3.4.19 -i scripts/game-source.css -o assets/game.css \
  --content './index.html,./sb-*.js' --minify
npm run check:quick
```

## Schritt 6: Spielstände schützen

Nicht verhandelbar. Die Spielstände liegen ausschließlich im Browser des
Nutzers. Es gibt keine Cloud, keinen Export und kein Backup.

- **Material-IDs in `sb-data.js` niemals umnummerieren.** Die IDs stehen als
  Zahlen im gespeicherten Raster. ID 7 ist aktuell frei.
- **Weltgröße 480 × 300** nicht ändern, ohne `ChunkEngine.importWorld` und die
  Übernahme alter 320 × 180-Spielstände anzupassen.
- **`DB_VERSION` nicht erhöhen**, ohne echte Migration und Nachweis, dass alte
  `worlds` und `settings` weiterhin laden. `deleteDatabase` ist tabu.
- **Keine Stores löschen, leeren oder umbenennen.**
- **`CACHE_NAME` bei jedem Release erhöhen.** Sonst bleibt die alte Fassung
  unter Umständen offline hängen.
- **Landingpage bleibt aus dem Service-Worker-Cache ausgenommen.**
- **Kein Autosave einbauen.** `autoSaveIfEditing` ist bewusst ein No-op.

Die vollständige Checkliste steht in `references/data-safety.md`. Bei GROSS mit
Datenbezug ist sie Pflicht.

## Schritt 7: Commit, Push und Produktion

`commit-and-push-workflow-xxl` vollständig ausführen, `github-infos` vor jeder
GitHub-Operation laden.

- Version, `index.html`, `sw.js`, `README.md` und `CHANGELOG.md` gehören in
  denselben Release-Commit. Keine Teil-Releases.
- Weitere Commits nach Thema: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`,
  `chore:`. Kurz, imperativ, ohne Emojis, ohne Hinweis auf KI.
- Nur beabsichtigte Dateien stagen. Kein `.env*`, `dist/`, `temp/`, `.dev/`,
  `.vercel/`, `node_modules/` oder lokale Artefakte.
- Vor jedem Commit und vor dem Push `git status` und `git diff` prüfen.
- Kein Force-Push, keine Hooks umgehen, gepushte Commits nicht umschreiben.
- Der Auftrag „Update ausliefern“ umfasst Commit und Push. Bei „nur
  vorbereiten“ oder „nicht pushen“ vor dem Push stoppen.

Die CI läuft bei Pull Requests gestuft. Ein Push auf `main` ist ein Release und
läuft dort als GROSS. Zusätzlich Vercel-Produktion prüfen:

```bash
curl -fsS "https://sandbox-zerstoerer.vercel.app/?v=$(date +%s)" \
  | grep -o 'application-version" content="[^"]*"'
curl -fsS https://sandbox-zerstoerer.vercel.app/sw.js | head -1
curl -fsSI https://sandbox-zerstoerer.vercel.app/landing-page | head -1
```

Erwartet: neue Version, passender `CACHE_NAME`, HTTP 200 für die Landingpage.
Danach mit Playwright die Produktion öffnen, Einstellungen öffnen und die
Version prüfen. Bleibt die alte Version länger live, das Deployment prüfen und
den Fehler melden, nicht „live“ behaupten.

## Abschluss

Dem Nutzer berichten:

- Scope: KLEIN oder GROSS, und die Version mit Datum.
- Die Changelog-Punkte, die ausgeliefert wurden.
- Welche Prüfung gelaufen ist: `check:quick`, `check` oder beides.
- Was an Spielständen, Weltformat und Offline-Cache geprüft wurde.
- Commit-Liste mit Hash und Betreff.
- Produktionsstatus: Version live, Cache-Name live, Landingpage erreichbar.
- Dass es kein Popup gibt und die neue Fassung beim nächsten vollständigen
  Laden aktiv wird.
- Alles, was offen oder rot ist.

## Verbote

- Kein Release ohne alle Versionsstellen: `index.html` Meta,
  `index.html` Anzeige, `sw.js` Cache, `README.md` und Changelog-Block.
- Kein Release ohne `npm run check` mit voller E2E-Suite.
- Kein voller E2E-Lauf für Copy, Farben oder Abstände im Entwicklungs-Loop.
  Das ist KLEIN mit `check:quick` plus Smoke.
- Keine erfundenen Changelog-Punkte, keine Emojis, kein Code im Changelog.
- Kein Artwork, kein Update-Popup, kein Update-Gate, keine Admin-Version
  erfinden.
- Keine Daten zurücksetzen, löschen oder still reduzieren. Kein
  `deleteDatabase`, kein leerer Store, keine umnummerierten Material-IDs.
- Kein `CACHE_NAME` vergessen.
- Keine Secrets committen, kein Force-Push, keine übersprungenen Hooks.
- Keine Änderungen am Nutzer-Update-Erlebnis, außer der Nutzer beauftragt sie
  ausdrücklich als eigenes Feature.

## Referenzen

- `references/data-safety.md` – Datenpfade, Migration, Release-Checkliste
- [docs/RELEASING.md](../../../docs/RELEASING.md) – Scope, Version, Deploy,
  Rollback
- [docs/TESTING.md](../../../docs/TESTING.md) – Teststufen, Testzuordnung, CI
- [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) – Aufbau und
  Erweiterungsrezepte
