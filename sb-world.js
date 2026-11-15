// =============================================================================
// sb-world.js - Detailed, device-friendly scenario worlds
// =============================================================================

// ---------------------------------------------------------------------------
// Scene randomness (deterministic: a reload of the same world looks the same)
// ---------------------------------------------------------------------------
let sceneSeed = 2463534242;
function seedScene(seed) {
    sceneSeed = (seed >>> 0) || 1;
}
function srnd() {
    sceneSeed ^= sceneSeed << 13; sceneSeed >>>= 0;
    sceneSeed ^= sceneSeed >>> 17;
    sceneSeed ^= sceneSeed << 5; sceneSeed >>>= 0;
    return sceneSeed / 4294967296;
}
function srange(min, max) { return min + srnd() * (max - min); }
function sint(min, max) { return Math.floor(min + srnd() * (max - min + 1)); }
function schance(p) { return srnd() < p; }
function spick(list) { return list[Math.floor(srnd() * list.length)]; }

function hash11(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
}
function vnoise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash11(i) * (1 - u) + hash11(i + 1) * u;
}
function fbm(x, octaves = 3) {
    let value = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
        value += vnoise(x * freq) * amp;
        norm += amp;
        freq *= 2;
        amp *= 0.5;
    }
    return value / norm;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
function box(x, y, w, h, mat) {
    const ix = Math.floor(x), iy = Math.floor(y);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) setPixel(ix + i, iy + j, mat);
    }
}

function ellipse(cx, cy, rx, ry, mat, rough = 0.2) {
    for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
            const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
            if (d > 1) continue;
            if (d > 0.72 && rough > 0 && schance(rough)) continue;
            setPixel(cx + x, cy + y, mat);
        }
    }
}

function line(x1, y1, x2, y2, thickness, mat) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
        const t = steps ? i / steps : 0;
        const x = Math.round(x1 + (x2 - x1) * t);
        const y = Math.round(y1 + (y2 - y1) * t);
        box(x, y, thickness, 1, mat);
    }
}

// Fill a terrain column and remember where open sky ends.
function groundColumn(x, topY, options = {}) {
    const bottom = WORLD_HEIGHT - BEDROCK_DEPTH;
    const top = Math.max(1, Math.min(bottom - 1, Math.floor(topY)));
    ChunkEngine.setSkyline(x, top);

    const soil = options.soil ?? 6;
    for (let y = top; y < bottom; y++) {
        const depth = y - top;
        let mat = options.rock ?? M.STONE;
        if (soil > 0) {
            if (depth < soil) mat = options.soilMat ?? M.SAND;
            else if (depth < soil + 3) mat = schance(0.4) ? M.SAND : M.STONE;
        }
        if (options.cap && depth === 0) mat = options.cap;
        setPixel(x, y, mat);
    }
}

function oreVein(x, y, length, mat = M.COAL) {
    let cx = x, cy = y;
    for (let i = 0; i < length; i++) {
        setPixel(cx, cy, mat);
        if (schance(0.45)) setPixel(cx + 1, cy, mat);
        cx += sint(-1, 1);
        cy += sint(0, 1);
        if (cy >= WORLD_HEIGHT - BEDROCK_DEPTH) break;
    }
}

function cavePocket(cx, cy, rx, ry) {
    ellipse(cx, cy, rx, ry, M.AIR, 0.5);
}

function leafBall(cx, cy, rx, ry, rough = 0.14) {
    for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
            const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
            if (d > 1) continue;
            if (d > 0.72 && schance(rough)) continue;
            setPixel(cx + x, cy + y, M.LEAVES);
        }
    }
}

