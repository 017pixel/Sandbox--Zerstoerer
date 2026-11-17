# Architektur

## Überblick

Sandbox-Zerstörer ist eine statische Browser-Anwendung. Es gibt keinen
Server-Code, keine API und keine Datenbank im Backend. Alles, was zur Laufzeit
passiert, steckt in klassischen JavaScript-Dateien, die `index.html` in fester
Reihenfolge lädt.

Die zwei Oberflächen teilen sich denselben Code, aber nicht denselben Zustand:

- **Spiel** unter `/` mit Speicherung, Service Worker und Ton.
- **Landingpage** unter `/landing-page` mit eigener Demo ohne Speicherung.

## Bewusste Entscheidungen

- **Kein Bundler, keine ES-Module im Spielcode.** Die Dateien werden als
  klassische Skripte geladen. Das hält das Spiel ohne Build-Schritt lauffähig
  und macht Debugging im Browser direkt möglich.
- **Kein Backend.** Es gibt keine Konten, keine API und keine Serverdaten.
  Spielstände gehören dem Browserprofil.
- **Nur IndexedDB als Persistenz.** Kein localStorage für Spielstände, kein
  Cloud-Sync, kein Autosave.
- **Vorab erzeugtes Tailwind-CSS.** Kein CSS-Build bei jedem Deployment. Neue
  Utility-Klassen werden bewusst neu erzeugt.
- **Kein Update-Popup.** Die neue Fassung kommt beim nächsten vollständigen
  Laden. Der Service Worker cached versioniert.
- **Landingpage getrennt.** Sie hat eigene Styles und eine Demo ohne
  Speicherzugriff. Sie wird nicht vom Service Worker gecacht.

## Ladereihenfolge

`index.html` lädt die Skripte am Ende des Bodys:

```text
sb-chunk.js -> sb-data.js -> sb-storage.js -> sb-utils.js -> sb-audio.js
-> sb-world.js -> sb-renderer.js -> sb-physics.js -> sb-ui.js -> sb-main.js
```

Die Reihenfolge ist wichtig. `sb-chunk.js` definiert `ChunkEngine`,
`sb-data.js` definiert Materialien und Zustände und initialisiert danach das
Raster. `sb-main.js` startet schließlich Loop und UI.

Es gibt keine ES-Module und kein Bundling. Funktionen und Variablen liegen
absichtlich global, damit Inline-Handler wie `onclick="loadWorld('island')"`
sie erreichen.

## Dateien

### Spiel

| Datei | Verantwortung |
|---|---|
| `sb-data.js` | Canvas, `M`-Material-IDs, Farben, `WORLD_WIDTH`/`WORLD_HEIGHT`, globale Zustände, Werkzeuglisten. |
| `sb-chunk.js` | `ChunkEngine`: festes Raster, `getV`/`setV`, Heatmap, Draht, Skyline, Export/Import. |
| `sb-world.js` | Acht Szenarien, Terrain, Gebäude, Vegetation, Himmelspaletten, Szenario-Auswahl. |
| `sb-renderer.js` | Vorberechneter Himmel, Weltzeichnung, Effekte, Offscreen-Canvas. |
| `sb-physics.js` | Ein Simulationsschritt: Schwerkraft, Flüssigkeiten, Feuer, Gas, Strom, Explosionen, Kernschmelze. |
| `sb-ui.js` | Panels, Inventar, Einstellungen, Welt speichern/laden/löschen. |
| `sb-main.js` | Maus-, Touch- und Tastatureingabe, Kamera, Zoom, Animation-Loop, Start. |
| `sb-storage.js` | IndexedDB `SandboxZerstörerDB`, Stores `worlds` und `settings`. |
| `sb-utils.js` | Resize, Kamera-Clamping, `frameWorld`, Zeichen-Helfer, `resetWorld`. |
| `sb-audio.js` | Prozedurale Platzierungs- und Umgebungsklänge. |
| `sw.js` | Offline-Precache, Cache-Aufräumen, Fetch-Strategie. |

### Landingpage

`landing-page/index.html`, `styles.css` und `landing.js` sind eigenständig.
`demo.html` und `demo.js` laden dieselben Engine-Dateien wie das Spiel, aber
ohne `sb-storage.js`, ohne Service Worker und mit einem Stub für Audio. Die
Demo hat keinen Zugriff auf gespeicherte Welten.

### Werkzeuge

| Datei | Aufgabe |
|---|---|
| `scripts/dev-server.mjs` | Static-Server mit Vercel-ähnlichen Routen, MIME-Typen, Range-Requests und Dev-Cache-Bust, ohne Doku/Tests. |
| `scripts/dev.mjs` | Start, Stop, Status und Restart mit PID-Datei unter `.dev/`. |
| `scripts/build.mjs` | Löscht `dist/` und kopiert nur die Produktions-Whitelist. |
| `scripts/check.mjs` | Prüft Version, Cache, Doku-Links, Tests, Manifest, Syntax und optional `dist/`. |
| `tests/` | Playwright-Smoke und E2E. |
| `.opencode/skills/app-update/` | Release-Workflow und Versions-Script. |

## Laufzeitfluss

```text
Maus/Touch
  -> paint()
  -> ChunkEngine.setV()
  -> grid

requestAnimationFrame
  -> updatePhysics()
  -> draw()
  -> Offscreen-Canvas
  -> sichtbares Canvas
```

`updatePhysics()` arbeitet auf dem gesamten Raster, überspringt aber mit
Materialmasken alles, was in einem Durchlauf nichts tut. Der Himmel wird pro
Szene einmal in `skyMap` vorberechnet und im Frame nur noch nachgeschlagen.
Die Simulation läuft in einer kleinen Offscreen-Auflösung (`targetShort` 180
oder 220 je nach Gerät), das sichtbare Canvas skaliert mit maximal DPR 2.

