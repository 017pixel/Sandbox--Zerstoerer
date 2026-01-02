# Sandbox-Zerstorer

## Projektbeschreibung
Sandbox-Zerstorer ist eine hochperformante, webbasierte Physik-Simulation auf Basis von zellularen Automaten. Das System ermoglicht die Interaktion verschiedener Materialien und Elemente in einer dynamischen Umgebung. Die Anwendung ist als Progressive Web App (PWA) konzipiert und fur mobile Endgerate optimiert.

## Kernfunktionen
- Dynamische Partikelsimulation mit Echtzeit-Physik.
- Fortgeschrittenes Hitze- und Ausbreitungssystem (Heatmap).
- Modulare Weltenstruktur fur verschiedene Ausgangsszenarien.
- Optimierte Benutzeroberflache fur Desktop- und Touch-Gerate.
- Offline-Unterstutzung durch Service Worker Integration.

## Simulierte Elemente
Das System beinhaltet eine Vielzahl spezialisierter Materialien mit individuellen physikalischen Eigenschaften:
- Feststoffe: Stein, Holz, Beton, Eis.
- Granulare Medien: Sand, Kohle, Glut, TNT.
- Flussigkeiten: Wasser, Lava, Saure.
- Gase und Effekte: Methan, Dampf, Feuer, Funken.
- Biologische Elemente: Blatter, Ranken, Termiten.
- Energetische Effekte: Blitzschlag, Feuerwerk.

## Technische Details
Die Anwendung ist in modularer Architektur aufgebaut, um Wartbarkeit und Performance zu gewahrleisten:
- index.html: Struktur und UI-Layout.
- sb-data.js: Definition der Materialkonstanten und globalen Zustande.
- sb-physics.js: Kern-Engine fur die Berechnung der Partikelinteraktionen.
- sb-renderer.js: Canvas-basierte Darstellung mit spezialisierten Shadern und Effekten.
- sb-ui.js: Steuerung der Benutzerschnittstelle und des Inventarsystems.
- sb-world.js: Generierungsalgorithmen fur die Umgebungen.
- sw.js: Service Worker fur Offline-Funktionalitat.

## Installation und Ausfuhrung
Das Projekt benötigt keine serverseitigen Abhängigkeiten. Zur Ausführung sind folgende Schritte notwendig:
1. Lokales Klonen oder Herunterladen des Repositories.
2. Offnen der Datei index.html in einem modernen Webbrowser.
3. Fur die PWA-Funktionalitat wird das Hosting uber eine gesicherte Verbindung (HTTPS) oder localhost empfohlen.

## Lizenz
Alle Rechte an diesem Projekt liegen beim Ersteller. Eine kommerzielle Nutzung oder Verbreitung ist ohne ausdruckliche Zustimmung nicht gestattet.
