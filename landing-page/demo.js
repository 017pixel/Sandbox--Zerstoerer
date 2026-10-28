/* A small, isolated world running the game's original physics and renderer.
   No storage, service worker or audio; it cannot overwrite a player's worlds. */
const AudioEngine = { play() {} };
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let visible = true;
let selected = M.SAND;
let lastTick = 0;

function fitDemo() {
  width = 320;
  height = 140;
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  canvas.width = 1280;
  canvas.height = 560;
  zoom = 1;
  cameraX = 0;
  cameraY = 40;
  draw();
}
window.addEventListener('resize', fitDemo);

function seedDemo() {
  resetWorld();
  // Cutaway terrain and pond, built entirely from real game materials.
  for (let x = 0; x < 320; x++) {
    const dip = x > 126 && x < 207;
    const surface = dip ? 161 : Math.floor(143 + Math.sin(x * .045) * 5);
    for (let y = surface; y < 175; y++) setPixel(x, y, y > surface + 6 ? M.STONE : M.SAND);
    if (!dip) setPixel(x, surface, M.VINE);
    else for (let y = 151; y < 161; y++) setPixel(x, y, M.WATER);
  }
  // Little wooden house with an open door, concrete roof and TNT in its attic.
  drawRect(65, 115, 35, 28, M.WOOD);
  drawRect(78, 130, 8, 13, M.AIR);
  drawRect(69, 122, 6, 6, M.ICE);
  drawRect(89, 122, 6, 6, M.ICE);
  for (let d = 0; d < 19; d++) drawRect(61 + d, 114 - d, 43 - d * 2, 1, M.CONCRETE);
  drawRect(91, 94, 4, 13, M.STONE);
  drawRect(78, 111, 7, 4, M.TNT);
  // Chunky trees and a small stone bridge.
  for (const [x,y,h] of [[24,147,26],[48,147,19],[116,138,29],[233,140,25],[266,139,31],[298,146,22]]) {
    drawRect(x,y-h,3,h,M.WOOD);
    drawCircle(x+1,y-h-5,10,M.LEAVES);
    drawCircle(x-5,y-h,7,M.LEAVES);
    drawCircle(x+7,y-h,7,M.LEAVES);
  }
  drawRect(136,145,59,3,M.STONE);
  drawRect(140,148,3,12,M.STONE);
  drawRect(188,148,3,12,M.STONE);
  fitDemo();
}
function sprinkle(x,y) {
  for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++) {
    if (dx*dx+dy*dy > 16) continue;
    const px=x+dx, py=y+dy;
    setPixel(px,py,selected);
    if (selected===M.FIRE) ChunkEngine.setHeat(px,py,255);
  }
  if (paused) { for(let n=0;n<12;n++) updatePhysics(); draw(); }
}
canvas.addEventListener('pointerdown',e=> {
  const rect=canvas.getBoundingClientRect();
  sprinkle(Math.floor((e.clientX-rect.left)/rect.width*320),40+Math.floor((e.clientY-rect.top)/rect.height*140));
});
canvas.addEventListener('keydown',e=> {
  if(e.key==='Enter'||e.key===' ') {e.preventDefault();sprinkle(160,75);}
});
window.addEventListener('message',e=> {
  if(e.origin!==location.origin || e.source!==parent) return;
  const data=e.data;
  if(!data || data.source!=='sandbox-landing') return;
  if(data.action==='material' && ['SAND','WATER','FIRE'].includes(data.material)) selected=M[data.material];
  if(data.action==='reset') seedDemo();
  if(data.action==='pause') paused=!!data.paused;
  if(data.action==='visibility') visible=!!data.visible;
});
function tick(time) {
  if(visible && !document.hidden && !paused && time-lastTick>=1000/30) {
    updatePhysics(); draw(); lastTick=time;
  }
  requestAnimationFrame(tick);
}
seedDemo();
requestAnimationFrame(tick);
parent.postMessage({source:'sandbox-demo',ready:true},location.origin);
