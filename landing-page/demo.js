/* A small, isolated world running the game's original physics and renderer.
   No storage, service worker or audio; it cannot overwrite a player's worlds.
   The demo uses the same material strip and controls as the real game. */
const AudioEngine = { play() {} };
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let visible = true;
let lastTick = 0;
let painting = false;
let fpsFrames = 0;
let fpsSince = 0;

const demoAtmosphere = {
  skyTop: [9, 20, 34],
  skyBottom: [20, 48, 52],
  cloud: [125, 158, 148],
  cloudAmount: 0.5,
  stars: 0.5,
  moon: { x: 356, y: 172, r: 8 }
};

function fitDemo() {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const aspect = vw / vh;

  // Keep the same horizontal framing (house, tree, pond) and grow the
  // visible vertical slice on taller containers. Nothing is cropped.
  width = 320;
  height = Math.round(width / aspect);
  height = Math.max(100, Math.min(WORLD_HEIGHT, height));

  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  imgData = offscreenCtx.createImageData(width, height);
  data = imgData.data;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);

  zoom = 1;
  cameraX = 72;
  cameraY = Math.round(218 - height * 0.72);
  cameraY = Math.max(0, Math.min(WORLD_HEIGHT - height, cameraY));
  draw();
}
window.addEventListener('resize', fitDemo);

function seedDemo() {
  resetWorld(false);
  seedScene(4242);
  worldAtmosphere = demoAtmosphere;
  skyMapDirty = true;

  // Cutaway terrain with a pond.
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const top = 218 + Math.sin(x * 0.014 + 0.6) * 5 + Math.sin(x * 0.045) * 2;
    groundColumn(x, top, { soil: 6, sub: 16, cap: M.LEAVES });
  }

  // Pond and sandy banks
  const waterLine = 226;
  for (let x = 262; x < 346; x++) {
    const bank = Math.round(Math.sin(((x - 262) / 84) * Math.PI) * 5);
    const g = ChunkEngine.getSkyline(x);
    for (let y = g; y < waterLine; y++) {
      if (ChunkEngine.getV(x, y) !== M.BEDROCK) setPixel(x, y, M.AIR);
    }
    for (let y = waterLine; y < waterLine + 10 + bank; y++) setPixel(x, y, M.WATER);
    for (let y = waterLine + 10 + bank; y < waterLine + 16; y++) {
      if (ChunkEngine.getV(x, y) !== M.BEDROCK) setPixel(x, y, M.STONE);
    }
    ChunkEngine.setSkyline(x, waterLine - 2);
  }
  for (let x = 250; x < 262; x++) {
    const g = ChunkEngine.getSkyline(x);
    for (let y = g; y < g + 2; y++) setPixel(x, y, M.SAND);
  }

  // A little wooden bridge over the pond
  for (let x = 264; x < 344; x++) {
    if (x % 4 < 3) {
      setPixel(x, 221, M.WOOD);
      setPixel(x, 222, M.WOOD);
    }
  }
  box(264, 220, 2, 15, M.WOOD);
  box(343, 220, 2, 15, M.WOOD);

  // Cottage with a smoking chimney
  cottage(120, ChunkEngine.getSkyline(140), 46, 36, { roof: M.CONCRETE });

  // Trees and undergrowth frame the little scene
  oakTree(78, ChunkEngine.getSkyline(78), 0.85);
  oakTree(200, ChunkEngine.getSkyline(200), 0.95);
  pineTree(382, ChunkEngine.getSkyline(382), 0.9);
  pineTree(412, ChunkEngine.getSkyline(412), 0.7);
  bush(175, ChunkEngine.getSkyline(175), 0.7);
  bush(235, ChunkEngine.getSkyline(235), 0.6);
  bush(352, ChunkEngine.getSkyline(352), 0.7);
  for (let i = 0; i < 18; i++) {
    const x = 40 + i * 22;
    const g = ChunkEngine.getSkyline(x);
    if (chanceDemo(0.5)) setPixel(x, g - 1, M.LEAVES);
  }

  // Gravel path from the cottage to the bridge
  for (let x = 166; x < 264; x++) {
    const g = ChunkEngine.getSkyline(x);
    if (g > 206 && g < 230) {
      setPixel(x, g, M.SAND);
      if (chanceDemo(0.2)) setPixel(x, g - 1, M.STONE);
    }
  }

  // A little geology in the cutaway
  for (let i = 0; i < 6; i++) oreVein(70 + i * 60, 244 + (i % 3) * 8, 7);
  cavePocket(330, 252, 18, 6);
  for (let i = 0; i < 6; i++) setPixel(322 + i * 3, 252, M.ICE);

  // A rowboat on the pond
  box(300, waterLine - 1, 22, 3, M.WOOD);
  box(303, waterLine - 3, 3, 3, M.WOOD);
  box(316, waterLine - 3, 3, 3, M.WOOD);

  tameVines();
  fitDemo();
  renderTools();
  setMaterial(currentMaterial);
}

