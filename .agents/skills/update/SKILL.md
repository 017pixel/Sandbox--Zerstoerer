---
name: update
description: Sandbox-Zerstörer auf ausdrücklichen Befehl ausliefern: stilles Update oder Popup auf Production, auch aus einem PR oder aus lokalen Änderungen. Triggert bei „Update“, „App-Update“, „Release“, „Version rausbringen“, „PR <n> mergen und ausliefern“, „nur die lokalen Änderungen rausschicken“, „still“ oder „mit Popup“. Reine Fragen starten keine Auslieferung.
---

# Update: Sandbox-Zerstörer

Nur für dieses Repository. Nur auf ausdrücklichen Update-Auftrag. Reine Fragen
beantworten, nichts ausliefern. Am echten Git-Stand arbeiten, nicht aus dem
Chat.

## Auftrag in einem Satz

| Nutzer sagt | Weg |
|---|---|
| „Update“, „still“ | stilles Update ohne Popup |
| „großes Update“, „mit Popup“ | Popup mit genau drei Hinweisen |
| „PR 5 mergen und als Update“ | PR prüfen, mergen, `git pull`, dann updaten |
| „nur die lokalen Änderungen“ | aktuellen Diff ausliefern |
| „testen, kein Update“ | keine Version, kein Commit, kein Deploy |
| Ohne Zusatz | klein und unsichtbar → still; sichtbar oder groß → Popup |

## Projektfakten

| Punkt | Wert |
|---|---|
| Repo | `https://github.com/017pixel/Sandbox--Zerstoerer`, Branch `main` |
| Live | `https://sandbox-zerstoerer.vercel.app/` |
| Landingpage | `https://sandbox-zerstoerer.vercel.app/landing-page` |
| Deploy | Vercel, automatisch bei Push auf `main` |
| Umgebung | nur Production, kein Development-Deploy |
| Dev | `npm start`, Stopp mit `npm run stop` |
| Scope | `npm run release:scope` |
| Tests | `npm run test:changed`, `npm run test:smoke`, `npm run test:e2e` |
| Schnellprüfung | `npm run check:quick` |
| Vollprüfung | `npm run check` |
| Version | `version.json`, `index.html`, `sw.js`, `README.md`, `CHANGELOG.md` |
| Update | Service Worker, still oder Popup über `sb-update.js` |
| Speicher | IndexedDB `SandboxZerstörerDB`, Stores `worlds` und `settings` |

## Zeitbudget

- Kleines Update: 15 Minuten, Obergrenze 20 Minuten.
- Großes Update: bis 2 Stunden.
- Der kleine Weg hat Vorrang. Wird er länger als 20 Minuten, den blockierenden
  Schritt melden statt vollständige Suiten zu starten.

## 1. Ist-Zustand (2 Minuten)

```bash
git status
git diff
git diff --staged
git log --oneline -12
git branch --show-current
git remote -v
npm run release:scope
```

Zusätzlich lesen: `version.json`, `index.html`, `sw.js`, die obersten 40 Zeilen
von `CHANGELOG.md` und die Versionszeile in `README.md`.

- Keine Änderungen: melden und stoppen.
- Branch nicht `main`: stoppen und melden.
- Fremde uncommittete Änderungen: nicht mit ausliefern.

## 2. Umfang und Prüftiefe (2 Minuten)

`npm run release:scope` entscheidet, nicht das Bauchgefühl.

| Klasse | Definition | Entwicklung | Release |
|---|---|---|---|
| KLEIN | höchstens 5 produktive Dateien, kein Datenpfad, keine Engine-Änderung | `npm run check:quick` + `npm run test:smoke` | `npm run check:source` + `npm run test:smoke` + `npm run build` |
| GROSS | `sb-storage.js`, `sb-chunk.js`, `sw.js`, Engine, Update-Flow, Dependencies, mehr als 5 produktive Dateien | `npm run check` | `npm run check`, einmal |

Scope **vor** dem Versions-Bump bestimmen. Danach ist `sw.js` durch die
Versionierung formal ein Datenpfad; die vorher bestimmte Stufe gilt.

Gezielte Tests:

| Änderung | Befehl |
|---|---|
| Spielstart, Zeichnen, Mobile | `npm run test:smoke` |
| Kernlogik, Speichern, Welten | `npm run test:changed` |
| Offline, Service Worker | `npx playwright test tests/offline.spec.mjs` |
| Landingpage | `npm run test:landing` |
| Unklar oder GROSS | `npm run check` |