function leafStrands(x, y, count, length) {
    for (let i = 0; i < count; i++) {
        const sx = x + sint(-6, 6);
        const len = sint(2, length);
        for (let j = 0; j < len; j++) {
            if (schance(0.8)) setPixel(sx, y + j, M.LEAVES);
        }
    }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------
function oakTree(x, groundY, scale = 1) {
    const h = Math.round(srange(58, 92) * scale);
    const phase = srange(0, Math.PI * 2);
    const trunkW = scale > 1.1 ? 5 : 4;
    const topX = x + Math.round(Math.sin(phase) * 7 * scale);
    const curve = (t) => x + Math.sin(t * 2.4 + phase) * 6 * scale + (topX - x) * t;

    for (let i = 0; i <= h; i++) {
        const t = i / h;
        const cx = Math.round(curve(t));
        const w = i > h - 8 ? Math.max(2, trunkW - 2) : trunkW;
        box(cx - (w >> 1), groundY - i, w, 1, M.WOOD);
    }

    // Root flare
    for (let i = -4; i <= 4; i++) {
        if (Math.abs(i) === 4 && schance(0.4)) continue;
        setPixel(x + i, groundY, M.WOOD);
        if (Math.abs(i) < 3) setPixel(x + i, groundY - 1, M.WOOD);
    }

    const branch = (t, dx, dy, size) => {
        const bx = Math.round(curve(t));
        const by = groundY - Math.round(h * t);
        line(bx, by, bx + dx, by + dy, 2, M.WOOD);
        leafBall(bx + Math.round(dx * 0.7), by + dy, 13 * size, 10 * size, 0.14);
    };

    // Branch arms and a lumpy crown
    branch(0.58, -24 * scale, -6, scale);
    branch(0.68, 25 * scale, -9, scale);
    branch(0.78, -15 * scale, -15, scale);
    branch(0.86, 18 * scale, -16, scale);

    const cx = Math.round(topX);
    const cy = groundY - h;
    leafBall(cx, cy - 15 * scale, 24 * scale, 17 * scale, 0.13);
    leafBall(cx - 17 * scale, cy - 4 * scale, 15 * scale, 12 * scale, 0.15);
    leafBall(cx + 17 * scale, cy - 6 * scale, 16 * scale, 12 * scale, 0.15);
    leafBall(cx - 6 * scale, cy + 5 * scale, 14 * scale, 10 * scale, 0.17);
    leafBall(cx + 8 * scale, cy + 4 * scale, 13 * scale, 10 * scale, 0.17);

    // A few fixed leaf strands under the crown (not growing vines).
    leafStrands(cx - 12 * scale, cy + 8 * scale, 2, 7);
    leafStrands(cx + 12 * scale, cy + 7 * scale, 2, 6);
}

function pineTree(x, groundY, scale = 1) {
    const h = Math.round(srange(100, 150) * scale);
    const trunkTop = groundY - h;
    box(x - 1, trunkTop, 3, h, M.WOOD);
    if (scale > 1) box(x - 2, trunkTop, 5, h, M.WOOD);

    const tiers = 6;
    for (let t = 0; t < tiers; t++) {
        const baseY = groundY - Math.round(h * (0.14 + t * 0.135));
        const halfW = Math.max(3, Math.round((19 - t * 2.6) * scale));
        const tierH = Math.round(h * 0.26);
        for (let j = 0; j < tierH; j++) {
            const f = 1 - j / tierH;
            const w = Math.round(halfW * f);
            for (let k = -w; k <= w; k++) {
                if (w - Math.abs(k) < 2 && schance(0.45)) continue;
                setPixel(x + k, baseY - j, M.LEAVES);
            }
        }
    }
    leafBall(x, trunkTop, 4, 8, 0.14);
}

function palmTree(x, groundY, height, lean) {
    const topX = x + Math.round(lean);
    for (let i = 0; i <= height; i++) {
        const t = i / height;
        const px = Math.round(x + lean * Math.pow(t, 1.7));
        box(px, groundY - i, 3, 1, M.WOOD);
        if (i > 4 && i % 5 === 0) setPixel(px - 1, groundY - i, M.WOOD);
    }
    const topY = groundY - height;
    const fronds = 9;
    for (let f = 0; f < fronds; f++) {
        const a = (f / fronds) * Math.PI * 2 + srange(-0.12, 0.12);
        const len = srange(20, 31);
        for (let s = 0; s < len; s++) {
            const t = s / len;
            const px = Math.round(topX + Math.cos(a) * s);
            const py = Math.round(topY + Math.sin(a) * s * 0.5 + t * t * 13);
            setPixel(px, py, M.LEAVES);
            setPixel(px, py + 1, M.LEAVES);
            if (s < len * 0.55 && f % 2 === 0) setPixel(px, py - 1, M.LEAVES);
        }
    }
    // Coconuts
    setPixel(topX - 2, topY + 4, M.WOOD);
    setPixel(topX + 2, topY + 5, M.WOOD);
    setPixel(topX, topY + 6, M.WOOD);
}

function deadTree(x, groundY, height) {
    const phase = srange(0, Math.PI * 2);
    for (let i = 0; i < height; i++) {
        const px = Math.round(x + Math.sin(i * 0.05 + phase) * 3);
        box(px, groundY - i, 2, 1, M.WOOD);
        if (i > height * 0.45 && schance(0.13)) {
            const dir = schance(0.5) ? -1 : 1;
            line(px, groundY - i, px + dir * sint(5, 12), groundY - i - sint(2, 7), 1, M.WOOD);
        }
    }
}

function bush(x, groundY, scale = 1) {
    leafBall(x, groundY - 4 * scale, 8 * scale, 5 * scale, 0.24);
    leafBall(x - 5 * scale, groundY - 2 * scale, 5 * scale, 4 * scale, 0.28);
    leafBall(x + 5 * scale, groundY - 2 * scale, 5 * scale, 4 * scale, 0.28);
}

function boulder(x, groundY, w, h) {
    ellipse(x, groundY - Math.round(h / 2), w, h, M.STONE, 0.14);
    for (let i = 0; i < 4; i++) setPixel(x + sint(-w, w), groundY - sint(0, h), M.COAL);
    for (let i = -w + 2; i < w - 2; i += 3) {
        if (schance(0.6)) setPixel(x + i, groundY - h, M.LEAVES);
    }
}

// ---------------------------------------------------------------------------
// Village buildings
// ---------------------------------------------------------------------------
function windowPane(x, y, w, h) {
    box(x, y, w, h, M.ICE);
    box(x, y + Math.floor(h / 2), w, 1, M.WOOD);
    box(x + Math.floor(w / 2), y, 1, h, M.WOOD);
}

function cottage(x, groundY, width, wallHeight, options = {}) {
    const wall = options.wall ?? M.WOOD;
    const roof = options.roof ?? M.CONCRETE;
    const top = groundY - wallHeight;

    box(x, groundY - 5, width, 5, M.STONE);
    box(x, top, width, wallHeight - 5, wall);
    box(x, top, 2, wallHeight, M.WOOD);
    box(x + width - 2, top, 2, wallHeight, M.WOOD);
    box(x, top, width, 1, M.WOOD);

    // Door
    const doorX = x + Math.floor(width / 2) - 4;
    box(doorX, groundY - 19, 8, 14, M.AIR);
    box(doorX - 1, groundY - 19, 1, 14, M.WOOD);
    box(doorX + 8, groundY - 19, 1, 14, M.WOOD);
    box(doorX, groundY - 20, 8, 1, M.WOOD);

    // Windows, framed in wood
    if (width >= 34) {
        windowPane(x + 5, top + 9, 7, 7);
        windowPane(x + width - 12, top + 9, 7, 7);
    } else {
        windowPane(x + Math.floor(width / 2) - 3, top + 8, 6, 6);
    }

    // Gabled roof with an overhang
    const roofH = Math.max(8, Math.round(width * 0.4));
    for (let d = 0; d < roofH; d++) {
        const rw = width + 8 - d * 2;
        if (rw <= 0) break;
        box(x - 4 + d, top - 1 - d, rw, 1, roof);
    }
    box(x - 4, top - 1, width + 8, 1, M.WOOD);

    // Chimney and smoke
    const chx = x + width - 13;
    box(chx, top - roofH - 11, 5, roofH + 12, M.STONE);
    for (let i = 0; i < 5; i++) {
        setPixel(chx + 1 + sint(-1, 1), top - roofH - 13 - i * 3, M.STEAM);
    }

    // Warm lantern beside the door
    setPixel(doorX + 10, groundY - 20, M.REDSTONE_TORCH);
}

function church(x, groundY) {
    const naveW = 58;
    const naveH = 54;
    const top = groundY - naveH;

    box(x, groundY - 6, naveW, 6, M.STONE);
    box(x, top, naveW, naveH - 6, M.WOOD);
    box(x, top, naveW, 1, M.WOOD);

    // Tall arched windows
    for (let i = 0; i < 3; i++) {
        const wx = x + 12 + i * 15;
        box(wx, top + 9, 7, 15, M.ICE);
        box(wx, top + 8, 7, 1, M.ICE);
        box(wx - 1, top + 9, 1, 15, M.WOOD);
        box(wx + 7, top + 9, 1, 15, M.WOOD);
    }

    // Nave roof
    const roofH = 24;
    for (let d = 0; d < roofH; d++) {
        const rw = naveW + 8 - d * 2;
        if (rw <= 0) break;
        box(x - 4 + d, top - 1 - d, rw, 1, M.CONCRETE);
    }

    // Bell tower on the left
    const tw = 22;
    const towerH = 104;
    const towerTop = groundY - towerH;
    box(x + 2, groundY - towerH, tw, towerH, M.STONE);
    box(x + 2, towerTop, tw, 2, M.WOOD);
    box(x + 2, groundY - 22, tw, 2, M.WOOD);

    // Tower door and bell opening
    box(x + 9, groundY - 20, 8, 14, M.AIR);
    box(x + 8, groundY - 21, 10, 1, M.WOOD);
    box(x + 7, towerTop + 18, 12, 14, M.AIR);
    box(x + 7, towerTop + 17, 12, 1, M.WOOD);

    // Spire and cross
    const spireH = 24;
    for (let d = 0; d < spireH; d++) {
        const rw = tw - d * 0.65;
        if (rw < 1) break;
        box(x + 2 + Math.round((tw - rw) / 2), towerTop - d, Math.max(1, Math.round(rw)), 1, M.CONCRETE);
    }
    box(x + 12, towerTop - spireH - 10, 2, 12, M.WOOD);
    box(x + 8, towerTop - spireH - 6, 10, 2, M.WOOD);

    // Tower clock / window
    box(x + 8, towerTop + 42, 10, 10, M.ICE);
    box(x + 12, towerTop + 42, 1, 10, M.WOOD);
    box(x + 8, towerTop + 46, 10, 1, M.WOOD);
}

function windmill(x, groundY) {
    const h = 62;
    const top = groundY - h;
    // Tapered stone tower
    for (let i = 0; i < h; i++) {
        const t = i / h;
        const w = Math.round(26 - t * 8);
        box(x - (w >> 1), groundY - i, w, 1, M.STONE);
    }
    box(x - 11, top - 3, 22, 3, M.WOOD);
    box(x - 2, top + 14, 6, 8, M.AIR);
    box(x - 1, top + 30, 4, 5, M.ICE);
    box(x - 7, groundY - 20, 8, 14, M.AIR);

    // Four wooden sails
    const hubX = x;
    const hubY = top - 2;
    for (let a = 0; a < 4; a++) {
        const ang = (Math.PI / 4) + a * (Math.PI / 2);
        const ex = Math.round(hubX + Math.cos(ang) * 32);
        const ey = Math.round(hubY + Math.sin(ang) * 32);
        line(hubX, hubY, ex, ey, 2, M.WOOD);
        line(hubX + Math.round(Math.cos(ang + 0.22) * 10), hubY + Math.round(Math.sin(ang + 0.22) * 10),
            ex + Math.round(Math.cos(ang + 0.22) * 4), ey + Math.round(Math.sin(ang + 0.22) * 4), 1, M.WOOD);
    }
    box(hubX - 2, hubY - 2, 5, 5, M.CONCRETE);
}

function well(x, groundY) {
    box(x - 10, groundY - 10, 20, 10, M.STONE);
    box(x - 6, groundY - 9, 12, 6, M.WATER);
    box(x - 11, groundY - 11, 22, 2, M.STONE);
    box(x - 8, groundY - 20, 2, 10, M.WOOD);
    box(x + 6, groundY - 20, 2, 10, M.WOOD);
    for (let d = 0; d < 8; d++) {
        box(x - 10 + d, groundY - 21 - d, 20 - d * 2, 1, M.CONCRETE);
    }
    box(x - 1, groundY - 23, 1, 5, M.WIRE);
    box(x - 3, groundY - 18, 5, 3, M.WOOD);
}

function lampPost(x, groundY) {
    box(x, groundY - 22, 2, 22, M.WOOD);
    box(x - 3, groundY - 24, 8, 2, M.WOOD);
    torchCluster(x - 1, groundY - 27);
}

function fence(x1, x2, groundY) {
    for (let x = x1; x <= x2; x += 9) {
        box(x, groundY - 10, 2, 10, M.WOOD);
    }
    box(x1, groundY - 7, x2 - x1 + 1, 1, M.WOOD);
    box(x1, groundY - 4, x2 - x1 + 1, 1, M.WOOD);
}

function cropField(x, groundY, w, h) {
    box(x, groundY - h, w, h, M.SAND);
    for (let r = 4; r < w - 4; r += 7) {
        for (let y = groundY - h + 2; y < groundY - 1; y += 3) {
            setPixel(x + r, y, M.LEAVES);
            if (schance(0.5)) setPixel(x + r + 1, y - 1, M.LEAVES);
        }
    }
}

function mineCart(x, groundY) {
    box(x, groundY - 9, 14, 6, M.WOOD);
    box(x + 1, groundY - 10, 12, 1, M.WOOD);
    setPixel(x + 2, groundY - 3, M.STONE);
    setPixel(x + 11, groundY - 3, M.STONE);
    box(x - 4, groundY - 1, 22, 1, M.WOOD);
}

// ---------------------------------------------------------------------------
// Small atmosphere pieces
// ---------------------------------------------------------------------------
function torch(x, y) { setPixel(x, y, M.REDSTONE_TORCH); }

function torchCluster(x, y) {
    for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) setPixel(x + dx, y + dy, M.REDSTONE_TORCH);
    }
}

