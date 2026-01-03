function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Update visual canvas
    canvas.width = screenW * dpr;
    canvas.height = screenH * dpr;

    // Update simulation grid to match aspect ratio
    const aspect = screenW / screenH;
    let newW, newH;
    if (aspect > 1) {
        newH = targetShort;
        newW = Math.round(targetShort * aspect);
    } else {
        newW = targetShort;
        newH = Math.round(targetShort / aspect);
    }

    if (newW !== width || newH !== height) {
        initBuffers(newW, newH);
    }
}
window.addEventListener('resize', resize);
resize();

// --- HELPER ---
function setPixel(x, y, mat) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = Math.floor(y) * width + Math.floor(x);
        grid[idx] = mat; heatMap[idx] = 0; liquidDir[idx] = 0;
    }
}
// Note: These helper functions depend on M defined in data.js
function drawRect(x, y, w, h, mat) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) setPixel(x + i, y + j, mat); }
function drawCircle(cx, cy, r, mat) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) setPixel(cx + x, cy + y, mat);
}
function drawTree(x, y) {
    const h = 10 + Math.random() * 5;
    drawRect(x, y - h, 2, h, M.WOOD); drawCircle(x + 1, y - h - 3, 5, M.LEAVES);
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;

    // Position within the canvas in CSS pixels
    const cssX = touch.clientX - rect.left;
    const cssY = touch.clientY - rect.top;

    // Convert to 0-1 range based on visual display size, 
    // then to simulation units, then account for viewport transformation.
    const simX = ((cssX / rect.width) * width - offsetX) / zoom;
    const simY = ((cssY / rect.height) * height - offsetY) / zoom;

    return {
        x: Math.floor(simX),
        y: Math.floor(simY)
    };
}

function resetWorld() {
    grid.fill(0);
    heatMap.fill(0);
    liquidDir.fill(0);
    fireworkVel.fill(0);
    sparkColors.fill(0);
    // Exit edit mode if function exists (clears the world name from UI)
    if (typeof exitEditMode === 'function') exitEditMode();
}
