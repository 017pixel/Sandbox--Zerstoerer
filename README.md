# Sandbox-Zerstörer

Ein kleiner Pixel-Spielplatz im Browser. Sand rieselt, Wasser fließt, Holz brennt. Baue eine Welt, mische Materialien und probiere aus, was passiert.

[Jetzt spielen](https://sandbox-zerstoerer.vercel.app/) · [Landingpage](https://sandbox-zerstoerer.vercel.app/landing-page)

## Spielen

Material auswählen und mit Maus oder Finger in die Welt malen. Über „Welten“ stehen acht Szenarien bereit, darunter Wald, Dorf, Insel und Vulkan. Im erweiterten Inventar findest du unter anderem Lava, TNT, Feuerwerk und elektrische Bauteile.

Mit dem Mausrad zoomst du, mit der rechten Maustaste verschiebst du die Ansicht. Auf dem Handy geht beides mit zwei Fingern. Eigene Welten und Einstellungen werden im jeweiligen Browser gespeichert. Nach dem ersten Laden funktioniert das Spiel auch offline.

Spielstände gehören zur jeweiligen Internetadresse. Welten von der früheren GitHub-Pages-Adresse werden vom Browser nicht automatisch auf die neue Vercel-Adresse übertragen.

## Landingpage

Der Ordner `landing-page/` enthält die eigenständige Vorstellung des Spiels. Die kleine Demowelt nutzt dieselbe Physik und Darstellung wie das Spiel, hat aber keinen Zugriff auf gespeicherte Welten. Screenshots und Video sind echte Spielaufnahmen. Die Demo lässt sich pausieren und zurücksetzen. Bei reduzierter Bewegung startet sie pausiert.

Schriften, Bilder und Video werden lokal ausgeliefert. Es gibt keine Analyse- oder Trackingdienste. Die Schriftlizenzen liegen in `assets/fonts/`.

## Lokal starten

Keine Installation nötig. Im Projektordner:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Spiel: `http://127.0.0.1:8080/`

Landingpage: `http://127.0.0.1:8080/landing-page/`

## Vercel

Das Projekt `sandbox-zerstoerer` läuft im kostenlosen Hobby-Tarif und ist mit diesem GitHub-Repository verbunden. Der Hauptbranch ist `main`. Das Spiel bleibt auf `/`, die Landingpage liegt auf `/landing-page`. GitHub Pages und der bisherige Pages-Workflow sind deaktiviert.

`node scripts/build.mjs` kopiert ausschließlich die benötigten Spiel- und Landingpage-Dateien nach `dist/`. Vercel führt diesen Befehl beim Deployment aus. Entwicklernotizen und lokale Werkzeuge werden nicht veröffentlicht. Es gibt keine Serverfunktionen, Datenbank oder kostenpflichtigen Zusatzdienste.

Nach Verbindung mit Vercel lösen freigegebene Pushes auf `main` neue Produktionsdeployments aus. Eine direkte Veröffentlichung ist ebenfalls möglich:

```sh
vercel deploy --prod --scope benjamin-s-projects-77ef4d8a
```

Die Spieloberfläche verwendet vorab erzeugtes Tailwind-CSS. Wenn Klassen im Spiel hinzukommen, die Datei neu erzeugen:

```sh
npx --yes tailwindcss@3.4.19 -i scripts/game-source.css -o assets/game.css --content './index.html,./sb-*.js' --minify
```

Die Landingpage verwendet eigenständiges CSS ohne Build-Abhängigkeiten.

## Aufbau

- `index.html`, `sb-*.js`, `sb-styles.css`: Spiel, Physik, Welten, Oberfläche und Browser-Speicher.
- `sw.js`, `manifest.json`, `pwa-icon.png`: Offlinebetrieb und installierbares Spiel.
- `landing-page/`: Landingpage mit Medien und isolierter Demo.
- `assets/`: lokal ausgelieferte Spielstyles und Schriften.
- `scripts/build.mjs`, `vercel.json`: statischer Build und Hosting.

## Version

Aktuell: **1.1.0**. Änderungen stehen in [CHANGELOG.md](CHANGELOG.md).

## Lizenz

Alle Rechte an diesem Projekt liegen beim Ersteller. Eine kommerzielle Nutzung oder Verbreitung ist ohne ausdrückliche Zustimmung nicht gestattet. Die separat mitgelieferten Schriften unterliegen ihren jeweiligen OFL-Lizenzen.