Lokal maximal 2 Playwright-Worker (`PW_WORKERS=2`). Keine Nutzer-Ports
übernehmen.

## 3. Release-Metadaten (3 Minuten)

```bash
# Still
npm run release -- --type patch --silent \
  --points "fixed:Kurzer Nutzertext|technical:Interner Punkt"

# Popup
npm run release -- --type minor --announced \
  --points "new:Erster Punkt|improved:Zweiter Punkt" \
  --notes "Erster Hinweis|Zweiter Hinweis|Dritter Hinweis"
```

Das Script schreibt `version.json` (Version, Modus, Hinweise), `index.html`,
`sw.js`, `README.md` und den Changelog-Block. `announced` braucht genau drei
Hinweise, `silent` keine. Keine Handpflege, keine Teil-Releases.

Mit `--dry-run` vorher prüfen.

## 4. Prüfen und ausliefern (5 Minuten)

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

`npm run check` ist Quellprüfung, Produktionsbuild, Dist-Check und alle
E2E-Tests. Es ist die Pflicht bei Daten-, Engine- oder Update-Änderungen.

Dann committen und pushen:

```bash
git add <release-dateien>
git diff --staged
git commit -m "vX.Y.Z - chore: release vorbereiten"
git push origin main
```

Produktion prüfen:

```bash
curl -fsS https://sandbox-zerstoerer.vercel.app/ | grep -o 'application-version" content="[^"]*"'
curl -fsS https://sandbox-zerstoerer.vercel.app/sw.js | head -3
curl -fsS https://sandbox-zerstoerer.vercel.app/version.json
```

Erwartet: neue Version, neuer `CACHE_NAME`, `version.json` mit Modus und
Hinweisen. Danach die Produktionsseite einmal mit dem T3-Code-Browser öffnen.

## 5. Update-Erlebnis

### Still

- `version.json` hat `"mode": "silent"`.
- Der neue Service Worker aktiviert sich, die Seite übernimmt beim nächsten
  vollständigen Start. Kein Popup.
- `sandbox:seen-version` wird gesetzt.

### Popup

- `version.json` hat `"mode": "announced"` und genau drei `notes`.
- Nach dem Versionswechsel zeigt `sb-update.js` einmal „Update installiert“ mit
  Version und drei Hinweisen.
- Nur „Alles klar“, Escape und Backdrop schließen. Kein Reload-Knopf, keine
  Wiederholung.

## 6. Datensicherheit

- IndexedDB nicht leeren, keine Welten oder Einstellungen löschen.
- Der Service Worker löscht nur `sandbox-*`-Caches, niemals IndexedDB.
- `version.json` gehört nicht in den Service-Worker-Cache.
- Änderungen an `sb-storage.js`, `sb-chunk.js`, `sw.js` oder am Update-Flow
  sind immer GROSS.
- Vor einem Update mit Speicheränderung eine Welt speichern, neu laden und
  prüfen, dass sie erhalten bleibt.

## 7. PR als Update

```bash
gh pr view <n> --json number,title,state,mergeable,headRefName,baseRefName
gh pr merge <n> --squash --delete-branch
git checkout main
git pull --ff-only
```

Danach normal updaten.

## 8. Abschlussbericht

Kurz: Version, Datum, still oder Popup, drei Hinweise (nur Popup), KLEIN/GROSS,
Testergebnis, Commit, Produktionsstatus mit URL, offene Blocker.

## Verbote

- Kein Release ohne synchrones Set aus `version.json`, `index.html`, `sw.js`,
  `README.md` und `CHANGELOG.md`.
- Kein Popup ohne genau drei Hinweise.
- Keine Nutzerdaten löschen oder zurücksetzen.
- Kein voller E2E-Lauf bei KLEIN, außer der Diff ist GROSS.
- Kein Force-Push, keine Secrets, keine übersprungenen Hooks.
- Keine Produktionsversion behaupten, die live noch nicht erreichbar ist.

## Referenzen

- `scripts/release.mjs` – Version, Modus, Hinweise und Changelog schreiben
- `sb-update.js` – Update-Hinweis nach dem Versionswechsel
- `references/data-safety.md` – IndexedDB, Welten, Migrationen
