# Changelog

## [1.2.2] - 2026-11-15

### Verändert
- Landingpage-Demo nutzt jetzt die echte Spiel-UI: Materialleiste links, LEEREN, FPS/ENT und Tool-Anzeige. Die separate Demo-Leiste mit Sand/Wasser/Feuer und Pause/Neustart ist entfernt.
- Insel und Eissee werden von Fels- beziehungsweise Eisrändern eingefasst, damit kein Wasser am Weltrand herausläuft.
- Fenster sind reine Glasflächen ohne Glut oder Feuer; keine Glut und keine Lava in Wasser; Methan liegt nicht neben Lava; TNT hat keine Hitzequellen direkt daneben.
- Offene Moosranken werden beim Laden zu Blättern; Moos bleibt nur in geschlossenen Wand- und Baumflächen.
- Insel- und Waldbilder, Demo-Poster und Galerie an die neue Weltlogik angepasst.

## [1.2.1] - 2026-11-15

### Verändert
- Insel-Kamera auf schmale Handybildschirme angepasst, damit Hütte und Palmen nicht mehr hinter dem Werkzeugmenü liegen.

## [1.2.0] - 2026-11-15

### Verändert
- Alle acht Welten neu aufgebaut: größere Bauwerke, mehr Tiefe, mehr Details und eigene Himmelsstimmungen mit Sternen, Mond und Wolken.
- Weltfläche von 320 × 180 auf 480 × 300 Pixel vergrößert.
- Kamera rahmt jede Welt beim Laden passend; hochkant auf dem Handy füllt ein automatischer Zoom den Bildschirm.
- Höhlen, Minen und Labyrinthe haben jetzt echten Untergrund statt Himmel in den Hohlräumen.
- Gespeicherte Welten aus der alten Größe werden beim Laden automatisch übernommen und mittig unten einsortiert.
- Landingpage-Demo an die neue Weltgröße und die neuen Szene-Bausteine angepasst und für alle Bildschirmgrößen ohne Beschnitt umgebaut; auf hohen Displays zeigt sie mehr Himmel.
- Spielposter, Weltenbilder, Video und Video-Poster mit den neuen Welten neu erstellt.

### Technisch
- Himmel wird pro Szene vorberechnet, Physik überspringt statische Materialien; die größeren Welten bleiben flüssig.
- Speicherformat um Weltgröße, Skyline und Himmelsstimmung ergänzt, alte Spielstände bleiben lesbar.
- Offline-Cache auf Version 1.2.0 aktualisiert.

## [1.1.0] - 2026-10-28

### Erstellt
- Spielerische Landingpage mit einer interaktiven Demowelt, echten Screenshots und einem kurzen Spielvideo.
- Direkte Links zum Spiel und zum GitHub-Projekt, auch auf kleinen Bildschirmen.
- Neues Vercel-Projekt im kostenlosen Hobby-Tarif mit eigener Spiel- und Landingpage-Adresse.

### Verändert
- Hosting von GitHub Pages zu Vercel umgestellt.
- Spielstyles und Schriften lokal eingebunden, damit das Spiel ohne externe Schrift- und Styledienste funktioniert.
- Offline-Cache aktualisiert und von der Landingpage getrennt.
- Link zur Landingpage und Versionsanzeige in den Spieleinstellungen ergänzt.

### Gelöscht
- Bisherigen Deployment-Workflow für GitHub Pages entfernt.
