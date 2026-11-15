// =============================================================================
// sb-chunk.js - Fixed World Data Engine
// =============================================================================
// Flat 2D arrays for a fixed-size world (WORLD_WIDTH x WORLD_HEIGHT).
// Replaces the old chunk-based Map system.

const BEDROCK_DEPTH = 5;

const ChunkEngine = {
    worldWidth: 0,
    worldHeight: 0,
    grid: null,         // Int8Array   — material type per cell
    heatMap: null,      // Uint8Array  — heat level (0-255)
    liquidDir: null,    // Int8Array   — liquid flow direction (-1 or +1)
    fireworkVel: null,  // Int16Array  — firework remaining velocity
    sparkColors: null,  // Uint32Array — spark RGB color
    wireMap: null,      // Uint8Array  — electricity signal (0-255)
    prevGrid: null,     // Int8Array   — grid snapshot for sensor change detection
    skyline: null,      // Uint16Array — first underground row per column

    init(w, h) {
        this.worldWidth = w;
        this.worldHeight = h;
        const size = w * h;
        this.grid = new Int8Array(size);
        this.heatMap = new Uint8Array(size);
        this.liquidDir = new Int8Array(size);
        this.fireworkVel = new Int16Array(size);
        this.sparkColors = new Uint32Array(size);
        this.wireMap = new Uint8Array(size);
        this.prevGrid = new Int8Array(size);
        this.skyline = new Uint16Array(w);
        this._generateBedrock();
        this._resetSkyline();
        this.prevGrid.set(this.grid);
    },

    _generateBedrock() {
        for (let x = 0; x < this.worldWidth; x++) {
            for (let y = this.worldHeight - BEDROCK_DEPTH; y < this.worldHeight; y++) {
                const idx = y * this.worldWidth + x;
                this.grid[idx] = M.BEDROCK;
            }
        }
    },

    _resetSkyline() {
        this.skyline.fill(this.worldHeight - BEDROCK_DEPTH);
    },

    // --- Skyline (surface between open sky and cave air) ---
    getSkyline(x) {
        if (x < 0 || x >= this.worldWidth) return this.worldHeight - BEDROCK_DEPTH;
        return this.skyline[x];
    },

    setSkyline(x, y) {
        if (x < 0 || x >= this.worldWidth) return;
        this.skyline[x] = Math.max(0, Math.min(this.worldHeight - BEDROCK_DEPTH, y | 0));
    },

    fillSkyline(y) {
        this.skyline.fill(Math.max(0, Math.min(this.worldHeight - BEDROCK_DEPTH, y | 0)));
    },

    // Flat index helper
    _idx(x, y) {
        if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) return -1;
        return y * this.worldWidth + x;
    },

    inBounds(x, y) {
        return x >= 0 && x < this.worldWidth && y >= 0 && y < this.worldHeight;
    },

    // --- Grid (material) ---
    getV(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return M.AIR;
        return this.grid[idx];
    },

    setV(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        if (this.grid[idx] === M.BEDROCK && val !== M.BEDROCK) return;
        this.grid[idx] = val;
    },

    // --- Heat Map ---
    getHeat(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return 0;
        return this.heatMap[idx];
    },

    setHeat(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        this.heatMap[idx] = val;
    },

    // --- Wire Map ---
    getWire(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return 0;
        return this.wireMap[idx];
    },

    setWire(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        this.wireMap[idx] = val;
    },

    // --- Liquid Direction ---
    getLiquidDir(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return 0;
        return this.liquidDir[idx];
    },

    setLiquidDir(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        this.liquidDir[idx] = val;
    },

    // --- Firework Velocity ---
    getFireworkVel(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return 0;
        return this.fireworkVel[idx];
    },

    setFireworkVel(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        this.fireworkVel[idx] = val;
    },

    // --- Spark Colors ---
    getSparkColor(x, y) {
        const idx = this._idx(x, y);
        if (idx < 0) return 0;
        return this.sparkColors[idx];
    },

    setSparkColor(x, y, val) {
        const idx = this._idx(x, y);
        if (idx < 0) return;
        this.sparkColors[idx] = val;
    },

    // --- Snapshot grid for sensor change detection ---
    snapshotGrid() {
        this.prevGrid.set(this.grid);
    },

    // --- Clear world ---
    clearWorld() {
        const size = this.worldWidth * this.worldHeight;
        this.grid.fill(0);
        this.heatMap.fill(0);
        this.liquidDir.fill(0);
        this.fireworkVel.fill(0);
        this.sparkColors.fill(0);
        this.wireMap.fill(0);
        this.prevGrid.fill(0);
        this._generateBedrock();
        this._resetSkyline();
        this.prevGrid.set(this.grid);
    },

    // --- Export / Import for saving ---
    exportWorld() {
        return {
            width: this.worldWidth,
            height: this.worldHeight,
            grid: new Int8Array(this.grid),
            wireMap: new Uint8Array(this.wireMap),
            skyline: new Uint16Array(this.skyline)
        };
    },

    importWorld(data) {
        if (!data || !data.grid) return false;

        const srcW = data.width || 320;
        const srcH = data.height || Math.round(data.grid.length / srcW);
        if (!srcW || !srcH) return false;

        const dstW = this.worldWidth;
        const dstH = this.worldHeight;

        this.heatMap.fill(0);
        this.liquidDir.fill(0);
        this.fireworkVel.fill(0);
        this.sparkColors.fill(0);
        this.wireMap.fill(0);

        if (srcW === dstW && srcH === dstH) {
            this.grid.set(data.grid);
            if (data.wireMap && data.wireMap.length === dstW * dstH) this.wireMap.set(data.wireMap);
            this._generateBedrock();
            if (data.skyline && data.skyline.length === dstW) {
                this.skyline.set(data.skyline);
            } else {
                this._deriveSkyline();
            }
        } else {
            // Older saves are smaller (320x180). Keep them intact: center
            // horizontally, anchor to the bottom so the ground stays grounded.
            this.grid.fill(0);
            this._generateBedrock();
            const xOff = Math.floor((dstW - srcW) / 2);
            const yOff = dstH - srcH;
            const rowLen = Math.min(srcW, dstW);
            for (let y = 0; y < srcH; y++) {
                const ty = y + yOff;
                if (ty < 0 || ty >= dstH) continue;
                for (let x = 0; x < rowLen; x++) {
                    const tx = x + xOff;
                    if (tx < 0 || tx >= dstW) continue;
                    const v = data.grid[y * srcW + x];
                    if (v === M.AIR || v === M.BEDROCK) continue;
                    this.grid[ty * dstW + tx] = v;
                }
            }
            if (data.wireMap && data.wireMap.length === srcW * srcH) {
                for (let y = 0; y < srcH; y++) {
                    const ty = y + yOff;
                    if (ty < 0 || ty >= dstH) continue;
                    for (let x = 0; x < rowLen; x++) {
                        const tx = x + xOff;
                        if (tx < 0 || tx >= dstW) continue;
                        const v = data.wireMap[y * srcW + x];
                        if (v) this.wireMap[ty * dstW + tx] = v;
                    }
                }
            }
            this._deriveSkyline();
        }

        this.prevGrid.set(this.grid);
        return true;
    },

    // Approximate the open-air/underground border from the grid. Used for
    // saves from before the skyline existed and for unusual resolutions.
    _deriveSkyline() {
        const W = this.worldWidth;
        const H = this.worldHeight;
        const bottom = H - BEDROCK_DEPTH;
        for (let x = 0; x < W; x++) {
            let line = bottom;
            for (let y = 0; y < bottom; y++) {
                const v = this.grid[y * W + x];
                if (v === M.AIR) continue;
                // Ignore thin floating structures (tree crowns, roofs).
                let support = 0;
                for (let k = 1; k <= 12 && y + k < bottom; k++) {
                    if (this.grid[(y + k) * W + x] !== M.AIR) support++;
                }
                if (support >= 7 || v === M.WATER) {
                    line = y;
                    break;
                }
            }
            this.skyline[x] = line;
        }
    }
};

window.ChunkEngine = ChunkEngine;
window.BEDROCK_DEPTH = BEDROCK_DEPTH;
