function paint(e) {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;
    if (e.target.closest('#settingsPanel') || e.target.closest('#worldsPanel')) return;

    // Single placement for Firework
    if (currentMaterial === M.FIREWORK && (e.type === 'mousemove' || e.type === 'touchmove')) return;

    const { x, y } = getPos(e);
    // Force size 1 for firework (single rocket)
    let size = (currentMaterial === M.AIR) ? eraserSize : brushSize;
    if (currentMaterial === M.FIREWORK) size = 1;

    let r = (size <= 1) ? 0 : Math.floor(size / 2);

    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            let py = y + dy; let px = x + dx;
            if (px >= 0 && px < width && py >= 0 && py < height) {
                let idx = py * width + px;

                // Firework already present? skip
                if (currentMaterial === M.FIREWORK && grid[idx] === M.FIREWORK) continue;

                if (currentMaterial === M.FIRE) {
                    if (grid[idx] === M.STONE) {
                        if (py > 0) { grid[(py - 1) * width + px] = M.FIRE; heatMap[(py - 1) * width + px] = 255; }
                        continue;
                    }
                }
                if (currentMaterial === M.FIRE && (grid[idx] === M.STONE || grid[idx] === M.WOOD)) continue;
                grid[idx] = currentMaterial;
                AudioEngine.play('place', 0.5, 0.8 + Math.random() * 0.4);
                if (currentMaterial === M.WATER) { heatMap[idx] = 0; liquidDir[idx] = 0; }
                // Randomize lifetime
                if (currentMaterial === M.FIREWORK) { fireworkVel[idx] = 240 + Math.floor(Math.random() * 30); }
            }
        }
    }
}

// --- INPUT HANDLING ---
let lastPinchDist = 0;
let lastMidX = 0;
let lastMidY = 0;

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

function handleTouch(e) {
    if (e.touches.length === 2) {
        isDrawing = false;
        const data = getPinchData(e);
        if (!data) return;

        const rect = canvas.getBoundingClientRect();
        // Convert screen midpoint to simulation-space "target" (without scaling/offset yet)
        const targetX = (data.midX - rect.left) * (width / rect.width);
        const targetY = (data.midY - rect.top) * (height / rect.height);

        if (lastPinchDist > 0) {
            // ZOOM
            const ratio = data.dist / lastPinchDist;
            const oldZoom = zoom;
            zoom *= ratio;

            // Constrain zoom
            zoom = Math.max(1.0, Math.min(zoom, 10.0));

            if (zoom === 1.0) {
                offsetX = 0;
                offsetY = 0;
            } else {
                // Adjust offsets so focal point stays under fingers
                const focalX = (targetX - offsetX) / oldZoom;
                const focalY = (targetY - offsetY) / oldZoom;

                offsetX = targetX - focalX * zoom;
                offsetY = targetY - focalY * zoom;

                // Constraints: prevent seeing beyond grid edges (avoid black area)
                offsetX = Math.min(0, Math.max(offsetX, width * (1 - zoom)));
                offsetY = Math.min(0, Math.max(offsetY, height * (1 - zoom)));
            }

            // PAN (movement of the midpoint)
            // Note: Pan is already somewhat handled by the focal point logic above if we use current targetX
            // but we can add more if needed.
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

canvas.addEventListener('mousedown', e => { isDrawing = true; paint(e); });
window.addEventListener('mousemove', e => { if (isDrawing) { paint(e); } });
window.addEventListener('mouseup', () => {
    if (isDrawing) {
        isDrawing = false;
        autoSaveIfEditing(); // Auto-save on draw end
    }
});

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        lastPinchDist = 0; // Reset
        isDrawing = false;
    } else if (e.touches.length === 1) {
        isDrawing = true;
        handleTouch(e);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault(); // Prevent scroll/zoom browser default
    handleTouch(e);
}, { passive: false });

canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) lastPinchDist = 0;
    if (e.touches.length === 0) {
        if (isDrawing) autoSaveIfEditing(); // Auto-save on touch end
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
    // Cap accumulator to prevent spiral of death or huge skips
    if (tickAccumulator > 5) tickAccumulator = 5;

    while (tickAccumulator >= 1) {
        updatePhysics();
        tickAccumulator -= 1;
    }

    draw();
    if (dt > 0 && (timestamp / 1000) % 1 < 0.1) fpsDisplay.innerText = Math.round(1000 / (dt || 1));

    // Periodical auto-save every ~5 seconds as safety
    if ((timestamp / 1000) % 5 < 0.02) {
        autoSaveIfEditing();
    }

    requestAnimationFrame(loop);
}

resetWorld();
renderTools(); // Init sidebar

// Wait for DB and then init UI state
(async () => {
    // Small delay to ensure DB is ready if needed
    setTimeout(async () => {
        if (typeof initUI === 'function') await initUI();
        requestAnimationFrame(loop);
    }, 100);
})();

