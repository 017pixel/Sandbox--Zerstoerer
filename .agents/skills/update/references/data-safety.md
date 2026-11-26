# Datensicherheit

Die Spielstände existieren nur im Browser. Es gibt keinen Server, keinen
Export, kein Backup und keine Wiederherstellung. Ein Fehler hier ist
endgültiger Datenverlust.

## Was gespeichert ist

`sb-storage.js` öffnet `SandboxZerstörerDB` mit `DB_VERSION = 1`.

| Store | Schlüssel | Inhalt |
|---|---|---|
| `worlds` | `id` | `{ id, name, data, timestamp }` |
| `settings` | `key` | `{ key, value }`, aktuell `appState` |

`data` enthält:

- `width`, `height`
- `grid` (`Int8Array`, Material-ID pro Zelle)
- `wireMap` (`Uint8Array`, Stromsignal)
- `skyline` (`Uint16Array`, erste unterirdische Zeile pro Spalte)
- `atmosphere` (`skyTop`, `skyBottom`, `cloud`, `cloudAmount`, `stars`,
  `moon`)

`appState` enthält Pinsel, Radierer, Feuerstärke, Chaos, Simulationstempo,
Audioflags und `selectedExtraIds`.

## Unveränderlich

- **Material-IDs nicht umnummerieren.** `M` in `sb-data.js` wird als Zahl im
  `grid` gespeichert. Neue Materialien bekommen eine freie neue ID. ID 7 ist
  aktuell frei. Bestehende IDs behalten ihre Zahl.
- **Weltgröße 480 × 300** nicht ändern, ohne die Übernahme alter Formate
  anzupassen. `ChunkEngine.importWorld` setzt kleinere Saves mittig und unten
  verankert ein.
- **`DB_VERSION` nicht erhöhen**, ohne echte Migration in `onupgradeneeded`
  und Nachweis, dass alte `worlds` und `settings` weiter laden.
- **Keine Stores löschen, leeren oder umbenennen.**
- **Kein `indexedDB.deleteDatabase`.**
- **`importWorld` muss alte Formate lesen.** Fehlende `skyline` wird
  abgeleitet, fehlende `atmosphere` fällt auf den Standard zurück.
- **Kein Autosave einbauen.** `autoSaveIfEditing` ist bewusst ein No-op.
- **`CACHE_NAME` bei jedem Release erhöhen.** Der alte `sandbox-*`-Cache wird
  beim Aktivieren gelöscht, der neue precacht die aktuelle Fassung.
- **Landingpage bleibt aus dem Service-Worker-Cache ausgenommen.**
- **`vercel.json` behält `Cache-Control: no-cache` für `/sw.js`.**

## Checkliste für GROSS mit Datenbezug

Vor dem Commit:

- [ ] Diff in `sb-storage.js`, `sb-chunk.js`, `sb-data.js`, `sb-ui.js` und
      `sw.js` gezielt gelesen.
- [ ] Bestehende Material-IDs unverändert.
- [ ] Bestehende Weltgröße unverändert oder alte Formate getestet.
- [ ] `DB_VERSION` unverändert oder Migration mit altem Datensatz getestet.
- [ ] `worlds` und `settings` bleiben nach Migration lesbar.
- [ ] `importWorld` liest einen alten 320 × 180-Save.
- [ ] Fehlende `skyline` und `atmosphere` werden abgefangen.
- [ ] `CACHE_NAME` erhöht.
- [ ] `ASSETS` enthält alle Spielmodule.
- [ ] `npm run check` grün.
- [ ] Migrationsnachweis im Abschlussbericht.
- [ ] Ausdrückliche Freigabe für den Produktionslauf.

## Migrationsregeln

- Abwärtskompatibel erweitern: optionale Felder, Standardwerte beim Lesen,
  keine stillen Umbenennungen.
- Neue Pflichtfelder beim Lesen mit Default füllen, nicht beim Schreiben
  erzwingen.
- Alte und neue Formate eine Version lang parallel lesen.
- Migration idempotent bauen. Ein zweiter Lauf darf nichts verschlimmern.
- Vor dem Schreiben prüfen, ob die alten Daten vollständig gelesen wurden.
- Keine Daten „reparieren“, indem der Store neu angelegt wird.

## Service Worker

- Normale Navigationen laufen network-first mit Cache-Fallback.
- Spielassets laufen cache-first mit Netz-Fallback.
- `/landing-page` wird vollständig ausgenommen.
- Ein neuer Worker ruft `skipWaiting()` und `clients.claim()` auf. Offene Tabs
  behalten ihr JavaScript, bis sie vollständig neu laden.
- Kein Update-Gate und kein `SKIP_WAITING`-Ausbau. Ein optionales Popup über
  `sb-update.js` ist erlaubt und standardmäßig aus.

## Was nie passiert

- IndexedDB leeren, um ein Update zu reparieren.
- Den Nutzer bitten, Website-Daten zu löschen.
- Gespeicherte Welten durch Szenario-Änderungen überschreiben.
- Ungespeicherte Änderungen als „automatisch gesichert“ darstellen.
- Eine Migration ohne Test als sicher bezeichnen.
- Bei einem Rollback davon ausgehen, dass alter Code neue Daten liest.
