# Optimierungs-Recherche für den "Sandbox Zerstörer" 🚀

Um die Performance deines Sandbox-Projekts auf Low-End-Geräten (wie älteren Smartphones oder Tablets) signifikant zu steigern, ohne die Physik oder die Optik spürbar zu verändern, gibt es mehrere hocheffektive Strategien im Hintergrund. 

Die folgenden Punkte konzentrieren sich auf die Reduzierung der CPU-Last und die effizientere Nutzung des Arbeitsspeichers.

---

### 1. Chunk-basiertes Update-System (Wichtigste Maßnahme) 🧊
Momentan wird in jedem Frame das **gesamte Spielfeld** (jeder einzelne Pixel) geprüft, ob er sich bewegen muss. Das ist sehr ineffizient, wenn ein Großteil der Welt aus statischem Boden oder leerer Luft besteht.
*   **Konzept:** Teile das Spielfeld in kleine Quadrate auf (z.B. 16x16 oder 32x32 Pixel), sogenannte "Chunks".
*   **Vorteil:** Nur Chunks, in denen sich mindestens ein aktives Teilchen (z.B. fallender Sand oder fließendes Wasser) befindet, werden berechnet.
*   **Effekt:** Wenn nur in einer Ecke des Bildschirms etwas passiert, sinkt die CPU-Last um bis zu 90%, da der Rest der Welt einfach "schläft".

### 2. "Sleeping" Partikel 😴
Partikel, die zur Ruhe gekommen sind (z.B. Sand, der auf einem festen Stein liegt und keine freien Nachbarfelder hat), müssen nicht in jedem Frame neu berechnet werden.
*   **Konzept:** Markiere Partikel als "schlafend", sobald sie sich für eine bestimmte Anzahl an Frames nicht mehr bewegt haben.
*   **Aufwachen:** Ein Partikel wacht erst wieder auf, wenn ein Nachbar-Pixel sich verändert (z.B. wenn der Boden darunter weggeschossen wird).

### 3. Effizientes Heatmap-Update 🔥
Die Hitze-Berechnung ist aktuell einer der teuersten Prozesse, da sie für fast jeden Pixel Nachbarschafts-Checks durchführt.
*   **Intervall-Update:** Die Hitze muss nicht zwingend in jedem Physik-Schritt aktualisiert werden. Ein Update alle 2 oder 3 Frames reicht oft aus, ohne dass die Ausbreitung von Feuer ruckelig wirkt.
*   **Downsampling:** Man könnte die Heatmap in einer geringeren Auflösung berechnen als das Partikel-Grid (z.B. nur halb so groß) und beim Rendern hochskalieren. Das spart massiv Berechnungen.

### 4. Optimierung der Zufallszahlen (Fast RNG) 🎲
`Math.random()` ist in JavaScript innerhalb von extrem schnellen Schleifen (die tausendfach pro Sekunde laufen) überraschend langsam.
*   **Konzept:** Nutze ein Array mit vorab berechneten Zufallszahlen (z.B. 4096 Werte), das du immer wieder im Kreis durchläufst. Alternativ kann ein einfacherer Algorithmus (wie Xorshift) verwendet werden, der viel schneller ist als die Standard-Funktion des Browsers.

### 5. Vermeidung von DOM-Zugriffen in der Loop 🛑
Sachen wie `document.getElementById` oder das Ändern von CSS-Klassen innerhalb der `updatePhysics`-Funktion sind "Performance-Killer".
*   **Konzept:** Suche alle benötigten HTML-Elemente einmalig beim Start der App und speichere sie in Variablen. 
*   **Zustands-Checks:** Ändere das Interface (z.B. die Meltdown-Warnung) nur dann, wenn sich der Status tatsächlich *geändert* hat, anstatt den Text in jedem Frame neu zu setzen.

### 6. Typed Arrays & Bitwise Operations 💻
Du nutzt bereits `Int8Array` und `Uint8Array`, was sehr gut ist.
*   **Bit-Flags:** Man könnte Informationen (z.B. "Ist brennbar", "Ist flüssig") direkt in die Zahlenwerte der Materialien kodieren. So reicht ein einziger schneller Bit-Vergleich statt langer `if/else`-Ketten.

### 7. Canvas-Layering & Dirty Rectangles 🎨
*   **Konzept:** Das Rendern des Hintergrunds (Wolken, Farbverläufe) muss nicht in jedem Frame komplett neu berechnet werden.
*   **Ebenen:** Zeichne statische Dinge auf einen separaten Hintergrund-Canvas. Auf dem Haupt-Canvas werden nur die Pixel aktualisiert, die sich tatsächlich verändert haben ("Dirty Rectangles").

### 8. Physics-Interpollation (Variable Tickrate) ⏱️
Wenn das Gerät zu langsam wird, fangen die FPS an zu sinken.
*   **Konzept:** Die Physik läuft mit einer festen Rate (z.B. immer 60 Ticks pro Sekunde), unabhängig davon, wie oft der Bildschirm aktualisiert wird. Auf Low-End Geräten kann man die Anzahl der Physik-Schritte pro Frame dynamisch senken, um die grafische Darstellung flüssig zu halten, während die Simulation im Hintergrund einfach etwas langsamer läuft.

---

**Zusammenfassung für Benjamin:**
Die größte Verbesserung bringt das **Chunking (Punkt 1)**. Es sorgt dafür, dass dein Projekt auch auf schwachen Handys flüssig läuft, selbst wenn die Welt riesig ist – solange nicht überall gleichzeitig alles explodiert. 🚀✨
