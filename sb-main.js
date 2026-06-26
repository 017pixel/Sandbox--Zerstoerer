// =============================================================================
// sb-main.js - Main Loop & Input Handling for Infinite World
// =============================================================================
/* global canvas, getPos, isDrawing:writable, currentMaterial, M, eraserSize, brushSize, height */
/* global zoom:writable, cameraX:writable, cameraY:writable, autoSaveIfEditing, simulationSpeed, updatePhysics, draw, fpsDisplay */
/* global resetWorld, renderTools, initUI, width, ChunkEngine, AudioEngine */

function paint(e) {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    if (e.target.closest('#settingsPanel') || e.target.closest('#worldsPanel')) return;

    // Single placement for Firework
    if (currentMaterial === M.FIREWORK && (e.type === 'mousemove' || e.type === 'touchmove')) return;

    // Strom-Fackel: 0.3s placement delay
    if (currentMaterial === M.REDSTONE_TORCH) {
        const now = Date.now();
        if (now - lastTorchPlaceTime < 300) return;
        lastTorchPlaceTime = now;
    }

    const { x, y } = getPos(e);
    let size = (currentMaterial === M.AIR) ? eraserSize : brushSize;
    // --- BRUSH RULES ---
    if (currentMaterial === M.FIREWORK) {
        size = 1;
    } else if (currentMaterial === M.WIRE || currentMaterial === M.BOOSTER) {
        if (size <= 2) size = 1;
        else if (size <= 5) size = 2;
        else size = 4;
    } else if (currentMaterial === M.REDSTONE_TORCH) {
        size = 1;
    }

    let r = (size <= 1) ? 0 : Math.floor(size / 2);

    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            const py = y + dy;
            const px = x + dx;

            if (py >= 0 && py < WORLD_HEIGHT && px >= 0 && px < WORLD_WIDTH) {
                const existing = ChunkEngine.getV(px, py);

                // Firework already present? skip
                if (currentMaterial === M.FIREWORK && existing === M.FIREWORK) continue;

                // Can't place on bedrock
                if (existing === M.BEDROCK && currentMaterial !== M.AIR) continue;

                if (currentMaterial === M.FIRE) {
                    if (existing === M.STONE) {
                        if (py > 0) {
                            ChunkEngine.setV(px, py - 1, M.FIRE);
                            ChunkEngine.setHeat(px, py - 1, 255);
                        }
                        continue;
                    }
                }
                if (currentMaterial === M.FIRE && (existing === M.STONE || existing === M.WOOD)) continue;

                ChunkEngine.setV(px, py, currentMaterial);
                AudioEngine.play('place', 0.5, 0.8 + Math.random() * 0.4);

                if (currentMaterial === M.WATER) {
                    ChunkEngine.setHeat(px, py, 0);
                    ChunkEngine.setLiquidDir(px, py, 0);
                }
                if (currentMaterial === M.FIREWORK) {
                    ChunkEngine.setFireworkVel(px, py, 240 + Math.floor(Math.random() * 30));
                }
            }
        }
    }
}

// --- INPUT HANDLING ---
let lastPinchDist = 0;
let lastMidX = 0;
let lastMidY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;
let lastTorchPlaceTime = 0;

// Disable context menu on canvas for right-click pan
canvas.addEventListener('contextmenu', e => e.preventDefault());

function getPinchData(e) {
    if (e.touches.length < 2) return null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;
    return { dist, midX, midY };
}

// Mouse wheel zoom
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;

    // Get world X at mouse position before zoom
    const viewX = (cssX / rect.width) * width;
    const worldXAtMouse = cameraX + (viewX / zoom);

    // Adjust zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = zoom;
    zoom *= zoomFactor;
    // Limit zoom: No zooming out further than 1.0
    zoom = Math.max(1.0, Math.min(zoom, 5.0));

    // Adjust cameraX so the world point under mouse stays there
    if (zoom !== oldZoom) {
        cameraX = worldXAtMouse - (viewX / zoom);
        const maxCamX = Math.max(0, WORLD_WIDTH - (width / zoom));
        cameraX = Math.max(0, Math.min(cameraX, maxCamX));
    }
}, { passive: false });

// Right-click pan (mouse)
canvas.addEventListener('mousedown', e => {
    if (e.button === 2) {
        // Right-click = pan
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
    } else if (e.button === 0) {
        // Left-click = draw
        isDrawing = true;
        paint(e);
    }
});

