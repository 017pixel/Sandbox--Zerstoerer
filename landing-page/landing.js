const demo = document.getElementById('demo-frame');
const scene = document.getElementById('demo-scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const send = data => demo.contentWindow?.postMessage({ source: 'sandbox-landing', ...data }, location.origin);
let ready = false;
let paused = reducedMotion.matches;
const materials = document.querySelectorAll('[data-material]');
const controls = document.querySelectorAll('.demo-controls button');
controls.forEach(button => button.disabled = true);
window.addEventListener('message', event => {
  if(event.origin !== location.origin || event.source !== demo.contentWindow || event.data?.source !== 'sandbox-demo') return;
  if(event.data.ready) {
    ready = true;
    scene.classList.add('ready');
    controls.forEach(button => button.disabled = false);
    send({action: 'pause', paused});
    updatePause();
  }
});
materials.forEach(button => button.addEventListener('click', () => {
  materials.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  send({action: 'material', material: button.dataset.material});
}));
document.getElementById('demo-reset').addEventListener('click', () => send({action: 'reset'}));
const pauseButton = document.getElementById('demo-pause');
function updatePause() {
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Demo fortsetzen' : 'Demo pausieren');
  pauseButton.title = paused ? 'Weiter' : 'Pause';
  pauseButton.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
}
pauseButton.addEventListener('click', () => {paused = !paused;updatePause();send({action:'pause',paused});});
reducedMotion.addEventListener('change', event => {
  paused = event.matches;updatePause();send({action:'pause',paused});
  if(event.matches) document.getElementById('game-video').pause();
});
new IntersectionObserver(entries => send({action:'visibility',visible:entries[0].isIntersecting})).observe(scene);
// Only animate elements as they arrive. Content stays visible if scripting fails.
const reveals = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    if(!reducedMotion.matches) entry.target.classList.add('animate');
    reveals.unobserve(entry.target);
  });
}, {threshold: .12});
document.querySelectorAll('.reveal').forEach(element => reveals.observe(element));
const mobileCTA = document.querySelector('.mobile-play');
let heroVisible = true;
let closingVisible = false;
function updateMobileCTA() {
  const show = !heroVisible && !closingVisible && matchMedia('(max-width:540px)').matches;
  mobileCTA.classList.toggle('visible', show);
  mobileCTA.setAttribute('aria-hidden', String(!show));
  mobileCTA.tabIndex = show ? 0 : -1;
  document.body.classList.toggle('has-mobile-cta', show);
}
new IntersectionObserver(entries => {heroVisible=entries[0].isIntersecting;updateMobileCTA();}).observe(document.querySelector('.hero'));
new IntersectionObserver(entries => {closingVisible=entries[0].isIntersecting;updateMobileCTA();}).observe(document.querySelector('.closing'));
window.addEventListener('resize', updateMobileCTA);
