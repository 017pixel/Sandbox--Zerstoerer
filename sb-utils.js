// =============================================================================
// sb-utils.js - Utility Functions for Infinite World
// =============================================================================

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Update visual canvas
    canvas.width = screenW * dpr;
    canvas.height = screenH * dpr;

    // Update simulation viewport dimensions to match aspect ratio
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
        width = newW;
        height = newH;
        ChunkEngine.height = height; // Sync height

        // Resize offscreen rendering buffer
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
        imgData = offscreenCtx.createImageData(width, height);
        data = imgData.data;
    }
}
window.addEventListener('resize', resize);
resize();

// --- HELPER ---
// Set pixel in world coordinates (infinite X)
function setPixel(x, y, mat) {
    if (y >= 0 && y < height) {
        ChunkEngine.setV(Math.floor(x), Math.floor(y), mat);
        ChunkEngine.setHeat(Math.floor(x), Math.floor(y), 0);
        ChunkEngine.setLiquidDir(Math.floor(x), Math.floor(y), 0);
    }
}

function drawRect(x, y, w, h, mat) {
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
            setPixel(x + i, y + j, mat);
        }
    }
}

function drawCircle(cx, cy, r, mat) {
    for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
            if (xx * xx + yy * yy <= r * r) {
                setPixel(cx + xx, cy + yy, mat);
            }
        }
    }
}

function drawTree(x, y) {
    const h = 10 + Math.random() * 5;
    drawRect(x, y - h, 2, h, M.WOOD);
    drawCircle(x + 1, y - h - 3, 5, M.LEAVES);
}

// Convert screen position to world coordinates
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;

    // Position within the canvas in CSS pixels
    const cssX = touch.clientX - rect.left;
    const cssY = touch.clientY - rect.top;

    // Convert to simulation viewport coordinates (0 to width/height)
    const viewX = (cssX / rect.width) * width;
    const viewY = (cssY / rect.height) * height;

    // Apply zoom and camera offset to get world coordinates
    const worldX = cameraX + (viewX / zoom);
    const worldY = cameraY + (viewY / zoom);

    return {
        x: Math.floor(worldX),
        y: Math.floor(worldY)
    };
}

// Reset world - clear all chunks
function resetWorld() {
    ChunkEngine.clearWorld();
    meltdownActive = false;
    meltdownTimer = 0;
    // Load initial chunks around camera
    const viewWidth = width / zoom;
    ChunkEngine.loadChunksForViewport(Math.floor(cameraX), Math.floor(cameraX + viewWidth));
    // Exit edit mode if function exists
    if (typeof exitEditMode === 'function') exitEditMode();
}
