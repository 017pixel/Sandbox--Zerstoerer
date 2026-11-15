// =============================================================================
// sb-renderer.js - Rendering for Fixed World
// =============================================================================

// The sky only changes when a world loads or its palette changes. Pre-render
// it once into a world-sized RGB buffer so the per-frame loop is a cheap
// lookup instead of dozens of sine/moon calculations per pixel.
let skyMap = null;
let skyMapDirty = true;

function rebuildSkyMap() {
    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;
    const size = W * H * 3;
    if (!skyMap || skyMap.length !== size) skyMap = new Uint8Array(size);

    const atmo = worldAtmosphere;
    const skyTopR = atmo.skyTop[0], skyTopG = atmo.skyTop[1], skyTopB = atmo.skyTop[2];
    const skyBotR = atmo.skyBottom[0], skyBotG = atmo.skyBottom[1], skyBotB = atmo.skyBottom[2];
    const cloudR = atmo.cloud[0], cloudG = atmo.cloud[1], cloudB = atmo.cloud[2];
    const cloudAmount = atmo.cloudAmount;
    const starAmount = atmo.stars;
    const cloudThreshold = 2.35 - cloudAmount * 0.9;
    const starThreshold = 0.9982 - starAmount * 0.004;
    const moon = atmo.moon;
    const moonX = moon ? moon.x : 0;
    const moonY = moon ? moon.y : 0;
    const moonR = moon ? moon.r : 0;
    const skyline = ChunkEngine.skyline;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (y >= skyline[x]) continue;
            skyAt(x, y, false,
                skyTopR, skyTopG, skyTopB, skyBotR, skyBotG, skyBotB,
                cloudR, cloudG, cloudB, cloudAmount, cloudThreshold,
                starAmount, starThreshold, 0,
                moonX, moonY, moonR);
            const si = (y * W + x) * 3;
            skyMap[si] = skyOutR;
            skyMap[si + 1] = skyOutG;
            skyMap[si + 2] = skyOutB;
        }
    }
    skyMapDirty = false;
}

