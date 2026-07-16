// ANIMA — boot, the single rAF loop, and the module scheduler.
// One loop. One agitation scalar. Asleep sections cost zero.
import { Nervous } from './nervous.js';
import { Recorder, FLAG } from './recorder.js';
import { Amoeba } from './cursor.js';
import { Membrane } from './sections/membrane.js';
import { Drift } from './sections/drift.js';
import { Mitosis } from './sections/mitosis.js';
import { Mycelium } from './sections/mycelium.js';
import { Murmuration } from './sections/murmuration.js';
import { Anamnesis } from './sections/anamnesis.js';
import { Colophon } from './sections/colophon.js';

const organism = document.getElementById('organism');
const gut = document.getElementById('gut');
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)').matches;

let dormant = false;
try { dormant = localStorage.getItem('anima-dormant') === '1'; } catch (_) { /* private mode */ }

const ctx = {
  organism,
  pointer: { x: innerWidth / 2, y: innerHeight / 2, speed: 0 },
  // The default pointer position is a guess, not a person. Nothing reacts
  // to it until a real pointer, tap, or keyboard focus proves someone is here.
  pointerActive: false,
  scrollY: window.scrollY,
  scrollVel: 0,
  vw: innerWidth,
  vh: innerHeight,
  idleSeconds: 0,
  nearestHeading: null,
  headingEls: [],
  dormant,
  reduced: () => mq.matches || ctx.dormant,
  toggleDormancy() {
    ctx.dormant = !ctx.dormant;
    try { localStorage.setItem('anima-dormant', ctx.dormant ? '1' : '0'); } catch (_) { /* ignore */ }
    document.documentElement.classList.toggle('dormant', ctx.dormant);
    applyCursorMode();
    return ctx.dormant;
  },
};

ctx.nervous = new Nervous(organism, ctx.reduced);
ctx.recorder = new Recorder(4000);

if (ctx.dormant) document.documentElement.classList.add('dormant');

function applyCursorMode() {
  const on = finePointer && !ctx.reduced();
  document.documentElement.classList.toggle('has-amoeba', on);
}
applyCursorMode();
mq.addEventListener('change', applyCursorMode);

// ---------- input tracking (listeners store; rAF consumes) ----------
let lastPX = ctx.pointer.x, lastPY = ctx.pointer.y;
let lastInputAt = performance.now();
function pointerSeen() {
  if (ctx.pointerActive) return;
  ctx.pointerActive = true;
  document.documentElement.classList.add('pointer-live');
}
document.addEventListener('pointermove', (e) => {
  ctx.pointer.x = e.clientX;
  ctx.pointer.y = e.clientY;
  lastInputAt = performance.now();
  pointerSeen();
}, { passive: true });
document.addEventListener('pointerdown', (e) => {
  lastInputAt = performance.now();
  // touch has no hover: a tap IS the pointer, so the predator/hawk/roots react
  ctx.pointer.x = e.clientX;
  ctx.pointer.y = e.clientY;
  lastPX = e.clientX; lastPY = e.clientY; // don't count the jump as speed
  pointerSeen();
  ctx.recorder.event(FLAG.CLICK, e.clientX / ctx.vw, e.clientY / ctx.vh);
}, { passive: true });
document.addEventListener('keydown', () => { lastInputAt = performance.now(); }, { passive: true });
// keyboard focus is a first-class stimulus: recorded like the cursor
document.addEventListener('focusin', (e) => {
  if (!e.target.getBoundingClientRect) return;
  const r = e.target.getBoundingClientRect();
  const x = (r.left + r.width / 2) / ctx.vw;
  const y = (r.top + r.height / 2) / ctx.vh;
  ctx.recorder.event(FLAG.FOCUS, x, y);
  ctx.pointer.x = r.left + r.width / 2;
  ctx.pointer.y = r.top + r.height / 2;
  pointerSeen();
});
let lastScrollY = window.scrollY;
window.addEventListener('scroll', () => {
  ctx.scrollY = window.scrollY;
  lastInputAt = performance.now();
}, { passive: true });

// ---------- modules ----------
const registry = [];
function register(id, Cls) {
  const el = document.getElementById(id);
  const mod = new Cls(ctx, el);
  registry.push({ id, el, mod });
  return mod;
}
const membrane = register('membrane', Membrane);
register('drift', Drift);
register('mitosis', Mitosis);
register('mycelium', Mycelium);
register('murmuration', Murmuration);
register('anamnesis', Anamnesis);
register('colophon', Colophon);

const amoeba = finePointer ? new Amoeba(ctx) : null;

// ---------- awake/asleep via IntersectionObserver ----------
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const item = registry.find((r) => r.el === entry.target);
    if (!item) continue;
    const was = item.mod.awake;
    item.mod.awake = entry.isIntersecting;
    item.el.classList.toggle('in-view', entry.isIntersecting);
    if (!was && entry.isIntersecting) {
      if (item.id === 'mycelium') item.mod.cacheParas?.();
      item.mod.wake?.();
    }
  }
}, { rootMargin: '25% 0px 25% 0px' });
for (const r of registry) io.observe(r.el);
document.documentElement.classList.add('anima-ready');

