// =============================================================================
// sb-chunk.js - Infinite World Chunk Engine
// =============================================================================
// Manages chunks of the world. Each chunk is a vertical slice of width CHUNK_WIDTH.
// Chunks are lazily generated and only simulated when near the viewport.

const CHUNK_WIDTH = 32;
const BEDROCK_DEPTH = 5; // Bottom 5 pixels are bedrock

// ChunkEngine - Central manager for all world data
const ChunkEngine = {
    chunks: new Map(), // key: chunkX (integer), value: { grid, heatMap, liquidDir, fireworkVel, sparkColors, wireMap }
    height: 0, // Set during init from sb-data.js

    init(worldHeight) {
        this.height = worldHeight;
        this.chunks.clear();
    },

    // Get chunk X index from world X coordinate
    getChunkX(worldX) {
        return Math.floor(worldX / CHUNK_WIDTH);
    },

    // Ensure a chunk exists, create if not
    ensureChunk(chunkX) {
        if (this.chunks.has(chunkX)) return this.chunks.get(chunkX);

        const size = CHUNK_WIDTH * this.height;
        const chunk = {
            grid: new Int8Array(size),
            heatMap: new Uint8Array(size),
            liquidDir: new Int8Array(size),
            fireworkVel: new Int16Array(size),
            sparkColors: new Uint32Array(size),
            wireMap: new Uint8Array(size) // Stores electricity (0-255)
        };

        // Generate bedrock at bottom
        for (let x = 0; x < CHUNK_WIDTH; x++) {
            for (let y = this.height - BEDROCK_DEPTH; y < this.height; y++) {
                const idx = y * CHUNK_WIDTH + x;
                chunk.grid[idx] = M.BEDROCK;
            }
        }

        this.chunks.set(chunkX, chunk);
        return chunk;
    },

    // Get value at world coordinates
    getV(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return M.AIR;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return M.AIR;
        return chunk.grid[worldY * CHUNK_WIDTH + localX];
    },

    // Set value at world coordinates
    setV(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        const idx = worldY * CHUNK_WIDTH + localX;
        if (chunk.grid[idx] === M.BEDROCK && val !== M.BEDROCK) return;
        chunk.grid[idx] = val;
    },

    // Heat map accessors
    getHeat(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return 0;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return 0;
        return chunk.heatMap[worldY * CHUNK_WIDTH + localX];
    },

    setHeat(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        chunk.heatMap[worldY * CHUNK_WIDTH + localX] = val;
    },

    // Wire map accessors
    getWire(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return 0;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return 0;
        return chunk.wireMap[worldY * CHUNK_WIDTH + localX];
    },

    setWire(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        chunk.wireMap[worldY * CHUNK_WIDTH + localX] = val;
    },

    // Liquid direction accessors
    getLiquidDir(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return 0;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return 0;
        return chunk.liquidDir[worldY * CHUNK_WIDTH + localX];
    },

    setLiquidDir(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        chunk.liquidDir[worldY * CHUNK_WIDTH + localX] = val;
    },

    // Firework velocity accessors
    getFireworkVel(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return 0;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return 0;
        return chunk.fireworkVel[worldY * CHUNK_WIDTH + localX];
    },

    setFireworkVel(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        chunk.fireworkVel[worldY * CHUNK_WIDTH + localX] = val;
    },

    // Spark colors accessors
    getSparkColor(worldX, worldY) {
        if (worldY < 0 || worldY >= this.height) return 0;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.chunks.get(chunkX);
        if (!chunk) return 0;
        return chunk.sparkColors[worldY * CHUNK_WIDTH + localX];
    },

    setSparkColor(worldX, worldY, val) {
        if (worldY < 0 || worldY >= this.height) return;
        const chunkX = this.getChunkX(worldX);
        const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
        const chunk = this.ensureChunk(chunkX);
        chunk.sparkColors[worldY * CHUNK_WIDTH + localX] = val;
    },

    // Get list of chunk indices that should be active (visible + buffer)
    getActiveChunkIndices(viewportStartX, viewportEndX) {
        const startChunk = this.getChunkX(viewportStartX) - 1; // 1 chunk buffer
        const endChunk = this.getChunkX(viewportEndX) + 1;
        const indices = [];
        for (let i = startChunk; i <= endChunk; i++) {
            indices.push(i);
        }
        return indices;
    },

    // Load chunks for a viewport range (ensures they exist)
    loadChunksForViewport(viewportStartX, viewportEndX) {
        const indices = this.getActiveChunkIndices(viewportStartX, viewportEndX);
        for (const idx of indices) {
            this.ensureChunk(idx);
        }
        return indices;
    },

    // Clear world - reset all chunks
    clearWorld() {
        this.chunks.clear();
    },

    // Export world data for saving
    exportWorld() {
        const exportData = [];
        for (const [x, chunk] of this.chunks) {
            // Include wireMap in export if present
            exportData.push({
                x: x,
                grid: chunk.grid,
                wireMap: chunk.wireMap // Also save wire state
            });
        }
        return exportData;
    },

    // Import world data
    importWorld(data) {
        this.clearWorld();
        if (Array.isArray(data)) {
            for (const chunkData of data) {
                const chunk = this.ensureChunk(chunkData.x);
                if (chunkData.grid) chunk.grid.set(chunkData.grid);
                if (chunkData.wireMap) chunk.wireMap.set(chunkData.wireMap);
            }
        }
    },

    // Get all loaded chunks (for saving/iteration)
    getAllChunks() {
        return this.chunks;
    }
};

// Make ChunkEngine globally available
window.ChunkEngine = ChunkEngine;
window.CHUNK_WIDTH = CHUNK_WIDTH;
window.BEDROCK_DEPTH = BEDROCK_DEPTH;
