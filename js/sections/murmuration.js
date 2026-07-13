// 05 / MURMURATION — 400 boids, spatial-hashed, your cursor as the hawk.
// Five seconds of stillness and the flock forgives you: it collapses into
// the word ALIVE — or any word you feed it — still trembling, still wild.
import { SpatialHash } from '../lib/hash.js';
import { mulberry32 } from '../lib/noise.js';
import { FLAG } from '../recorder.js';

const PERCEPTION = 56;
const MAX_SPEED = 170;

export class Murmuration {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.canvas = sec.querySelector('canvas.stage');
    this.g = this.canvas.getContext('2d');
    this.awake = false;
    this.hash = new SpatialHash(PERCEPTION);
    this.still = 0;
    this.formFactor = 0;       // 0 wild → 1 spelling
    this.forming = false;
    this.word = 'ALIVE';
    this.targets = null;
    this.rand = mulberry32(0xF10C);
    this.offscreen = document.createElement('canvas');

    sec.querySelector('[data-stim="startle"]').addEventListener('click', () => {
      this.startle();
      this.ctx.recorder.event(FLAG.STARTLE, 0.5, 0.5);
    });
    sec.querySelector('form.feed').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = sec.querySelector('#feed-input');
      const word = (input.value || '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, 12);
      if (!word) return;
      this.word = word;
      this.harvestTargets();
      this.staticDrawn = false; // reduced-motion: redraw the new word once
      this.beginForming(true);
      this.ctx.recorder.fedWord = word;
      this.ctx.recorder.event(FLAG.WORD, 0.5, 0.5);
      this.ctx.nervous.impulse(0.25);
      input.value = '';
      // the canvas is aria-hidden; tell assistive tech what just happened
      const status = sec.querySelector('#feed-status');
      if (status) status.textContent = `THE FLOCK IS SPELLING "${word}".`;
    });
    this.resize();
  }

  top() { return this.secTop - this.ctx.scrollY; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = this.sec.clientWidth, h = this.sec.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.secTop = this.sec.getBoundingClientRect().top + this.ctx.scrollY;

    const n = w >= 1024 ? 400 : 220;
    this.n = n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.px[i] = this.rand() * w;
      this.py[i] = this.rand() * h * 0.7;
      const a = this.rand() * Math.PI * 2;
      this.vx[i] = Math.cos(a) * 60;
      this.vy[i] = Math.sin(a) * 60;
    }
    this.harvestTargets();
    this.staticDrawn = false;
    if (this.ctx.reduced()) this.settleAtTargets();
  }

  // Render the word offscreen once, harvest ~n points from its pixels.
  // The ONLY runtime getImageData — never inside the frame loop.
  harvestTargets() {
    const oc = this.offscreen;
    const W = 900, H = 260;
    oc.width = W; oc.height = H;
    const og = oc.getContext('2d', { willReadFrequently: true });
    og.clearRect(0, 0, W, H);
    og.fillStyle = '#fff';
    let size = 200;
    og.font = `800 ${size}px 'Instrument Sans', sans-serif`;
    const tw = og.measureText(this.word).width;
    if (tw > W * 0.94) size *= (W * 0.94) / tw;
    og.font = `800 ${size}px 'Instrument Sans', sans-serif`;
    og.textBaseline = 'middle';
    og.textAlign = 'center';
    og.fillText(this.word, W / 2, H / 2);
    const data = og.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += 5) {
      for (let x = 0; x < W; x += 5) {
        if (data[(y * W + x) * 4 + 3] > 120) pts.push([x, y]);
      }
    }
    if (!pts.length) return;
    // shuffle (seeded) then take n, mapped to the upper stage
    const rand = mulberry32(0x77 + this.word.length);
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    // the word lives in the open air to the right of the headline
    const wide = this.w >= 1024;
    const budgetW = wide ? this.w * 0.5 : this.w * 0.86;
    const scale = Math.min(budgetW / W, (this.h * 0.36) / H);
    const offX = (wide ? this.w * 0.66 : this.w * 0.5) - (W * scale) / 2;
    const offY = this.h * 0.36 - (H * scale) / 2;
    for (let i = 0; i < this.n; i++) {
      const p = pts[i % pts.length];
      this.tx[i] = offX + p[0] * scale;
      this.ty[i] = offY + p[1] * scale;
    }
  }

  settleAtTargets() {
    for (let i = 0; i < this.n; i++) {
      this.px[i] = this.tx[i];
      this.py[i] = this.ty[i];
    }
  }

  beginForming(immediate) {
    this.forming = true;
    if (immediate) this.still = 5;
  }

  detonate() {
    this.forming = false;
    this.still = 0;
    for (let i = 0; i < this.n; i++) {
      this.vx[i] += (this.rand() - 0.5) * 320;
      this.vy[i] += (this.rand() - 0.5) * 320;
    }
  }

  startle() {
    this.detonate();
    const cx = this.w / 2, cy = this.h / 2;
    for (let i = 0; i < this.n; i++) {
      const dx = this.px[i] - cx, dy = this.py[i] - cy;
      const d = Math.max(20, Math.hypot(dx, dy));
      this.vx[i] += (dx / d) * 260;
      this.vy[i] += (dy / d) * 260;
    }
    this.ctx.nervous.impulse(0.4);
  }

  update(dt, t) {
    const ctx = this.ctx;
    if (ctx.reduced()) return;
    dt = Math.min(dt, 1 / 30);

    const mx = ctx.pointer.x;
    const my = ctx.pointer.y - this.top();
    const hawkActive = my > -100 && my < this.h + 100;

    // stillness is mercy
    if (ctx.pointer.speed < 8) this.still += dt;
    else {
      this.still = 0;
      if (this.forming && this.formFactor > 0.15) this.detonate();
    }
    if (!this.forming && this.still > 5) this.forming = true;
    const targetF = this.forming ? 1 : 0;
    this.formFactor += (targetF - this.formFactor) * (1 - Math.exp(-dt / (this.forming ? 0.9 : 0.25)));
    const f = this.formFactor;
    const flockW = 1 - 0.8 * f;

    this.hash.clear();
    for (let i = 0; i < this.n; i++) this.hash.insert(this.px[i], this.py[i], i);

    for (let i = 0; i < this.n; i++) {
      const x = this.px[i], y = this.py[i];
      let cohX = 0, cohY = 0, aliX = 0, aliY = 0, sepX = 0, sepY = 0, cnt = 0;
      this.hash.query(x, y, PERCEPTION, (j) => {
        if (j === i) return;
        const dx = this.px[j] - x, dy = this.py[j] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > PERCEPTION * PERCEPTION) return;
        cnt++;
        cohX += dx; cohY += dy;
        aliX += this.vx[j]; aliY += this.vy[j];
        if (d2 < 22 * 22 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          sepX -= (dx / d) * (1 - d / 22);
          sepY -= (dy / d) * (1 - d / 22);
        }
      });
      let ax = 0, ay = 0;
      if (cnt > 0) {
        ax += (cohX / cnt) * 0.9 * flockW;
        ay += (cohY / cnt) * 0.9 * flockW;
        ax += (aliX / cnt - this.vx[i]) * 1.4 * flockW;
        ay += (aliY / cnt - this.vy[i]) * 1.4 * flockW;
        ax += sepX * 160 * flockW;
        ay += sepY * 160 * flockW;
      }
      // hawk
      if (hawkActive) {
        const dx = x - mx, dy = y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 160 * 160 && d2 > 1) {
          const d = Math.sqrt(d2);
          const flee = (1 - d / 160) * 1400 * (1 - 0.6 * f);
          ax += (dx / d) * flee;
          ay += (dy / d) * flee;
        }
      }
      // arrive at the letter target
      if (f > 0.01) {
        ax += (this.tx[i] - x) * 6 * f;
        ay += (this.ty[i] - y) * 6 * f;
        ax -= this.vx[i] * 3.2 * f;
        ay -= this.vy[i] * 3.2 * f;
      }
      // soft walls
      const m = 40;
      if (x < m) ax += (m - x) * 4;
      if (x > this.w - m) ax -= (x - (this.w - m)) * 4;
      if (y < m) ay += (m - y) * 4;
      if (y > this.h - m) ay -= (y - (this.h - m)) * 4;

      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;
      const sp = Math.hypot(this.vx[i], this.vy[i]);
      const max = MAX_SPEED * (1 + 0.6 * this.ctx.nervous.agitation) * (1 - 0.55 * f) + 24;
      if (sp > max) {
        this.vx[i] *= max / sp;
        this.vy[i] *= max / sp;
      }
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
    }
  }

  draw(t) {
    const g = this.g;
    const ctx = this.ctx;
    g.clearRect(0, 0, this.w, this.h);

    if (ctx.reduced()) {
      // the word arrives already formed and HOLDS STILL — drawn once,
      // zero per-frame cost for exactly the visitors who asked for calm
      if (this.staticDrawn) return;
      this.staticDrawn = true;
      g.strokeStyle = 'rgba(94,242,214,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < this.n; i++) {
        g.moveTo(this.tx[i], this.ty[i]);
        g.lineTo(this.tx[i] + 2, this.ty[i]);
      }
      g.stroke();
      return;
    }
    this.staticDrawn = false;

    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(94,242,214,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < this.n; i++) {
      const sp = Math.max(8, Math.hypot(this.vx[i], this.vy[i]));
      const ux = this.vx[i] / sp, uy = this.vy[i] / sp;
      g.moveTo(this.px[i], this.py[i]);
      g.lineTo(this.px[i] + ux * 4, this.py[i] + uy * 4);
    }
    g.stroke();
    g.restore();
  }
}
