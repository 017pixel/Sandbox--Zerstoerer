# Sandbox-Zerstörer

Ein kleiner Pixel-Spielplatz im Browser. Sand rieselt, Wasser fließt, Holz
brennt. Baue eine Welt, mische Materialien und probiere aus, was passiert.

[Jetzt spielen](https://sandbox-zerstoerer.vercel.app/) ·
[Landingpage](https://sandbox-zerstoerer.vercel.app/landing-page)

## Schnellstart

```bash
npm install
npm start
```

`npm start` startet Spiel und Landingpage auf dem ersten freien Port ab 8080
und nennt die tatsächliche URL. Normalerweise:

- Spiel: `http://127.0.0.1:8080/`
- Landingpage: `http://127.0.0.1:8080/landing-page`

Stoppen und prüfen:

```bash
npm run stop
npm run status
```

Es gibt kein Backend und keine lokale Datenbank, die zusätzlich gestartet
werden müsste. Der Dev-Server liefert die statischen Dateien direkt aus dem
Projektordner. Ein Build ist für die Entwicklung nicht nötig.

Weitere Befehle:

| Befehl | Wirkung |
|---|---|
| `npm start -- --open` | Startet und öffnet das Spiel im Browser. |
| `npm run restart` | Startet den Dev-Server neu. |
| `npm run release:scope` | Klassifiziert den Git-Diff als KLEIN oder GROSS. |
| `npm run test:changed` | Führt nur die Tests zum aktuellen Diff aus. |
| `npm run check:quick` | Quellprüfung plus betroffene Tests, ohne Produktionsbuild. Nur KLEIN. |
| `npm run check` | Vollständiges Gate mit Build, Dist-Check und allen E2E-Tests. |
| `npm run build` | Baut `dist/` für Vercel. |

## Änderungsgröße

Vor der Arbeit den Diff klassifizieren:

```bash
npm run release:scope
```

Auf einem Branch mit bereits committeten Änderungen gegen den Basis-Branch:

```bash
npm run release:scope -- --base origin/main
```

**KLEIN** heißt: keine Datenpfade, keine echte Engine-Änderung, höchstens fünf
produktive Dateien. Typisch sind Copy, Farben, Abstände, kleine UI-Korrekturen
und Landingpage-Änderungen. Prüfung: `npm run check:quick`.

**GROSS** heißt: Datenpfad, Speicherformat, Service Worker, Update-Flow,
Engine-Datei, Abhängigkeiten, Deployment-Build, mehr als fünf produktive
Dateien oder ein übergreifender Umbau. Prüfung: `npm run check`.

Ein Release oder Produktionsupdate läuft immer über das volle Gate. Der kurze
KLEIN-Loop gilt für die Entwicklung, nicht für die Auslieferung. Auf einem
Branch mit committeten Änderungen: `npm run check:quick -- --base origin/main`.
Doku- und Tooling-Änderungen brauchen kein App-Release.

## Testen

Die Tests sind gestuft. Kleine Änderungen laufen nicht durch die komplette
E2E-Suite.

| Befehl | Dauer | Wann |
|---|---|---|
| `npm run test:changed` | je nach Diff | nur die betroffenen Browser-Tests |
| `npm run test:smoke` | ca. 2–4 s | Start, Version, Zeichnen, Mobile-Layout |
| `npm run test:e2e` | ca. 5–20 s | alle Browser-Tests |
| `npm run test:landing` | ca. 2 s | nur Landingpage, Demo und Medien |
| `npm run check:quick` | ca. 5–10 s | KLEIN: Quellprüfung plus betroffene Tests |
| `npm run check` | ca. 10–25 s | GROSS und Release: Build, Dist-Check, alle E2E-Tests |

Einmalig nach dem Auschecken:

```bash
npm install
npx playwright install chromium
```

Die Testsuite deckt alle acht Szenarien, Speichern und Laden, Einstellungen,
das erweiterte Inventar, den Service Worker und die Landingpage ab. Details und
die Begründung, was bewusst nicht getestet wird, stehen in
[docs/TESTING.md](docs/TESTING.md).

## CI

`.github/workflows/verify.yml` klassifiziert jeden Pull Request:

- KLEIN: `check:quick` plus Browser-Smoke.
- GROSS: `check` mit voller E2E-Suite.
- Push auf `main`: immer GROSS.
- Der gemeinsame Job `Gate` bleibt grün, wenn E2E bewusst übersprungen wurde.

## Spielen

Material auswählen und mit Maus oder Finger in die Welt malen. Über „Welten“
stehen acht Szenarien bereit, darunter Wald, Dorf, Insel und Vulkan. Im
erweiterten Inventar findest du unter anderem Lava, TNT, Feuerwerk und
elektrische Bauteile.

Die Szenarien sind 480 × 300 Pixel groß und so angelegt, dass sie auf Handy,
Tablet und Desktop den Bildschirm füllen. Beim Laden wird die Kamera auf den
Mittelpunkt der jeweiligen Welt gesetzt; hochkant zoomt das Spiel automatisch
so weit hinein, dass keine leeren Ränder bleiben.

Mit dem Mausrad zoomst du, mit der rechten Maustaste verschiebst du die
Ansicht. Auf dem Handy geht beides mit zwei Fingern. Eigene Welten und
Einstellungen werden im jeweiligen Browser gespeichert. Nach dem ersten Laden
funktioniert das Spiel auch offline.

Spielstände gehören zur jeweiligen Internetadresse. Welten von der früheren
GitHub-Pages-Adresse werden vom Browser nicht automatisch auf die neue
Vercel-Adresse übertragen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html`, `sb-*.js`, `sb-styles.css` | Spiel, Physik, Welten, Oberfläche und Browser-Speicher. |
| `sw.js`, `manifest.json`, `pwa-icon.png` | Offlinebetrieb und installierbares Spiel. |
| `landing-page/` | Landingpage mit Medien und isolierter Demo. |
| `assets/` | Lokal ausgelieferte Spielstyles und Schriften. |
| `scripts/` | Dev-Server, Build, Diff-Scope, Testauswahl und Prüfung. |
| `tests/` | Playwright-Smoke und E2E. |
| `docs/` | Architektur, Teststrategie, Release und Archiv. |
| `.agents/skills/update/` | Release-Workflow für Agenten. |

Die App nutzt klassische JavaScript-Dateien ohne Bundler. Die Ladereihenfolge
in `index.html` ist Teil der Architektur. Schriften, Bilder und Video werden
lokal ausgeliefert; es gibt keine Analyse- oder Trackingdienste. Details stehen
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Daten und Offline

Spielstände liegen ausschließlich im Browser in IndexedDB
(`SandboxZerstörerDB`). Es gibt keine Cloud, keine Konten und kein Backup.
Welten und Einstellungen bleiben auf dem jeweiligen Gerät und in der
jeweiligen Browseradresse.

Der Service Worker cached die Spieldateien unter `sandbox-vX.Y.Z`. Die
Landingpage bleibt vom Cache ausgenommen. Nach einem Update wird die neue
Fassung beim nächsten vollständigen Laden aktiv. Standardmäßig gibt es kein
Popup; mit `"mode": "announced"` zeigt `sb-update.js` einmal drei Hinweise.

Im lokalen Dev-Betrieb erzeugt der Dev-Server einen eigenen Cache-Namen aus den
Spieldateien. Dadurch erscheinen Änderungen sofort, ohne den Browser-Cache von
Hand zu leeren. Tests und Produktion nutzen weiterhin den echten
`CACHE_NAME`.

## Release

Der Ablauf für Menschen und Agenten steht in
[docs/RELEASING.md](docs/RELEASING.md). Kurz:

```bash
npm run release:scope
npm run release -- --type patch --points "fixed:Kurzer Punkt"
npm run check
git add ...
git commit
git push
```

Kleine Änderungen nutzen im Entwicklungs-Loop `check:quick`. Features, Daten
und Releases laufen über `check`.

## Deployment

Das Projekt `sandbox-zerstoerer` läuft im kostenlosen Vercel-Hobby-Tarif und
ist mit diesem GitHub-Repository verbunden. Der Hauptbranch ist `main`. Das
Spiel bleibt auf `/`, die Landingpage liegt auf `/landing-page`.

`node scripts/build.mjs` kopiert ausschließlich die benötigten Spiel- und
Landingpage-Dateien nach `dist/`. Vercel führt diesen Befehl beim Deployment
aus. Entwicklernotizen, Tests und Werkzeuge werden nicht veröffentlicht. Es
gibt keine Serverfunktionen, Datenbank oder kostenpflichtigen Zusatzdienste.

Details: [DEPLOYMENT.md](DEPLOYMENT.md).

## Doku

- [AGENTS.md](AGENTS.md) — Arbeitsregeln, Diff-Scope und CI.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Aufbau und Erweiterung.
- [docs/TESTING.md](docs/TESTING.md) — Teststufen, Testzuordnung und CI.
- [docs/RELEASING.md](docs/RELEASING.md) — Version, Deploy, Rollback.
- [docs/README.md](docs/README.md) — Doku-Übersicht.

## Version

Aktuell: **1.2.2**. Änderungen stehen in [CHANGELOG.md](CHANGELOG.md).

## Lizenz

Alle Rechte an diesem Projekt liegen beim Ersteller. Eine kommerzielle Nutzung
oder Verbreitung ist ohne ausdrückliche Zustimmung nicht gestattet. Die separat
mitgelieferten Schriften unterliegen ihren jeweiligen OFL-Lizenzen.
