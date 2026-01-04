const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d', { alpha: false });
const fpsDisplay = document.getElementById('fps');
const entDisplay = document.getElementById('entityCount');

// --- CONFIG ---
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1366;
const targetShort = isTablet ? 220 : 180;

// Internal Simulation Size (Global) - height is fixed, width matches viewport
let width, height;

// Offscreen buffer for simulation pixels
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
let imgData, data;

// Initialize simulation dimensions based on aspect ratio
function initSimulationSize() {
    const aspect = window.innerWidth / window.innerHeight;
    let initialW, initialH;
    if (aspect > 1) {
        initialH = targetShort;
        initialW = Math.round(targetShort * aspect);
    } else {
        initialW = targetShort;
        initialH = Math.round(targetShort / aspect);
    }
    width = initialW;
    height = initialH;

    // Initialize ChunkEngine with world height
    ChunkEngine.init(height);

    // Prepare offscreen rendering buffer
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    imgData = offscreenCtx.createImageData(width, height);
    data = imgData.data;
}
initSimulationSize();

// Material definitions
const M = {
    AIR: 0, STONE: 1, SAND: 2, WATER: 3, WOOD: 4, LEAVES: 5, FIRE: 6,
    STEAM: 8, FIREWORK: 9, VINE: 10, LAVA: 11, SPARK: 12, COAL: 13,
    EMBER: 14, ACID: 15, METHANE: 16, ICE: 17, TERMITE: 18, CONCRETE: 19,
    LIGHTNING: 20, TNT: 21, URANIUM: 22, BEDROCK: 23,
    BATTERY: 24, WIRE: 25, BOOSTER: 26, LAMP: 27
};
const firePalette = [[0, 0, 0, 0], [160, 0, 0], [230, 90, 0], [255, 200, 0], [255, 255, 200]];

const colors = {};
colors[M.AIR] = [15, 23, 42];
colors[M.STONE] = [100, 100, 100];
colors[M.SAND] = [220, 200, 150];
colors[M.WATER] = [40, 100, 220];
colors[M.WOOD] = [101, 67, 33];
colors[M.LEAVES] = [50, 140, 50];
colors[M.STEAM] = [200, 220, 230];
colors[M.LAVA] = [255, 80, 0];
colors[M.VINE] = [30, 100, 30];
colors[M.FIREWORK] = [255, 255, 255];
colors[M.SPARK] = [255, 200, 100];
colors[M.COAL] = [40, 40, 40];
colors[M.EMBER] = [180, 60, 40];
colors[M.ACID] = [170, 255, 0];
colors[M.METHANE] = [20, 40, 30];
colors[M.ICE] = [180, 220, 255];
colors[M.TERMITE] = [200, 150, 100];
colors[M.CONCRETE] = [50, 50, 60];
colors[M.LIGHTNING] = [255, 255, 255];
colors[M.TNT] = [180, 40, 40];
colors[M.URANIUM] = [50, 255, 50];
colors[M.BEDROCK] = [30, 30, 30];
colors[M.BATTERY] = [30, 80, 50];   // Deep Emerald
colors[M.WIRE] = [184, 115, 51];   // Copper
colors[M.BOOSTER] = [70, 80, 90];  // Industrial Slate
colors[M.LAMP] = [50, 50, 50];     // Dark Gray (Off)

// --- STATE ---
let currentMaterial = M.STONE;
let isDrawing = false;
let brushSize = 2;
let eraserSize = 4;
let fireIntensity = 1.0;
let fireChaos = 0.5;
let simulationSpeed = 0.9;
let globalTime = 0;
let meltdownActive = false;
let meltdownTimer = 0;
let uraniumPresent = false;
let musicEnabled = true;
let sfxEnabled = true;

