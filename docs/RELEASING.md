# Releasing

## Grundsatz

Ein Release ist erst fertig, wenn Version, Changelog, Build und Produktion
zusammenpassen. Für den Ablauf ist der Skill `update` zuständig. Diese Seite
beschreibt die Regeln dahinter.

## Version

Die App-Version steht an sechs Stellen:

| Datei | Stelle |
|---|---|
| `version.json` | `version`, `mode`, `notes` |
| `index.html` | `<meta name="application-version" content="X.Y.Z">` |
| `index.html` | `<span>vX.Y.Z</span>` im Einstellungsfenster |
| `sw.js` | `const CACHE_NAME = 'sandbox-vX.Y.Z';` |
| `CHANGELOG.md` | oberster Block `## [X.Y.Z] - YYYY-MM-DD` |
| `README.md` | `Aktuell: **X.Y.Z**` |

Das Release-Script schreibt alle sechs Stellen. Nicht von Hand nachziehen.

| Änderung | Stufe |
|---|---|
| Fix, Copy, Performance, intern | `patch` |
| Neue sichtbare Funktion, Welt, Material, Design | `minor` |
| Speicherformat, Weltgröße, Material-IDs, Breaking Change | `major` |

`package.json` trägt bewusst keine App-Version. So gibt es keine sechste
Quelle, die auseinanderlaufen kann.

## Vor dem Release: Scope

**Vor** dem Versions-Bump klassifizieren:

```bash
npm run release:scope
```

Das Script liest staged, unstaged und untracked Dateien. Auf einem Branch mit
bereits committeten Änderungen gegen den Basis-Branch:

```bash
npm run release:scope -- --base origin/main
```

| Scope | Bedeutung | Prüfung im Entwicklungs-Loop |
|---|---|---|
| `KLEIN` | keine Datenpfade, keine echte Engine-Änderung, höchstens fünf produktive Dateien | `npm run check:quick` plus Smoke |
| `GROSS` | Datenpfad, Engine, Service Worker, Update-Flow, Abhängigkeiten, Deployment-Build, übergreifender Umbau | `npm run check` |

Ein Release folgt derselben Stufe. KLEIN läuft über `check:source`,
`test:smoke` und `build`. GROSS läuft über `npm run check`, einmal. Die
Versions-Metadaten allein lösen keinen vollen Browserlauf aus.

Warum vor dem Bump? Das Release-Script ändert `sw.js`. Danach wäre der Diff
allein durch die Versionierung ein Daten-/Update-Pfad und würde immer GROSS
melden. Der Scope soll die eigentliche Codeänderung bewerten.

## Release-Script

```bash
npm run release -- \
  --type patch --silent \
  --points "fixed:Wasser läuft nicht mehr aus dem Weltrand|technical:Offline-Cache erneuert"
```

Popup:

```bash
npm run release -- \
  --type minor --announced \
  --points "new:Erster Punkt|improved:Zweiter Punkt" \
  --notes "Erster Hinweis|Zweiter Hinweis|Dritter Hinweis"
```

Punkt-Typen: `new`, `improved`, `fixed`, `removed`, `technical`.
`fixed` und `improved` landen unter „Verändert“, `new` unter „Erstellt“,
`removed` unter „Gelöscht“, `technical` unter „Technisch“.

Weitere Schalter:

| Schalter | Wirkung |
|---|---|
| `--silent` | Stilles Update ohne Popup (Standard). |
| `--announced` | Popup mit genau drei Hinweisen. |
| `--notes "A\|B\|C"` | Drei Hinweise für das Popup. |
| `--dry-run` | Zeigt Version und Changelog-Block, schreibt nichts. |
| `--date YYYY-MM-DD` | Setzt das Release-Datum. Standard ist heute. |

Das Script bricht ab, wenn eine Versionsstelle fehlt, doppelt vorkommt oder
die neue Version schon im Changelog steht. Fehler beheben, nicht umgehen.

## Prüfung

KLEIN:

```bash
npm run check:source
npm run test:smoke
npm run build
```

GROSS:

```bash
npm run check
```

Das ist das vollständige Gate:

- `check:source`: Version, Cache, Doku-Links, Testdateien, Manifest, Syntax.
- `build`: Produktions-Whitelist nach `dist/`.
- `check:dist`: Build-Version, Cache, Assets, Landingpage, keine Doku/Tests.
- `test:e2e`: alle Browser-Tests.

`check:quick` ist der kurze Entwicklungs-Loop:

```bash
npm run check:quick
```