function ceilingLamp(x, y) {
    setPixel(x, y, M.REDSTONE_TORCH);
    setPixel(x + 1, y, M.REDSTONE_TORCH);
    setPixel(x, y + 1, M.WIRE);
    setPixel(x + 1, y + 1, M.WIRE);
    setPixel(x, y + 2, M.LAMP);
    setPixel(x + 1, y + 2, M.LAMP);
}

function supportFrame(x, y, w, h) {
    box(x, y, 3, h, M.WOOD);
    box(x + w - 3, y, 3, h, M.WOOD);
    box(x, y, w, 3, M.WOOD);
}

function ladder(x, y, h) {
    box(x, y, 1, h, M.WOOD);
    box(x + 7, y, 1, h, M.WOOD);
    for (let i = 2; i < h; i += 4) box(x, y + i, 8, 1, M.WOOD);
}

// ===========================================================================
// WORLDS
// ===========================================================================

function worldForest() {
    seedScene(9101);
    const base = 208;

    for (let x = 0; x < WORLD_WIDTH; x++) {
        let top = base + Math.sin(x * 0.012) * 13 + Math.sin(x * 0.034 + 1.4) * 5;
        top += (fbm(x * 0.02, 2) - 0.5) * 10;
        if (x > 288 && x < 344) top += Math.sin(((x - 288) / 56) * Math.PI) * 13;
        groundColumn(x, top, { soil: 6, sub: 22, cap: M.LEAVES });
    }

    // Little stream with a bridge
    const streamStart = 286;
    const streamEnd = 338;
    const streamSurface = ChunkEngine.getSkyline(312) + 2;
    for (let x = streamStart; x < streamEnd; x++) {
        const g = ChunkEngine.getSkyline(x);
        for (let y = g; y < g + 2; y++) setPixel(x, y, M.AIR);
        for (let y = g + 2; y < g + 10; y++) setPixel(x, y, M.WATER);
        for (let y = g + 10; y < g + 14; y++) setPixel(x, y, M.STONE);
        ChunkEngine.setSkyline(x, g);
    }
    for (let x = 292; x < 332; x++) {
        if (x % 4 < 3) {
            setPixel(x, streamSurface - 6, M.WOOD);
            setPixel(x, streamSurface - 5, M.WOOD);
        }
    }
    box(292, streamSurface - 7, 2, 11, M.WOOD);
    box(331, streamSurface - 7, 2, 11, M.WOOD);

    // Undergrowth
    for (let i = 0; i < 26; i++) {
        const bx = sint(20, 460);
        const gy = ChunkEngine.getSkyline(bx);
        if (gy > 150 && gy < 235) bush(bx, gy, srange(0.6, 1.1));
    }

    // Hero trees and a varied forest edge
    pineTree(142, ChunkEngine.getSkyline(142), 1.1);
    oakTree(230, ChunkEngine.getSkyline(230), 1.25);
    pineTree(374, ChunkEngine.getSkyline(374), 1.25);
    oakTree(72, ChunkEngine.getSkyline(72), 0.95);
    pineTree(438, ChunkEngine.getSkyline(438), 0.9);
    oakTree(320, ChunkEngine.getSkyline(320), 0.8);
    deadTree(46, ChunkEngine.getSkyline(46), 38);
    oakTree(268, ChunkEngine.getSkyline(268), 0.72);
    pineTree(196, ChunkEngine.getSkyline(196), 0.7);

    // A fallen log with termites (a small, identifiable hazard)
    const logY = ChunkEngine.getSkyline(412);
    box(400, logY - 4, 30, 6, M.WOOD);
    box(398, logY - 7, 4, 4, M.WOOD);
    for (let i = 0; i < 6; i++) setPixel(406 + i * 4, logY - 5 + sint(0, 2), M.TERMITE);
    leafBall(412, logY - 9, 9, 5, 0.25);

    // Ranger cabin
    cottage(54, ChunkEngine.getSkyline(74), 40, 34, { roof: M.WOOD });
    fence(20, 48, ChunkEngine.getSkyline(20));

    // Rocks and mushrooms (small tan accents)
    boulder(352, ChunkEngine.getSkyline(352), 9, 5);
    boulder(120, ChunkEngine.getSkyline(120), 5, 3);
    for (let i = 0; i < 7; i++) {
        const mx = sint(100, 280);
        const gy = ChunkEngine.getSkyline(mx);
        if (gy > 150) {
            box(mx, gy - 4, 1, 3, M.WOOD);
            setPixel(mx - 1, gy - 5, M.SAND);
            setPixel(mx, gy - 5, M.SAND);
            setPixel(mx + 1, gy - 5, M.SAND);
        }
    }

    // Underground: coal, pockets of methane and a small cave
    for (let i = 0; i < 10; i++) oreVein(sint(20, 460), sint(240, 285), sint(6, 16));
    cavePocket(120, 258, 18, 8);
    cavePocket(398, 265, 22, 7);
    for (let i = 0; i < 4; i++) setPixel(sint(105, 135), sint(252, 264), M.METHANE);
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let y = 240; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) {
            if (ChunkEngine.getV(x, y) === M.AIR && schance(0.02)) setPixel(x, y, M.METHANE);
        }
    }
}

function worldVillage() {
    seedScene(9202);
    const base = 216;

    for (let x = 0; x < WORLD_WIDTH; x++) {
        let top = base + Math.sin(x * 0.011 + 0.7) * 6 + Math.sin(x * 0.05) * 2;
        if (x > 390) top -= Math.max(0, (x - 390) * 0.28);
        groundColumn(x, top, { soil: 5, sub: 16, cap: M.LEAVES });
    }

    // Main road
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const gy = ChunkEngine.getSkyline(x);
        if (gy > 205 && gy < 235) {
            setPixel(x, gy, M.SAND);
            if (schance(0.22)) setPixel(x, gy - 1, M.STONE);
        }
    }

    // Church and square
    church(210, 216);
    well(300, 218);
    lampPost(190, ChunkEngine.getSkyline(190));
    lampPost(360, ChunkEngine.getSkyline(360));
    box(266, 213, 14, 2, M.WOOD);
    box(267, 215, 2, 3, M.WOOD);
    box(277, 215, 2, 3, M.WOOD);
    box(198, 204, 2, 13, M.WOOD);
    box(192, 201, 14, 5, M.WOOD);
    setPixel(197, 203, M.STONE);
    setPixel(201, 203, M.STONE);
    setPixel(199, 204, M.STONE);

    // Small plants along the road
    for (let i = 0; i < 16; i++) {
        const x = sint(20, 460);
        const gy = ChunkEngine.getSkyline(x);
        if (gy > 205) {
            setPixel(x + sint(-1, 1), gy - 1, M.LEAVES);
            if (schance(0.4)) setPixel(x + sint(-1, 1), gy - 2, M.LEAVES);
        }
    }

    // Cottages
    cottage(96, 218, 48, 40, { roof: M.CONCRETE });
    cottage(346, 217, 52, 42, { roof: M.WOOD });
    cottage(52, 219, 34, 30, { roof: M.CONCRETE });
    cottage(405, 216, 38, 32, { roof: M.CONCRETE });
    cottage(160, 219, 30, 26, { roof: M.WOOD });

    // Windmill on the small hill
    windmill(450, ChunkEngine.getSkyline(450));

    // Garden, field and fences
    cropField(22, 220, 34, 8);
    fence(16, 60, 220);
    fence(150, 190, 219);
    cropField(154, 219, 32, 7);

    // Town trees
    oakTree(25, 218, 0.75);
    oakTree(390, 215, 0.9);
    oakTree(120, 217, 0.6);
    bush(75, 218, 0.8);
    bush(330, 217, 0.7);
    pineTree(440, ChunkEngine.getSkyline(440), 0.75);

    // Shed with a TNT crate
    cottage(320, 216, 28, 24, { wall: M.CONCRETE, roof: M.WOOD });
    const tntY = ChunkEngine.getSkyline(348);
    box(350, tntY - 5, 7, 5, M.TNT);

    // Cart and small details
    mineCart(250, 218);
    box(238, 213, 8, 5, M.WOOD);
    box(239, 218, 6, 2, M.SAND);
    for (let i = 0; i < 10; i++) {
        setPixel(sint(200, 340), 217 - sint(0, 2), M.SAND);
    }

    // A few smoke columns make the village feel alive
    for (let i = 0; i < 8; i++) {
        setPixel(191 + sint(-1, 1), 160 - i * 3, M.STEAM);
        setPixel(365 + sint(-1, 1), 153 - i * 3, M.STEAM);
    }

    // Underground: root cellar, methane, coal
    cavePocket(120, 260, 22, 9);
    cavePocket(370, 266, 26, 8);
    for (let i = 0; i < 9; i++) oreVein(sint(20, 460), sint(242, 288), sint(5, 14));
    for (let i = 0; i < 5; i++) setPixel(sint(210, 240), sint(250, 270), M.METHANE);
}