function chanceDemo(p) {
  return srnd() < p;
}

// The same permanent material strip as the real game.
function renderTools() {
  const container = document.getElementById('tools-container');
  if (!container) return;
  container.innerHTML = '';
  permanentTools.forEach(tool => {
    const button = document.createElement('button');
    button.type = 'button';
    button.onclick = () => setMaterial(tool.id);
    button.id = 'btn-' + tool.id;
    button.className = `mat-btn w-28 h-8 ${tool.col} hover:brightness-110 border-r-4 ${tool.border} pointer-events-auto-child text-[8px] uppercase flex items-center pl-3 shadow-lg transition-transform hover:translate-x-2 relative`;
    button.innerText = tool.name;
    container.appendChild(button);
  });
  setMaterial(currentMaterial);
}

function setMaterial(id) {
  const tool = permanentTools.find(t => t.id === id);
  if (!tool) return;
  currentMaterial = id;
  const label = document.getElementById('currentMat');
  if (label) label.innerText = tool.name;
  document.querySelectorAll('#tools-container .mat-btn').forEach(button => {
    button.classList.remove('translate-x-4', 'border-white');
  });
  const button = document.getElementById('btn-' + id);
  if (button) button.classList.add('translate-x-4', 'border-white');
}

function paintAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const wx = Math.floor(cameraX + ((clientX - rect.left) / rect.width) * width);
  const wy = Math.floor(cameraY + ((clientY - rect.top) / rect.height) * height);
  const radius = currentMaterial === M.AIR ? 3 : 2;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
      const px = wx + dx;
      const py = wy + dy;
      if (px < 0 || px >= WORLD_WIDTH || py < 0 || py >= WORLD_HEIGHT) continue;
      setPixel(px, py, currentMaterial);
      if (currentMaterial === M.FIRE) ChunkEngine.setHeat(px, py, 255);
    }
  }
  draw();
  if (paused) {
    for (let i = 0; i < 6; i++) updatePhysics();
    draw();
  }
}

function resetDemo() {
  resetWorld(false);
  worldAtmosphere = demoAtmosphere;
  skyMapDirty = true;
  fitDemo();
}

canvas.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  painting = true;
  if (canvas.setPointerCapture && e.pointerId !== undefined) {
    try { canvas.setPointerCapture(e.pointerId); } catch (error) { /* ignore */ }
  }
  paintAt(e.clientX, e.clientY);
});

window.addEventListener('pointermove', e => {
  if (painting) paintAt(e.clientX, e.clientY);
});

window.addEventListener('pointerup', () => { painting = false; });
window.addEventListener('pointercancel', () => { painting = false; });
window.addEventListener('blur', () => { painting = false; });

window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== parent) return;
  const data = e.data;
  if (!data || data.source !== 'sandbox-landing') return;
  if (data.action === 'material' && ['SAND', 'WATER', 'FIRE'].includes(data.material)) {
    setMaterial(M[data.material]);
  }
  if (data.action === 'reset') seedDemo();
  if (data.action === 'pause') paused = !!data.paused;
  if (data.action === 'visibility') visible = !!data.visible;
});

function tick(time) {
  if (visible && !document.hidden && !paused && time - lastTick >= 1000 / 30) {
    updatePhysics();
    draw();
    lastTick = time;
  }

  fpsFrames++;
  if (!fpsSince) fpsSince = time;
  if (time - fpsSince >= 500) {
    const fps = Math.round(fpsFrames * 1000 / (time - fpsSince));
    const fpsElement = document.getElementById('fps');
    if (fpsElement) fpsElement.innerText = fps;
    fpsFrames = 0;
    fpsSince = time;
  }

  requestAnimationFrame(tick);
}

seedDemo();
requestAnimationFrame(tick);
parent.postMessage({ source: 'sandbox-demo', ready: true }, location.origin);