// ---------- scroll-spy + peristalsis ----------
const vertebrae = [...document.querySelectorAll('.vertebrae a')];
let activeSection = '';
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const id = entry.target.id;
    if (id === activeSection) continue;
    activeSection = id;
    for (const a of vertebrae) a.classList.toggle('active', a.dataset.spy === id);
    // peristalsis: one swallow per boundary crossing
    if (!ctx.reduced()) {
      gut.classList.remove('swallow');
      void gut.offsetWidth; // restart the keyframe
      gut.classList.add('swallow');
    }
    // only the in-view headline breathes (paint cost discipline)
    for (const r of registry) {
      const title = r.el.querySelector('.sec-title');
      if (title) title.classList.toggle('is-breathing', r.id === id);
    }
    ctx.recorder.event(FLAG.SECTION, 0.5, 0.5);
    ctx.nervous.impulse(0.15);
  }
  // center-band detection, not a visibility threshold: a 400vh section can
  // never reach 40% visible, but it can always cross the viewport's middle
}, { rootMargin: '-45% 0px -45% 0px' });
for (const r of registry) spy.observe(r.el);
gut.addEventListener('animationend', () => gut.classList.remove('swallow'));

// ---------- living-root underlines (svg injected once) ----------
for (const link of document.querySelectorAll('.root-link')) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 10');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,2 C30,2 55,2 100,3 M62,2.5 C70,4 74,6 76,9 M80,2.6 C86,4 90,5 95,8');
  svg.appendChild(path);
  link.appendChild(svg);
}

// ---------- buttons are cells: nutrient bloom from the press point ----------
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.stim');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  btn.style.setProperty('--px', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  btn.style.setProperty('--py', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  btn.classList.add('bloom');
}, { passive: true });
document.addEventListener('pointerup', () => {
  for (const b of document.querySelectorAll('.stim.bloom')) b.classList.remove('bloom');
}, { passive: true });
// keyboard activation blooms too — same nutrient, center of the cell
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const btn = e.target.closest?.('.stim');
  if (!btn || btn.disabled) return;
  btn.style.setProperty('--px', '50%');
  btn.style.setProperty('--py', '50%');
  btn.classList.add('bloom');
  setTimeout(() => btn.classList.remove('bloom'), 450);
});

// ---------- field notes: the engineering, on demand ----------
for (const toggle of document.querySelectorAll('.fn-toggle')) {
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// ---------- resize (debounced; the only sanctioned layout reads) ----------
let resizeTimer = 0;
function doResize() {
  ctx.vw = innerWidth;
  ctx.vh = innerHeight;
  for (const r of registry) r.mod.resize?.();
  registry.find((r) => r.id === 'mycelium')?.mod.cacheParas?.();
  ctx.headingEls = [...document.querySelectorAll('.sec-title')];
  cacheHeadings();
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(doResize, 150);
});

// heading positions (doc coords) for the amoeba's idle curiosity
let headingDocs = [];
function cacheHeadings() {
  headingDocs = ctx.headingEls.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 + ctx.scrollY };
  });
}
ctx.headingEls = [...document.querySelectorAll('.sec-title')];
cacheHeadings();

// ---------- pre-warm during the quiet first screen ----------
const idleQueue = [
  () => registry.find((r) => r.id === 'murmuration')?.mod.harvestTargets(),
  () => { if (ctx.reduced()) registry.find((r) => r.id === 'mycelium')?.mod.wake?.(); },
];
function runIdleQueue(deadline) {
  while (idleQueue.length && (!deadline || deadline.timeRemaining() > 8)) idleQueue.shift()();
  if (idleQueue.length) schedulePrewarm();
}
function schedulePrewarm() {
  if ('requestIdleCallback' in window) requestIdleCallback(runIdleQueue, { timeout: 2000 });
  else setTimeout(() => runIdleQueue(), 600);
}
schedulePrewarm();

// re-render everything typographic once the real fonts arrive: the hero
// word, the flock's letterform targets, and the cached heading positions
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    membrane.fontDirty = true;
    membrane.staticDirty = true;
    registry.find((r) => r.id === 'murmuration')?.mod.refreshWord();
    cacheHeadings();
  });
}

// ---------- the single rAF loop ----------
let last = performance.now();
let smoothScrollVel = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // derive speeds (no layout reads here — values were stored by listeners)
  const pdx = ctx.pointer.x - lastPX;
  const pdy = ctx.pointer.y - lastPY;
  lastPX = ctx.pointer.x; lastPY = ctx.pointer.y;
  const instSpeed = Math.hypot(pdx, pdy) / Math.max(dt, 1e-4);
  ctx.pointer.speed += (instSpeed - ctx.pointer.speed) * Math.min(1, dt * 12);

  const sdy = Math.abs(ctx.scrollY - lastScrollY);
  ctx.recorder.scrollTravel += sdy;
  lastScrollY = ctx.scrollY;
  const instScroll = sdy / Math.max(dt, 1e-4);
  smoothScrollVel += (instScroll - smoothScrollVel) * Math.min(1, dt * 8);

  ctx.idleSeconds = (now - lastInputAt) / 1000;
  if (ctx.idleSeconds > 8 && headingDocs.length) {
    let best = null, bestD = Infinity;
    for (const h of headingDocs) {
      const hy = h.y - ctx.scrollY;
      const d = Math.abs(hy - ctx.vh / 2);
      if (d < bestD) { bestD = d; best = { x: h.x, y: hy }; }
    }
    ctx.nearestHeading = best;
  }

  ctx.nervous.update(dt, smoothScrollVel, ctx.pointer.speed);
  ctx.recorder.sample(dt, ctx.pointer.x / ctx.vw, ctx.pointer.y / ctx.vh);

  if (amoeba) {
    amoeba.update(dt, now / 1000);
    amoeba.draw(now / 1000);
  }

  for (const r of registry) {
    if (!r.mod.awake) continue;
    r.mod.update?.(dt, now / 1000);
    r.mod.draw?.(now / 1000);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug handle — local development only, never shipped to visitors
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.__anima = { ctx, registry };
}