Es enthält `check:source` und `npm run test:changed`, aber keinen
Produktionsbuild und keine volle E2E-Suite. Bei einem GROSS-Diff bricht es mit
dem Hinweis auf `npm run check` ab.

Bei Daten- oder Formatänderungen zusätzlich:

- Alten Spielstand simulieren oder einen bestehenden Testdatensatz laden.
- Prüfen, dass `worlds` und `settings` erhalten bleiben.
- Prüfen, dass `importWorld` alte Formate liest.
- Ergebnis im Abschlussbericht nennen.

## Tailwind

Tailwind nur neu erzeugen, wenn neue Utility-Klassen dazugekommen sind:

```bash
npx --yes tailwindcss@3.4.19 -i scripts/game-source.css -o assets/game.css \
  --content './index.html,./sb-*.js' --minify
```

Danach erneut `npm run check`.

## Commit und Push

- Release-Commit enthält Version, `version.json`, `index.html`, `sw.js`,
  `README.md` und `CHANGELOG.md` zusammen mit den eigentlichen Änderungen.
- Weitere Commits nach Thema: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`,
  `chore:`.
- Nur beabsichtigte Dateien stagen. Kein `dist/`, `temp/`, `.dev/`, `.vercel/`,
  `node_modules/`, keine Secrets.
- Vor Commit und Push `git status` und `git diff` prüfen.
- Kein Force-Push, keine Hooks umgehen.
- Der Auftrag „Update ausliefern“ umfasst Commit und Push. Bei „nur
  vorbereiten“ vor dem Push stoppen.

## CI

`.github/workflows/verify.yml` prüft Pull Requests gestuft:

- KLEIN: `check:quick` plus Browser-Smoke.
- GROSS: `check` mit voller E2E-Suite.
- Push auf `main`: Scope gegen den vorherigen Commit, nicht pauschal GROSS.
- Der Job `Gate` bleibt grün, wenn E2E bewusst übersprungen wurde.

`Gate` ist der verpflichtende Branch-Protection-Check.

## Deployment

Ein Push auf `main` löst das Vercel-Produktionsdeployment aus. Der Build läuft
bei Vercel mit `node scripts/build.mjs`, Output ist `dist/`.

Produktionsadressen:

- Spiel: <https://sandbox-zerstoerer.vercel.app/>
- Landingpage: <https://sandbox-zerstoerer.vercel.app/landing-page>

Nach dem Push prüfen:

```bash
curl -fsS "https://sandbox-zerstoerer.vercel.app/?v=$(date +%s)" \
  | grep -o 'application-version" content="[^"]*"'
curl -fsS https://sandbox-zerstoerer.vercel.app/sw.js | head -1
curl -fsSI https://sandbox-zerstoerer.vercel.app/landing-page | head -1
```

Erwartet: neue Version, passender `CACHE_NAME`, HTTP 200 für die Landingpage.
Danach mit Playwright die Produktion öffnen und die Version in den
Einstellungen prüfen.

Vercel braucht meist unter einer Minute. Bleibt die alte Version länger live,
das Deployment prüfen und den Fehler melden. Nicht „live“ behaupten.

## Update-Verhalten

Standardmäßig gibt es kein Popup und kein Update-Gate. Die neue Fassung wird
beim nächsten vollständigen Laden aktiv. Mit `--announced` zeigt
`sb-update.js` nach dem Versionswechsel einmal drei Hinweise. Offene Tabs
behalten ihr geladenes JavaScript, bis sie neu laden. Der Service Worker
tauscht den Cache über den neuen `CACHE_NAME`.

## Rollback

1. Im Vercel-Dashboard das letzte gesunde Deployment promoten oder den
   fehlerhaften Commit mit `git revert` umkehren und pushen.
2. Produktion prüfen.
3. Prüfen, ob der alte Stand die vorhandenen IndexedDB-Daten lesen kann.
4. Korrektur als neuen Patch ausliefern.

Nach einem Speicherformat-Wechsel ist ein Rollback gefährlich, wenn der alte
Code die neuen Daten nicht versteht. Dann vorwärts reparieren.

Niemals IndexedDB leeren, `deleteDatabase` aufrufen oder den Nutzer bitten,
Website-Daten zu löschen. Es gibt keinen Export und kein Backup.

## Doku- und Tooling-Änderungen

Änderungen an README, Tests, Skripten oder dieser Doku sind kein App-Release.
Sie brauchen keine Versionserhöhung und keinen Changelog-Eintrag. Prüfung:

```bash
npm run check:quick
```

Der `CHANGELOG.md` dokumentiert ausgelieferte App-Versionen, nicht die
Entwicklungswerkzeuge.