function draw() {
    const time = Date.now() * 0.002;
    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;

    if (skyMapDirty) rebuildSkyMap();

    // Viewport Calculations
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;

    // Clamp camera to world bounds
    clampCamera();

    const startX = Math.floor(cameraX);
    const startY = Math.floor(cameraY);

    const skyline = ChunkEngine.skyline;
    const atmo = worldAtmosphere;
    const skyTopR = atmo.skyTop[0], skyTopG = atmo.skyTop[1], skyTopB = atmo.skyTop[2];
    const skyBotR = atmo.skyBottom[0], skyBotG = atmo.skyBottom[1], skyBotB = atmo.skyBottom[2];

    for (let y = 0; y < height; y++) {
        const worldY = Math.floor(startY + y / zoom);

        if (worldY < 0 || worldY >= H) {
            drawBackdropRow(y, worldY < 0, skyTopR, skyTopG, skyTopB, skyBotR, skyBotG, skyBotB);
            continue;
        }

        for (let x = 0; x < width; x++) {
            const worldX = Math.floor(startX + x / zoom);
            if (worldX < 0 || worldX >= W) {
                let r, g, b;
                if (worldY < H) {
                    const t = Math.min(1, worldY / 190);
                    r = skyTopR + (skyBotR - skyTopR) * t;
                    g = skyTopG + (skyBotG - skyTopG) * t;
                    b = skyTopB + (skyBotB - skyTopB) * t;
                } else {
                    r = 7; g = 10; b = 15;
                }
                const pIdx = (y * width + x) * 4;
                data[pIdx] = r;
                data[pIdx + 1] = g;
                data[pIdx + 2] = b;
                data[pIdx + 3] = 255;
                continue;
            }

            const cell = ChunkEngine.getV(worldX, worldY);
            const heat = ChunkEngine.getHeat(worldX, worldY);

            let r, g, b;

            // --- MATERIAL RENDERING ---
            if (cell === M.WIRE) {
                const wire = ChunkEngine.getWire(worldX, worldY);
                const f = wire / 255;
                r = 184 + f * 71;
                g = 115 + f * 140;
                b = 51 - f * 30;
                if (wire > 220) {
                    const pulse = Math.sin(time * 8 + worldX * 0.5) * 10;
                    r = Math.min(255, r + 20 + pulse);
                    g = Math.min(255, g + 20 + pulse);
                }
            }
            else if (cell === M.LAMP) {
                const wire = ChunkEngine.getWire(worldX, worldY);
                if (wire > 20) { r = 255; g = 255; b = 220; }
                else { r = 50; g = 50; b = 50; }
            }
            else if (cell === M.BOOSTER) {
                const wire = ChunkEngine.getWire(worldX, worldY);
                r = 70; g = 80; b = 90;
                if (wire > 100) {
                    const glow = Math.sin(time * 10) * 20 + 30;
                    r += 20 + glow;
                    g += 100 + glow;
                    b += 155 + glow;
                }
            }
            else if (cell === M.BATTERY) {
                r = 30; g = 80; b = 50;
                const pulse = Math.sin(time * 4) * 20 + 20;
                g = Math.min(255, g + 80 + pulse);
                r = Math.min(255, r + 10 + pulse * 0.5);
            }
            else if (cell === M.REDSTONE_TORCH) {
                // Strom-Fackel: flame-like torch visual
                const flicker = Math.sin(time * 14 + worldX * 0.7 + worldY * 0.3) * 30;
                const pulse = Math.sin(time * 6) * 15;
                r = 255;
                g = 170 + flicker + pulse;
                b = 30 + flicker * 0.4;
                r = Math.min(255, r);
                g = Math.min(255, Math.max(80, g));
                b = Math.min(255, Math.max(5, b));
            }
            else if (cell === M.DETONATOR) {
                // Zünder: dull red, glows when near fire or powered
                if (heat > 30) {
                    const glow = Math.sin(time * 12) * 20 + 20;
                    r = 220 + glow; g = 70; b = 50;
                } else {
                    r = 180; g = 60; b = 60;
                }
            }
            else if (cell === M.SENSOR) {
                const wire = ChunkEngine.getWire(worldX, worldY);
                if (wire > 0) {
                    const pulse = Math.sin(time * 8) * 20 + 20;
                    r = 40 + pulse;
                    g = 140 + pulse;
                    b = 255;
                } else {
                    r = 60; g = 80; b = 180;
                }
            }
            else if (cell === M.AIR || cell === M.FIREWORK) {
                let palIdx = 0;
                if (heat > 0) {
                    if (heat > 220) palIdx = 4;
                    else if (heat > 160) palIdx = 3;
                    else if (heat > 80) palIdx = 2;
                    else if (heat > 20) palIdx = 1;
                }

                if (palIdx > 0) {
                    [r, g, b] = firePalette[palIdx];
                } else if (worldY < skyline[worldX]) {
                    const si = (worldY * W + worldX) * 3;
                    r = skyMap[si];
                    g = skyMap[si + 1];
                    b = skyMap[si + 2];
                } else {
                    const d = Math.min(1, worldY / 220);
                    const grain = pixelGrain(worldX, worldY) * 4;
                    r = 11 + d * 6 + grain;
                    g = 14 + d * 8 + grain;
                    b = 20 + d * 11 + grain;
                }

                if (cell === M.FIREWORK) {
                    r += 40; b += 40;
                }
            }
            else if (cell === M.FIRE) { r = 255; g = 255; b = 200; }
            else if (cell === M.SPARK) {
                const sparkColor = ChunkEngine.getSparkColor(worldX, worldY);
                r = ((sparkColor >> 16) & 0xFF) * (heat / 200);
                g = ((sparkColor >> 8) & 0xFF) * (heat / 200);
                b = (sparkColor & 0xFF) * (heat / 200);
                r = Math.min(255, r + 50); g = Math.min(255, g + 30); b = Math.min(255, b + 20);
            }
            else if (cell === M.VINE) {
                const pattern = Math.sin(worldX * 0.5 + worldY * 0.3 + time) * 0.5 + 0.5;
                const grain = pixelGrain(worldX, worldY) * 20;
                r = 20 + pattern * 30; g = 80 + pattern * 60 + grain; b = 20 + pattern * 20;
                if (heat > 30) { r += heat * 0.5; g -= heat * 0.2; }
            }
            else if (cell === M.LAVA) {
                const glow = Math.sin(time * 2 + worldX * 0.2 + worldY * 0.1) * 0.3 + 0.7;
                r = 200 + glow * 55;
                g = 50 + glow * 80 + pixelGrain(worldX, worldY) * 30;
                b = 0 + glow * 20;
            }
            else if (cell === M.EMBER) {
                const pulse = Math.sin(time * 5 + worldX * 0.1 + worldY * 0.1) * 0.5 + 0.5;
                r = 160 + pulse * 60; g = 40 + pulse * 20; b = 20;
            }
            else if (cell === M.BEDROCK) {
                const noise = ((worldX * 17 + worldY * 31) % 10) / 10;
                r = 25 + noise * 15;
                g = 25 + noise * 15;
                b = 28 + noise * 15;
            }
            else {
                if (colors[cell]) {
                    [r, g, b] = colors[cell];
                    if (cell !== M.WATER && cell !== M.STEAM) {
                        const noise = pixelGrain(worldX, worldY) * 9;
                        r += noise; g += noise; b += noise;
                    }
                    if (cell === M.WATER) {
                        const liquidDir = ChunkEngine.getLiquidDir(worldX, worldY);
                        if (liquidDir !== 0) { r += 10; g += 10; b += 20; }
                    }
                    if ((cell === M.WOOD || cell === M.LEAVES) && heat > 50) {
                        r += (heat / 2);
                        g -= (heat / 3);
                    }
                    if (cell === M.COAL && heat > 200) {
                        r += 180; g += 60; b += 20;
                        if (pixelGrain(worldX, worldY) > 0.4) { r += 40; g += 40; }
                    }
                } else {
                    r = 255; g = 0; b = 255;
                }
            }

            const pIdx = (y * width + x) * 4;
            data[pIdx] = r;
            data[pIdx + 1] = g;
            data[pIdx + 2] = b;
            data[pIdx + 3] = 255;
        }
    }

    offscreenCtx.putImageData(imgData, 0, 0);

    // Final Composite
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(offscreenCanvas,
        0, 0, width, height,
        0, 0, canvas.width, canvas.height
    );
}

