# Strategien zur FPS-Optimierung (Sandbox-Zerstörer)

Dieses Dokument analysiert die aktuelle Performance der Sandbox und schlägt konkrete Maßnahmen vor, um die FPS zu stabilisieren und zu erhöhen, insbesondere für mobile Geräte und schwächere PCs.

---

## 1. Engpass-Analyse (Bottlenecks)

### A. Rendering (Der größte Flaschenhals)
In der aktuellen `sb-renderer.js` wird für **jeden einzelnen Pixel** der Kamera-Ansicht eine Abfrage an die `ChunkEngine` gestellt (`getV`, `getHeat`, `getWire`). 
- Eine Map-Abfrage (`Map.get()`) ist zwar schnell, aber bei 100.000+ Aufrufen pro Frame (z.B. 400x300 Pixel) summiert sich der Overhead massiv.
- Die Umrechnung von Screen- zu Welt-Koordinaten findet in der innersten Schleife statt.

### B. Physik-Berechnung
Die Simulation scannt jeden Pixel in den aktiven Chunks. Da die Welt unendlich ist, steigt die Last, wenn viele Chunks gleichzeitig aktiv sind (z.B. durch schnelles Scrollen oder Explosionen).
- Viele Pixel sind Luft oder Stein und ändern sich nie, werden aber trotzdem jedes Mal geprüft.

### C. Speicherverwaltung (GC Pressure)
Falls in den Loops neue Objekte oder Arrays erzeugt werden, muss der Browser regelmäßig aufräumen (Garbage Collection), was zu kurzen Rucklern (Stuttering) führt.

---

## 2. Optimierungsvorschläge

### 🚀 Level 1: Quick Wins (Sofort umsetzbar)

1.  **Direktzugriff auf Chunk-Daten:**
    Anstatt `ChunkEngine.getV(x, y)` in der Schleife zu rufen, sollten wir am Anfang des Render- oder Physik-Passes die `Int8Array`-Referenzen der sichtbaren Chunks in eine lokale Variable holen. Das spart Millionen von Funktionsaufrufen und Map-Lookups.

2.  **Bitwise-Operationen:**
    Prüfungen wie `if (cell === M.AIR)` können durch Bit-Operationen beschleunigt werden, wenn die Material-IDs strategisch gewählt werden (z.B. alle Gase haben Bit 4 gesetzt).

3.  **Throttling der Physik:**
    Wir berechnen Strom und Hitze bereits nur alle 3 Frames. Dies könnte auf alle "langsamen" Elemente (wie Pflanzenwachstum) ausgeweitet werden.

---

### 🔥 Level 2: Struktur-Änderungen (Hoher Impact)

4.  **Chunk-Caching (Canvas-Backend):**
    Jeder Chunk bekommt ein eigenes kleines `OffscreenCanvas` (32xH Pixel).
    - Nur wenn sich ein Pixel im Chunk ändert, wird der Chunk neu auf sein Canvas gezeichnet.
    - In der `draw()` Funktion wird dann nur noch `ctx.drawImage()` für die 10-20 sichtbaren Chunks aufgerufen.
    - **Vorteil:** Statische Bereiche der Welt kosten fast 0% Performance beim Zeichnen.

5.  **Dirty-Rectangles / Active Regions:**
    Wir führen eine Liste von "aktiven" Bereichen pro Chunk. Wenn Sand aufhört zu fallen, wird der Bereich als "schlafend" markiert und nicht mehr gescannt, bis ein Nachbar-Pixel ihn wieder aufweckt (ähnlich wie in Minecraft).

6.  **Typed Array Pooling:**
    Verwendung von `SharedArrayBuffer` (falls verfügbar), um Daten zwischen dem Haupt-Thread und Web-Workern zu teilen, ohne sie zu kopieren.

---

### ⚡ Level 3: High-End (Maximale Performance)

7.  **Web-Worker (Multi-Threading):**
    Die gesamte Physik-Berechnung (`updatePhysics`) wird in einen Web-Worker ausgelagert. Während der Worker den nächsten Frame berechnet, kann der Haupt-Thread flüssig mit 60 FPS rendern.

8.  **GPU-Beschleunigung (WebGL/WebGPU):**
    Übertragung der Gitter-Daten als Textur an die Grafikkarte. Die Simulation wird über einen "Compute Shader" oder "Fragment Shader" berechnet.
    - Dies ist der Goldstandard für Sandbox-Spiele (wie Noita), erfordert aber eine fast vollständige Neuentwicklung der Physik-Logik in GLSL/WGSL.

---

## 3. Empfohlene nächste Schritte

Ich empfehle, mit **Punkt 1 (Direktzugriff)** und **Punkt 4 (Chunk-Caching)** zu beginnen. Diese bringen den größten FPS-Schub, ohne die gesamte Architektur umwerfen zu müssen. 

- **Ziel:** 60 FPS stabil auf dem Handy, selbst bei großen Schaltungen oder vielen fallenden Sandkörnern.