function worldIsland() {
    seedScene(9303);
    const sea = 212;
    const seabed = 250;

    const shoreLeft = 120;
    const shoreRight = 360;

    // Ocean basin with solid rock shores at both ends, so the water cannot
    // visually spill out of the world box.
    for (let x = 0; x < WORLD_WIDTH; x++) {
        if (x < shoreLeft || x >= shoreRight) {
            const top = 196 + Math.round(Math.sin(x * 0.11) * 2);
            groundColumn(x, top, { soil: 4, sub: 18, cap: M.LEAVES });
            continue;
        }
        for (let y = sea; y < seabed; y++) setPixel(x, y, M.WATER);
        for (let y = seabed; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) {
            setPixel(x, y, schance(0.03) ? M.COAL : M.STONE);
        }
        ChunkEngine.setSkyline(x, sea - 2);
    }

    // A compact island with a flat green plateau and a wide beach. Keeping
    // it narrower than the desktop viewport leaves the ocean visible.
    for (let x = 140; x < 340; x++) {
        const dx = (x - 240) / 95;
        let height = Math.pow(Math.max(0, 1 - Math.pow(dx, 4)), 0.5) * 62;
        height += (fbm(x * 0.08, 2) - 0.5) * 5;
        if (height < 1) continue;
        const top = Math.round(sea - height);

        for (let y = top; y < seabed; y++) {
            const depth = y - top;
            let mat = M.STONE;
            const beachDepth = top > sea - 10 ? 6 : top > sea - 34 ? 4 : 3;
            if (depth < beachDepth) mat = M.SAND;
            if (y > sea + 2) mat = M.STONE;
            setPixel(x, y, mat);
        }
        ChunkEngine.setSkyline(x, Math.min(sea - 2, top));

        // Green plateau, sandy beach.
        if (top < sea - 9) {
            setPixel(x, top, M.LEAVES);
            if (schance(0.35)) setPixel(x, top + 1, M.LEAVES);
            if (schance(0.18)) setPixel(x + sint(-1, 1), top, M.LEAVES);
        }
    }

    // Flat terrace for the beach hut on the plateau
    const hutBase = 158;
    for (let x = 168; x < 216; x++) {
        const top = ChunkEngine.getSkyline(x);
        for (let y = top; y < hutBase; y++) {
            if (ChunkEngine.getV(x, y) !== M.BEDROCK) setPixel(x, y, M.AIR);
        }
        for (let y = hutBase; y < seabed; y++) {
            setPixel(x, y, y < hutBase + 3 ? M.SAND : M.STONE);
        }
        ChunkEngine.setSkyline(x, hutBase);
    }

    // Hut with a peaked thatch roof
    box(171, hutBase - 26, 42, 26, M.WOOD);
    for (let d = 0; d < 11; d++) {
        const rw = 46 - d * 4;
        box(169 + d * 2, hutBase - 27 - d, rw, 1, d < 4 ? M.LEAVES : M.SAND);
    }
    box(184, hutBase - 16, 8, 16, M.AIR);
    box(176, hutBase - 21, 6, 6, M.ICE);
    box(200, hutBase - 21, 6, 6, M.ICE);
    box(190, hutBase - 2, 8, 2, M.SAND);

    // Rocks at the shoreline and on the plateau
    boulder(148, ChunkEngine.getSkyline(148), 8, 5);
    boulder(326, ChunkEngine.getSkyline(326), 9, 5);
    boulder(282, ChunkEngine.getSkyline(282), 6, 3);

    // Palm grove, anchored to the real surface
    palmTree(226, ChunkEngine.getSkyline(226), 62, -5);
    palmTree(262, ChunkEngine.getSkyline(262), 54, 4);
    palmTree(302, ChunkEngine.getSkyline(302), 48, 9);
    palmTree(318, ChunkEngine.getSkyline(318), 38, -6);
    bush(212, ChunkEngine.getSkyline(212), 0.6);
    bush(276, ChunkEngine.getSkyline(276), 0.55);

    // Jungle undergrowth on the plateau
    for (let i = 0; i < 14; i++) {
        const bx = sint(214, 330);
        const by = ChunkEngine.getSkyline(bx);
        if (by < sea - 8) bush(bx, by, srange(0.4, 0.7));
    }
    for (let i = 0; i < 22; i++) {
        const bx = sint(150, 334);
        const by = ChunkEngine.getSkyline(bx);
        if (by < sea - 4) setPixel(bx + sint(-2, 2), by, M.LEAVES);
    }

    // Underground strata and small pockets make the cutaway interesting
    for (let x = 140; x < 340; x++) {
        const top = ChunkEngine.getSkyline(x);
        for (let y = top + 18; y < 246; y++) {
            const band = (y + Math.round(Math.sin(x * 0.045) * 5)) % 34;
            if (band < 2 && schance(0.5)) setPixel(x, y, M.CONCRETE);
        }
    }
    cavePocket(216, 220, 20, 7);
    cavePocket(286, 232, 15, 5);
    for (let i = 0; i < 6; i++) oreVein(sint(160, 320), sint(210, 242), sint(4, 9));

    // Shipwreck on the right beach
    const sy = 208;
    line(300, sy - 10, 352, sy - 1, 4, M.WOOD);
    line(300, sy - 10, 316, sy - 18, 3, M.WOOD);
    line(332, sy - 4, 340, sy - 24, 2, M.WOOD);
    box(304, sy - 7, 10, 5, M.WOOD);
    for (let i = 0; i < 4; i++) setPixel(306 + i * 6, sy - 1, M.LEAVES);
    box(342, sy - 5, 8, 4, M.WOOD);

    // A small bamboo pier on the left beach
    box(142, 205, 22, 2, M.WOOD);
    box(144, 207, 2, 7, M.WOOD);
    box(160, 207, 2, 7, M.WOOD);

    // Coral and kelp only in the two water channels
    for (let i = 0; i < 16; i++) {
        const left = schance(0.5);
        const cx = left ? sint(124, 136) : sint(344, 356);
        const cy = sint(226, 246);
        for (let j = 0; j < sint(3, 7); j++) {
            setPixel(cx + sint(-2, 2), cy - sint(0, 2), M.LEAVES);
        }
    }
    for (let i = 0; i < 10; i++) {
        const left = schance(0.5);
        const kx = left ? sint(124, 136) : sint(344, 356);
        const ky = sint(228, 247);
        for (let j = 0; j < sint(2, 5); j++) setPixel(kx, ky - j, M.LEAVES);
    }

    // Shells and stones on the beach
    for (let i = 0; i < 14; i++) {
        const bx = sint(140, 340);
        const by = ChunkEngine.getSkyline(bx);
        if (by > sea - 10 && by < sea) setPixel(bx, by - 1, schance(0.5) ? M.SAND : M.STONE);
    }

    // Small plants on the containing cliffs
    bush(24, ChunkEngine.getSkyline(24), 0.6);
    bush(456, ChunkEngine.getSkyline(456), 0.6);
}

