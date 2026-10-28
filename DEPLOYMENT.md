# Umzug zu Vercel

Stand: 28. Oktober 2026, Version 1.1.0.

## Ergebnis

- Spiel: https://sandbox-zerstoerer.vercel.app/
- Landingpage: https://sandbox-zerstoerer.vercel.app/landing-page
- Projekt: https://vercel.com/benjamin-s-projects-77ef4d8a/sandbox-zerstoerer
- Repository: https://github.com/017pixel/Sandbox--Zerstoerer

Das neue Projekt liegt im bestehenden Vercel-Hobby-Team. Der Tarif wurde über die Vercel-API als `hobby` bestätigt. Es wurden keine kostenpflichtigen Erweiterungen, Serverfunktionen oder Datenbanken eingerichtet. Die kostenlosen Tarifgrenzen von Vercel gelten weiterhin.

Das Produktionsdeployment `dpl_Av45KAhbDQQ6UXZ2EzRt2xTw6PDF` wurde von Vercel als `Ready` bestätigt. Beide Seiten sind öffentlich ohne Vercel-Anmeldung erreichbar. Das Projekt ist mit dem bestehenden GitHub-Repository und dem Produktionsbranch `main` verbunden.

GitHub bestätigt `has_pages: false`. Der alte Pages-Workflow ist `disabled_manually`; seine Datei wurde lokal entfernt. Die Repository-Homepage zeigt auf die neue Spieladresse.

## Landingpage

Dunkle Spielpalette, gelbe Aktionen und Pixelschrift. Eine kleine Welt reagiert auf Sand, Wasser und Feuer mit der originalen Spielphysik. Dazu kommen drei echte Szenario-Screenshots, eine kurze echte Spielaufnahme mit TNT und Links zum Spiel und zu GitHub. Alle Medien und Schriften werden lokal ausgeliefert.

Die Demo speichert nichts und verändert keine Welten des eigentlichen Spiels. Bei reduzierter Bewegung startet sie pausiert. Materialien lassen sich per Tastatur wählen; mit Enter oder Leertaste im Demo-Canvas wird Material gesetzt.

Die Designrichtung und die eigene gestalterische Einschätzung sind in [landing-page/DESIGN.md](landing-page/DESIGN.md) dokumentiert.

## Prüfung

Lokal und anschließend mit einem frischen Browserkontext auf der öffentlichen Vercel-Adresse bestanden:

- Layout und Bilder bei 320, 390, 768 und 1440 Pixeln, ohne horizontalen Überlauf.
- Materialwechsel, Pause, Zeichnen, Reset und Tastatureingabe in der Demo.
- Videowiedergabe, interne Spiellinks und GitHub-Linkziele.
- Mobiler Spielbutton beim Scrollen und pausierter Start bei reduzierter Bewegung.
- Szenario laden, Material auswählen, zeichnen, Welt speichern, neu laden und Offlinebetrieb im eigentlichen Spiel.
- Keine unbehandelten JavaScript-Ausnahmen oder HTTP-Fehler während dieser Abläufe.

Die Designwerkzeuge melden für die finale Seite bei 390, 768 und 1440 Pixeln `0 FAIL, 0 WARN`. Die bestehende Pixelschrift wurde dabei ausdrücklich als Markenbestandteil zugelassen. Die Screenshots aller geprüften Ansichten wurden angesehen. Der statische Build enthält weder Entwicklernotizen noch die Design-Dokumentation.

## Zu beachten

Browser-Spielstände sind an ihre bisherige Internetadresse gebunden. Die Datenstruktur wurde nicht geändert; eine automatische Übertragung alter GitHub-Pages-Spielstände auf die Vercel-Adresse ist durch die Trennung der Browser-Speicher nicht möglich.

Die erste Veröffentlichung erfolgte direkt per Vercel CLI. Die Übernahme des geprüften Standes als Version 1.1.0 auf GitHub und der Push auf `main` wurden vom Nutzer freigegeben. Künftige Pushes auf `main` lösen über die GitHub-Verbindung ein Produktionsdeployment aus.
