// --- PHYSICS UPDATE ---
function updatePhysics() {
    let activeParticles = 0;
    globalTime += 0.1;
    let currentlyHasUranium = false;

    // 0. MELTDOWN MANAGEMENT
    const warningEl = document.getElementById('meltdownWarning');
    const timerEl = document.getElementById('meltdownTimer');

    if (meltdownActive) {
        meltdownTimer -= 1 * (simulationSpeed / 0.4);
        if (warningEl) {
            warningEl.classList.remove('hidden');
            timerEl.innerText = (Math.max(0, meltdownTimer / 60)).toFixed(1) + 's';
        }

        // Pulse heat everywhere if melting down
        const globalPulse = Math.sin(globalTime * 2) * 50 + 50;
        if (Math.random() < 0.1) {
            for (let i = 0; i < grid.length; i += 10) {
                if (grid[i] !== M.AIR) heatMap[i] = Math.max(heatMap[i], globalPulse);
            }
        }
    } else {
        if (warningEl) warningEl.classList.add('hidden');
    }

    // 1. HEATMAP & FEUER LOGIK
    for (let x = 0; x < width; x++) {
        for (let y = 1; y < height; y++) {
            const idx = y * width + x;
            if (grid[idx] === M.FIRE || (grid[idx] === M.COAL && heatMap[idx] > 200)) {
                heatMap[idx] = 255;
                continue;
            }
            let windOffset = 0;
            if (fireChaos < 0.1) {
                if (Math.random() < 0.05 + Math.sin(globalTime) * 0.05) windOffset = (Math.random() > 0.5 ? 1 : -1);
            } else {
                const chaosFactor = fireChaos;
                const rand = Math.random();
                if (rand < 0.3 * chaosFactor) windOffset = (Math.random() > 0.5) ? 1 : -1;
                else { if (rand < 0.4) windOffset = 0; else if (rand < 0.7) windOffset = -1; else windOffset = 1; }
            }
            const srcX = x + windOffset;
            if (srcX >= 0 && srcX < width) {
                const srcIdx = (y + 1) * width + srcX;
                let decay = (fireChaos < 0.1) ? 2 : Math.floor(Math.random() * 3);
                if (fireChaos >= 0.1 && Math.random() < (0.2 * fireChaos)) decay += Math.random() * 10;
                decay = decay / fireIntensity;
                let newHeat = (srcIdx < width * height) ? heatMap[srcIdx] - decay : 0;
                heatMap[idx] = Math.max(0, newHeat);
            } else { heatMap[idx] = 0; }
            if (grid[idx] === M.WATER || grid[idx] === M.STONE) heatMap[idx] = 0;
        }
    }

    // 2. PASS 1 (UPWARD - FIREWORK, STEAM, METHANE, LIGHTNING)
    for (let y = 0; y < height; y++) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < width; i++) {
            let x = (dir === 1) ? i : (width - 1 - i);
            const idx = y * width + x;
            const type = grid[idx];
            if (type === M.AIR) continue;

            if (type === M.FIREWORK) {
                if (fireworkVel[idx] === 0) fireworkVel[idx] = 240 + Math.floor(Math.random() * 30);
                const life = fireworkVel[idx];
                fireworkVel[idx] = life - 1;
                if (life > 1 && y > 2) {
                    if (Math.random() < 0.6) {
                        const above = idx - width;
                        if (above >= 0 && (grid[above] === M.AIR || grid[above] === M.VINE || grid[above] === M.FIREWORK || grid[above] === M.SPARK)) {
                            grid[above] = M.FIREWORK; fireworkVel[above] = life - 1; grid[idx] = M.AIR; fireworkVel[idx] = 0;
                        }
                    }
                } else {
                    grid[idx] = M.AIR;
                    fireworkVel[idx] = 0;
                    AudioEngine.play('firework', 0.6); // Boom sound for firework
                    const color = Math.floor(Math.random() * 0xFFFFFF);
                    for (let ey = -6; ey <= 6; ey++) {
                        for (let ex = -6; ex <= 6; ex++) {
                            if (ex * ex + ey * ey <= 36 && Math.random() < 0.5) {
                                const sx = x + ex, sy = y + ey;
                                if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                                    const si = sy * width + sx;
                                    if (grid[si] === M.AIR) { grid[si] = M.SPARK; sparkColors[si] = color; heatMap[si] = 160 + Math.random() * 95; }
                                }
                            }
                        }
                    }
                }
            } else if (type === M.STEAM) {
                if (y > 0 && grid[idx - width] === M.AIR) { grid[idx - width] = M.STEAM; grid[idx] = M.AIR; } else if (Math.random() < 0.05) grid[idx] = M.AIR;
            } else if (type === M.METHANE) {
                let ignite = (heatMap[idx] > 50);
                if (!ignite) {
                    const nb = [idx - 1, idx + 1, idx - width, idx + width];
                    for (let n of nb) if (n >= 0 && n < width * height && [M.FIRE, M.SPARK, M.LAVA, M.LIGHTNING, M.EMBER].includes(grid[n])) { ignite = true; break; }
                }
                if (ignite) {
                    grid[idx] = M.FIRE; heatMap[idx] = 255;
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const bi = idx + dx + dy * width;
                            if (bi >= 0 && bi < grid.length) {
                                if (grid[bi] === M.METHANE) { grid[bi] = M.FIRE; heatMap[bi] = 255; }
                                else if ((grid[bi] === M.WOOD || grid[bi] === M.TERMITE) && Math.random() < 0.3) { grid[bi] = M.FIRE; heatMap[bi] = 255; }
                            }
                        }
                    }
                } else {
                    const up = idx - width;
                    if (y > 0) {
                        if (grid[up] === M.AIR) { grid[up] = M.METHANE; grid[idx] = M.AIR; }
                        else if (Math.random() < 0.5) {
                            const side = idx + (Math.random() < 0.5 ? 1 : -1);
                            if (grid[side] === M.AIR && Math.floor(side / width) === y) { grid[side] = M.METHANE; grid[idx] = M.AIR; }
                        }
                    }
                }
            } else if (type === M.LIGHTNING) {
                const strike = (sIdx, en) => {
                    let cur = sIdx;
                    while (en > 0 && cur < width * height) {
                        grid[cur] = M.SPARK; sparkColors[cur] = 0xFFFFFF; heatMap[cur] = 255;
                        const b = cur + width; if (b >= width * height) break;
                        const t = grid[b];
                        if (t !== M.AIR && t !== M.METHANE && t !== M.STEAM && t !== M.SPARK) {
                            if (t === M.WATER) grid[b] = M.STEAM; else { grid[b] = M.STONE; grid[cur] = M.EMBER; }
                            heatMap[b] = 255; break;
                        } else if (t === M.METHANE) { grid[b] = M.FIRE; heatMap[b] = 255; }
                        let d = width; const r = Math.random(); if (r < 0.2) d -= 1; else if (r < 0.4) d += 1;
                        if (en > 10 && Math.random() < 0.05) strike(cur, en - 5);
                        cur += d; en--;
                    }
                };
                grid[idx] = M.AIR; strike(idx, height);
            }
        }
    }

    // 3. PASS 2 (DOWNWARD - SAND, WATER, WOOD, LAVA, TNT, URANIUM, ACID, TERMITE, VINE, ICE, COAL, EMBER, SPARK)
    for (let y = height - 1; y >= 0; y--) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < width; i++) {
            let x = (dir === 1) ? i : (width - 1 - i);
            const idx = y * width + x;
            const type = grid[idx];
            if (type === M.AIR) continue;
            activeParticles++;

            if (type === M.FIRE) {
                const below = idx + width;
                if (below < width * height && grid[below] === M.AIR) { grid[below] = M.FIRE; grid[idx] = M.AIR; continue; }
                const spreads = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
                for (let offset of spreads) {
                    const nIdx = idx + offset;
                    if (nIdx >= 0 && nIdx < width * height) {
                        const nType = grid[nIdx];
                        if (nType === M.WOOD || nType === M.LEAVES || nType === M.VINE || nType === M.COAL || nType === M.EMBER) {
                            let chance = 0.1 * fireIntensity; if (offset === width) chance *= 2;
                            if (Math.random() < chance) {
                                if (nType === M.COAL) heatMap[nIdx] = 255;
                                else { grid[nIdx] = M.FIRE; heatMap[nIdx] = 255; }
                                AudioEngine.play('fire', 0.3);
                            }
                        } else if (nType === M.WATER) { grid[nIdx] = M.STEAM; if (Math.random() < 0.5) grid[idx] = M.AIR; }
                    }
                }
                if (Math.random() < 0.4) {
                    const wIdx = idx + (Math.random() > 0.5 ? 1 : -1);
                    if (grid[wIdx] === M.AIR && Math.floor(wIdx / width) === y) { grid[wIdx] = M.FIRE; grid[idx] = M.AIR; }
                }
                if (Math.random() < 0.25) grid[idx] = (Math.random() > 0.3) ? M.STEAM : M.AIR;
            }
            else if (type === M.SAND) {
                const below = idx + width;
                if (y < height - 1) {
                    const bt = grid[below];
                    if (bt === M.AIR || bt === M.WATER) { grid[idx] = (bt === M.WATER ? M.WATER : M.AIR); grid[below] = M.SAND; }
                    else if (x > 0 && grid[below - 1] === M.AIR) { grid[below - 1] = M.SAND; grid[idx] = M.AIR; }
                    else if (x < width - 1 && grid[below + 1] === M.AIR) { grid[below + 1] = M.SAND; grid[idx] = M.AIR; }
                }
            }
            else if (type === M.WATER) {
                const below = idx + width;
                if (heatMap[idx] > 200) { grid[idx] = M.STEAM; continue; }
                if (y < height - 1) {
                    if (grid[below] === M.AIR) { grid[below] = M.WATER; grid[idx] = M.AIR; }
                    else {
                        let fD = liquidDir[idx] || (Math.random() < 0.5 ? 1 : -1);
                        const next = idx + fD;
                        if (grid[next] === M.AIR && Math.floor(next / width) === y) {
                            grid[next] = M.WATER; grid[idx] = M.AIR; liquidDir[next] = fD;
                            AudioEngine.play('water', 0.2);
                        }
                        else liquidDir[idx] = -fD;
                    }
                }
            }
            else if (type === M.LAVA) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ni = idx + dx + dy * width;
                        if (ni >= 0 && ni < grid.length && [M.WOOD, M.LEAVES, M.VINE, M.TERMITE].includes(grid[ni]) && Math.random() < 0.02) { grid[ni] = M.FIRE; heatMap[ni] = 255; }
                        if (grid[ni] === M.WATER) { grid[idx] = M.STONE; grid[ni] = M.STEAM; }
                    }
                }
                if (Math.random() < 0.16 && y < height - 1) {
                    const below = idx + width;
                    if (grid[below] === M.AIR) { grid[below] = M.LAVA; grid[idx] = M.AIR; }
                    else {
                        let fD = liquidDir[idx] || (Math.random() < 0.5 ? 1 : -1);
                        const next = idx + fD;
                        if (grid[next] === M.AIR && Math.floor(next / width) === y) { grid[next] = M.LAVA; grid[idx] = M.AIR; liquidDir[next] = fD; }
                        else liquidDir[idx] = -fD;
                    }
                }
            }
            else if (type === M.TNT) {
                const below = idx + width;
                if (below < width * height && grid[below] === M.AIR) { grid[below] = M.TNT; grid[idx] = M.AIR; continue; }
                let trig = (heatMap[idx] > 50);
                if (!trig) { const nb = [idx - 1, idx + 1, idx - width, idx + width]; for (let n of nb) if (n >= 0 && n < width * height && [M.FIRE, M.SPARK, M.LAVA, M.EMBER, M.LIGHTNING].includes(grid[n])) trig = true; }
                if (trig) {
                    const r = 10, rSq = r * r;
                    for (let dy = -r; dy <= r; dy++) {
                        for (let dx = -r; dx <= r; dx++) {
                            const d = dx * dx + dy * dy, tx = x + dx, ty = y + dy;
                            if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
                                const ti = ty * width + tx;
                                if (grid[ti] === M.CONCRETE) { if (d < rSq * 0.3) grid[ti] = M.AIR; continue; }
                                if (d <= rSq) {
                                    grid[ti] = M.AIR; heatMap[ti] = 255;
                                }
                            }
                        }
                    }
                    AudioEngine.play('tnt');
                }
            }
            else if (type === M.URANIUM) {
                currentlyHasUranium = true;
                const below = idx + width;
                if (below < width * height && grid[below] === M.AIR) { grid[below] = M.URANIUM; grid[idx] = M.AIR; continue; }
                const pulse = Math.sin(globalTime * 3) * 40 + 40;
                heatMap[idx] = Math.max(heatMap[idx], pulse);
                if (pulse > 75) AudioEngine.play('uranium_pulse', 0.3);
                if (Math.random() < 0.2) {
                    const nb = [idx - 1, idx + 1, idx - width, idx + width];
                    for (let n of nb) if (n >= 0 && n < width * height && heatMap[n] < 220) heatMap[n] = Math.min(220, heatMap[n] + 2);
                }
                if (!meltdownActive) {
                    if (heatMap[idx] >= 250 || Math.random() < (0.0002 * (simulationSpeed / 0.4))) {
                        meltdownActive = true; meltdownTimer = 600; // 10s countdown
                    }
                }
                if (meltdownActive) {
                    const pulseDist = Math.sin(globalTime * 6) * 25 + 25;
                    const rIdx = idx + Math.floor((Math.random() - 0.5) * pulseDist) + Math.floor((Math.random() - 0.5) * pulseDist) * width;
                    if (rIdx >= 0 && rIdx < grid.length && grid[rIdx] !== M.AIR && grid[rIdx] !== M.URANIUM && Math.random() < 0.2) {
                        grid[rIdx] = M.LAVA; heatMap[rIdx] = 255;
                    }
                    if (meltdownTimer <= 0) {
                        const r = 60; const rSq = r * r;
                        for (let dy = -r; dy <= r; dy++) {
                            for (let dx = -r; dx <= r; dx++) {
                                const d2 = dx * dx + dy * dy, tx = x + dx, ty = y + dy;
                                if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
                                    const ti = ty * width + tx;
                                    if (d2 < rSq * 0.5) grid[ti] = M.AIR; else if (Math.random() < 0.8) grid[ti] = M.LAVA;
                                    heatMap[ti] = 255;
                                }
                            }
                        }
                        grid[idx] = M.AIR;
                        AudioEngine.play('explosion', 1.5);
                    }
                }
            }
            else if (type === M.ACID) {
                const below = idx + width;
                if (below < width * height) {
                    const bt = grid[below];
                    if (bt === M.AIR) { grid[below] = M.ACID; grid[idx] = M.AIR; }
                    else if (bt !== M.ACID) {
                        if (bt === M.CONCRETE) { if (Math.random() < 0.02) { grid[below] = M.AIR; grid[idx] = M.AIR; } }
                        else { grid[below] = M.AIR; if (Math.random() < 0.15) grid[idx] = M.AIR; }
                    }
                } else {
                    let fD = liquidDir[idx] || (Math.random() < 0.5 ? 1 : -1);
                    const nx = x + fD; if (nx >= 0 && nx < width && grid[y * width + nx] === M.AIR) { grid[y * width + nx] = M.ACID; grid[idx] = M.AIR; liquidDir[y * width + nx] = fD; }
                    else liquidDir[idx] = -fD;
                }
            }
            else if (type === M.TERMITE) {
                const below = idx + width;
                const touchW = [idx - 1, idx + 1, idx - width, idx + width].some(ni => ni >= 0 && [M.WOOD, M.LEAVES, M.VINE].includes(grid[ni]));
                if (below < width * height && grid[below] === M.AIR && (!touchW || Math.random() < 0.1)) { grid[below] = M.TERMITE; grid[idx] = M.AIR; continue; }
                if (Math.random() < 0.6) {
                    const r = Math.random();
                    let m = (r < 0.45) ? width : (r < 0.75 ? (Math.random() < 0.5 ? 1 : -1) : (touchW ? -width : (Math.random() < 0.5 ? 1 : -1)));
                    const ds = idx + m;
                    if (ds >= 0 && ds < grid.length && (Math.abs(m) !== 1 || Math.floor(ds / width) === y)) {
                        const dt = grid[ds];
                        if ([M.WOOD, M.LEAVES, M.VINE].includes(dt)) { grid[ds] = M.TERMITE; grid[idx] = M.AIR; if (Math.random() < 0.1) grid[idx] = M.METHANE; }
                        else if (dt === M.AIR && Math.random() < 0.15) { grid[ds] = M.TERMITE; grid[idx] = M.AIR; }
                    }
                }
            }
            else if (type === M.VINE) {
                if (heatMap[idx] > 80) { grid[idx] = M.FIRE; heatMap[idx] = 200; continue; }
                if (Math.random() < 0.015) { // Slightly increased spread
                    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
                    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = ny * width + nx;
                        if (grid[ni] === M.AIR) {
                            grid[ni] = M.VINE;
                            AudioEngine.play('vine', 0.4);
                        }
                    }
                }
            }
            else if (type === M.ICE) {
                if (heatMap[idx] > 30) grid[idx] = M.WATER;
                if (Math.random() < 0.05) { const n = idx + (Math.random() < 0.5 ? 1 : -1); if (n >= 0 && n < grid.length) heatMap[n] = Math.max(0, heatMap[n] - 10); }
            }
            else if (type === M.COAL) {
                if (heatMap[idx] > 200) {
                    heatMap[idx] = 255; if (Math.random() < 0.05) { const sides = [idx - 1, idx + 1, idx - width]; const s = sides[Math.floor(Math.random() * sides.length)]; if (grid[s] === M.AIR) grid[s] = M.FIRE; }
                }
            }
            else if (type === M.EMBER) {
                if (Math.random() < 0.1) { const nb = [idx - 1, idx + 1, idx - width, idx + width]; for (let n of nb) if (grid[n] === M.FIRE) { grid[idx] = M.COAL; heatMap[idx] = 255; break; } }
            }
            else if (type === M.SPARK) {
                heatMap[idx] -= 6; if (heatMap[idx] <= 0 || Math.random() < 0.05) { grid[idx] = M.AIR; sparkColors[idx] = 0; }
                else { const b = idx + width; if (b < grid.length && grid[b] === M.AIR && Math.random() < 0.3) { grid[b] = M.SPARK; sparkColors[b] = sparkColors[idx]; heatMap[b] = heatMap[idx]; grid[idx] = M.AIR; } }
            }
            else if (type === M.WOOD || type === M.LEAVES) {
                if (heatMap[idx] > 120 && Math.random() < 0.02) { grid[idx] = M.FIRE; heatMap[idx] = 255; }
            }
        }
    }

    if (currentlyHasUranium && !meltdownActive) {
        if (Math.random() < (0.0005 * (simulationSpeed / 0.4))) { meltdownActive = true; meltdownTimer = 600; }
    }
    if (!currentlyHasUranium && meltdownActive && meltdownTimer <= 0) meltdownActive = false;

    entDisplay.innerText = activeParticles;
}