function worldVolcano() {
    seedScene(9404);
    const base = 242;
    const peakX = 240;

    for (let x = 0; x < WORLD_WIDTH; x++) {
        const d = Math.abs(x - peakX);
        let height = 154 * Math.pow(Math.max(0, 1 - d / 152), 1.15);
        height += (fbm(x * 0.05, 3) - 0.5) * 16;
        // A secondary cinder cone on the left flank
        const side = Math.abs(x - 124);
        if (side < 44) height += Math.pow(1 - side / 44, 1.4) * 34;
        height = Math.max(0, height);
        const top = Math.round(base - height);
        groundColumn(x, top, { soil: 0, rock: M.STONE });
        if (height > 4) ChunkEngine.setSkyline(x, top);
    }

    // Geological strata and glowing fissures
    for (let x = 24; x < 456; x++) {
        const top = ChunkEngine.getSkyline(x);
        for (let y = top + 14; y < 286; y++) {
            const band = (y + Math.round(Math.sin(x * 0.045) * 10)) % 46;
            if (band < 2 && schance(0.75)) setPixel(x, y, M.CONCRETE);
            else if (band === 2 && schance(0.4)) setPixel(x, y, M.COAL);
        }
    }
    for (let i = 0; i < 70; i++) {
        const x = sint(24, 456);
        const top = ChunkEngine.getSkyline(x);
        if (top > 235) continue;
        const y = top + sint(4, 40);
        setPixel(x, y, M.COAL);
        if (schance(0.5)) setPixel(x + 1, y + sint(0, 1), M.COAL);
    }
    for (let i = 0; i < 46; i++) {
        const x = 240 + sint(-70, 70);
        const top = ChunkEngine.getSkyline(x);
        if (top < 190) {
            for (let y = top + 2; y < top + 9; y += 2) {
                if (schance(0.5)) setPixel(x, y, M.EMBER);
            }
        }
    }

    // Crater bowl with a lava lake
    ellipse(peakX, 96, 19, 10, M.AIR, 0.12);
    box(peakX - 14, 100, 29, 5, M.LAVA);
    for (let x = peakX - 21; x <= peakX + 21; x++) {
        const rim = ChunkEngine.getSkyline(x);
        if (rim > 80 && rim < 100) setPixel(x, rim, M.EMBER);
    }

    // Lava runs down the flanks in shallow channels, so they glow inside the
    // mountain instead of tracing its whole silhouette.
    const flow = (startX, dir, length) => {
        let x = startX;
        for (let i = 0; i < length; i++) {
            const gy = ChunkEngine.getSkyline(x);
            for (let dy = 1; dy <= 4; dy++) setPixel(x, gy + dy, M.AIR);
            box(x, gy + 1, 3, 2, M.LAVA);
            if (schance(0.45)) setPixel(x, gy + 3, M.LAVA);
            setPixel(x, gy, M.STONE);
            if (schance(0.25)) setPixel(x - 1, gy + 1, M.EMBER);
            if (schance(0.25)) setPixel(x + 3, gy + 1, M.EMBER);
            x += dir * (1 + (i % 3 === 0 ? 1 : 0));
        }
    };
    flow(222, -1, 60);
    flow(258, 1, 26);

    // Side vent
    ellipse(326, 186, 10, 6, M.AIR, 0.15);
    box(319, 189, 14, 3, M.LAVA);

    // Lava basin at the foot
    ellipse(150, 254, 24, 9, M.AIR, 0.12);
    box(132, 256, 36, 6, M.LAVA);
    for (let x = 128; x < 172; x++) {
        if (schance(0.4)) setPixel(x, ChunkEngine.getSkyline(x), M.EMBER);
    }

    // Scorched trees and boulders at the base and on the flanks
    deadTree(112, ChunkEngine.getSkyline(112), 30);
    deadTree(368, ChunkEngine.getSkyline(368), 26);
    boulder(58, ChunkEngine.getSkyline(58), 9, 5);
    boulder(392, ChunkEngine.getSkyline(392), 8, 4);
    for (let i = 0; i < 14; i++) {
        const x = sint(100, 380);
        const gy = ChunkEngine.getSkyline(x);
        if (gy > 110 && gy < 225) {
            ellipse(x, gy - 2, sint(2, 6), sint(1, 3), M.CONCRETE, 0.3);
        }
    }
    for (let i = 0; i < 30; i++) {
        const x = sint(20, 460);
        const top = ChunkEngine.getSkyline(x);
        if (top > 228) {
            setPixel(x, top, schance(0.5) ? M.COAL : M.EMBER);
        }
    }

    // Smoke over the crater
    for (let i = 0; i < 12; i++) {
        setPixel(peakX + sint(-9, 9), 82 - i * 4, M.STEAM);
        if (schance(0.5)) setPixel(peakX + sint(-13, 13), 80 - i * 4, M.STEAM);
    }
}

function worldCave() {
    seedScene(9505);
    ChunkEngine.fillSkyline(0);

    // Solid rock
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let y = 0; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) {
            setPixel(x, y, schance(0.012) ? M.COAL : M.STONE);
        }
    }

    // Chambers and connecting tunnels
    const chambers = [
        [246, 148, 88, 44],
        [112, 188, 54, 36],
        [388, 168, 52, 44],
        [298, 236, 88, 30],
        [92, 248, 40, 22],
        [444, 232, 34, 24],
        [238, 96, 46, 18]
    ];
    for (const [cx, cy, rx, ry] of chambers) ellipse(cx, cy, rx, ry, M.AIR, 0.04);
    line(246, 148, 112, 188, 11, M.AIR);
    line(246, 148, 388, 168, 11, M.AIR);
    line(298, 190, 298, 236, 13, M.AIR);
    line(112, 210, 92, 248, 8, M.AIR);
    line(388, 198, 444, 232, 9, M.AIR);
    line(238, 110, 238, 148, 9, M.AIR);

    // Break up the chamber edges with larger chunks instead of pixel noise
    for (let i = 0; i < 28; i++) {
        const x = sint(40, 440);
        const y = sint(70, 265);
        if (ChunkEngine.getV(x, y) !== M.STONE) continue;
        const airNear = ChunkEngine.getV(x - 2, y) === M.AIR || ChunkEngine.getV(x + 2, y) === M.AIR ||
            ChunkEngine.getV(x, y - 2) === M.AIR || ChunkEngine.getV(x, y + 2) === M.AIR;
        if (airNear) ellipse(x, y, sint(2, 6), sint(2, 5), M.AIR, 0.2);
    }
    for (let i = 0; i < 10; i++) {
        const x = sint(40, 440);
        const y = sint(70, 265);
        if (ChunkEngine.getV(x, y) === M.AIR) {
            const stoneNear = ChunkEngine.getV(x - 2, y) === M.STONE || ChunkEngine.getV(x + 2, y) === M.STONE ||
                ChunkEngine.getV(x, y - 2) === M.STONE || ChunkEngine.getV(x, y + 2) === M.STONE;
            if (stoneNear) ellipse(x, y, sint(2, 4), sint(2, 4), M.STONE, 0.3);
        }
    }

    // Stone pillars keep the big cavern readable
    box(198, 108, 12, 48, M.STONE);
    box(304, 108, 14, 40, M.STONE);
    box(250, 128, 8, 22, M.STONE);

    // Stalactites and stalagmites
    for (let i = 0; i < 26; i++) {
        const x = sint(60, 430);
        let y = 54;
        while (y < 260 && ChunkEngine.getV(x, y) !== M.AIR) y++;
        if (y < 240) {
            const len = sint(4, 14);
            for (let j = 0; j < len; j++) {
                const w = Math.max(1, Math.round((1 - j / len) * 3));
                box(x - (w >> 1), y + j, w, 1, M.STONE);
            }
        }
    }
    for (let i = 0; i < 24; i++) {
        const x = sint(60, 430);
        let y = sint(110, 240);
        if (ChunkEngine.getV(x, y) !== M.AIR) continue;
        while (y < 288 && ChunkEngine.getV(x, y) === M.AIR) y++;
        if (y >= 288) continue;
        const len = sint(3, 12);
        for (let j = 0; j < len; j++) {
            const w = Math.max(1, Math.round((1 - j / len) * 4));
            box(x - (w >> 1), y - 1 - j, w, 1, M.STONE);
        }
    }

    // Underground lake
    box(220, 237, 156, 10, M.WATER);
    for (let x = 214; x < 382; x++) {
        if (schance(0.35)) setPixel(x, 234 + sint(0, 2), M.STONE);
    }
    // A thin waterfall falling into the lake
    for (let y = 207; y < 237; y++) {
        setPixel(330, y, M.WATER);
        setPixel(331, y, M.WATER);
    }

    // Lava chamber in the left cavern
    box(86, 208, 48, 8, M.LAVA);
    box(84, 206, 52, 2, M.STONE);
    for (let i = 0; i < 26; i++) {
        const x = sint(84, 136);
        setPixel(x, 205 + sint(-1, 1), M.EMBER);
    }
    for (let i = 0; i < 6; i++) setPixel(sint(120, 170), sint(70, 120), M.METHANE);

    // Ice crystals in the right cavern
    for (let i = 0; i < 7; i++) {
        const cx = 386 + sint(-18, 18);
        const cy = 204 + sint(-6, 4);
        const h = sint(8, 18);
        for (let j = 0; j < h; j++) {
            const w = Math.max(1, Math.round((1 - j / h) * 5));
            box(cx - (w >> 1), cy - j, w, 1, M.ICE);
        }
    }
    for (let i = 0; i < 12; i++) setPixel(sint(370, 416), sint(176, 206), M.ICE);

    // Wooden bridge over the lake
    for (let x = 228; x < 370; x++) {
        if (x % 4 < 3) setPixel(x, 218, M.WOOD);
    }
    box(228, 218, 2, 20, M.WOOD);
    box(368, 218, 2, 20, M.WOOD);
    for (let i = 0; i < 5; i++) box(252 + i * 24, 214, 2, 5, M.WOOD);

    // A small stone shrine in the main chamber
    box(252, 186, 44, 5, M.STONE);
    box(258, 182, 32, 4, M.STONE);
    box(264, 178, 20, 4, M.STONE);
    box(266, 176, 16, 2, M.STONE);
    torchCluster(268, 172);
    torchCluster(276, 172);
    box(272, 160, 3, 16, M.ICE);
    setPixel(273, 159, M.ICE);
    box(256, 160, 4, 22, M.STONE);
    box(288, 160, 4, 22, M.STONE);
    for (let j = 0; j < 8; j++) {
        setPixel(257, 159 - j, M.ICE);
        setPixel(289, 159 - j, M.ICE);
    }

    // Supports, ladders and lanterns
    supportFrame(196, 120, 54, 70);
    supportFrame(302, 116, 48, 74);
    ladder(172, 142, 46);
    torchCluster(186, 178);
    torchCluster(356, 148);
    torchCluster(268, 122);
    torchCluster(128, 198);
    torchCluster(400, 198);
    torchCluster(300, 214);
    torchCluster(238, 96);

    // Coal veins and scattered details
    for (let i = 0; i < 26; i++) oreVein(sint(20, 460), sint(80, 280), sint(4, 12));
    for (let i = 0; i < 30; i++) {
        const x = sint(20, 460);
        const y = sint(90, 270);
        if (ChunkEngine.getV(x, y) === M.WOOD && schance(0.55)) {
            setPixel(x, y, M.TERMITE);
            if (schance(0.5)) setPixel(x + 1, y, M.TERMITE);
        }
    }
    // Metallic-looking coal clusters on the walls
    for (let i = 0; i < 12; i++) {
        const x = sint(40, 440);
        const y = sint(100, 260);
        if (ChunkEngine.getV(x, y) === M.STONE) setPixel(x, y, M.COAL);
    }
    // A small acid pool in the lower left chamber
    box(74, 252, 32, 5, M.ACID);
    box(70, 250, 40, 2, M.CONCRETE);
}