## Weltformat

Eine gespeicherte Welt hat diese Form:

```js
{
  id: 'user-...',
  name: 'Meine Welt',
  timestamp: 1234567890,
  data: {
    width: 480,
    height: 300,
    grid: Int8Array,      // Material-ID pro Zelle
    wireMap: Uint8Array,  // Stromsignal
    skyline: Uint16Array, // erste unterirdische Zeile pro Spalte
    atmosphere: { ... }   // Himmelspalette
  }
}
```

`ChunkEngine.exportWorld()` liefert die ersten fünf Felder.
`saveCurrentWorld()` ergänzt `atmosphere`. `importWorld()` akzeptiert kleinere
alte Welten (320 × 180), setzt sie mittig und unten verankert ein und leitet
eine fehlende Skyline ab. Fehlende Atmosphäre fällt auf den Standard zurück.

## Speicherung

`sb-storage.js` öffnet `SandboxZerstörerDB` mit `DB_VERSION = 1`.

| Store | Schlüssel | Inhalt |
|---|---|---|
| `worlds` | `id` | `{ id, name, data, timestamp }` |
| `settings` | `key` | `{ key, value }`, aktuell `appState` |

`appState` enthält Pinsel, Radierer, Feuerstärke, Chaos, Simulationstempo und
die ausgewählten Zusatzwerkzeuge. Es gibt kein Autosave. Gespeichert wird nur
über den Speichern-Dialog.

`sessionStorage.hasOpened` sorgt dafür, dass ein frischer Tab einmal neu lädt.
Das ist bestehendes Verhalten und kein Speicherpfad für Spielstände.

## Service Worker

`sw.js` precacht die Spieldateien aus `ASSETS` unter `sandbox-vX.Y.Z`.

- `install`: Cache füllen, `skipWaiting()`.
- `activate`: alte `sandbox-`-Caches löschen, `clients.claim()`.
- `fetch`: Nur same-origin GET. `/landing-page` wird vollständig
  ausgenommen. Navigationen laufen network-first mit Cache-Fallback, alle
  anderen precachten Dateien cache-first mit Netz-Fallback.

Ein neues Release muss `CACHE_NAME` erhöhen und neue Spielmodule in `ASSETS`
aufnehmen. Die Landingpage bleibt draußen.

Im Dev-Betrieb startet `npm start` den Server mit `--dev-cache-bust`. Er
ersetzt den ausgelieferten `CACHE_NAME` durch einen Hash aus den Spiel-Dateien.
Ändert sich eine Datei, installiert der Browser den Worker neu und lädt die
aktuellen Assets. Tests und Produktion nutzen den echten Cache-Namen aus
`sw.js`.

## Build und Deployment

`scripts/build.mjs` kopiert nur:

- `index.html`, `sb-*.js`, `sb-*.css`, `sw.js`, `manifest.json`,
  `pwa-icon.png`, `robots.txt`, `sitemap.xml`
- `assets/` vollständig
- `landing-page/` mit `.html`, `.css`, `.js` und `assets/`

`vercel.json` baut mit `node scripts/build.mjs`, liefert `dist/` aus, nutzt
clean URLs und setzt für `/sw.js` `Cache-Control: no-cache`. Ein Push auf
`main` löst das Produktionsdeployment aus.

## Erweiterungsrezepte

### Neues Material

1. Neue numerische ID in `M` in `sb-data.js` eintragen. Bestehende IDs nicht
   verschieben. ID 7 ist frei.
2. Farbe in `colors` ergänzen.
3. Werkzeug in `permanentTools` oder `extraToolsSource` ergänzen.
4. Verhalten in `sb-physics.js` implementieren.
5. Bei Bedarf Darstellung in `sb-renderer.js` ergänzen.
6. Prüfen, ob das Material gespeichert und wieder geladen werden kann.
7. Bei sichtbarem Verhalten einen Test in `tests/core.spec.mjs` ergänzen und
   `npm run check` laufen lassen.

### Neues Szenario

1. Builder-Funktion in `sb-world.js` schreiben.
2. In `WORLD_BUILDERS` registrieren, Himmel in `WORLD_ATMOSPHERES`, Blick in
   `WORLD_VIEWS` ergänzen.
3. Button in `index.html` mit `onclick="loadWorld('name')"` hinzufügen.
4. Namen in `SCENARIO_NAMES` in `tests/helpers.mjs` aufnehmen.
5. `npm run check`.

### Neue UI-Fläche

1. Markup in `index.html`, Styles bevorzugt über vorhandene Tailwind-Klassen.
2. Neue Klassen in `assets/game.css` neu erzeugen:
   `npx --yes tailwindcss@3.4.19 -i scripts/game-source.css -o assets/game.css --content './index.html,./sb-*.js' --minify`
3. Keine Datenpfade anfassen.
4. `npm run check:quick` reicht bei reiner Darstellung.

### Speicherformat ändern

1. Als GROSS behandeln und vorher freigeben lassen.
2. `importWorld` abwärtskompatibel erweitern.
3. `DB_VERSION` nur mit echter Migration in `onupgradeneeded` erhöhen.
4. Regressionstest ergänzen, der einen alten Datensatz lädt.
5. `npm run check` plus manuellen Migrationsnachweis.

### Neue Datei ausliefern

1. Spielmodul mit `sb-`-Präfix: in `index.html` einbinden und in `sw.js`
   unter `ASSETS` aufnehmen.
2. Andere Datei: Whitelist in `scripts/build.mjs` erweitern.
3. `npm run check`.
