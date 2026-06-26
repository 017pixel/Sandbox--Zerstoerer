// =============================================================================
// sb-renderer.js - Rendering for Fixed World
// =============================================================================

function draw() {
    const time = Date.now() * 0.002;
    const W = WORLD_WIDTH;
    const H = WORLD_HEIGHT;

    // Viewport Calculations
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;

    // Clamp camera to world bounds
    const maxCamX = Math.max(0, W - viewWidth);
    const maxCamY = Math.max(0, H - viewHeight);
    cameraX = Math.max(0, Math.min(cameraX, maxCamX));
    cameraY = Math.max(0, Math.min(cameraY, maxCamY));

    const startX = Math.floor(cameraX);
    const startY = Math.floor(cameraY);

    const imgData = offscreenCtx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
        const worldY = Math.floor(startY + y / zoom);

        if (worldY < 0 || worldY >= H) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const grad = y / height;
                data[idx] = 15 + (grad * 5);
                data[idx + 1] = 23 + (grad * 10);
                data[idx + 2] = 42 + (grad * 20);
                data[idx + 3] = 255;
            }
            continue;
        }

        for (let x = 0; x < width; x++) {
            const worldX = Math.floor(startX + x / zoom);
            if (worldX < 0 || worldX >= W) {
                const idx = (y * width + x) * 4;
                const grad = y / height;
                data[idx] = 15 + (grad * 5);
                data[idx + 1] = 23 + (grad * 10);
                data[idx + 2] = 42 + (grad * 20);
                data[idx + 3] = 255;
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
                const wire = ChunkEngine.getWire(worldX, worldY);
                if (wire > 0) {
                    const pulse = Math.sin(time * 10 + worldX * 0.4) * 25 + 25;
                    r = 255;
                    g = 60 + pulse;
                    b = 30 + pulse * 0.3;
                } else {
                    r = 80; g = 20; b = 10;
                }
            }
            else if (cell === M.DETONATOR) {
                const wire = ChunkEngine.getWire(worldX, worldY);
                const adjPowered = (worldX > 0 && ChunkEngine.getV(worldX - 1, worldY) === M.WIRE && ChunkEngine.getWire(worldX - 1, worldY) > 50) ||
                    (worldX < W - 1 && ChunkEngine.getV(worldX + 1, worldY) === M.WIRE && ChunkEngine.getWire(worldX + 1, worldY) > 50) ||
                    (worldY > 0 && ChunkEngine.getV(worldX, worldY - 1) === M.WIRE && ChunkEngine.getWire(worldX, worldY - 1) > 50) ||
                    (worldY < H - 1 && ChunkEngine.getV(worldX, worldY + 1) === M.WIRE && ChunkEngine.getWire(worldX, worldY + 1) > 50);
                if (adjPowered || wire > 50) {
                    const blink = Math.sin(time * 16) > 0 ? 255 : 120;
                    r = blink; g = 50; b = 50;
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
                if (heat > 0) {
                    let palIdx = 0;
                    if (heat > 220) palIdx = 4;
                    else if (heat > 160) palIdx = 3;
                    else if (heat > 80) palIdx = 2;
                    else if (heat > 20) palIdx = 1;

                    if (palIdx > 0) {
                        [r, g, b] = firePalette[palIdx];
                    } else {
                        const grad = y / height;
                        r = 15 + (grad * 5); g = 23 + (grad * 10); b = 42 + (grad * 20);
                    }
                } else {
                    const grad = y / height;
                    r = 15 + (grad * 5); g = 23 + (grad * 10); b = 42 + (grad * 20);
                    const noise = Math.sin(worldX * 0.04 + time * 0.2) + Math.sin((worldX + worldY) * 0.02) + Math.sin(worldY * 0.1);
                    let mask = 1 - (worldY / (H * 0.45));
                    mask = Math.max(0, mask);

                    if (noise > 0.5 && mask > 0) {
                        const cloud = (noise * mask * 60);
                        r += cloud; g += cloud; b += cloud + 10;
                    }
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
                r = 20 + pattern * 30; g = 80 + pattern * 60 + (Math.random() - 0.5) * 20; b = 20 + pattern * 20;
                if (heat > 30) { r += heat * 0.5; g -= heat * 0.2; }
            }
            else if (cell === M.LAVA) {
                const glow = Math.sin(time * 2 + worldX * 0.2 + worldY * 0.1) * 0.3 + 0.7;
                r = 200 + glow * 55; g = 50 + glow * 80 + (Math.random() - 0.5) * 30; b = 0 + glow * 20;
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
                        const noise = (Math.random() - 0.5) * 15;
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
                        if (Math.random() > 0.8) { r += 40; g += 40; }
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(offscreenCanvas,
        0, 0, width, height,
        0, 0, canvas.width, canvas.height
    );
}