function worldMine() {
    seedScene(9606);
    const surface = 88;

    for (let x = 0; x < WORLD_WIDTH; x++) {
        let top = surface + Math.sin(x * 0.013 + 0.3) * 6 + Math.sin(x * 0.031) * 3;
        groundColumn(x, top, { soil: 5, sub: 16, cap: M.LEAVES });
    }

    // Geological strata behind the tunnels
    for (let x = 0; x < WORLD_WIDTH; x++) {
        const top = ChunkEngine.getSkyline(x);
        for (let y = top + 26; y < 288; y++) {
            const band = (y + Math.round(Math.sin(x * 0.02) * 6)) % 42;
            if (band < 2 && schance(0.55)) setPixel(x, y, M.CONCRETE);
            else if (band === 2 && schance(0.35)) setPixel(x, y, M.SAND);
        }
    }

    // Surface scenery
    oakTree(56, ChunkEngine.getSkyline(56), 0.8);
    pineTree(410, ChunkEngine.getSkyline(410), 0.85);
    oakTree(370, ChunkEngine.getSkyline(370), 0.6);
    bush(140, ChunkEngine.getSkyline(140), 0.7);
    boulder(450, ChunkEngine.getSkyline(450), 8, 4);
    for (let i = 0; i < 20; i++) {
        const gx = sint(20, 460);
        setPixel(gx, ChunkEngine.getSkyline(gx), M.SAND);
    }

    // Main shaft and levels
    const shaftX = 226;
    const shaftW = 18;
    const levelY = [116, 178, 242];
    box(shaftX, surface, shaftW, 288 - surface, M.AIR);
    for (const y of levelY) {
        box(26, y, 430, 10, M.AIR);
    }

    // Wooden shaft lining, ladders and lamps
    for (let y = surface + 8; y < 280; y += 26) {
        box(shaftX - 2, y, shaftW + 4, 2, M.WOOD);
        box(shaftX - 2, y, 2, 26, M.WOOD);
        box(shaftX + shaftW, y, 2, 26, M.WOOD);
    }
    ladder(shaftX + 2, surface + 6, 200);
    for (let i = 0; i < 7; i++) {
        ceilingLamp(shaftX + 12, surface + 22 + i * 30);
    }

    // Horizontal level supports and lamps
    for (const y of levelY) {
        for (let x = 44; x < 440; x += 54) {
            supportFrame(x, y - 2, 34, 12);
            if ((x / 54) % 2 < 1) torchCluster(x + 14, y + 2);
        }
    }

    // Rails and carts in the upper tunnels
    for (const y of [116, 178]) {
        box(64, y + 10, 330, 1, M.WOOD);
        mineCart(170, y + 10);
        box(172, y + 4, 10, 3, M.COAL);
        mineCart(340, y + 10);
        box(342, y + 4, 10, 3, M.COAL);
    }

    // Entrance shed and headframe
    box(198, 66, 76, 22, M.WOOD);
    for (let d = 0; d < 14; d++) {
        const inset = d * 3;
        box(194 + inset, 65 - d, 84 - inset * 2, 1, M.CONCRETE);
    }
    box(230, 70, 12, 18, M.AIR);
    box(208, 70, 6, 6, M.ICE);
    box(258, 70, 6, 6, M.ICE);
    line(212, 88, 228, 46, 4, M.CONCRETE);
    line(258, 88, 242, 46, 4, M.CONCRETE);
    line(226, 62, 246, 62, 3, M.CONCRETE);
    line(218, 76, 234, 60, 2, M.CONCRETE);
    line(254, 76, 238, 60, 2, M.CONCRETE);
    box(229, 42, 12, 6, M.CONCRETE);
    box(234, 48, 2, 16, M.WIRE);
    torchCluster(202, 80);
    // A TNT crate and a tool box beside the shed
    const crateY = ChunkEngine.getSkyline(282);
    box(280, crateY - 6, 7, 6, M.TNT);
    box(266, crateY - 5, 6, 5, M.WOOD);
    box(290, crateY - 4, 4, 4, M.STONE);

    // Surface greenery and a rock
    oakTree(120, ChunkEngine.getSkyline(120), 0.7);
    boulder(400, ChunkEngine.getSkyline(400), 7, 4);
    // Small wooden sign at the entrance
    box(214, 76, 2, 12, M.WOOD);
    box(208, 74, 14, 6, M.WOOD);
    setPixel(212, 76, M.STONE);
    setPixel(216, 76, M.STONE);
    setPixel(214, 77, M.STONE);

    // Rails on a small trestle, with a cart
    const railY = 80;
    box(300, railY, 70, 1, M.WOOD);
    for (let x = 302; x <= 368; x += 11) {
        const gy = ChunkEngine.getSkyline(x);
        if (gy > railY) box(x, railY + 1, 2, gy - railY - 1, M.WOOD);
    }
    mineCart(336, railY);

    // Underground details
    for (let i = 0; i < 30; i++) oreVein(sint(30, 450), sint(110, 286), sint(4, 12));
    for (let i = 0; i < 8; i++) cavePocket(sint(60, 420), sint(110, 280), sint(5, 14), sint(3, 7));

    // TNT storage on the middle level
    box(96, 168, 26, 10, M.WOOD);
    box(100, 171, 7, 6, M.TNT);
    box(110, 171, 7, 6, M.TNT);
    box(120, 171, 3, 6, M.WOOD);

    // Flooded lower tunnel
    box(340, 242, 60, 10, M.WATER);
    box(338, 240, 64, 2, M.STONE);

    // Lava pocket deep left
    ellipse(90, 266, 24, 10, M.AIR, 0.2);
    box(68, 268, 44, 7, M.LAVA);
    for (let i = 0; i < 12; i++) setPixel(sint(68, 112), 265 + sint(-2, 1), M.EMBER);

    // Methane pockets and termite damage
    for (let i = 0; i < 10; i++) setPixel(sint(60, 430), sint(120, 220), M.METHANE);
    for (let i = 0; i < 14; i++) {
        const x = sint(50, 430);
        const y = sint(120, 270);
        if (ChunkEngine.getV(x, y) === M.WOOD) {
            setPixel(x, y, M.TERMITE);
            if (schance(0.5)) setPixel(x + 1, y, M.TERMITE);
        }
    }

    // A collapsed section with rubble
    box(384, 180, 20, 8, M.AIR);
    for (let i = 0; i < 16; i++) setPixel(sint(384, 404), sint(180, 192), M.STONE);
}

