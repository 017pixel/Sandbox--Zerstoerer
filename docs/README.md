# Dokumentation

Die aktuelle Doku für Sandbox-Zerstörer:

| Datei | Inhalt |
|---|---|
| [README.md](../README.md) | Einstieg, Schnellstart, Befehle, Projektüberblick. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Aufbau, Laufzeitfluss, Datenformat, Erweiterungsrezepte. |
| [TESTING.md](TESTING.md) | Smoke, E2E, Änderungsstufen, Testregeln. |
| [RELEASING.md](RELEASING.md) | Version, Release-Script, Deploy, Rollback. |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Vercel, Build und Produktionsbetrieb. |
| [AGENTS.md](../AGENTS.md) | Verbindliche Arbeitsanleitung für Agenten. |

## Archiv

`archive/` enthält alte Notizen und frühere Code-Stände. Sie sind historisch
und nicht bindend. Für aktuelle Arbeit immer die Doku oben verwenden.

- [alter-funktionaler-code.md](archive/alter-funktionaler-code.md)
- [verbesserungen-fps.md](archive/verbesserungen-fps.md)
- [optimierung.md](archive/optimierung.md)
- [verbesserungsmoeglichkeiten.md](archive/verbesserungsmoeglichkeiten.md)

Der Release-Workflow für Agenten liegt unter
[.opencode/skills/app-update/SKILL.md](../.opencode/skills/app-update/SKILL.md).
Der CI-Gate liegt in
[.github/workflows/verify.yml](../.github/workflows/verify.yml).
