// 01 / MEMBRANE — one giant soft-body cell breathing at 12bpm, the word
// ANIMA living inside it. Poke it and it ruptures, then heals with a wobble.
import { mulberry32 } from '../lib/noise.js';
import { FLAG } from '../recorder.js';

const N = 64;
const TAU = Math.PI * 2;
const PARTICLES = 200;

export class Membrane {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.canvas = sec.querySelector('canvas.stage');
    this.g = this.canvas.getContext('2d');
    this.awake = false;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.ox = new Float32Array(N);
    this.oy = new Float32Array(N);
    this.healing = 1;            // 0 = ruptured springs off, 1 = whole
    this.ruptureT = -1;          // seconds since rupture, -1 = none
    this.ruptureCount = 0;
    this.ruptureOrigin = { x: 0, y: 0 };
    this.pvx = new Float32Array(PARTICLES);
    this.pvy = new Float32Array(PARTICLES);
    this.letterFly = [];         // per-letter ballistic params
    this.letters = ['A', 'N', 'I', 'M', 'A'];
    this.letterW = null;         // measured once per font/resize
    this.fontPx = 100;
    this.fontDirty = true;
    this.staticDirty = true;     // reduced-motion: redraw only when needed

    this.resize();

    const poke = (clientX, clientY) => {
      const y = clientY - this.top();
      this.rupture(clientX, y);
    };
    this.canvas.parentElement.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, .fieldnotes')) return;
      poke(e.clientX, e.clientY);
    });
    sec.querySelector('[data-stim="poke"]').addEventListener('click', () => {
      poke(this.cx, this.top() + this.cy - this.R * 0.5);
    });
  }

  top() { return this.secTop - this.ctx.scrollY; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.sec.clientWidth, h = this.sec.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.secTop = this.sec.getBoundingClientRect().top + this.ctx.scrollY;
    this.cx = w / 2;
    this.cy = h / 2;
    this.R = Math.min(w, h) * 0.27;
    this.fontPx = Math.max(40, this.R * 0.62);
    this.fontDirty = true;
    this.staticDirty = true;
    // gradient depends only on cx/cy/R — built here, never per frame
    const grad = this.g.createRadialGradient(this.cx, this.cy, this.R * 0.1, this.cx, this.cy, this.R * 1.15);
    grad.addColorStop(0, 'rgba(14,31,34,0.95)');
    grad.addColorStop(0.75, 'rgba(14,31,34,0.55)');
    grad.addColorStop(1, 'rgba(14,31,34,0)');
    this.bgGrad = grad;
    this.reset();
  }

  reset() {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      this.px[i] = this.ox[i] = this.cx + Math.cos(a) * this.R;
      this.py[i] = this.oy[i] = this.cy + Math.sin(a) * this.R;
    }
  }

  measureLetters() {
    const measure = () => {
      this.g.font = `560 ${this.fontPx}px Fraunces, Georgia, serif`;
      this.letterW = this.letters.map((ch) => this.g.measureText(ch).width);
      this.wordW = this.letterW.reduce((a, b) => a + b, 0) + (this.letters.length - 1) * this.fontPx * 0.04;
    };
    measure();
    // the word must live INSIDE the cell — refit if it overflows the membrane
    const maxW = this.R * 1.62;
    if (this.wordW > maxW) {
      this.fontPx *= maxW / this.wordW;
      measure();
    }
    this.g.textBaseline = 'middle';
    this.fontDirty = false;
    this.staticDirty = true;
  }

  rupture(x, y) {
    if (this.ruptureT >= 0 && this.ruptureT < 1.2) return;
    this.ruptureT = 0;
    this.ruptureCount++;
    this.ruptureOrigin.x = x;
    this.ruptureOrigin.y = y;
    const rand = mulberry32(0xB10 + this.ruptureCount * 7919);
    for (let i = 0; i < PARTICLES; i++) {
      const a = rand() * TAU;
      const sp = 120 + rand() * 480;
      this.pvx[i] = Math.cos(a) * sp;
      this.pvy[i] = Math.sin(a) * sp - 120;
    }
    this.letterFly = this.letters.map(() => {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
      const sp = 260 + rand() * 320;
      return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: (rand() - 0.5) * 7 };
    });
    // membrane blows outward, springs cut for 900ms
    this.healing = 0;
    for (let i = 0; i < N; i++) {
      const dx = this.px[i] - x, dy = this.py[i] - y;
      const d = Math.max(40, Math.hypot(dx, dy));
      const f = 2600 / d;
      this.ox[i] -= (dx / d) * f * 0.06;
      this.oy[i] -= (dy / d) * f * 0.06;
    }
    // cross-medium light: the burst throws shadows on every DOM headline
    this.throwBurstShadow(x, y);
    this.ctx.nervous.impulse(0.5);
    this.ctx.recorder.event(FLAG.POKE, x / this.ctx.vw, (y + this.top()) / this.ctx.vh);
    this.staticDirty = true;
  }

  // Event-scale (never per-frame): measure visible headlines, hand each its
  // viewport position, and kick --burst-* so canvas and DOM share one light.
  throwBurstShadow(x, y) {
    const root = this.ctx.organism;
    for (const el of this.ctx.headingEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > this.ctx.vh) continue;
      el.style.setProperty('--hx', ((r.left + r.width / 2) / this.ctx.vw).toFixed(3));
      el.style.setProperty('--hy', ((r.top + r.height / 2) / this.ctx.vh).toFixed(3));
    }
    root.style.setProperty('--burst-x', (x / this.ctx.vw).toFixed(3));
    root.style.setProperty('--burst-y', ((y + this.top()) / this.ctx.vh).toFixed(3));
    this.burstA = 1;
  }

  update(dt, t) {
    const ctx = this.ctx;
    const reduced = ctx.reduced();

    if (this.burstA !== undefined && this.burstA > 0) {
      this.burstA = Math.max(0, this.burstA - dt / 0.9);
      ctx.organism.style.setProperty('--burst-a', this.burstA.toFixed(3));
    }

    if (this.ruptureT >= 0) {
      this.ruptureT += dt;
      if (this.ruptureT > 0.9 && this.healing < 1) {
        this.healing = Math.min(1, (this.ruptureT - 0.9) / 0.9);
      }
      if (this.ruptureT > 3.0) {
        this.ruptureT = -1;
        this.staticDirty = true; // reduced-motion: repaint the healed state
      }
    }

    if (reduced) return;

    // breath modulates the rest radius; agitation quickens it upstream
    const breath = ctx.nervous.breath;
    const targetR = this.R * (1 + 0.05 * (breath * 2 - 1));
    const k = 14 * this.healing;
    // until a real pointer exists, nothing touches the skin
    const mx = ctx.pointerActive ? ctx.pointer.x : -1e5;
    const my = ctx.pointer.y - this.top();

    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const rx = this.cx + Math.cos(a) * targetR;
      const ry = this.cy + Math.sin(a) * targetR;
      let ax = (rx - this.px[i]) * k;
      let ay = (ry - this.py[i]) * k;
      // the cursor dents it from 200px away, like touched skin
      const dx = this.px[i] - mx, dy = this.py[i] - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < 200 * 200 && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = (1 - d / 200) * 900;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
      }
      // verlet step
      const nx = this.px[i] + (this.px[i] - this.ox[i]) * 0.94 + ax * dt * dt;
      const ny = this.py[i] + (this.py[i] - this.oy[i]) * 0.94 + ay * dt * dt;
      this.ox[i] = this.px[i]; this.oy[i] = this.py[i];
      this.px[i] = nx; this.py[i] = ny;
    }
    // neighbor smoothing: a dent ripples around the circumference
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        const l = (i + N - 1) % N, r = (i + 1) % N;
        this.px[i] += ((this.px[l] + this.px[r]) / 2 - this.px[i]) * 0.22;
        this.py[i] += ((this.py[l] + this.py[r]) / 2 - this.py[i]) * 0.22;
      }
    }
  }

  draw(t) {
    const g = this.g;
    const ctx = this.ctx;
    const reduced = ctx.reduced();
    if (this.fontDirty) this.measureLetters();
    if (reduced && !this.staticDirty && this.ruptureT < 0) return;
    this.staticDirty = false;

    g.clearRect(0, 0, this.w, this.h);

    // membrane path (smooth closed loop)
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const mx = (this.px[i] + this.px[j]) / 2;
      const my = (this.py[i] + this.py[j]) / 2;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(this.px[i], this.py[i], mx, my);
    }
    g.quadraticCurveTo(this.px[0], this.py[0], (this.px[0] + this.px[1]) / 2, (this.py[0] + this.py[1]) / 2);
    g.closePath();

    g.fillStyle = this.bgGrad;
    g.fill();

    // three layered strokes instead of shadowBlur; the heartbeat lives
    // in the rim — the page feels warm-blooded without page geometry moving
    const pulse = reduced ? 0 : ctx.nervous.pulse;
    const strokes = [[1.5, 0.5], [4, 0.22], [9, 0.08]];
    for (const [w, a] of strokes) {
      g.lineWidth = w;
      g.strokeStyle = `rgba(94,242,214,${Math.min(1, a * (1 + 0.45 * pulse)).toFixed(3)})`;
      g.stroke();
    }

    // the word, living inside the cell (font/baseline set in measureLetters —
    // canvas state survives between frames, no per-frame shorthand re-parse)
    // reduced motion: the rupture becomes a brief FROZEN spill, not a movie
    const flyWindow = reduced ? 0.8 : 2.6;
    const flying = this.ruptureT >= 0 && this.ruptureT < flyWindow && this.letterFly.length;
    g.fillStyle = '#E9F4EE';
    if (!flying) {
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillText('ANIMA', this.cx - this.wordW / 2, this.cy);
      g.restore();
    } else {
      // letters tumble as closed-form ballistic bodies, then swim home
      const tt = reduced ? 0.45 : this.ruptureT;
      let x0 = this.cx - this.wordW / 2;
      for (let i = 0; i < this.letters.length; i++) {
        const fl = this.letterFly[i];
        const homeX = x0 + this.letterW[i] / 2;
        const homeY = this.cy;
        const flyEnd = 0.9 + i * 0.08;
        let lx, ly, rot, alpha = 1;
        if (tt < flyEnd) {
          const ft = Math.min(tt, flyEnd);
          lx = homeX + fl.vx * ft;
          ly = homeY + fl.vy * ft + 0.5 * 900 * ft * ft;
          rot = fl.w * ft;
        } else {
          // ease back home over 0.6s, staggered
          const ht = Math.min(1, (tt - flyEnd) / 0.6);
          const e = 1 - Math.pow(1 - ht, 3);
          const ex = homeX + fl.vx * flyEnd;
          const ey = homeY + fl.vy * flyEnd + 0.5 * 900 * flyEnd * flyEnd;
          lx = ex + (homeX - ex) * e;
          ly = ey + (homeY - ey) * e;
          rot = fl.w * flyEnd * (1 - e);
        }
        g.save();
        g.translate(lx, ly);
        g.rotate(rot);
        g.globalAlpha = alpha;
        g.fillText(this.letters[i], -this.letterW[i] / 2, 0);
        g.restore();
        x0 += this.letterW[i] + this.fontPx * 0.04;
      }
      // cytoplasm spills as closed-form particles
      const pt = Math.min(tt, 1.6);
      if (tt < 1.6) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(94,242,214,${(1 - pt / 1.6) * 0.55})`;
        for (let i = 0; i < PARTICLES; i++) {
          const sx = this.ruptureOrigin.x + this.pvx[i] * pt;
          const sy = this.ruptureOrigin.y + this.pvy[i] * pt + 0.5 * 700 * pt * pt;
          g.fillRect(sx, sy, 2, 2);
        }
        g.restore();
      }
    }
  }
}