window.addEventListener('mousemove', e => {
    if (isPanning) {
        const rect = canvas.getBoundingClientRect();
        const deltaX = e.clientX - lastPanX;
        const deltaY = e.clientY - lastPanY;

        // Convert screen delta to world delta
        const worldDeltaX = (deltaX / rect.width) * (width / zoom);
        const worldDeltaY = (deltaY / rect.height) * (height / zoom);

        cameraX -= worldDeltaX;
        cameraY -= worldDeltaY;

        // Clamp Camera X
        const maxCamX = Math.max(0, WORLD_WIDTH - (width / zoom));
        cameraX = Math.max(0, Math.min(cameraX, maxCamX));

        // Clamp Camera Y
        const maxCamY = Math.max(0, WORLD_HEIGHT - (height / zoom));
        cameraY = Math.max(0, Math.min(cameraY, maxCamY));

        lastPanX = e.clientX;
        lastPanY = e.clientY;
    } else if (isDrawing) {
        paint(e);
    }
});

window.addEventListener('mouseup', e => {
    if (e.button === 2) {
        isPanning = false;
    } else if (e.button === 0) {
        if (isDrawing) {
            isDrawing = false;
            autoSaveIfEditing();
        }
    }
});

// Touch handling
function handleTouch(e) {
    if (e.touches.length === 2) {
        // Two-finger pinch/pan
        isDrawing = false;
        const data = getPinchData(e);
        if (!data) return;

        const rect = canvas.getBoundingClientRect();
        const viewX = ((data.midX - rect.left) / rect.width) * width;
        const worldXAtMid = cameraX + (viewX / zoom);

        if (lastPinchDist > 0) {
            // ZOOM
            const ratio = data.dist / lastPinchDist;
            const oldZoom = zoom;
            zoom *= ratio;
            // Limit zoom: No zooming out further than 1.0
            zoom = Math.max(1.0, Math.min(zoom, 5.0));

            // Adjust cameraX so focal point stays under fingers
            if (zoom !== oldZoom) {
                cameraX = worldXAtMid - (viewX / zoom);
                const maxCamX = Math.max(0, WORLD_WIDTH - (width / zoom));
                cameraX = Math.max(0, Math.min(cameraX, maxCamX));
            }

            // PAN (movement of midpoint)
            const panDeltaX = data.midX - lastMidX;
            const panDeltaY = data.midY - lastMidY;
            const worldPanDeltaX = (panDeltaX / rect.width) * (width / zoom);
            const worldPanDeltaY = (panDeltaY / rect.height) * (height / zoom);
            cameraX -= worldPanDeltaX;
            cameraY -= worldPanDeltaY;

            // Clamp Camera
            const maxCamX2 = Math.max(0, WORLD_WIDTH - (width / zoom));
            cameraX = Math.max(0, Math.min(cameraX, maxCamX2));
            const maxCamY2 = Math.max(0, WORLD_HEIGHT - (height / zoom));
            cameraY = Math.max(0, Math.min(cameraY, maxCamY2));
        }

        lastPinchDist = data.dist;
        lastMidX = data.midX;
        lastMidY = data.midY;
    } else {
        lastPinchDist = 0;
        if (e.touches.length === 1 && !e.target.closest('button')) {
            paint(e);
        }
    }
}

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        lastPinchDist = 0;
        isDrawing = false;
    } else if (e.touches.length === 1) {
        isDrawing = true;
        handleTouch(e);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    handleTouch(e);
}, { passive: false });

canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastPinchDist = 0;
    if (e.touches.length === 0) {
        if (isDrawing) autoSaveIfEditing();
        isDrawing = false;
    }
}, { passive: false });

// --- ANIMATION LOOP ---
let lastTime = 0;
let tickAccumulator = 0;

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    tickAccumulator += simulationSpeed;
    if (tickAccumulator > 5) tickAccumulator = 5;

    while (tickAccumulator >= 1) {
        updatePhysics();
        tickAccumulator -= 1;
    }

    draw();
    if (dt > 0 && (timestamp / 1000) % 1 < 0.1) fpsDisplay.innerText = Math.round(1000 / (dt || 1));

    // Periodical auto-save every ~5 seconds
    if ((timestamp / 1000) % 5 < 0.02) {
        autoSaveIfEditing();
    }

    requestAnimationFrame(loop);
}

// Initialize
resetWorld();
renderTools();

// Wait for DB and then init UI state
(async () => {
    if (!sessionStorage.getItem('hasOpened')) {
        sessionStorage.setItem('hasOpened', 'true');
        location.reload();
        return;
    }

    setTimeout(async () => {
        if (typeof initUI === 'function') await initUI();
        requestAnimationFrame(loop);
    }, 100);
})();