function worldIce() {
    seedScene(9707);
    const lake = 222;

    // Frozen lake with solid banks at both ends, so the water stays in the box
    const iceShore = 26;
    for (let x = 0; x < WORLD_WIDTH; x++) {
        if (x < iceShore || x >= WORLD_WIDTH - iceShore) {
            for (let y = lake - 8; y < lake; y++) setPixel(x, y, M.ICE);
            for (let y = lake; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) setPixel(x, y, M.STONE);
            ChunkEngine.setSkyline(x, lake - 8);
            continue;
        }
        for (let y = 226; y < 254; y++) setPixel(x, y, M.WATER);
        for (let y = lake; y < 226; y++) setPixel(x, y, M.ICE);
        for (let y = 254; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) setPixel(x, y, M.STONE);
        ChunkEngine.setSkyline(x, lake);
    }

    // Cracked ice and darker water holes
    for (let i = 0; i < 30; i++) {
        const x = sint(34, 446);
        const y = lake + sint(1, 4);
        setPixel(x, y, M.WATER);
        if (schance(0.5)) setPixel(x + 1, y, M.WATER);
    }
    // One larger open patch of water in front of the palace
    ellipse(146, lake + 2, 17, 3, M.WATER, 0.35);
    for (let x = 128; x < 166; x++) {
        if (schance(0.5)) setPixel(x, lake, M.WATER);
    }

    // Palace base platform and terrace
    box(96, lake - 8, 288, 8, M.ICE);
    box(120, lake - 4, 240, 4, M.ICE);
    for (let x = 96; x < 384; x += 8) {
        if (schance(0.7)) setPixel(x, lake - 8, M.CONCRETE);
    }

    // Central keep
    const keepX = 198;
    const keepW = 84;
    const keepBase = lake - 8;
    const keepTop = 132;
    box(keepX, keepTop, keepW, keepBase - keepTop, M.ICE);

    // Masonry seams: vertical pilasters and horizontal bands
    for (let x = keepX + 8; x < keepX + keepW; x += 16) {
        box(x, keepTop, 1, keepBase - keepTop, M.CONCRETE);
    }
    box(keepX, keepTop, keepW, 2, M.CONCRETE);
    box(keepX, keepBase - 8, keepW, 1, M.CONCRETE);
    for (let y = keepTop + 12; y < keepBase - 10; y += 14) {
        box(keepX, y, keepW, 1, M.CONCRETE);
    }

    // Keep battlements
    for (let x = keepX; x < keepX + keepW; x += 10) {
        box(x, keepTop - 8, 6, 9, M.ICE);
        setPixel(x + 3, keepTop - 9, M.CONCRETE);
    }

    // Arched gateway with a dark opening
    const gateW = 30;
    const gateX = keepX + (keepW - gateW) / 2;
    for (let d = 0; d < 9; d++) {
        const w = Math.max(1, gateW - 8 - d * 2);
        box(gateX + 4 + d, keepBase - 27 - d, w, 1, M.ICE);
    }
    box(gateX + 4, keepBase - 26, gateW - 8, 26, M.AIR);
    for (let i = 0; i < 4; i++) {
        box(gateX + 7 + i * 5, keepBase - 26, 2, 26, M.WOOD);
    }
    for (let x = gateX - 4; x < gateX + gateW + 4; x++) {
        ChunkEngine.setSkyline(x, keepBase - 28);
    }

    // Tall windows with ice panes
    for (let i = 0; i < 3; i++) {
        const wx = keepX + 12 + i * 22;
        box(wx, keepTop + 6, 9, 18, M.CONCRETE);
        box(wx + 1, keepTop + 7, 7, 16, M.ICE);
        box(wx + 4, keepTop + 7, 1, 16, M.CONCRETE);
    }

    // Central tower rising behind the keep
    box(232, 110, 20, keepTop - 110, M.ICE);
    box(229, 108, 26, 3, M.CONCRETE);
    for (let d = 0; d < 20; d++) {
        const w = Math.max(1, 20 - d);
        box(242 - Math.round(w / 2), 107 - d, Math.round(w), 1, M.CONCRETE);
    }
    box(241, 84, 2, 10, M.ICE);

    // Side towers with conical ice roofs
    const tower = (cx, base, w, h, roofH) => {
        const top = base - h;
        box(cx - (w >> 1), top, w, h, M.ICE);
        box(cx - (w >> 1) - 3, top, w + 6, 3, M.ICE);
        box(cx - (w >> 1) - 3, base - 4, w + 6, 4, M.ICE);
        box(cx - 1, top + 6, 2, h - 14, M.CONCRETE);
        for (let d = 0; d < roofH; d++) {
            const rw = Math.max(1, Math.round(w - d * (w / roofH)));
            box(cx - (rw >> 1), top - 3 - d, rw, 1, M.CONCRETE);
            if (d % 4 === 0 && rw > 3) {
                setPixel(cx - (rw >> 1), top - 3 - d, M.ICE);
                setPixel(cx + (rw >> 1), top - 3 - d, M.ICE);
            }
        }
        box(cx - (w >> 1), top + 18, 7, 12, M.CONCRETE);
        box(cx - (w >> 1) + 1, top + 19, 5, 10, M.ICE);
        if (h > 55) {
            box(cx - (w >> 1) + 3, top + 42, 7, 10, M.CONCRETE);
            box(cx - (w >> 1) + 4, top + 43, 5, 8, M.ICE);
        }
        for (let i = -w / 2; i < w / 2; i += 4) {
            if (schance(0.7)) setPixel(cx + Math.round(i), top + 3 + sint(0, 4), M.ICE);
        }
    };
    tower(160, keepBase, 28, 92, 24);
    tower(320, keepBase, 28, 84, 22);
    tower(112, keepBase, 18, 60, 16);
    tower(368, keepBase, 18, 68, 16);

    // Big rose window above the gate
    const rcX = 240, rcY = 168, rcR = 7;
    for (let y = -rcR; y <= rcR; y++) {
        for (let x = -rcR; x <= rcR; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d > rcR) continue;
            setPixel(rcX + x, rcY + y, d > rcR - 2 ? M.CONCRETE : M.ICE);
            if (d < 3) setPixel(rcX + x, rcY + y, M.CONCRETE);
            if ((Math.abs(x) <= 1 || Math.abs(y) <= 1) && d > 3) setPixel(rcX + x, rcY + y, M.CONCRETE);
        }
    }

    // Gate bridge and steps
    box(222, keepBase, 36, 3, M.ICE);
    box(226, keepBase + 3, 28, 2, M.CONCRETE);
    for (let i = 0; i < 4; i++) {
        box(228 + i * 4, keepBase + 5 + i, 24 - i * 4, 1, M.ICE);
    }

    // Frozen courtyard: pillars and drifts
    box(206, keepBase - 22, 4, 22, M.ICE);
    box(270, keepBase - 22, 4, 22, M.ICE);
    for (let i = 0; i < 10; i++) {
        ellipse(sint(110, 370), lake - sint(0, 3), sint(4, 10), sint(2, 4), M.ICE, 0.3);
    }

    // Ice floes on the open water
    for (const [fx, fy, fr] of [[126, 225, 9], [176, 227, 7], [338, 226, 10], [366, 228, 6]]) {
        ellipse(fx, fy, fr, 2, M.ICE, 0.2);
        ellipse(fx, fy - 1, fr - 2, 1, M.ICE, 0.2);
    }

    // Frozen trees on the shores
    for (const [tx, ty, th] of [[62, 222, 58], [82, 224, 42], [100, 222, 44], [380, 222, 48], [400, 222, 62], [424, 224, 46], [40, 226, 34]]) {
        deadTree(tx, ty, th);
        leafBall(tx, ty - th, 13, 10, 0.2);
        for (let i = 0; i < 20; i++) {
            setPixel(tx + sint(-15, 15), ty - th + sint(-11, 11), M.ICE);
        }
    }

    // Ice crystal clusters flanking the palace
    for (const [cx, cy, h] of [[132, 214, 24], [348, 214, 22], [122, 214, 16], [356, 214, 14]]) {
        for (let j = 0; j < h; j++) {
            const w = Math.max(1, Math.round((1 - j / h) * 7));
            box(cx - (w >> 1), cy - j, w, 1, M.ICE);
        }
        for (let j = 0; j < 5; j++) setPixel(cx + sint(-6, 6), cy - sint(0, 4), M.ICE);
    }
    for (let i = 0; i < 10; i++) {
        const cx = sint(20, 460);
        const cy = lake - sint(12, 34);
        const h = sint(4, 12);
        for (let j = 0; j < h; j++) {
            setPixel(cx, cy - j, M.ICE);
            if (j < h / 2) {
                setPixel(cx - 1, cy - j, M.ICE);
                setPixel(cx + 1, cy - j, M.ICE);
            }
        }
    }
    // Frozen waterfall at the right edge of the terrace
    for (let y = 190; y < 217; y++) {
        const x = 376 + Math.round(Math.sin(y * 0.12) * 3);
        box(x, y, 4, 1, M.ICE);
        if (schance(0.5)) box(x - 2, y, 2, 1, M.ICE);
    }

    // Frozen fountain in the courtyard
    for (const fx of [184, 296]) {
        ellipse(fx, keepBase - 2, 9, 3, M.ICE, 0.2);
        box(fx - 1, keepBase - 12, 3, 10, M.ICE);
        for (let j = 0; j < 6; j++) setPixel(fx + sint(-4, 4), keepBase - 4 - j, M.ICE);
    }

    // Ice crystal pedestals at the gate (no fire inside an ice palace)
    for (const px of [208, 256]) {
        box(px, keepBase - 36, 9, 5, M.STONE);
        for (let j = 0; j < 10; j++) {
            const w = Math.max(1, Math.round((1 - j / 10) * 5));
            box(px + 4 - (w >> 1), keepBase - 41 - j, w, 1, M.ICE);
        }
    }
    for (let j = 0; j < 6; j++) {
        setPixel(197, keepBase - 12 - j, M.ICE);
        setPixel(285, keepBase - 12 - j, M.ICE);
    }
}