// Stable per-pixel dither instead of per-frame random noise. Keeps surfaces
// textured without shimmering and without burning CPU on Math.random().
function pixelGrain(x, y) {
    const h = Math.imul(x * 73856093 ^ y * 19349663, 668265263);
    return (((h ^ (h >>> 13)) >>> 0) & 31) / 31 - 0.5;
}

// Sky above the surface, cave air below it. Writes into skyOutR/G/B to avoid
// allocating a color array for every sky pixel in every frame.
let skyOutR = 0, skyOutG = 0, skyOutB = 0;
function skyAt(worldX, worldY, underground, topR, topG, topB, botR, botG, botB,
    cloudR, cloudG, cloudB, cloudAmount, cloudThreshold, starAmount, starThreshold, time,
    moonX, moonY, moonR) {
    if (underground) {
        // Dark rock air with a very slight, depth-based tint.
        const d = Math.min(1, worldY / 220);
        const grain = pixelGrain(worldX, worldY) * 4;
        skyOutR = 11 + d * 6 + grain;
        skyOutG = 14 + d * 8 + grain;
        skyOutB = 20 + d * 11 + grain;
        return;
    }

    const t = Math.min(1, worldY / 190);
    let r = topR + (botR - topR) * t;
    let g = topG + (botG - topG) * t;
    let b = topB + (botB - topB) * t;

    // Sparse stars, twinkling gently.
    if (starAmount > 0 && worldY < 150) {
        let h = Math.imul(worldX * 374761393 + worldY * 668265263, 1274126177);
        h = (h ^ (h >>> 13)) >>> 0;
        const star = h / 4294967296;
        if (star > starThreshold) {
            const tw = 0.55 + 0.45 * Math.sin(time * 1.4 + (h % 97));
            const bright = 80 + 130 * tw;
            r = Math.min(255, r + bright);
            g = Math.min(255, g + bright);
            b = Math.min(255, b + bright);
        }
    }

    // Moon with a soft halo. Clouds are painted afterwards so they can drift
    // in front of it.
    if (moonR > 0) {
        const mdx = worldX - moonX;
        const mdy = worldY - moonY;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md <= moonR) {
            const edge = Math.min(1, (moonR - md) / 1.5);
            const mix = 0.5 + 0.38 * edge;
            r += (228 - r) * mix;
            g += (236 - g) * mix;
            b += (246 - b) * mix;
            if (md < moonR - 2 && pixelGrain(worldX, worldY) > 0.2) {
                r *= 0.92; g *= 0.94; b *= 0.92;
            }
        } else if (md < moonR + 7) {
            const hal = (1 - (md - moonR) / 7) * 0.14;
            r += (170 - r) * hal;
            g += (190 - g) * hal;
            b += (210 - b) * hal;
        }
    }

    // Soft pixel clouds, only in the upper part of the sky.
    if (cloudAmount > 0 && worldY < 150) {
        const n = Math.sin(worldX * 0.045 + time * 0.06)
            + Math.sin(worldX * 0.019 - worldY * 0.17 + 2.2)
            + Math.sin(worldY * 0.065 + worldX * 0.011 + 1.1)
            + Math.sin((worldX + worldY * 2) * 0.085 + 0.4);
        if (n > cloudThreshold) {
            const edge = Math.min(1, (n - cloudThreshold) * 2.2);
            const mask = 1 - Math.max(0, worldY - 95) / 70;
            const mix = (0.14 + 0.34 * edge) * Math.max(0, mask) * Math.min(1, cloudAmount * 1.6);
            r += (cloudR - r) * mix;
            g += (cloudG - g) * mix;
            b += (cloudB - b) * mix;
        }
    }

    skyOutR = r;
    skyOutG = g;
    skyOutB = b;
}

// Out-of-world background: sky above, dark rock below, no crashes.
function drawBackdropRow(y, above, topR, topG, topB, botR, botG, botB) {
    let r, g, b;
    if (above) {
        const t = Math.min(1, y / height);
        r = topR + (botR - topR) * t;
        g = topG + (botG - topG) * t;
        b = topB + (botB - topB) * t;
    } else {
        r = 7; g = 10; b = 15;
    }
    for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        data[pIdx] = r;
        data[pIdx + 1] = g;
        data[pIdx + 2] = b;
        data[pIdx + 3] = 255;
    }
}
