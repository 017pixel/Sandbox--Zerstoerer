// =============================================================================
// sb-physics.js - Physics for Fixed World
// =============================================================================

let physicsFrameCount = 0;
let cachedWarningEl = null;
let cachedTimerEl = null;

function updatePhysics() {
    let activeParticles = 0;
    globalTime += 0.1;
    physicsFrameCount++;
    let currentlyHasUranium = false;

    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;
    const g = ChunkEngine.grid;
    const hMap = ChunkEngine.heatMap;
    const wMap = ChunkEngine.wireMap;

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
            for (let i = 0; i < g.length; i += 10) {
                if (g[i] !== M.AIR) {
                    hMap[i] = Math.max(hMap[i], globalPulse);
                }
            }
        }
    } else {
        if (cachedWarningEl) cachedWarningEl.classList.add('hidden');
    }

    // 1. HEATMAP & ELECTRONICS (every 3rd frame)
    if (physicsFrameCount % 3 === 0) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const idx = y * W + x;
                const cell = g[idx];

                // --- ELECTRONICS ---
                if (cell === M.BATTERY) {
                    wMap[idx] = 255;
                } else if (cell === M.WIRE || cell === M.LAMP || cell === M.BOOSTER) {
                    let maxE = 0;
                    if (x > 0) maxE = Math.max(maxE, wMap[idx - 1]);
                    if (x < W - 1) maxE = Math.max(maxE, wMap[idx + 1]);
                    if (y > 0) maxE = Math.max(maxE, wMap[idx - W]);
                    if (y < H - 1) maxE = Math.max(maxE, wMap[idx + W]);

                    if (cell === M.BOOSTER) {
                        if (maxE > 100) {
                            wMap[idx] = 255;
                        } else {
                            wMap[idx] = Math.max(0, maxE - 10);
                        }
                    } else {
                        wMap[idx] = Math.max(0, maxE - 2);
                    }
                } else if (cell === M.REDSTONE_TORCH) {
                    // Strom-Fackel: always outputs 255 (power source)
                    wMap[idx] = 255;
                } else if (cell === M.SENSOR) {
                    // Use liquidDir as timer, output full signal while active
                    const lq = ChunkEngine.liquidDir;
                    if (lq[idx] > 0) {
                        lq[idx]--;
                        wMap[idx] = 255;
                        if (lq[idx] === 0) wMap[idx] = 0;
                    }
                    let changed = false;
                    if (x > 0 && g[idx - 1] !== ChunkEngine.prevGrid[idx - 1]) changed = true;
                    else if (x < W - 1 && g[idx + 1] !== ChunkEngine.prevGrid[idx + 1]) changed = true;
                    else if (y > 0 && g[idx - W] !== ChunkEngine.prevGrid[idx - W]) changed = true;
                    else if (y < H - 1 && g[idx + W] !== ChunkEngine.prevGrid[idx + W]) changed = true;
                    if (changed) {
                        lq[idx] = 30;
                        wMap[idx] = 255;
                    }
                } else {
                    if (wMap[idx] > 0) wMap[idx] = 0;
                }

                // --- HEAT LOGIC ---
                if (y === 0) continue;

                if (cell === M.FIRE || (cell === M.COAL && hMap[idx] > 200)) {
                    hMap[idx] = 255;
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

                const srcX = x + windOffset;
                const srcY = y + 1;
                if (srcY < H) {
                    let decay = (fireChaos < 0.1) ? 2 : Math.floor(random() * 3);
                    if (fireChaos >= 0.1 && random() < (0.2 * fireChaos)) decay += random() * 10;
                    decay = decay / fireIntensity;
                    const srcHeat = ChunkEngine.getHeat(srcX, srcY);
                    let newHeat = srcHeat - decay;
                    if (cell === M.DETONATOR) {
                        hMap[idx] = Math.max(hMap[idx], Math.max(0, newHeat));
                    } else {
                        hMap[idx] = Math.max(0, newHeat);
                    }
                } else {
                    hMap[idx] = 0;
                }

                if (cell === M.WATER || cell === M.STONE || cell === M.BEDROCK) {
                    hMap[idx] = 0;
                }
            }
        }
        // Snapshot grid after sensor checks for next comparison
        ChunkEngine.snapshotGrid();
    }

    // 2. PASS 1 (UPWARD — FIREWORK, STEAM, METHANE, LIGHTNING)
    for (let y = 0; y < H; y++) {
        const dir = random() > 0.5 ? 1 : -1;
        for (let i = 0; i < W; i++) {
            const x = (dir === 1) ? i : (W - 1 - i);
            const idx = y * W + x;
            const type = g[idx];

            if (type === M.AIR || type === M.BEDROCK) continue;

            if (type === M.FIREWORK) {
                const fv = ChunkEngine.fireworkVel;
                if (fv[idx] === 0) fv[idx] = 240 + Math.floor(random() * 30);
                const life = fv[idx];
                fv[idx] = life - 1;
                if (life > 1 && y > 2) {
                    if (random() < 0.6) {
                        const aboveY = y - 1;
                        const above = ChunkEngine.getV(x, aboveY);
                        if (above === M.AIR || above === M.VINE || above === M.FIREWORK || above === M.SPARK) {
                            ChunkEngine.setV(x, aboveY, M.FIREWORK);
                            ChunkEngine.setFireworkVel(x, aboveY, life - 1);
                            g[idx] = M.AIR;
                            fv[idx] = 0;
                        }
                    }
                } else {
                    g[idx] = M.AIR;
                    fv[idx] = 0;
                    AudioEngine.play('firework', 0.6);
                    const color = Math.floor(random() * 0xFFFFFF);
                    for (let ey = -6; ey <= 6; ey++) {
                        for (let ex = -6; ex <= 6; ex++) {
                            if (ex * ex + ey * ey <= 36 && random() < 0.5) {
                                const sx = x + ex, sy = y + ey;
                                if (sy >= 0 && sy < H && ChunkEngine.getV(sx, sy) === M.AIR) {
                                    ChunkEngine.setV(sx, sy, M.SPARK);
                                    ChunkEngine.setSparkColor(sx, sy, color);
                                    ChunkEngine.setHeat(sx, sy, 160 + random() * 95);
                                }
                            }
                        }
                    }
                }
            } else if (type === M.STEAM) {
                if (y > 0 && ChunkEngine.getV(x, y - 1) === M.AIR) {
                    ChunkEngine.setV(x, y - 1, M.STEAM);
                    g[idx] = M.AIR;
                } else if (random() < 0.05) {
                    g[idx] = M.AIR;
                }
            } else if (type === M.METHANE) {
                let ignite = (hMap[idx] > 50);
                if (!ignite) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        const nType = ChunkEngine.getV(nx, ny);
                        if ([M.FIRE, M.SPARK, M.LAVA, M.LIGHTNING, M.EMBER].includes(nType)) {
                            ignite = true;
                            break;
                        }
                    }
                }
                if (ignite) {
                    g[idx] = M.FIRE;
                    hMap[idx] = 255;
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const bx = x + dx, by = y + dy;
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
                        if (ChunkEngine.getV(x, y - 1) === M.AIR) {
                            ChunkEngine.setV(x, y - 1, M.METHANE);
                            g[idx] = M.AIR;
                        } else if (random() < 0.5) {
                            const sideX = x + (random() < 0.5 ? 1 : -1);
                            if (ChunkEngine.getV(sideX, y) === M.AIR) {
                                ChunkEngine.setV(sideX, y, M.METHANE);
                                g[idx] = M.AIR;
                            }
                        }
                    }
                }
            } else if (type === M.LIGHTNING) {
                g[idx] = M.AIR;
                let curY = y;
                let curX = x;
                let energy = H;
                while (energy > 0 && curY < H) {
                    ChunkEngine.setV(curX, curY, M.SPARK);
                    ChunkEngine.setSparkColor(curX, curY, 0xFFFFFF);
                    ChunkEngine.setHeat(curX, curY, 255);

                    // Electrify wires in lightning path
                    const struckCell = ChunkEngine.getV(curX, curY);
                    if ([M.WIRE, M.LAMP, M.BOOSTER, M.REDSTONE_TORCH, M.SENSOR].includes(struckCell)) {
                        ChunkEngine.setWire(curX, curY, 255);
                    }

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

    // 3. PASS 2 (DOWNWARD — solids, liquids, TNT, detonator, etc.)
    const detonatorBurns = [];
    for (let y = H - 1; y >= 0; y--) {
        const dir = random() > 0.5 ? 1 : -1;
        for (let i = 0; i < W; i++) {
            const x = (dir === 1) ? i : (W - 1 - i);
            const idx = y * W + x;
            const type = g[idx];

            if (type === M.AIR || type === M.BEDROCK) continue;
            activeParticles++;

            if (type === M.FIRE) {
                const below = ChunkEngine.getV(x, y + 1);
                if (y < H - 1 && below === M.AIR) {
                    ChunkEngine.setV(x, y + 1, M.FIRE);
                    g[idx] = M.AIR;
                    continue;
                }
                const spreads = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
                for (const [dx, dy] of spreads) {
                    const nx = x + dx, ny = y + dy;
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
                        if (random() < 0.5) g[idx] = M.AIR;
                    }
                }
                if (random() < 0.75) {
                    const sideX = x + (random() > 0.5 ? 1 : -1);
                    if (ChunkEngine.getV(sideX, y) === M.AIR) {
                        ChunkEngine.setV(sideX, y, M.FIRE);
                        g[idx] = M.AIR;
                    }
                }
                if (random() < 0.25) g[idx] = (random() > 0.3) ? M.STEAM : M.AIR;
            }
            else if (type === M.SAND) {
                if (y < H - 1) {
                    const below = ChunkEngine.getV(x, y + 1);
                    if (below === M.AIR || below === M.WATER) {
                        g[idx] = (below === M.WATER) ? M.WATER : M.AIR;
                        ChunkEngine.setV(x, y + 1, M.SAND);
                    } else if (ChunkEngine.getV(x - 1, y + 1) === M.AIR) {
                        ChunkEngine.setV(x - 1, y + 1, M.SAND);
                        g[idx] = M.AIR;
                    } else if (ChunkEngine.getV(x + 1, y + 1) === M.AIR) {
                        ChunkEngine.setV(x + 1, y + 1, M.SAND);
                        g[idx] = M.AIR;
                    }
                }
            }
            else if (type === M.WATER) {
                if (hMap[idx] > 200) {
                    g[idx] = M.STEAM;
                    continue;
                }
                if (y < H - 1) {
                    const below = ChunkEngine.getV(x, y + 1);
                    if (below === M.AIR) {
                        ChunkEngine.setV(x, y + 1, M.WATER);
                        g[idx] = M.AIR;
                    } else {
                        const lq = ChunkEngine.liquidDir;
                        let fD = lq[idx] || (random() < 0.5 ? 1 : -1);
                        const nextX = x + fD;
                        if (ChunkEngine.getV(nextX, y) === M.AIR) {
                            ChunkEngine.setV(nextX, y, M.WATER);
                            ChunkEngine.setLiquidDir(nextX, y, fD);
                            g[idx] = M.AIR;
                            AudioEngine.play('water', 0.2);
                        } else {
                            lq[idx] = -fD;
                        }
                    }
                }
            }
            else if (type === M.LAVA) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        const nt = ChunkEngine.getV(nx, ny);
                        if ([M.WOOD, M.LEAVES, M.VINE, M.TERMITE].includes(nt) && random() < 0.02) {
                            ChunkEngine.setV(nx, ny, M.FIRE);
                            ChunkEngine.setHeat(nx, ny, 255);
                        }
                        if (nt === M.WATER) {
                            g[idx] = M.STONE;
                            ChunkEngine.setV(nx, ny, M.STEAM);
                        }
                    }
                }
                if (random() < 0.16 && y < H - 1) {
                    const below = ChunkEngine.getV(x, y + 1);
                    if (below === M.AIR) {
                        ChunkEngine.setV(x, y + 1, M.LAVA);
                        g[idx] = M.AIR;
                    } else {
                        const lq = ChunkEngine.liquidDir;
                        let fD = lq[idx] || (random() < 0.5 ? 1 : -1);
                        const nextX = x + fD;
                        if (ChunkEngine.getV(nextX, y) === M.AIR) {
                            ChunkEngine.setV(nextX, y, M.LAVA);
                            ChunkEngine.setLiquidDir(nextX, y, fD);
                            g[idx] = M.AIR;
                        } else {
                            lq[idx] = -fD;
                        }
                    }
                }
            }
            else if (type === M.TNT) {
                const below = ChunkEngine.getV(x, y + 1);
                if (y < H - 1 && below === M.AIR) {
                    ChunkEngine.setV(x, y + 1, M.TNT);
                    g[idx] = M.AIR;
                    continue;
                }
                let trig = (hMap[idx] > 50);
                if (!trig) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        const nt = ChunkEngine.getV(nx, ny);
                        if ([M.FIRE, M.SPARK, M.LAVA, M.EMBER, M.LIGHTNING].includes(nt)) {
                            trig = true;
                            break;
                        }
                    }
                }
                // Electrified wire triggers TNT
                if (!trig) {
                    if ((x > 0 && ChunkEngine.getV(x - 1, y) === M.WIRE && ChunkEngine.getWire(x - 1, y) > 50) ||
                        (x < W - 1 && ChunkEngine.getV(x + 1, y) === M.WIRE && ChunkEngine.getWire(x + 1, y) > 50) ||
                        (y > 0 && ChunkEngine.getV(x, y - 1) === M.WIRE && ChunkEngine.getWire(x, y - 1) > 50) ||
                        (y < H - 1 && ChunkEngine.getV(x, y + 1) === M.WIRE && ChunkEngine.getWire(x, y + 1) > 50)) {
                        trig = true;
                    }
                }
                if (trig) {
                    const r = 10, rSq = r * r;
                    for (let dy = -r; dy <= r; dy++) {
                        for (let dx = -r; dx <= r; dx++) {
                            const d = dx * dx + dy * dy;
                            const tx = x + dx, ty = y + dy;
                            if (ty >= 0 && ty < H) {
                                const tt = ChunkEngine.getV(tx, ty);
                                if (tt === M.BEDROCK) continue;
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
            else if (type === M.DETONATOR) {
                // No gravity. Burns up on contact with fire, lava, spark, ember, or powered wire.
                // Uses liquidDir as burn delay counter (3 ticks = ~65% slower chain).
                let burning = (hMap[idx] > 50);
                if (!burning) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        const nt = ChunkEngine.getV(nx, ny);
                        if ([M.FIRE, M.LAVA, M.SPARK, M.EMBER, M.LIGHTNING].includes(nt)) {
                            burning = true;
                            break;
                        }
                    }
                }
                let powered = false;
                if ((x > 0 && ChunkEngine.getV(x - 1, y) === M.WIRE && ChunkEngine.getWire(x - 1, y) > 50) ||
                    (x < W - 1 && ChunkEngine.getV(x + 1, y) === M.WIRE && ChunkEngine.getWire(x + 1, y) > 50) ||
                    (y > 0 && ChunkEngine.getV(x, y - 1) === M.WIRE && ChunkEngine.getWire(x, y - 1) > 50) ||
                    (y < H - 1 && ChunkEngine.getV(x, y + 1) === M.WIRE && ChunkEngine.getWire(x, y + 1) > 50)) {
                    powered = true;
                }
                if (!powered) {
                    if ((x > 0 && g[idx - 1] === M.REDSTONE_TORCH && wMap[idx - 1] > 0) ||
                        (x < W - 1 && g[idx + 1] === M.REDSTONE_TORCH && wMap[idx + 1] > 0) ||
                        (y > 0 && g[idx - W] === M.REDSTONE_TORCH && wMap[idx - W] > 0) ||
                        (y < H - 1 && g[idx + W] === M.REDSTONE_TORCH && wMap[idx + W] > 0)) {
                        powered = true;
                    }
                }
                if (powered || burning) {
                    const lq = ChunkEngine.liquidDir;
                    lq[idx]++;
                    if (lq[idx] >= 3) {
                        g[idx] = M.AIR;
                        wMap[idx] = 0;
                        lq[idx] = 0;
                        detonatorBurns.push([x, y]);
                        AudioEngine.play('fire', 0.2);
                        continue;
                    }
                } else {
                    ChunkEngine.liquidDir[idx] = 0;
                }
            }
            else if (type === M.URANIUM) {
                currentlyHasUranium = true;
                const below = ChunkEngine.getV(x, y + 1);
                if (y < H - 1 && below === M.AIR) {
                    ChunkEngine.setV(x, y + 1, M.URANIUM);
                    g[idx] = M.AIR;
                    continue;
                }
                const pulse = Math.sin(globalTime * 3) * 40 + 40;
                hMap[idx] = Math.max(hMap[idx], pulse);
                if (pulse > 75) AudioEngine.play('uranium_pulse', 0.3);
                if (random() < 0.2) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        const nh = ChunkEngine.getHeat(nx, ny);
                        if (nh < 220) ChunkEngine.setHeat(nx, ny, Math.min(220, nh + 2));
                    }
                }
                if (!meltdownActive) {
                    if (hMap[idx] >= 250 || random() < (0.0002 * (simulationSpeed / 0.4))) {
                        meltdownActive = true;
                        meltdownTimer = 600;
                    }
                }
                if (meltdownActive) {
                    const pulseDist = Math.sin(globalTime * 6) * 25 + 25;
                    const rx = x + Math.floor((random() - 0.5) * pulseDist);
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
                                const tx = x + dx, ty = y + dy;
                                if (ty >= 0 && ty < H) {
                                    const tt = ChunkEngine.getV(tx, ty);
                                    if (tt === M.BEDROCK) continue;
                                    if (d2 < rSq * 0.5) ChunkEngine.setV(tx, ty, M.AIR);
                                    else if (random() < 0.8) ChunkEngine.setV(tx, ty, M.LAVA);
                                    ChunkEngine.setHeat(tx, ty, 255);
                                }
                            }
                        }
                        g[idx] = M.AIR;
                        AudioEngine.play('explosion', 1.5);
                    }
                }
            }
            else if (type === M.ACID) {
                if (y < H - 1) {
                    const below = ChunkEngine.getV(x, y + 1);
                    if (below === M.AIR) {
                        ChunkEngine.setV(x, y + 1, M.ACID);
                        g[idx] = M.AIR;
                    } else if (below !== M.ACID && below !== M.BEDROCK) {
                        if (below === M.CONCRETE) {
                            if (random() < 0.02) {
                                ChunkEngine.setV(x, y + 1, M.AIR);
                                g[idx] = M.AIR;
                            }
                        } else {
                            ChunkEngine.setV(x, y + 1, M.AIR);
                            if (random() < 0.15) g[idx] = M.AIR;
                        }
                    }
                } else {
                    const lq = ChunkEngine.liquidDir;
                    let fD = lq[idx] || (random() < 0.5 ? 1 : -1);
                    const nextX = x + fD;
                    if (ChunkEngine.getV(nextX, y) === M.AIR) {
                        ChunkEngine.setV(nextX, y, M.ACID);
                        ChunkEngine.setLiquidDir(nextX, y, fD);
                        g[idx] = M.AIR;
                    } else {
                        lq[idx] = -fD;
                    }
                }
            }
            else if (type === M.TERMITE) {
                const below = ChunkEngine.getV(x, y + 1);
                const touchW = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(
                    ([nx, ny]) => [M.WOOD, M.LEAVES, M.VINE].includes(ChunkEngine.getV(nx, ny))
                );
                if (y < H - 1 && below === M.AIR && (!touchW || random() < 0.1)) {
                    ChunkEngine.setV(x, y + 1, M.TERMITE);
                    g[idx] = M.AIR;
                    continue;
                }
                if (random() < 0.6) {
                    const r = random();
                    let mx = 0, my = 1;
                    if (r < 0.45) { mx = 0; my = 1; }
                    else if (r < 0.75) { mx = random() < 0.5 ? 1 : -1; my = 0; }
                    else { mx = touchW ? 0 : (random() < 0.5 ? 1 : -1); my = touchW ? -1 : 0; }
                    const dx = x + mx, dy = y + my;
                    if (dy >= 0 && dy < H) {
                        const dt = ChunkEngine.getV(dx, dy);
                        if ([M.WOOD, M.LEAVES, M.VINE].includes(dt)) {
                            ChunkEngine.setV(dx, dy, M.TERMITE);
                            g[idx] = M.AIR;
                            if (random() < 0.1) g[idx] = M.METHANE;
                        } else if (dt === M.AIR && random() < 0.15) {
                            ChunkEngine.setV(dx, dy, M.TERMITE);
                            g[idx] = M.AIR;
                        }
                    }
                }
            }
            else if (type === M.VINE) {
                if (hMap[idx] > 80) {
                    g[idx] = M.FIRE;
                    hMap[idx] = 200;
                    continue;
                }
                if (random() < 0.015) {
                    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
                    const [dx, dy] = dirs[Math.floor(random() * dirs.length)];
                    const nx = x + dx, ny = y + dy;
                    if (ny >= 0 && ny < H && ChunkEngine.getV(nx, ny) === M.AIR) {
                        ChunkEngine.setV(nx, ny, M.VINE);
                        AudioEngine.play('vine', 0.4);
                    }
                }
            }
            else if (type === M.ICE) {
                if (hMap[idx] > 30) g[idx] = M.WATER;
                if (random() < 0.05) {
                    const nx = x + (random() < 0.5 ? 1 : -1);
                    const nh = ChunkEngine.getHeat(nx, y);
                    ChunkEngine.setHeat(nx, y, Math.max(0, nh - 10));
                }
            }
            else if (type === M.COAL) {
                if (hMap[idx] > 200) {
                    hMap[idx] = 255;
                    if (random() < 0.05) {
                        const sides = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                        const [sx, sy] = sides[Math.floor(random() * sides.length)];
                        if (ChunkEngine.getV(sx, sy) === M.AIR) ChunkEngine.setV(sx, sy, M.FIRE);
                    }
                }
            }
            else if (type === M.EMBER) {
                if (random() < 0.02) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    const [nx, ny] = neighbors[Math.floor(random() * neighbors.length)];
                    const nt = ChunkEngine.getV(nx, ny);
                    if (nt === M.AIR && random() < 0.1) ChunkEngine.setV(nx, ny, M.FIRE);
                    else if ([M.WOOD, M.LEAVES, M.VINE, M.COAL].includes(nt)) {
                        ChunkEngine.setHeat(nx, ny, Math.min(255, ChunkEngine.getHeat(nx, ny) + 50));
                    }
                }
                if (random() < 0.1) {
                    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
                    for (const [nx, ny] of neighbors) {
                        if (ChunkEngine.getV(nx, ny) === M.FIRE) {
                            g[idx] = M.COAL;
                            hMap[idx] = 255;
                            break;
                        }
                    }
                }
            }
            else if (type === M.SPARK) {
                hMap[idx] -= 6;
                const sc = ChunkEngine.sparkColors;
                if (hMap[idx] <= 0 || random() < 0.05) {
                    g[idx] = M.AIR;
                    sc[idx] = 0;
                } else {
                    const below = ChunkEngine.getV(x, y + 1);
                    if (y < H - 1 && below === M.AIR && random() < 0.3) {
                        ChunkEngine.setV(x, y + 1, M.SPARK);
                        ChunkEngine.setSparkColor(x, y + 1, sc[idx]);
                        ChunkEngine.setHeat(x, y + 1, hMap[idx]);
                        g[idx] = M.AIR;
                    }
                }
            }
            else if (type === M.WOOD || type === M.LEAVES) {
                if (hMap[idx] > 120 && random() < 0.02) {
                    g[idx] = M.FIRE;
                    hMap[idx] = 255;
                }
            }
        }
    }

    // Post-process detonator burns: spread heat to adjacent cells for chain reaction
    for (const [bx, by] of detonatorBurns) {
        if (bx > 0) ChunkEngine.setHeat(bx - 1, by, 255);
        if (bx < W - 1) ChunkEngine.setHeat(bx + 1, by, 255);
        if (by > 0) ChunkEngine.setHeat(bx, by - 1, 255);
        if (by < H - 1) ChunkEngine.setHeat(bx, by + 1, 255);
    }

    // Finalize meltdown
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
