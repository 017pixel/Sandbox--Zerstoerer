function draw() {
    let i = 0;
    const time = Date.now() * 0.002;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = grid[i];
            const heat = heatMap[i];
            let r, g, b;

            if (cell === M.AIR || cell === M.FIREWORK) {
                if (heat > 0) {
                    let palIdx = 0;
                    if (heat > 220) palIdx = 4; else if (heat > 160) palIdx = 3;
                    else if (heat > 80) palIdx = 2; else if (heat > 20) palIdx = 1;
                    if (palIdx > 0) [r, g, b] = firePalette[palIdx];
                    else {
                        const grad = y / height;
                        r = 15 + (grad * 5); g = 23 + (grad * 10); b = 42 + (grad * 20);
                    }
                } else {
                    const grad = y / height;
                    r = 15 + (grad * 5); g = 23 + (grad * 10); b = 42 + (grad * 20);
                    const noise = Math.sin(x * 0.04 + time * 0.2) + Math.sin((x + y) * 0.02) + Math.sin(y * 0.1);
                    let mask = 1 - (y / (height * 0.45)); mask = Math.max(0, mask);
                    if (noise > 0.5 && mask > 0) {
                        const cloud = (noise * mask * 60); r += cloud; g += cloud; b += cloud + 10;
                    }
                }
            }
            else if (cell === M.FIRE) { r = 255; g = 255; b = 200; }
            else if (cell === M.SPARK) {
                const col = sparkColors[i];
                r = ((col >> 16) & 0xFF) * (heat / 200);
                g = ((col >> 8) & 0xFF) * (heat / 200);
                b = (col & 0xFF) * (heat / 200);
                r = Math.min(255, r + 50); g = Math.min(255, g + 30); b = Math.min(255, b + 20);
            }
            else if (cell === M.VINE) {
                const pattern = Math.sin(x * 0.5 + y * 0.3 + time) * 0.5 + 0.5;
                r = 20 + pattern * 30; g = 80 + pattern * 60 + (Math.random() - 0.5) * 20; b = 20 + pattern * 20;
                if (heat > 30) { r += heat * 0.5; g -= heat * 0.2; }
            }
            else if (cell === M.LAVA) {
                const glow = Math.sin(time * 2 + x * 0.2 + y * 0.1) * 0.3 + 0.7;
                r = 200 + glow * 55; g = 50 + glow * 80 + (Math.random() - 0.5) * 30; b = 0 + glow * 20;
            }
            else if (cell === M.EMBER) {
                const pulse = Math.sin(time * 5 + x * 0.1 + y * 0.1) * 0.5 + 0.5;
                r = 160 + pulse * 60; g = 40 + pulse * 20; b = 20;
            }
            else {
                if (colors[cell]) {
                    [r, g, b] = colors[cell];
                    if (cell !== M.WATER && cell !== M.STEAM) {
                        const noise = (Math.random() - 0.5) * 15; r += noise; g += noise; b += noise;
                    }
                    if (cell === M.WATER && liquidDir[i] !== 0) { r += 10; g += 10; b += 20; }
                    if ((cell === M.WOOD || cell === M.LEAVES) && heat > 50) { r += (heat / 2); g -= (heat / 3); }
                    if (cell === M.COAL && heat > 200) {
                        r += 180; g += 60; b += 20;
                        if (Math.random() > 0.8) { r += 40; g += 40; }
                    }
                } else {
                    r = 100; g = 0; b = 100;
                }
            }
            const pIdx = i * 4;
            data[pIdx] = r; data[pIdx + 1] = g; data[pIdx + 2] = b; data[pIdx + 3] = 255;
            i++;
        }
    }

    // Render to offscreen canvas
    offscreenCtx.putImageData(imgData, 0, 0);

    // Draw Sprites to offscreen
    for (let iy = 0; iy < height; iy++) {
        for (let ix = 0; ix < width; ix++) {
            if (grid[iy * width + ix] === M.FIREWORK) {
                offscreenCtx.fillStyle = '#94a3b8'; offscreenCtx.fillRect(ix, iy, 2, 4);
                offscreenCtx.fillStyle = '#ef4444'; offscreenCtx.fillRect(ix, iy + 1, 2, 1);
                offscreenCtx.fillStyle = '#e2e8f0'; offscreenCtx.fillRect(ix, iy, 2, 1);
            }
        }
    }

    // Draw offscreen to main canvas with zoom/offset
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = false;

    // Calculate base scale to fit simulation grid into high-res canvas
    const s = canvas.width / width;

    ctx.translate(offsetX * s, offsetY * s);
    ctx.scale(zoom * s, zoom * s);

    // Draw the offscreen simulation
    ctx.drawImage(offscreenCanvas, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
}
