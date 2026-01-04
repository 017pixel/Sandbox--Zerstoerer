// =============================================================================
// sb-physics.js - Physics for Infinite World (Chunk-based)
// =============================================================================
// Uses ChunkEngine for all world access. Only simulates active/visible chunks.

let physicsFrameCount = 0;
let cachedWarningEl = null;
let cachedTimerEl = null;

function updatePhysics() {
    let activeParticles = 0;
    globalTime += 0.1;
    physicsFrameCount++;
    let currentlyHasUranium = false;

    // Calculate visible world range
    const viewWidth = width / zoom;
    const worldStartX = Math.floor(cameraX) - CHUNK_WIDTH; // Buffer
    const worldEndX = Math.ceil(cameraX + viewWidth) + CHUNK_WIDTH;

    // Get active chunk indices
    const activeChunks = ChunkEngine.getActiveChunkIndices(worldStartX, worldEndX);

    // 0. MELTDOWN MANAGEMENT
    if (!cachedWarningEl) cachedWarningEl = document.getElementById('meltdownWarning');
    if (!cachedTimerEl) cachedTimerEl = document.getElementById('meltdownTimer');

    if (meltdownActive) {
        meltdownTimer -= 1 * (simulationSpeed / 0.4);
        if (cachedWarningEl) {
            cachedWarningEl.classList.remove('hidden');
            cachedTimerEl.innerText = (Math.max(0, meltdownTimer / 60)).toFixed(1) + 's';
        }
        const globalPulse = Math.sin(globalTime * 2) * 50 + 50;
        if (random() < 0.1) {
            // Apply pulse to some random visible cells
            for (const chunkX of activeChunks) {
                const chunk = ChunkEngine.chunks.get(chunkX);
                if (!chunk) continue;
                for (let i = 0; i < chunk.grid.length; i += 10) {
                    if (chunk.grid[i] !== M.AIR) {
                        chunk.heatMap[i] = Math.max(chunk.heatMap[i], globalPulse);
                    }
                }
            }
        }
    } else {
        if (cachedWarningEl) cachedWarningEl.classList.add('hidden');
    }

    // Process each active chunk
    for (const chunkX of activeChunks) {
        const chunk = ChunkEngine.ensureChunk(chunkX);
        const baseWorldX = chunkX * CHUNK_WIDTH;

        // 1. HEATMAP & ELECTRONICS (Throttled)
        if (physicsFrameCount % 3 === 0) {
            for (let localX = 0; localX < CHUNK_WIDTH; localX++) {
                const worldX = baseWorldX + localX;
                for (let y = 0; y < height; y++) { // Electronics needs y=0 too, Heat usually skips y=0 but it's fine
                    const idx = y * CHUNK_WIDTH + localX;
                    const cell = chunk.grid[idx];

                    // --- ELECTRONICS ---
                    // Simple conduction logic
                    if (cell === M.BATTERY) {
                        chunk.wireMap[idx] = 255;
                    } else if (cell === M.WIRE || cell === M.LAMP || cell === M.BOOSTER) {
                        // Get max neighbor energy
                        let maxE = 0;

                        // Left
                        if (localX > 0) maxE = Math.max(maxE, chunk.wireMap[idx - 1]);
                        else maxE = Math.max(maxE, ChunkEngine.getWire(worldX - 1, y));

                        // Right
                        if (localX < CHUNK_WIDTH - 1) maxE = Math.max(maxE, chunk.wireMap[idx + 1]);
                        else maxE = Math.max(maxE, ChunkEngine.getWire(worldX + 1, y));

                        // Up
                        if (y > 0) maxE = Math.max(maxE, chunk.wireMap[idx - CHUNK_WIDTH]);

                        // Down
                        if (y < height - 1) maxE = Math.max(maxE, chunk.wireMap[idx + CHUNK_WIDTH]);

                        // 3x Range: Decay 2 per update (255 / 2 = ~127 pixels/steps)
                        if (cell === M.BOOSTER) {
                            // Threshold lowered to allow longer distance between boosters
                            if (maxE > 100) {
                                chunk.wireMap[idx] = 255;
                            } else {
                                chunk.wireMap[idx] = Math.max(0, maxE - 10);
                            }
                        } else {
                            // Wire/Lamp decay: 2 instead of 8 for 3x distance
                            chunk.wireMap[idx] = Math.max(0, maxE - 2);
                        }
                    } else {
                        // Insulation
                        if (chunk.wireMap[idx] > 0) chunk.wireMap[idx] = 0;
                    }

                    // --- HEAT LOGIC ---
                    if (y === 0) continue; // Skip heat for top row (legacy protection)

                    if (cell === M.FIRE || (cell === M.COAL && chunk.heatMap[idx] > 200)) {
                        chunk.heatMap[idx] = 255;
                        continue;
                    }

                    let windOffset = 0;
                    if (fireChaos < 0.1) {
                        if (random() < 0.05 + Math.sin(globalTime) * 0.05) windOffset = (random() > 0.5 ? 1 : -1);
                    } else {
                        const chaosFactor = fireChaos;
                        const rand = random();
                        if (rand < 0.3 * chaosFactor) windOffset = (random() > 0.5) ? 1 : -1;
                        else { if (rand < 0.4) windOffset = 0; else if (rand < 0.7) windOffset = -1; else windOffset = 1; }
                    }

                    const srcWorldX = baseWorldX + localX + windOffset;
                    const srcY = y + 1;
                    if (srcY < height) {
                        let decay = (fireChaos < 0.1) ? 2 : Math.floor(random() * 3);
                        if (fireChaos >= 0.1 && random() < (0.2 * fireChaos)) decay += random() * 10;
                        decay = decay / fireIntensity;
                        const srcHeat = ChunkEngine.getHeat(srcWorldX, srcY);
                        let newHeat = srcHeat - decay;
                        chunk.heatMap[idx] = Math.max(0, newHeat);
                    } else {
                        chunk.heatMap[idx] = 0;
                    }

                    if (cell === M.WATER || cell === M.STONE || cell === M.BEDROCK) {
                        chunk.heatMap[idx] = 0;
                    }
                }
            }
        }

        // 2. PASS 1 (UPWARD - FIREWORK, STEAM, METHANE, LIGHTNING)
        for (let y = 0; y < height; y++) {
            const dir = random() > 0.5 ? 1 : -1;
            for (let i = 0; i < CHUNK_WIDTH; i++) {
                const localX = (dir === 1) ? i : (CHUNK_WIDTH - 1 - i);
                const worldX = baseWorldX + localX;
                const idx = y * CHUNK_WIDTH + localX;
                const type = chunk.grid[idx];

                if (type === M.AIR || type === M.BEDROCK) continue;

                if (type === M.FIREWORK) {
                    if (chunk.fireworkVel[idx] === 0) chunk.fireworkVel[idx] = 240 + Math.floor(random() * 30);
                    const life = chunk.fireworkVel[idx];
                    chunk.fireworkVel[idx] = life - 1;
                    if (life > 1 && y > 2) {
                        if (random() < 0.6) {
                            const aboveY = y - 1;
                            const above = ChunkEngine.getV(worldX, aboveY);
                            if (above === M.AIR || above === M.VINE || above === M.FIREWORK || above === M.SPARK) {
                                ChunkEngine.setV(worldX, aboveY, M.FIREWORK);
                                ChunkEngine.setFireworkVel(worldX, aboveY, life - 1);
                                chunk.grid[idx] = M.AIR;
                                chunk.fireworkVel[idx] = 0;
                            }
                        }
                    } else {
                        chunk.grid[idx] = M.AIR;
                        chunk.fireworkVel[idx] = 0;
                        AudioEngine.play('firework', 0.6);
                        const color = Math.floor(random() * 0xFFFFFF);
                        for (let ey = -6; ey <= 6; ey++) {
                            for (let ex = -6; ex <= 6; ex++) {
                                if (ex * ex + ey * ey <= 36 && random() < 0.5) {
                                    const sx = worldX + ex, sy = y + ey;
                                    if (sy >= 0 && sy < height && ChunkEngine.getV(sx, sy) === M.AIR) {
                                        ChunkEngine.setV(sx, sy, M.SPARK);
                                        ChunkEngine.setSparkColor(sx, sy, color);
                                        ChunkEngine.setHeat(sx, sy, 160 + random() * 95);
                                    }
                                }
                            }
                        }
                    }
                } else if (type === M.STEAM) {
                    if (y > 0 && ChunkEngine.getV(worldX, y - 1) === M.AIR) {
                        ChunkEngine.setV(worldX, y - 1, M.STEAM);
                        chunk.grid[idx] = M.AIR;
                    } else if (random() < 0.05) {
                        chunk.grid[idx] = M.AIR;
                    }
                } else if (type === M.METHANE) {
                    let ignite = (chunk.heatMap[idx] > 50);
                    if (!ignite) {
                        const neighbors = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                        for (const [nx, ny] of neighbors) {
                            const nType = ChunkEngine.getV(nx, ny);
                            if ([M.FIRE, M.SPARK, M.LAVA, M.LIGHTNING, M.EMBER].includes(nType)) {
                                ignite = true;
                                break;
                            }
                        }
                    }
                    if (ignite) {
                        chunk.grid[idx] = M.FIRE;
                        chunk.heatMap[idx] = 255;
                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                const bx = worldX + dx, by = y + dy;
                                const bt = ChunkEngine.getV(bx, by);
                                if (bt === M.METHANE) {
                                    ChunkEngine.setV(bx, by, M.FIRE);
                                    ChunkEngine.setHeat(bx, by, 255);
                                } else if ((bt === M.WOOD || bt === M.TERMITE) && random() < 0.3) {
                                    ChunkEngine.setV(bx, by, M.FIRE);
                                    ChunkEngine.setHeat(bx, by, 255);
                                }
                            }
                        }
                    } else {
                        if (y > 0) {
                            if (ChunkEngine.getV(worldX, y - 1) === M.AIR) {
                                ChunkEngine.setV(worldX, y - 1, M.METHANE);
                                chunk.grid[idx] = M.AIR;
                            } else if (random() < 0.5) {
                                const sideX = worldX + (random() < 0.5 ? 1 : -1);
                                if (ChunkEngine.getV(sideX, y) === M.AIR) {
                                    ChunkEngine.setV(sideX, y, M.METHANE);
                                    chunk.grid[idx] = M.AIR;
                                }
                            }
                        }
                    }
                } else if (type === M.LIGHTNING) {
                    chunk.grid[idx] = M.AIR;
                    // Lightning strike
                    let curY = y;
                    let curX = worldX;
                    let energy = height;
                    while (energy > 0 && curY < height) {
                        ChunkEngine.setV(curX, curY, M.SPARK);
                        ChunkEngine.setSparkColor(curX, curY, 0xFFFFFF);
                        ChunkEngine.setHeat(curX, curY, 255);
                        const below = ChunkEngine.getV(curX, curY + 1);
                        if (below !== M.AIR && below !== M.METHANE && below !== M.STEAM && below !== M.SPARK && below !== M.LIGHTNING) {
                            if (below === M.WATER) {
                                ChunkEngine.setV(curX, curY + 1, M.STEAM);
                            } else {
                                ChunkEngine.setV(curX, curY + 1, M.STONE);
                                ChunkEngine.setV(curX, curY, M.EMBER);
                            }
                            ChunkEngine.setHeat(curX, curY + 1, 255);
                            break;
                        } else if (below === M.METHANE) {
                            ChunkEngine.setV(curX, curY + 1, M.FIRE);
                            ChunkEngine.setHeat(curX, curY + 1, 255);
                        }
                        const r = random();
                        if (r < 0.2) curX -= 1;
                        else if (r < 0.4) curX += 1;
                        curY++;
                        energy--;
                    }
                }
            }
        }

        // 3. PASS 2 (DOWNWARD - SAND, WATER, LAVA, TNT, etc.)
        for (let y = height - 1; y >= 0; y--) {
            const dir = random() > 0.5 ? 1 : -1;
            for (let i = 0; i < CHUNK_WIDTH; i++) {
                const localX = (dir === 1) ? i : (CHUNK_WIDTH - 1 - i);
                const worldX = baseWorldX + localX;
                const idx = y * CHUNK_WIDTH + localX;
                const type = chunk.grid[idx];

                if (type === M.AIR || type === M.BEDROCK) continue;
                activeParticles++;

                if (type === M.FIRE) {
                    const below = ChunkEngine.getV(worldX, y + 1);
                    if (y < height - 1 && below === M.AIR) {
                        ChunkEngine.setV(worldX, y + 1, M.FIRE);
                        chunk.grid[idx] = M.AIR;
                        continue;
                    }
                    const spreads = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
                    for (const [dx, dy] of spreads) {
                        const nx = worldX + dx, ny = y + dy;
                        const nType = ChunkEngine.getV(nx, ny);
                        if (nType === M.WOOD || nType === M.LEAVES || nType === M.VINE || nType === M.COAL || nType === M.EMBER) {
                            let chance = 0.15 * fireIntensity;
                            if (dy === 1) chance *= 2;
                            if (Math.abs(dx) === 1 && dy === 0) chance *= 1.5;
                            if (random() < chance) {
                                if (nType === M.COAL) {
                                    ChunkEngine.setHeat(nx, ny, 255);
                                } else {
                                    ChunkEngine.setV(nx, ny, M.FIRE);
                                    ChunkEngine.setHeat(nx, ny, 255);
                                }
                                AudioEngine.play('fire', 0.3);
                            }
                        } else if (nType === M.WATER) {
                            ChunkEngine.setV(nx, ny, M.STEAM);
                            if (random() < 0.5) chunk.grid[idx] = M.AIR;
                        }
                    }
                    if (random() < 0.75) {
                        const sideX = worldX + (random() > 0.5 ? 1 : -1);
                        if (ChunkEngine.getV(sideX, y) === M.AIR) {
                            ChunkEngine.setV(sideX, y, M.FIRE);
                            chunk.grid[idx] = M.AIR;
                        }
                    }
                    if (random() < 0.25) chunk.grid[idx] = (random() > 0.3) ? M.STEAM : M.AIR;
                }
                else if (type === M.SAND) {
                    if (y < height - 1) {
                        const below = ChunkEngine.getV(worldX, y + 1);
                        if (below === M.AIR || below === M.WATER) {
                            chunk.grid[idx] = (below === M.WATER) ? M.WATER : M.AIR;
                            ChunkEngine.setV(worldX, y + 1, M.SAND);
                        } else if (ChunkEngine.getV(worldX - 1, y + 1) === M.AIR) {
                            ChunkEngine.setV(worldX - 1, y + 1, M.SAND);
                            chunk.grid[idx] = M.AIR;
                        } else if (ChunkEngine.getV(worldX + 1, y + 1) === M.AIR) {
                            ChunkEngine.setV(worldX + 1, y + 1, M.SAND);
                            chunk.grid[idx] = M.AIR;
                        }
                    }
                }
                else if (type === M.WATER) {
                    if (chunk.heatMap[idx] > 200) {
                        chunk.grid[idx] = M.STEAM;
                        continue;
                    }
                    if (y < height - 1) {
                        const below = ChunkEngine.getV(worldX, y + 1);
                        if (below === M.AIR) {
                            ChunkEngine.setV(worldX, y + 1, M.WATER);
                            chunk.grid[idx] = M.AIR;
                        } else {
                            let fD = chunk.liquidDir[idx] || (random() < 0.5 ? 1 : -1);
                            const nextX = worldX + fD;
                            if (ChunkEngine.getV(nextX, y) === M.AIR) {
                                ChunkEngine.setV(nextX, y, M.WATER);
                                ChunkEngine.setLiquidDir(nextX, y, fD);
                                chunk.grid[idx] = M.AIR;
                                AudioEngine.play('water', 0.2);
                            } else {
                                chunk.liquidDir[idx] = -fD;
                            }
                        }
                    }
                }
                else if (type === M.LAVA) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = worldX + dx, ny = y + dy;
                            const nt = ChunkEngine.getV(nx, ny);
                            if ([M.WOOD, M.LEAVES, M.VINE, M.TERMITE].includes(nt) && random() < 0.02) {
                                ChunkEngine.setV(nx, ny, M.FIRE);
                                ChunkEngine.setHeat(nx, ny, 255);
                            }
                            if (nt === M.WATER) {
                                chunk.grid[idx] = M.STONE;
                                ChunkEngine.setV(nx, ny, M.STEAM);
                            }
                        }
                    }
                    if (random() < 0.16 && y < height - 1) {
                        const below = ChunkEngine.getV(worldX, y + 1);
                        if (below === M.AIR) {
                            ChunkEngine.setV(worldX, y + 1, M.LAVA);
                            chunk.grid[idx] = M.AIR;
                        } else {
                            let fD = chunk.liquidDir[idx] || (random() < 0.5 ? 1 : -1);
                            const nextX = worldX + fD;
                            if (ChunkEngine.getV(nextX, y) === M.AIR) {
                                ChunkEngine.setV(nextX, y, M.LAVA);
                                ChunkEngine.setLiquidDir(nextX, y, fD);
                                chunk.grid[idx] = M.AIR;
                            } else {
                                chunk.liquidDir[idx] = -fD;
                            }
                        }
                    }
                }
                else if (type === M.TNT) {
                    const below = ChunkEngine.getV(worldX, y + 1);
                    if (y < height - 1 && below === M.AIR) {
                        ChunkEngine.setV(worldX, y + 1, M.TNT);
                        chunk.grid[idx] = M.AIR;
                        continue;
                    }
                    let trig = (chunk.heatMap[idx] > 50);
                    if (!trig) {
                        const neighbors = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                        for (const [nx, ny] of neighbors) {
                            const nt = ChunkEngine.getV(nx, ny);
                            if ([M.FIRE, M.SPARK, M.LAVA, M.EMBER, M.LIGHTNING].includes(nt)) {
                                trig = true;
                                break;
                            }
                        }
                    }
                    if (trig) {
                        const r = 10, rSq = r * r;
                        for (let dy = -r; dy <= r; dy++) {
                            for (let dx = -r; dx <= r; dx++) {
                                const d = dx * dx + dy * dy;
                                const tx = worldX + dx, ty = y + dy;
                                if (ty >= 0 && ty < height) {
                                    const tt = ChunkEngine.getV(tx, ty);
                                    if (tt === M.BEDROCK) continue; // Bedrock indestructible
                                    if (tt === M.CONCRETE) {
                                        if (d < rSq * 0.3) ChunkEngine.setV(tx, ty, M.AIR);
                                        continue;
                                    }
                                    if (d <= rSq) {
                                        ChunkEngine.setV(tx, ty, M.AIR);
                                        ChunkEngine.setHeat(tx, ty, 255);
                                    }
                                }
                            }
                        }
                        AudioEngine.play('tnt');
                    }
                }
                else if (type === M.URANIUM) {
                    currentlyHasUranium = true;
                    const below = ChunkEngine.getV(worldX, y + 1);
                    if (y < height - 1 && below === M.AIR) {
                        ChunkEngine.setV(worldX, y + 1, M.URANIUM);
                        chunk.grid[idx] = M.AIR;
                        continue;
                    }
                    const pulse = Math.sin(globalTime * 3) * 40 + 40;
                    chunk.heatMap[idx] = Math.max(chunk.heatMap[idx], pulse);
                    if (pulse > 75) AudioEngine.play('uranium_pulse', 0.3);
                    if (random() < 0.2) {
                        const neighbors = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                        for (const [nx, ny] of neighbors) {
                            const nh = ChunkEngine.getHeat(nx, ny);
                            if (nh < 220) ChunkEngine.setHeat(nx, ny, Math.min(220, nh + 2));
                        }
                    }
                    if (!meltdownActive) {
                        if (chunk.heatMap[idx] >= 250 || random() < (0.0002 * (simulationSpeed / 0.4))) {
                            meltdownActive = true;
                            meltdownTimer = 600;
                        }
                    }
                    if (meltdownActive) {
                        const pulseDist = Math.sin(globalTime * 6) * 25 + 25;
                        const rx = worldX + Math.floor((random() - 0.5) * pulseDist);
                        const ry = y + Math.floor((random() - 0.5) * pulseDist);
                        const rt = ChunkEngine.getV(rx, ry);
                        if (rt !== M.AIR && rt !== M.URANIUM && rt !== M.BEDROCK && random() < 0.2) {
                            ChunkEngine.setV(rx, ry, M.LAVA);
                            ChunkEngine.setHeat(rx, ry, 255);
                        }
                        if (meltdownTimer <= 0) {
                            const r = 60, rSq = r * r;
                            for (let dy = -r; dy <= r; dy++) {
                                for (let dx = -r; dx <= r; dx++) {
                                    const d2 = dx * dx + dy * dy;
                                    const tx = worldX + dx, ty = y + dy;
                                    if (ty >= 0 && ty < height) {
                                        const tt = ChunkEngine.getV(tx, ty);
                                        if (tt === M.BEDROCK) continue;
                                        if (d2 < rSq * 0.5) ChunkEngine.setV(tx, ty, M.AIR);
                                        else if (random() < 0.8) ChunkEngine.setV(tx, ty, M.LAVA);
                                        ChunkEngine.setHeat(tx, ty, 255);
                                    }
                                }
                            }
                            chunk.grid[idx] = M.AIR;
                            AudioEngine.play('explosion', 1.5);
                        }
                    }
                }
                else if (type === M.ACID) {
                    if (y < height - 1) {
                        const below = ChunkEngine.getV(worldX, y + 1);
                        if (below === M.AIR) {
                            ChunkEngine.setV(worldX, y + 1, M.ACID);
                            chunk.grid[idx] = M.AIR;
                        } else if (below !== M.ACID && below !== M.BEDROCK) {
                            if (below === M.CONCRETE) {
                                if (random() < 0.02) {
                                    ChunkEngine.setV(worldX, y + 1, M.AIR);
                                    chunk.grid[idx] = M.AIR;
                                }
                            } else {
                                ChunkEngine.setV(worldX, y + 1, M.AIR);
                                if (random() < 0.15) chunk.grid[idx] = M.AIR;
                            }
                        }
                    } else {
                        let fD = chunk.liquidDir[idx] || (random() < 0.5 ? 1 : -1);
                        const nextX = worldX + fD;
                        if (ChunkEngine.getV(nextX, y) === M.AIR) {
                            ChunkEngine.setV(nextX, y, M.ACID);
                            ChunkEngine.setLiquidDir(nextX, y, fD);
                            chunk.grid[idx] = M.AIR;
                        } else {
                            chunk.liquidDir[idx] = -fD;
                        }
                    }
                }
                else if (type === M.TERMITE) {
                    const below = ChunkEngine.getV(worldX, y + 1);
                    const touchW = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]].some(
                        ([nx, ny]) => [M.WOOD, M.LEAVES, M.VINE].includes(ChunkEngine.getV(nx, ny))
                    );
                    if (y < height - 1 && below === M.AIR && (!touchW || random() < 0.1)) {
                        ChunkEngine.setV(worldX, y + 1, M.TERMITE);
                        chunk.grid[idx] = M.AIR;
                        continue;
                    }
                    if (random() < 0.6) {
                        const r = random();
                        let mx = 0, my = 1;
                        if (r < 0.45) { mx = 0; my = 1; }
                        else if (r < 0.75) { mx = random() < 0.5 ? 1 : -1; my = 0; }
                        else { mx = touchW ? 0 : (random() < 0.5 ? 1 : -1); my = touchW ? -1 : 0; }
                        const dx = worldX + mx, dy = y + my;
                        if (dy >= 0 && dy < height) {
                            const dt = ChunkEngine.getV(dx, dy);
                            if ([M.WOOD, M.LEAVES, M.VINE].includes(dt)) {
                                ChunkEngine.setV(dx, dy, M.TERMITE);
                                chunk.grid[idx] = M.AIR;
                                if (random() < 0.1) chunk.grid[idx] = M.METHANE;
                            } else if (dt === M.AIR && random() < 0.15) {
                                ChunkEngine.setV(dx, dy, M.TERMITE);
                                chunk.grid[idx] = M.AIR;
                            }
                        }
                    }
                }
                else if (type === M.VINE) {
                    if (chunk.heatMap[idx] > 80) {
                        chunk.grid[idx] = M.FIRE;
                        chunk.heatMap[idx] = 200;
                        continue;
                    }
                    if (random() < 0.015) {
                        const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
                        const [dx, dy] = dirs[Math.floor(random() * dirs.length)];
                        const nx = worldX + dx, ny = y + dy;
                        if (ny >= 0 && ny < height && ChunkEngine.getV(nx, ny) === M.AIR) {
                            ChunkEngine.setV(nx, ny, M.VINE);
                            AudioEngine.play('vine', 0.4);
                        }
                    }
                }
                else if (type === M.ICE) {
                    if (chunk.heatMap[idx] > 30) chunk.grid[idx] = M.WATER;
                    if (random() < 0.05) {
                        const nx = worldX + (random() < 0.5 ? 1 : -1);
                        const nh = ChunkEngine.getHeat(nx, y);
                        ChunkEngine.setHeat(nx, y, Math.max(0, nh - 10));
                    }
                }
                else if (type === M.COAL) {
                    if (chunk.heatMap[idx] > 200) {
                        chunk.heatMap[idx] = 255;
                        if (random() < 0.05) {
                            const sides = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                            const [sx, sy] = sides[Math.floor(random() * sides.length)];
                            if (ChunkEngine.getV(sx, sy) === M.AIR) ChunkEngine.setV(sx, sy, M.FIRE);
                        }
                    }
                }
                else if (type === M.EMBER) {
                    if (random() < 0.02) {
                        const neighbors = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                        const [nx, ny] = neighbors[Math.floor(random() * neighbors.length)];
                        const nt = ChunkEngine.getV(nx, ny);
                        if (nt === M.AIR && random() < 0.1) ChunkEngine.setV(nx, ny, M.FIRE);
                        else if ([M.WOOD, M.LEAVES, M.VINE, M.COAL].includes(nt)) {
                            ChunkEngine.setHeat(nx, ny, Math.min(255, ChunkEngine.getHeat(nx, ny) + 50));
                        }
                    }
                    if (random() < 0.1) {
                        const neighbors = [[worldX - 1, y], [worldX + 1, y], [worldX, y - 1], [worldX, y + 1]];
                        for (const [nx, ny] of neighbors) {
                            if (ChunkEngine.getV(nx, ny) === M.FIRE) {
                                chunk.grid[idx] = M.COAL;
                                chunk.heatMap[idx] = 255;
                                break;
                            }
                        }
                    }
                }
                else if (type === M.SPARK) {
                    chunk.heatMap[idx] -= 6;
                    if (chunk.heatMap[idx] <= 0 || random() < 0.05) {
                        chunk.grid[idx] = M.AIR;
                        chunk.sparkColors[idx] = 0;
                    } else {
                        const below = ChunkEngine.getV(worldX, y + 1);
                        if (y < height - 1 && below === M.AIR && random() < 0.3) {
                            ChunkEngine.setV(worldX, y + 1, M.SPARK);
                            ChunkEngine.setSparkColor(worldX, y + 1, chunk.sparkColors[idx]);
                            ChunkEngine.setHeat(worldX, y + 1, chunk.heatMap[idx]);
                            chunk.grid[idx] = M.AIR;
                        }
                    }
                }
                else if (type === M.WOOD || type === M.LEAVES) {
                    if (chunk.heatMap[idx] > 120 && random() < 0.02) {
                        chunk.grid[idx] = M.FIRE;
                        chunk.heatMap[idx] = 255;
                    }
                }
            }
        }
    }

    // Meltdown logic
    if (currentlyHasUranium && !meltdownActive) {
        if (random() < (0.0005 * (simulationSpeed / 0.4))) {
            meltdownActive = true;
            meltdownTimer = 600;
        }
    }
    if (!currentlyHasUranium && meltdownActive && meltdownTimer <= 0) {
        meltdownActive = false;
    }

    entDisplay.innerText = activeParticles;
}