function worldLabyrinth() {
    seedScene(9808);
    ChunkEngine.fillSkyline(0);

    // Stone dungeon base
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let y = 0; y < WORLD_HEIGHT - BEDROCK_DEPTH; y++) {
            setPixel(x, y, schance(0.01) ? M.COAL : M.CONCRETE);
        }
    }

    const cell = 16;
    const marginX = 24;
    const marginY = 22;
    const cols = 27; // odd
    const rows = 16; // even -> maze interior is odd (15)
    const gridW = cols * cell;
    const gridH = rows * cell;
    const ox = Math.floor((WORLD_WIDTH - gridW) / 2);
    const oy = Math.floor((WORLD_HEIGHT - gridH) / 2);

    // Carve a classic backtracker maze. Wrong cells are filled with sand so
    // the layout reads as a ruin instead of a black void.
    const walls = Array.from({ length: rows }, () => new Uint8Array(cols).fill(1));
    const stack = [{ x: 1, y: 1 }];
    walls[1][1] = 0;
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    while (stack.length) {
        const cur = stack[stack.length - 1];
        const options = [];
        for (const [dx, dy] of dirs) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && walls[ny][nx] === 1) {
                options.push([nx, ny, dx, dy]);
            }
        }
        if (options.length) {
            const [nx, ny, dx, dy] = spick(options);
            walls[cur.y + dy / 2][cur.x + dx / 2] = 0;
            walls[ny][nx] = 0;
            stack.push({ x: nx, y: ny });
        } else {
            stack.pop();
        }
    }

    // Entrance at the top and exit at the bottom
    walls[0][1] = 0;
    walls[rows - 1][cols - 2] = 0;

    // Carve the center into a 5x5 chamber
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    for (let y = cy - 2; y <= cy + 2; y++) {
        for (let x = cx - 2; x <= cx + 2; x++) walls[y][x] = 0;
    }

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const px = ox + x * cell;
            const py = oy + y * cell;
            if (walls[y][x] === 1) {
                box(px, py, cell, cell, M.STONE);
                box(px, py + cell - 2, cell, 2, M.CONCRETE);
                if (schance(0.2)) box(px + 2, py + 2, cell - 4, 1, M.CONCRETE);
            } else {
                box(px, py, cell, cell, M.SAND);
                if (schance(0.2)) setPixel(px + sint(2, cell - 3), py + sint(2, cell - 3), M.STONE);
                if (schance(0.12)) setPixel(px + sint(2, cell - 3), py + sint(2, cell - 3), M.COAL);
            }
        }
    }

    // Central treasure room (5x5 cells)
    const roomX = ox + (cx - 2) * cell;
    const roomY = oy + (cy - 2) * cell;
    const roomSize = cell * 5;
    box(roomX + 6, roomY + 6, roomSize - 12, roomSize - 12, M.SAND);
    // Floor medallion
    const mx = roomX + roomSize / 2;
    const my = roomY + roomSize / 2;
    for (let y = -28; y <= 28; y++) {
        for (let x = -28; x <= 28; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d >= 23 && d <= 26) setPixel(mx + x, my + y, M.CONCRETE);
            else if (d < 3) setPixel(mx + x, my + y, M.CONCRETE);
            else if ((Math.abs(x) <= 1 || Math.abs(y) <= 1) && d > 3 && d < 23) {
                setPixel(mx + x, my + y, M.CONCRETE);
            }
        }
    }
    box(roomX + 31, roomY + 38, 20, 10, M.STONE);
    box(roomX + 35, roomY + 26, 12, 12, M.ICE);
    box(roomX + 37, roomY + 40, 8, 5, M.TNT);
    torchCluster(roomX + 10, roomY + 10);
    torchCluster(roomX + roomSize - 14, roomY + 10);
    torchCluster(roomX + 10, roomY + roomSize - 14);
    torchCluster(roomX + roomSize - 14, roomY + roomSize - 14);

    // Torches along the outer border and random dead ends
    for (let x = ox + 12; x < ox + gridW - 12; x += 40) {
        torchCluster(x, oy + 2);
        torchCluster(x, oy + gridH - 4);
    }
    for (let y = oy + 16; y < oy + gridH - 10; y += 40) {
        torchCluster(ox + 2, y);
        torchCluster(ox + gridW - 4, y);
    }

    // Decoration: vines on wall edges, cracks, rubble
    for (let i = 0; i < 110; i++) {
        const x = sint(ox + 2, ox + gridW - 3);
        const y = sint(oy + 2, oy + gridH - 3);
        if (ChunkEngine.getV(x, y) === M.STONE) {
            if (schance(0.5)) setPixel(x, y, M.VINE);
            else setPixel(x, y, M.CONCRETE);
        }
    }
    for (let i = 0; i < 26; i++) {
        const x = sint(ox + 8, ox + gridW - 8);
        const y = sint(oy + 8, oy + gridH - 8);
        if (ChunkEngine.getV(x, y) === M.SAND) setPixel(x, y, M.COAL);
    }

    // A few TNT traps in the corridors
    for (let i = 0; i < 4; i++) {
        const x = sint(ox + 20, ox + gridW - 20);
        const y = sint(oy + 20, oy + gridH - 20);
        if (ChunkEngine.getV(x, y) === M.SAND) box(x, y, 3, 3, M.TNT);
    }
}

// ---------------------------------------------------------------------------
// Sky palettes and framing per world
// ---------------------------------------------------------------------------
const WORLD_ATMOSPHERES = {
    forest: { skyTop: [8, 19, 26], skyBottom: [20, 44, 45], cloud: [110, 146, 138], cloudAmount: 0.42, stars: 0.4, moon: { x: 300, y: 98, r: 11 } },
    village: { skyTop: [15, 18, 36], skyBottom: [56, 42, 54], cloud: [170, 140, 145], cloudAmount: 0.55, stars: 0.55, moon: { x: 120, y: 104, r: 9 } },
    island: { skyTop: [8, 24, 46], skyBottom: [32, 84, 100], cloud: [175, 200, 205], cloudAmount: 0.6, stars: 0.35, moon: { x: 368, y: 112, r: 10 } },
    volcano: { skyTop: [24, 10, 12], skyBottom: [72, 26, 20], cloud: [120, 62, 48], cloudAmount: 0.6, stars: 0.05 },
    cave: { skyTop: [8, 11, 16], skyBottom: [14, 18, 26], cloud: [0, 0, 0], cloudAmount: 0, stars: 0 },
    mine: { skyTop: [10, 18, 34], skyBottom: [28, 38, 58], cloud: [110, 140, 170], cloudAmount: 0.45, stars: 0.4, moon: { x: 370, y: 56, r: 10 } },
    ice: { skyTop: [7, 14, 36], skyBottom: [26, 48, 80], cloud: [150, 185, 225], cloudAmount: 0.5, stars: 1, moon: { x: 120, y: 92, r: 14 } },
    labyrinth: { skyTop: [8, 11, 16], skyBottom: [14, 18, 26], cloud: [0, 0, 0], cloudAmount: 0, stars: 0 }
};

const WORLD_VIEWS = {
    forest: { x: 240, y: 162 },
    village: { x: 240, y: 162 },
    island: { x: 238, mediumX: 200, narrowX: 225, y: 160 },
    volcano: { x: 240, y: 162 },
    cave: { x: 232, y: 166 },
    mine: { x: 240, y: 128 },
    ice: { x: 240, y: 152 },
    labyrinth: { x: 240, y: 150 }
};

const WORLD_BUILDERS = {
    forest: worldForest,
    village: worldVillage,
    island: worldIsland,
    volcano: worldVolcano,
    cave: worldCave,
    mine: worldMine,
    ice: worldIce,
    labyrinth: worldLabyrinth
};

// Generated moss may only sit in fully enclosed spots. Any vine that touches
// open air would start spreading across the scene, so turn those into leaves.
function tameVines() {
    const W = ChunkEngine.worldWidth;
    const H = ChunkEngine.worldHeight;
    const g = ChunkEngine.grid;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (g[idx] !== M.VINE) continue;
            if (ChunkEngine.getV(x - 1, y) === M.AIR || ChunkEngine.getV(x + 1, y) === M.AIR ||
                ChunkEngine.getV(x, y - 1) === M.AIR || ChunkEngine.getV(x, y + 1) === M.AIR) {
                g[idx] = M.LEAVES;
            }
        }
    }
}

function setWorldAtmosphere(type) {
    worldAtmosphere = WORLD_ATMOSPHERES[type] || DEFAULT_ATMOSPHERE;
    skyMapDirty = true;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
function toggleWorlds() {
    document.getElementById('worldsPanel').classList.toggle('hidden');
    document.getElementById('settingsPanel').classList.add('hidden');
}

function loadWorld(type) {
    const builder = WORLD_BUILDERS[type];
    if (!builder) return;

    resetWorld(false);
    document.getElementById('worldsPanel').classList.add('hidden');

    builder();
    tameVines();
    setWorldAtmosphere(type);

    const view = WORLD_VIEWS[type] || { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT * 0.56 };
    let focusX = view.x;
    if (view.mediumX !== undefined && width < 240) focusX = view.mediumX;
    if (view.narrowX !== undefined && width < 200) focusX = view.narrowX;
    frameWorld(focusX, view.y);
}
