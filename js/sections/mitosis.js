// 03 / MITOSIS — the scrollbar is the timeline of cell division.
// Scroll progress is the ONLY clock: scrub-perfect, reversible,
// and free under reduced motion. Gooey merging is done by the GPU
// compositor (canvas blur + wrapper contrast), zero per-pixel JS.
import { mulberry32 } from '../lib/noise.js';

const DEPTH = 4; // 2^4 = 16 cells

export class Mitosis {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.canvas = sec.querySelector('canvas.stage');
    this.g = this.canvas.getContext('2d');
    this.counter = sec.querySelector('#mitosis-counter');
    this.awake = false;
    this.lastCounter = '';
    this.lastP = -1;

    // each leaf stores one unit split vector per depth, fixed forever
    const rand = mulberry32(0xCE11);
    const dirs = {}; // node key "d:k" → angle
    for (let d = 0; d < DEPTH; d++) {
      for (let k = 0; k < (1 << d); k++) {
        dirs[d + ':' + k] = rand() * Math.PI * 2;
      }
    }
    this.leaves = [];
    for (let leaf = 0; leaf < (1 << DEPTH); leaf++) {
      const vecs = [];
      for (let d = 0; d < DEPTH; d++) {
        const nodeIndex = leaf >> (DEPTH - d); // ancestor at depth d
        const bit = (leaf >> (DEPTH - 1 - d)) & 1;
        const a = dirs[d + ':' + nodeIndex];
        const sign = bit ? 1 : -1;
        vecs.push({ x: Math.cos(a) * sign, y: Math.sin(a) * sign });
      }
      this.leaves.push(vecs);
    }
    this.resize();
  }

  resize() {
    // half-resolution: the blur eats the detail anyway
    const w = this.sec.clientWidth, h = window.innerHeight;
    this.canvas.width = Math.max(2, Math.round(w * 0.5));
    this.canvas.height = Math.max(2, Math.round(h * 0.5));
    this.g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    this.w = w; this.h = h;
    this.secTop = this.sec.getBoundingClientRect().top + this.ctx.scrollY;
    this.secHeight = this.sec.offsetHeight;
    this.R0 = Math.min(w, h) * 0.13;
    this.lastP = -1;
  }

  update() {
    // progress drives everything; nothing else to integrate
  }

  draw() {
    const ctx = this.ctx;
    const span = Math.max(1, this.secHeight - ctx.vh);
    const p = Math.max(0, Math.min(1, (ctx.scrollY - this.secTop) / span));
    if (Math.abs(p - this.lastP) < 0.0004) return;
    this.lastP = p;

    const g = this.g;
    g.fillStyle = '#060B0D';
    g.fillRect(0, 0, this.w, this.h);

    const cx = this.w / 2, cy = this.h / 2;
    const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

    // split d runs in band [0.06 + 0.225d, 0.26 + 0.225d]
    const sd = [];
    let gens = 0;
    for (let d = 0; d < DEPTH; d++) {
      const s = smooth((p - (0.06 + 0.225 * d)) / 0.2);
      sd.push(s);
      gens += s;
    }
    const driftF = smooth((p - 0.86) / 0.14);
    const radius = this.R0 * Math.pow(0.68, gens);

    g.fillStyle = '#5EF2D6';
    const seen = new Set();
    for (let leaf = 0; leaf < this.leaves.length; leaf++) {
      const vecs = this.leaves[leaf];
      let x = cx, y = cy;
      let key = 0;
      for (let d = 0; d < DEPTH; d++) {
        const dist = this.R0 * (2.1 - d * 0.36);
        x += vecs[d].x * dist * sd[d];
        y += vecs[d].y * dist * sd[d];
        if (sd[d] > 0.02) key = key * 2 + (((leaf >> (DEPTH - 1 - d)) & 1) ? 1 : 0) + 1;
      }
      // collapse identical positions pre-split so we don't double-paint
      const sig = key + ':' + (x | 0) + ':' + (y | 0);
      if (seen.has(sig)) continue;
      seen.add(sig);
      if (driftF > 0) {
        x += Math.sin(p * 9 + leaf * 1.7) * 9 * driftF;
        y += Math.cos(p * 7 + leaf * 2.3) * 9 * driftF;
      }
      // the pinch: pre-split, a waist forms — two lobes separating reads
      // as one cell dividing once the goo filter merges them
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.fill();
    }

    // lab-note counter, written only when the text changes
    const visibleGens = sd.filter((s) => s > 0.5).length;
    const cells = 1 << visibleGens;
    const secs = Math.round(p * 47);
    const label = `GENERATION ${visibleGens} — ${cells} CELL${cells > 1 ? 'S' : ''} — T+0:${String(secs).padStart(2, '0')}`;
    if (label !== this.lastCounter) {
      this.lastCounter = label;
      this.counter.textContent = label;
    }
  }
}
