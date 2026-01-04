// =============================================================================
// sb-world.js - World Scenarios for Infinite World
// =============================================================================
// Scenarios generate content in a fixed area around cameraX (0).
// For infinite world, these serve as "spawn" areas.

function toggleWorlds() {
    document.getElementById('worldsPanel').classList.toggle('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function loadWorld(type) {
    resetWorld();
    document.getElementById('worldsPanel').classList.add('hidden');

    // Reset camera to origin for scenarios
    cameraX = 0;

    // Use viewport width for scenario generation
    const genWidth = width;

    if (type === 'forest') {
        for (let x = 0; x < genWidth; x++) {
            const groundY = height - 25 + Math.sin(x * 0.1) * 8 + Math.cos(x * 0.05) * 5;
            for (let y = Math.floor(groundY); y < height - BEDROCK_DEPTH; y++) {
                const mat = y > groundY + 5 ? M.STONE : M.SAND;
                setPixel(x, y, mat);
            }
            setPixel(x, Math.floor(groundY), M.VINE);

            if (Math.random() < 0.08 && x > 5 && x < genWidth - 5) {
                drawTree(x, Math.floor(groundY));
                if (Math.random() < 0.4) {
                    for (let i = 0; i < 5; i++) {
                        setPixel(x + (Math.random() - 0.5) * 4, Math.floor(groundY) - 2 - Math.random() * 5, M.TERMITE);
                    }
                }
            }
        }
        drawCircle(Math.floor(genWidth * 0.3), height - BEDROCK_DEPTH - 5, 5, M.METHANE);
    }
    else if (type === 'village') {
        drawRect(0, height - BEDROCK_DEPTH - 15, genWidth, 15, M.STONE);

        drawTree(Math.floor(genWidth * 0.1), height - BEDROCK_DEPTH - 15);
        drawTree(Math.floor(genWidth * 0.35), height - BEDROCK_DEPTH - 15);
        drawTree(Math.floor(genWidth * 0.65), height - BEDROCK_DEPTH - 15);
        drawTree(Math.floor(genWidth * 0.9), height - BEDROCK_DEPTH - 15);

        const housePositions = [0.25, 0.7];
        housePositions.forEach(pos => {
            const hx = Math.floor(genWidth * pos);
            const hy = height - BEDROCK_DEPTH - 15;

            drawRect(hx - 10, hy - 20, 20, 20, M.WOOD);
            drawRect(hx - 2, hy - 5, 4, 3, M.TNT);
            for (let d = 0; d < 12; d++) {
                drawRect(hx - 12 + d, hy - 20 - d, 24 - (d * 2), 1, M.CONCRETE);
            }
            drawRect(hx - 2, hy - 10, 4, 10, M.AIR);

            setPixel(hx + 12, hy - 15, M.STONE);
            drawRect(hx + 12, hy - 14, 1, 14, M.STONE);
            setPixel(hx + 12, hy - 16, M.METHANE);
        });

        for (let i = 0; i < 10; i++) {
            setPixel(10 + Math.random() * 20, height - BEDROCK_DEPTH - 16, M.TERMITE);
        }
    }
    else if (type === 'island') {
        const waterLevel = height - BEDROCK_DEPTH - 20;
        drawRect(0, waterLevel, genWidth, 20, M.WATER);

        const getIslandY = (x) => {
            const dx = (x - genWidth / 2) * 0.8;
            const dy = (dx * dx) / 60;
            return height - BEDROCK_DEPTH - 40 + dy;
        };

        for (let x = 0; x < genWidth; x++) {
            const groundY = getIslandY(x);
            if (groundY < height - BEDROCK_DEPTH) {
                for (let y = Math.floor(groundY); y < height - BEDROCK_DEPTH; y++) {
                    const mat = y < groundY + 12 ? M.SAND : M.STONE;
                    setPixel(x, y, mat);
                }
            }
        }

        [0.35, 0.5, 0.65].forEach(xp => {
            const hx = Math.floor(genWidth * xp);
            const hy = Math.floor(getIslandY(hx));

            if (hy < height - BEDROCK_DEPTH) {
                const trunkH = 20 + Math.random() * 10;
                for (let i = 0; i < trunkH; i++) {
                    const offset = Math.sin(i * 0.2) * 2;
                    setPixel(hx + offset, hy - i, M.WOOD);
                    setPixel(hx + offset + 1, hy - i, M.WOOD);
                }

                const topY = hy - trunkH;
                const topX = hx + Math.sin(trunkH * 0.2) * 2;

                for (let deg = 0; deg < 360; deg += 45) {
                    const rad = deg * Math.PI / 180;
                    for (let r = 0; r < 8; r++) {
                        setPixel(topX + Math.cos(rad) * r, topY + Math.sin(rad) * r, M.LEAVES);
                    }
                }
                setPixel(topX, topY + 1, M.COAL);
            }
        });
    }
    else if (type === 'volcano') {
        for (let x = 0; x < genWidth; x++) {
            const dx = Math.abs(x - genWidth / 2);
            const h = 80 - dx * 0.9;
            if (h > 0) {
                for (let y = height - BEDROCK_DEPTH - h; y < height - BEDROCK_DEPTH; y++) {
                    const mat = Math.random() < 0.1 ? M.COAL : M.STONE;
                    setPixel(x, y, mat);
                }
                if (Math.random() < 0.3) setPixel(x, height - BEDROCK_DEPTH - h, M.EMBER);
            }
        }
        drawRect(Math.floor(genWidth / 2) - 4, height - BEDROCK_DEPTH - 80, 8, 70, M.LAVA);
        drawCircle(Math.floor(genWidth / 2), height - BEDROCK_DEPTH - 90, 6, M.METHANE);
    }
    else if (type === 'mine') {
        drawRect(0, 0, genWidth, height - BEDROCK_DEPTH, M.STONE);

        const shaftWidth = 12;
        [0.2, 0.5, 0.8].forEach(pos => {
            const sx = Math.floor(genWidth * pos);
            drawRect(sx - shaftWidth / 2, 0, shaftWidth, height - BEDROCK_DEPTH, M.AIR);

            for (let y = 10; y < height - BEDROCK_DEPTH; y += 30) {
                drawRect(sx - shaftWidth / 2, y, shaftWidth, 2, M.WOOD);
                setPixel(sx, y + 2, M.METHANE);
            }
        });

        [0.25, 0.5, 0.75].forEach(pos => {
            const sy = Math.floor((height - BEDROCK_DEPTH) * pos);
            drawRect(0, sy, genWidth, 8, M.AIR);

            for (let x = 15; x < genWidth; x += 40) {
                drawRect(x, sy, 2, 8, M.WOOD);
            }
        });

        drawRect(Math.floor(genWidth * 0.5) - 5, Math.floor((height - BEDROCK_DEPTH) * 0.5) + 5, 10, 5, M.TNT);
        drawCircle(Math.floor(genWidth * 0.1), Math.floor((height - BEDROCK_DEPTH) * 0.1), 8, M.METHANE);
        drawCircle(Math.floor(genWidth * 0.9), Math.floor((height - BEDROCK_DEPTH) * 0.8), 6, M.METHANE);

        for (let i = 0; i < 30; i++) {
            const rx = Math.random() * genWidth;
            const ry = Math.random() * (height - BEDROCK_DEPTH);
            if (ChunkEngine.getV(Math.floor(rx), Math.floor(ry)) === M.WOOD) {
                setPixel(rx, ry, M.TERMITE);
            }
        }
    }
    else if (type === 'ice') {
        const waterLvl = height - BEDROCK_DEPTH - 20;
        drawRect(0, waterLvl, genWidth, 20, M.WATER);

        const cx = Math.floor(genWidth / 2);
        const cy = waterLvl;

        drawRect(cx - 50, cy - 8, 100, 12, M.ICE);
        drawRect(cx - 40, cy - 12, 80, 4, M.ICE);

        drawRect(cx - 30, cy - 40, 60, 28, M.AIR);
        drawRect(cx - 35, cy - 40, 5, 30, M.ICE);
        drawRect(cx + 30, cy - 40, 5, 30, M.ICE);
        drawRect(cx - 35, cy - 45, 70, 5, M.ICE);

        [cx - 40, cx, cx + 40].forEach((tx, i) => {
            const h = i === 1 ? 50 : 35;
            drawRect(tx - 4, cy - 45 - h, 8, h, M.ICE);
            for (let j = 0; j < 5; j++) {
                drawRect(tx - 2 + j / 2, cy - 45 - h - j * 2, 4 - j, 2, M.ICE);
            }
        });

        for (let a = 0; a < 3; a++) {
            const ax = cx - 20 + a * 20;
            drawRect(ax, cy - 12 - 15, 2, 15, M.ICE);
            drawRect(ax - 4, cy - 12 - 15, 10, 2, M.ICE);
        }

        for (let i = 0; i < 15; i++) {
            const sx = cx - 30 + Math.random() * 60;
            const sl = 3 + Math.random() * 8;
            drawRect(sx, cy - 40, 1, sl, M.ICE);
        }

        for (let i = 0; i < 60; i++) {
            setPixel(Math.random() * genWidth, Math.random() * 40, M.ICE);
        }

        for (let i = 0; i < 8; i++) {
            setPixel(cx - 45 + Math.random() * 90, cy + Math.random() * 5, M.METHANE);
        }
    }
    else if (type === 'cave') {
        drawRect(0, 0, genWidth, height - BEDROCK_DEPTH, M.STONE);
        for (let x = 0; x < genWidth; x++) {
            for (let y = 0; y < height - BEDROCK_DEPTH; y++) {
                const n = Math.sin(x * 0.08) + Math.sin(y * 0.08) + Math.cos((x + y) * 0.04);
                if (n > 0.6) setPixel(x, y, M.AIR);
                else if (n < -0.9) setPixel(x, y, M.COAL);
            }
        }
        drawRect(Math.floor(genWidth * 0.3), height - BEDROCK_DEPTH - 6, 30, 5, M.ACID);
        for (let i = 0; i < 20; i++) {
            setPixel(Math.random() * genWidth, Math.random() * (height - BEDROCK_DEPTH), M.TERMITE);
        }
    }
    else if (type === 'labyrinth') {
        drawRect(0, 0, genWidth, height - BEDROCK_DEPTH, M.STONE);

        const cellSize = 8;
        const gridW = Math.floor(genWidth / cellSize);
        const gridH = Math.floor((height - BEDROCK_DEPTH) / cellSize);

        const mazeCols = Math.floor((gridW - 2) / 2) * 2 + 1;
        const mazeRows = Math.floor((gridH - 2) / 2) * 2 + 1;

        const maze = Array.from({ length: mazeRows }, () => new Int8Array(mazeCols).fill(0));

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

        const mx = Math.floor((genWidth - mazeCols * cellSize) / 2);
        const my = Math.floor(((height - BEDROCK_DEPTH) - mazeRows * cellSize) / 2);

        for (let y = 0; y < mazeRows; y++) {
            for (let x = 0; x < mazeCols; x++) {
                if (maze[y][x] === 1) {
                    drawRect(mx + x * cellSize, my + y * cellSize, cellSize, cellSize, M.WOOD);
                }
            }
        }

        drawRect(mx + cellSize, 0, cellSize, my + cellSize, M.WOOD);
        const exitX = (mazeCols - 2) * cellSize;
        const exitY = (mazeRows - 1) * cellSize;
        drawRect(mx + exitX, my + exitY, cellSize, (height - BEDROCK_DEPTH) - (my + exitY), M.WOOD);

        const centerX = Math.floor(mazeCols / 2);
        const centerY = Math.floor(mazeRows / 2);
        drawRect(mx + (centerX - 1) * cellSize, my + (centerY - 1) * cellSize, cellSize * 3, cellSize * 3, M.WOOD);

        for (let i = 0; i < 20; i++) {
            const rx = Math.floor(Math.random() * (mazeCols - 2)) + 1;
            const ry = Math.floor(Math.random() * (mazeRows - 2)) + 1;

            if (maze[ry][rx] === 1) {
                const px = mx + rx * cellSize + Math.floor(cellSize / 2);
                const py = my + ry * cellSize + Math.floor(cellSize / 2);
                const r = Math.random();

                if (r < 0.2) {
                    setPixel(px, py, M.TNT);
                } else if (r < 0.4) {
                    drawCircle(px, py, 3, M.METHANE);
                } else if (r < 0.6) {
                    for (let t = 0; t < 5; t++) {
                        setPixel(px + (Math.random() - 0.5) * 4, py + (Math.random() - 0.5) * 4, M.TERMITE);
                    }
                } else if (r < 0.7) {
                    setPixel(px, py, M.COAL);
                }
            }
        }
    }
}
