# Deployment

Stand: 15. November 2026.

## Produktion

| Punkt | Wert |
|---|---|
| Spiel | <https://sandbox-zerstoerer.vercel.app/> |
| Landingpage | <https://sandbox-zerstoerer.vercel.app/landing-page> |
| Vercel-Projekt | `sandbox-zerstoerer` im Hobby-Team |
| Repository | <https://github.com/017pixel/Sandbox--Zerstoerer> |
| Produktionsbranch | `main` |
| Framework | statisch, kein Framework |

Es gibt keine Serverfunktionen, keine Datenbank, keine Umgebungsvariablen und
keine kostenpflichtigen Zusatzdienste. Vercel liefert ausschließlich statische
Dateien aus `dist/` aus. Spielstände bleiben im Browser der Nutzer.

## Build

`vercel.json` legt fest:

- Build: `node scripts/build.mjs`
- Output: `dist/`
- Clean URLs: an
- Trailing Slash: aus
- `/sw.js`: `Cache-Control: no-cache`
- Alle Antworten: `X-Content-Type-Options: nosniff` und
  `Referrer-Policy: strict-origin-when-cross-origin`

`scripts/build.mjs` löscht `dist/` und kopiert nur die Produktionsdateien:

- `index.html`, `sb-*.js`, `sb-*.css`, `sw.js`, `manifest.json`,
  `pwa-icon.png`, `robots.txt`, `sitemap.xml`
- `assets/` vollständig
- `landing-page/` mit `.html`, `.css`, `.js` und `assets/`

Doku, Tests, Skripte, `temp/`, `.dev/` und `.opencode/` landen nicht in `dist/`.
`npm run check:dist` prüft genau das.

## Deployment auslösen

Ein Push auf `main` löst automatisch ein Produktionsdeployment aus. Zusätzlich
läuft `.github/workflows/verify.yml`:

- Pull Request KLEIN: `check:quick` plus Browser-Smoke.
- Pull Request GROSS: `check` mit voller E2E-Suite.
- Push auf `main`: immer GROSS.
- `Gate` bleibt grün, wenn E2E bewusst übersprungen wurde.

Ablauf:

```bash
npm run release:scope   # KLEIN oder GROSS
npm run release -- --type patch --points "fixed:Kurzer Punkt"
npm run check           # Release-Gate, immer vollständig
git push origin main
```

Optionaler manueller Deploy:

```bash
vercel deploy --prod --scope benjamin-s-projects-77ef4d8a
```

Der manuelle Deploy ist nur für Notfälle oder Vercel-Probleme gedacht. Der
normale Weg ist der Push auf `main`.

## Produktion prüfen

```bash
curl -fsS "https://sandbox-zerstoerer.vercel.app/?v=$(date +%s)" \
  | grep -o 'application-version" content="[^"]*"'
curl -fsS https://sandbox-zerstoerer.vercel.app/sw.js | head -1
curl -fsSI https://sandbox-zerstoerer.vercel.app/landing-page | head -1
```

Erwartet:

- neue Version in der Meta,
- `const CACHE_NAME = 'sandbox-vX.Y.Z';`,
- HTTP 200 für die Landingpage.

Danach mit Playwright die Produktion öffnen, Einstellungen öffnen und die
Version prüfen. Erst dann gilt der Release als ausgeliefert.

Vercel braucht meist unter einer Minute. Bleibt die alte Version länger live,
das Deployment im Dashboard prüfen und den Fehler melden. Nicht „live“
behaupten.

## Rollback

1. Im Vercel-Dashboard das letzte gesunde Produktionsdeployment promoten oder
   den fehlerhaften Commit mit `git revert` umkehren und pushen.
2. Produktion erneut prüfen.
3. Prüfen, ob der alte Stand die vorhandenen IndexedDB-Daten lesen kann.
4. Korrektur als neuen Patch ausliefern.

Nach einem Speicherformat-Wechsel ist ein Rollback gefährlich, wenn der alte
Code die neuen Daten nicht versteht. Dann vorwärts reparieren.

Niemals IndexedDB leeren oder den Nutzer bitten, Website-Daten zu löschen. Es
gibt keinen Export und kein Backup.

## Lokal und Produktion

| Punkt | Lokal | Produktion |
|---|---|---|
| Server | `npm start` auf Port 8080+ | Vercel |
| Dateien | Projektordner direkt | `dist/` |
| Service Worker | `no-cache`, Cache `sandbox-vX.Y.Z` | dito |
| Landingpage | `/landing-page` | `/landing-page` |
| Datenbank | IndexedDB im Browser | IndexedDB im Browser |

Der lokale Dev-Server bildet Clean URLs, die Landingpage-Route, MIME-Typen,
Range-Requests für das Video und `no-cache` für `sw.js` nach. Er liefert aber
nur die erlaubten Spieldateien, nicht die Doku oder Tests.

## Hintergrund

Das Projekt lag früher auf GitHub Pages. Mit Version 1.1.0 wurde es auf Vercel
umgestellt. Der alte Pages-Workflow ist deaktiviert. Spielstände aus der alten
Adresse werden vom Browser nicht automatisch übertragen.

Aktuelle Release-Regeln: [docs/RELEASING.md](docs/RELEASING.md).