// --- INVENTORY STATE ---
const permanentTools = [
    { id: M.STONE, name: 'STEIN', col: 'bg-gray-600', border: 'border-gray-800' },
    { id: M.SAND, name: 'SAND', col: 'bg-yellow-600', border: 'border-yellow-800' },
    { id: M.WATER, name: 'WASSER', col: 'bg-blue-600', border: 'border-blue-800' },
    { id: M.WOOD, name: 'HOLZ', col: 'bg-amber-800', border: 'border-amber-950' },
    { id: M.FIRE, name: 'FEUER', col: 'bg-red-600', border: 'border-red-900' },
    { id: M.AIR, name: 'RADIEREN', col: 'bg-white/10', border: 'border-white/30' }
];

const extraToolsSource = [
    { id: M.LEAVES, name: 'BLATT', col: 'bg-green-700', border: 'border-green-900', desc: 'Wächst an Bäumen' },
    { id: M.FIREWORK, name: 'FEUERWERK', col: 'bg-yellow-500', border: 'border-yellow-700', desc: 'Schießt hoch & explodiert' },
    { id: M.VINE, name: 'RANKE', col: 'bg-emerald-700', border: 'border-emerald-900', desc: 'Wächst über Blöcke' },
    { id: M.LAVA, name: 'LAVA', col: 'bg-orange-600', border: 'border-orange-800', desc: 'Langsam, brennt alles' },
    { id: M.COAL, name: 'KOHLE', col: 'bg-gray-800', border: 'border-gray-950', desc: 'Brennt ewig' },
    { id: M.EMBER, name: 'GLUT', col: 'bg-red-900', border: 'border-red-950', desc: 'Entzündet Brennbares' },
    { id: M.ACID, name: 'SÄURE', col: 'bg-lime-500', border: 'border-lime-700', desc: 'Frisst fast alles' },
    { id: M.METHANE, name: 'METHAN', col: 'bg-green-900', border: 'border-green-950', desc: 'Explosives Gas' },
    { id: M.ICE, name: 'EIS', col: 'bg-cyan-300', border: 'border-cyan-500', desc: 'Schmilzt zu Wasser' },
    { id: M.TERMITE, name: 'TERMITE', col: 'bg-orange-300', border: 'border-orange-500', desc: 'Frisst Holz' },
    { id: M.CONCRETE, name: 'BETON', col: 'bg-slate-700', border: 'border-slate-900', desc: 'Sehr harter Stein' },
    { id: M.LIGHTNING, name: 'BLITZ', col: 'bg-yellow-200', border: 'border-yellow-400', desc: 'Schockt & Zündet' },
    { id: M.TNT, name: 'TNT', col: 'bg-red-700', border: 'border-red-900', desc: 'Explodiert' },
    { id: M.URANIUM, name: 'URAN', col: 'bg-green-500', border: 'border-green-700', desc: 'Radioaktive Hitze & Kernschmelze' },
    { id: M.BATTERY, name: 'BATTERIE', col: 'bg-emerald-600', border: 'border-emerald-800', desc: 'Stromquelle' },
    { id: M.WIRE, name: 'DRAHT', col: 'bg-orange-600', border: 'border-orange-800', desc: 'Leitet Strom' },
    { id: M.BOOSTER, name: 'VERSTÄRKER', col: 'bg-slate-500', border: 'border-slate-700', desc: 'Frischt das Signal auf' },
    { id: M.LAMP, name: 'LAMPE', col: 'bg-yellow-700', border: 'border-yellow-900', desc: 'Leuchtet bei Strom' },
];

let activeExtraTools = [];
let allCurrentTools = [];

// --- ZOOM & VIEWPORT STATE ---
// zoom: How much we magnify the view (1.0 = 100%)
// cameraX: World X coordinate at the LEFT edge of viewport (in simulation pixels)
// cameraY: World Y coordinate at the TOP edge of viewport (0 if zoomed out)
let zoom = 1.0;
let cameraX = 0;
let cameraY = 0;

// --- FAST RNG OPTIMIZATION ---
const RNG_SIZE = 8192;
const rngTable = new Float32Array(RNG_SIZE);
for (let i = 0; i < RNG_SIZE; i++) rngTable[i] = Math.random();
let rngIndex = 0;

function random() {
    rngIndex = (rngIndex + 1) & 8191;
    return rngTable[rngIndex];
}
