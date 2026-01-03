// --- WELTEN ---
function toggleWorlds() {
    document.getElementById('worldsPanel').classList.toggle('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function loadWorld(type) {
    resetWorld();
    document.getElementById('worldsPanel').classList.add('hidden');

    if (type === 'forest') {
        // Enriched Forest: hills, varied trees, termites near base, some methane pockets
        for (let x = 0; x < width; x++) {
            const groundY = height - 25 + Math.sin(x * 0.1) * 8 + Math.cos(x * 0.05) * 5;
            for (let y = groundY; y < height; y++) {
                const mat = y > groundY + 5 ? M.STONE : M.SAND;
                setPixel(x, y, mat);
            }
            // Add grass/dirt layer
            setPixel(x, groundY, M.VINE);

            if (Math.random() < 0.08 && x > 5 && x < width - 5) {
                drawTree(x, groundY);
                // Infest some trees with termites
                if (Math.random() < 0.4) {
                    for (let i = 0; i < 5; i++) setPixel(x + (Math.random() - 0.5) * 4, groundY - 2 - Math.random() * 5, M.TERMITE);
                }
            }
        }
        // Add a small hidden methane gas pocket underground
        drawCircle(width * 0.3, height - 10, 5, M.METHANE);
    }
    else if (type === 'village') {
        // Enriched Village: Houses with TNT basements, gas lamps (methane), more detail
        drawRect(0, height - 15, width, 15, M.STONE);

        // Add trees to the village
        drawTree(Math.floor(width * 0.1), height - 15);
        drawTree(Math.floor(width * 0.35), height - 15);
        drawTree(Math.floor(width * 0.65), height - 15);
        drawTree(Math.floor(width * 0.9), height - 15);

        const housePositions = [0.25, 0.7];
        housePositions.forEach(pos => {
            const hx = Math.floor(width * pos);
            const hy = height - 15;

            // House structure
            drawRect(hx - 10, hy - 20, 20, 20, M.WOOD);
            // TNT in the basement (danger!)
            drawRect(hx - 2, hy - 5, 4, 3, M.TNT);
            // Roof
            for (let d = 0; d < 12; d++) {
                drawRect(hx - 12 + d, hy - 20 - d, 24 - (d * 2), 1, M.CONCRETE);
            }
            // Door hallway
            drawRect(hx - 2, hy - 10, 4, 10, M.AIR);

            // Methane "Gas Lamp" outside
            setPixel(hx + 12, hy - 15, M.STONE);
            drawRect(hx + 12, hy - 14, 1, 14, M.STONE);
            setPixel(hx + 12, hy - 16, M.METHANE);
        });

        // Add some termites eating the village fences
        for (let i = 0; i < 10; i++) setPixel(10 + Math.random() * 20, height - 16, M.TERMITE);
    }
    else if (type === 'island') {
        // Enriched Island: more sand, no TNT, fixed floating trees
        const waterLevel = height - 25;
        drawRect(0, waterLevel, width, 25, M.WATER);

        // Helper to get ground Y for a specific X
        const getIslandY = (x) => {
            const dx = (x - width / 2) * 0.8; // Wider and flatter
            const dy = (dx * dx) / 60; // Flatter curve
            return height - 45 + dy; // Base height
        };

        for (let x = 0; x < width; x++) {
            const groundY = getIslandY(x);
            if (groundY < height) {
                for (let y = Math.floor(groundY); y < height; y++) {
                    // 12px deep sand layer
                    const mat = y < groundY + 12 ? M.SAND : M.STONE;
                    setPixel(x, y, mat);
                }
            }
        }

        // Palm trees - placed exactly on the ground
        [0.35, 0.5, 0.65].forEach(xp => {
            const hx = Math.floor(width * xp);
            const hy = Math.floor(getIslandY(hx));

            if (hy < height) {
                const trunkH = 20 + Math.random() * 10;
                // Slanted trunk look
                for (let i = 0; i < trunkH; i++) {
                    const offset = Math.sin(i * 0.2) * 2;
                    setPixel(hx + offset, hy - i, M.WOOD);
                    setPixel(hx + offset + 1, hy - i, M.WOOD);
                }

                const topY = hy - trunkH;
                const topX = hx + Math.sin(trunkH * 0.2) * 2;

                // Palm leaves (star pattern)
                for (let deg = 0; deg < 360; deg += 45) {
                    const rad = deg * Math.PI / 180;
                    for (let r = 0; r < 8; r++) {
                        setPixel(topX + Math.cos(rad) * r, topY + Math.sin(rad) * r, M.LEAVES);
                    }
                }

                // Coconuts
                setPixel(topX, topY + 1, M.COAL);
            }
        });
    }
    else if (type === 'volcano') {
        // Enriched Volcano: Ash, more lava, sulfur gas (methane)
        for (let x = 0; x < width; x++) {
            const dx = Math.abs(x - width / 2);
            const h = 80 - dx * 0.9;
            if (h > 0) {
                for (let y = height - h; y < height; y++) {
                    const mat = Math.random() < 0.1 ? M.COAL : M.STONE;
                    setPixel(x, y, mat);
                }
                // Ash/Cinder on slope
                if (Math.random() < 0.3) setPixel(x, height - h, M.EMBER);
            }
        }
        // Massive Lava pool
        drawRect(width / 2 - 4, height - 80, 8, 70, M.LAVA);
        // Gas vents
        drawCircle(width / 2, height - 90, 6, M.METHANE);
    }
    else if (type === 'mine') {
        // Enriched Mine: Wood supports, TNT chambers, Methane pockets
        drawRect(0, 0, width, height, M.STONE);

        // Main Shafts
        const shaftWidth = 12;
        [0.2, 0.5, 0.8].forEach(pos => {
            const sx = Math.floor(width * pos);
            drawRect(sx - shaftWidth / 2, 0, shaftWidth, height, M.AIR);

            // Wood supports every few pixels
            for (let y = 10; y < height; y += 30) {
                drawRect(sx - shaftWidth / 2, y, shaftWidth, 2, M.WOOD);
                // Hanging lantern (Methane)
                setPixel(sx, y + 2, M.METHANE);
            }
        });

        // Horizontal tunnels
        [0.25, 0.5, 0.75].forEach(pos => {
            const sy = Math.floor(height * pos);
            drawRect(0, sy, width, 8, M.AIR);

            // Vertical wood logs as supports
            for (let x = 15; x < width; x += 40) {
                drawRect(x, sy, 2, 8, M.WOOD);
            }
        });

        // Hidden Hazards
        drawRect(width * 0.5 - 5, height * 0.5 + 5, 10, 5, M.TNT); // Central TNT stash
        drawCircle(width * 0.1, height * 0.1, 8, M.METHANE); // Gas pocket
        drawCircle(width * 0.9, height * 0.8, 6, M.METHANE); // More gas

        // Termites in the wood
        for (let i = 0; i < 30; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            if (grid[Math.floor(ry) * width + Math.floor(rx)] === M.WOOD) setPixel(rx, ry, M.TERMITE);
        }
    }
    else if (type === 'ice') {
        // Grand Ice Palace: Floating fortress on water, no fire
        const waterLvl = height - 25;
        drawRect(0, waterLvl, width, 25, M.WATER);

        const cx = Math.floor(width / 2);
        const cy = waterLvl;

        // Massive Ice foundation with steps
        drawRect(cx - 50, cy - 8, 100, 12, M.ICE);
        drawRect(cx - 40, cy - 12, 80, 4, M.ICE);

        // Main Palace Hall
        drawRect(cx - 30, cy - 40, 60, 28, M.AIR); // Clear space
        drawRect(cx - 35, cy - 40, 5, 30, M.ICE); // Left Wall
        drawRect(cx + 30, cy - 40, 5, 30, M.ICE); // Right Wall
        drawRect(cx - 35, cy - 45, 70, 5, M.ICE); // Ceiling

        // Grand Spires (Layered)
        [cx - 40, cx, cx + 40].forEach((tx, i) => {
            const h = i === 1 ? 50 : 35; // Center spire is taller
            drawRect(tx - 4, cy - 45 - h, 8, h, M.ICE);
            // Spiky tips
            for (let j = 0; j < 5; j++) {
                drawRect(tx - 2 + j / 2, cy - 45 - h - j * 2, 4 - j, 2, M.ICE);
            }
        });

        // Decorative Ice Arches inside
        for (let a = 0; a < 3; a++) {
            const ax = cx - 20 + a * 20;
            drawRect(ax, cy - 12 - 15, 2, 15, M.ICE); // Pillars
            drawRect(ax - 4, cy - 12 - 15, 10, 2, M.ICE); // Arch top
        }

        // Ice Stalactites from ceiling
        for (let i = 0; i < 15; i++) {
            const sx = cx - 30 + Math.random() * 60;
            const sl = 3 + Math.random() * 8;
            drawRect(sx, cy - 40, 1, sl, M.ICE);
        }

        // Snow (Ice chunks) in the sky
        for (let i = 0; i < 60; i++) {
            setPixel(Math.random() * width, Math.random() * 40, M.ICE);
        }

        // Frozen Methane bubbles deep in the foundation
        for (let i = 0; i < 8; i++) {
            setPixel(cx - 45 + Math.random() * 90, cy + Math.random() * 5, M.METHANE);
        }
    }
    else if (type === 'cave') {
        // Enriched Cave: Acid pools, clusters of coal/embers, termites in walls
        drawRect(0, 0, width, height, M.STONE);
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const n = Math.sin(x * 0.08) + Math.sin(y * 0.08) + Math.cos((x + y) * 0.04);
                if (n > 0.6) setPixel(x, y, M.AIR);
                else if (n < -0.9) setPixel(x, y, M.COAL);
            }
        }
        // Acid puddle at the bottom
        drawRect(width * 0.3, height - 6, 30, 5, M.ACID);
        // Random termites
        for (let i = 0; i < 20; i++) setPixel(Math.random() * width, Math.random() * height, M.TERMITE);
    }
    else if (type === 'labyrinth') {
        // Enriched Labyrinth: Procedurally generated maze with wood paths and stone walls
        // 1. Fill background with stone
        drawRect(0, 0, width, height, M.STONE);

        // 2. Setup Maze Grid
        const cellSize = 10;
        const gridW = Math.floor(width / cellSize);
        const gridH = Math.floor(height / cellSize);

        const mazeCols = Math.floor((gridW - 1) / 2) * 2 + 1;
        const mazeRows = Math.floor((gridH - 1) / 2) * 2 + 1;

        const maze = Array.from({ length: mazeRows }, () => new Int8Array(mazeCols).fill(0));

        // 3. Recursive Backtracking Algorithm
        const stack = [];
        const start = { x: 1, y: 1 };
        maze[start.y][start.x] = 1;
        stack.push(start);

        const dirs = [
            { x: 0, y: -2 }, { x: 0, y: 2 }, { x: -2, y: 0 }, { x: 2, y: 0 }
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];

            for (const d of dirs) {
                const nx = current.x + d.x;
                const ny = current.y + d.y;
                if (nx > 0 && nx < mazeCols - 1 && ny > 0 && ny < mazeRows - 1 && maze[ny][nx] === 0) {
                    neighbors.push({ x: nx, y: ny });
                }
            }

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                maze[current.y + (next.y - current.y) / 2][current.x + (next.x - current.x) / 2] = 1;
                maze[next.y][next.x] = 1;
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        // 4. Draw Maze to World
        const offsetX = Math.floor((width - mazeCols * cellSize) / 2);
        const offsetY = Math.floor((height - mazeRows * cellSize) / 2);

        for (let y = 0; y < mazeRows; y++) {
            for (let x = 0; x < mazeCols; x++) {
                if (maze[y][x] === 1) {
                    drawRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize, M.WOOD);
                }
            }
        }

        // 5. Create Entry and Exit
        drawRect(offsetX + cellSize, 0, cellSize, offsetY + cellSize, M.WOOD);
        drawRect(offsetX + (mazeCols - 2) * cellSize, offsetY + (mazeRows - 1) * cellSize, cellSize, height - (offsetY + (mazeRows - 1) * cellSize), M.WOOD);

        // Termite clusters
        for (let i = 0; i < 5; i++) {
            const tx = Math.floor(Math.random() * (mazeCols - 2)) + 1;
            const ty = Math.floor(Math.random() * (mazeRows - 2)) + 1;
            if (maze[ty][tx] === 1) setPixel(offsetX + tx * cellSize + 5, offsetY + ty * cellSize + 5, M.TERMITE);
        }
    }
}
