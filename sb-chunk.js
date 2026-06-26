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
        this._generateBedrock();
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
        this.prevGrid.set(this.grid);
    },

    // --- Export / Import for saving ---
    exportWorld() {
        return {
            grid: new Int8Array(this.grid),
            wireMap: new Uint8Array(this.wireMap)
        };
    },

    importWorld(data) {
        if (data && data.grid) this.grid.set(data.grid);
        if (data && data.wireMap) this.wireMap.set(data.wireMap);
    }
};

window.ChunkEngine = ChunkEngine;
window.BEDROCK_DEPTH = BEDROCK_DEPTH;
