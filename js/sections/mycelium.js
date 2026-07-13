// 04 / MYCELIUM — space-colonization growth. The main canvas is never
// cleared: each frame draws only the new segments onto a persistent buffer,
// so cost stays flat as the network grows to thousands of branches.
import { SpatialHash } from '../lib/hash.js';
import { mulberry32 } from '../lib/noise.js';
import { FLAG } from '../recorder.js';

const INFLUENCE = 260; // attraction reach — must dwarf the kill radius or growth never bootstraps
const KILL = 14;
const STEP = 5;
const MAX_NODES = 6000;
const MAX_NEW_PER_FRAME = 40;
const MAX_PULSES = 120;

export class Mycelium {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.base = sec.querySelector('canvas.base');
    this.over = sec.querySelector('canvas.pulses');
    this.gb = this.base.getContext('2d');
    this.go = this.over.getContext('2d');
    this.awake = false;
    this.growClock = 0;
    this.depositClock = 0;
    this.pulseClock = 0;
    this.pulses = [];
    this.tips = [];           // recent bright tips, fading on the overlay
    this.rand = mulberry32(0x14CE);
    this.paragraphs = [...sec.querySelectorAll('.glow-host')];
    this.preGrown = false;

    for (const btn of sec.querySelectorAll('[data-stim="deposit"]')) {
      btn.addEventListener('click', () => {
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2 - this.top();
        this.deposit(x, y, 6);
        this.ctx.recorder.event(FLAG.DEPOSIT, (r.left + r.width / 2) / this.ctx.vw, (r.top + r.height / 2) / this.ctx.vh);
        this.ctx.nervous.impulse(0.2);
      });
    }
    this.resize();
  }

  top() { return this.secTop - this.ctx.scrollY; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = this.sec.clientWidth, h = this.sec.clientHeight;
    for (const [c, g] of [[this.base, this.gb], [this.over, this.go]]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.w = w; this.h = h;
    this.secTop = this.sec.getBoundingClientRect().top + this.ctx.scrollY;
    this.seedWorld();
    this.preGrown = false;
  }

  seedWorld() {
    // nodes
    this.nx = new Float32Array(MAX_NODES);
    this.ny = new Float32Array(MAX_NODES);
    this.parent = new Int32Array(MAX_NODES);
    this.nodeCount = 0;
    this.nodeHash = new SpatialHash(120);
    // seed from every edge so the network surrounds the words quickly
    for (let s = 0; s < 3; s++) {
      this.addNode((s + 0.5) * (this.w / 3) + (this.rand() - 0.5) * 60, this.h - 4, -1);
    }
    for (const fy of [0.25, 0.6, 0.9]) {
      this.addNode(4, this.h * fy, -1);
      this.addNode(this.w - 4, this.h * fy, -1);
    }
    this.addNode(this.w * 0.7, 4, -1);
    // attractors: scattered through the void + clustered along the prose,
    // so left alone it grows toward the words and underlines them
    this.ax = [];
    this.ay = [];
    const scatter = Math.max(150, Math.min(420, Math.round((this.w * this.h) / 5500)));
    for (let i = 0; i < scatter; i++) {
      this.ax.push(this.rand() * this.w);
      this.ay.push(this.rand() * this.h * 0.96);
    }
    for (const p of this.paragraphs) {
      const r = p.getBoundingClientRect();
      const px = r.left, py = r.top + this.ctx.scrollY - this.secTop;
      for (let i = 0; i < 16; i++) {
        this.ax.push(px + this.rand() * r.width);
        this.ay.push(py + r.height + 4 + this.rand() * 14);
      }
    }
    this.gb.clearRect(0, 0, this.w, this.h);
  }

  addNode(x, y, parent) {
    if (this.nodeCount >= MAX_NODES) return -1;
    const i = this.nodeCount++;
    this.nx[i] = x; this.ny[i] = y;
    this.parent[i] = parent;
    this.nodeHash.insert(x, y, i);
    return i;
  }

  deposit(x, y, n = 2) {
    if (this.nodeCount >= MAX_NODES) return; // it is full; it stops eating
    for (let i = 0; i < n; i++) {
      this.ax.push(x + (this.rand() - 0.5) * 50);
      this.ay.push(y + (this.rand() - 0.5) * 50);
    }
    // cap the larder: drop the oldest food, keep cost bounded
    const over = this.ax.length - 600;
    if (over > 0) {
      this.ax.splice(0, over);
      this.ay.splice(0, over);
    }
    this.tips.push({ x, y, age: 0, amber: true });
  }

  // One simulation step: attractors pull the nearest in-range node.
  // Hard exits keep this from degenerating into a permanent O(A×N) scan
  // once the network saturates or food runs out.
  growStep() {
    if (this.nodeCount >= MAX_NODES || this.ax.length === 0) return [];
    const pull = new Map(); // nodeIdx → {x, y, n}
    for (let a = this.ax.length - 1; a >= 0; a--) {
      const x = this.ax[a], y = this.ay[a];
      let best = -1, bestD = INFLUENCE;
      this.nodeHash.query(x, y, INFLUENCE, (i) => {
        const d = Math.hypot(this.nx[i] - x, this.ny[i] - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) {
        let p = pull.get(best);
        if (!p) { p = { x: 0, y: 0, n: 0 }; pull.set(best, p); }
        const d = Math.max(0.001, bestD);
        p.x += (x - this.nx[best]) / d;
        p.y += (y - this.ny[best]) / d;
        p.n++;
      }
    }
    const born = [];
    let made = 0;
    for (const [i, p] of pull) {
      if (made >= MAX_NEW_PER_FRAME) break;
      const len = Math.max(0.001, Math.hypot(p.x, p.y));
      const jx = (this.rand() - 0.5) * 0.6;
      const jy = (this.rand() - 0.5) * 0.6;
      const x = this.nx[i] + (p.x / len + jx) * STEP;
      const y = this.ny[i] + (p.y / len + jy) * STEP;
      const idx = this.addNode(x, y, i);
      if (idx >= 0) { born.push(idx); made++; }
    }
    // kill attractors fed by the new growth
    if (born.length) {
      for (let a = this.ax.length - 1; a >= 0; a--) {
        for (const b of born) {
          if (Math.abs(this.ax[a] - this.nx[b]) < KILL &&
              Math.abs(this.ay[a] - this.ny[b]) < KILL) {
            this.ax.splice(a, 1);
            this.ay.splice(a, 1);
            break;
          }
        }
      }
    }
    return born;
  }

  drawSegments(born, bright) {
    const g = this.gb;
    g.lineWidth = 1.2;
    g.strokeStyle = bright ? 'rgba(46,95,88,0.95)' : 'rgba(46,95,88,0.8)';
    g.beginPath();
    for (const i of born) {
      const p = this.parent[i];
      if (p < 0) continue;
      g.moveTo(this.nx[p], this.ny[p]);
      g.lineTo(this.nx[i], this.ny[i]);
      if (bright) this.tips.push({ x: this.nx[i], y: this.ny[i], age: 0, amber: false });
    }
    g.stroke();
  }

  wake() {
    // reduced motion: the network arrives pre-grown — a designed state,
    // not an absence
    if (this.ctx.reduced() && !this.preGrown) {
      this.preGrown = true;
      for (let s = 0; s < 240; s++) {
        const born = this.growStep();
        this.drawSegments(born, false);
        if (!born.length && s > 30) break;
      }
    }
  }

  update(dt) {
    const ctx = this.ctx;
    if (ctx.reduced()) return;

    // growth at 30Hz; drawing every frame
    this.growClock += dt;
    if (this.growClock >= 1 / 30) {
      this.growClock %= 1 / 30;
      const born = this.growStep();
      if (born.length) this.drawSegments(born, true);
    }

    // resting cursor deposits nutrients (throttled to 6/sec)
    this.depositClock += dt;
    if (this.depositClock > 0.16) {
      this.depositClock = 0;
      const my = ctx.pointer.y - this.top();
      if (my > 0 && my < this.h && ctx.pointer.speed < 60) {
        this.deposit(ctx.pointer.x, my, 2);
      }
    }

    // pulses race along finished branches: walk the parent chain rootward
    this.pulseClock += dt;
    if (this.pulseClock > 0.6 && this.pulses.length < MAX_PULSES && this.nodeCount > 60) {
      this.pulseClock = 0;
      const leaf = (this.rand() * this.nodeCount) | 0;
      this.pulses.push({ node: leaf, t: 0 });
    }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.t += dt * 5;
      while (p.t >= 1) {
        p.t -= 1;
        p.node = this.parent[p.node];
        if (p.node < 0 || this.parent[p.node] < 0) { this.pulses.splice(i, 1); p.dead = true; break; }
      }
    }
    for (const tip of this.tips) tip.age += dt;
    while (this.tips.length > 220) this.tips.shift();
  }

  draw(t) {
    const g = this.go;
    const ctx = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    if (ctx.reduced()) return;

    g.globalCompositeOperation = 'lighter';
    // bright growth tips and amber nutrient blooms
    for (const tip of this.tips) {
      const life = tip.amber ? 0.45 : 0.6;
      if (tip.age > life) continue;
      const a = 1 - tip.age / life;
      g.fillStyle = tip.amber
        ? `rgba(255,179,92,${a * 0.5})`
        : `rgba(155,232,196,${a * 0.7})`;
      g.beginPath();
      g.arc(tip.x, tip.y, tip.amber ? 5 : 1.8, 0, Math.PI * 2);
      g.fill();
    }
    // signal pulses
    let bestPulse = null, bestD = 1e9;
    g.fillStyle = 'rgba(94,242,214,0.85)';
    for (const p of this.pulses) {
      if (p.dead || p.node < 0) continue;
      const par = this.parent[p.node];
      if (par < 0) continue;
      const x = this.nx[p.node] + (this.nx[par] - this.nx[p.node]) * p.t;
      const y = this.ny[p.node] + (this.ny[par] - this.ny[p.node]) * p.t;
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
      // nearest pulse to the prose lights the words from below
      for (const para of this.cachedParas || []) {
        const d = Math.hypot(x - para.cx, y - para.cy);
        if (d < bestD) { bestD = d; bestPulse = { x, y, para }; }
      }
    }
    g.globalCompositeOperation = 'source-over';

    // cross-medium glow: one paragraph at a time, decaying var
    if (bestPulse && bestD < 320) {
      const root = ctx.organism;
      root.style.setProperty('--pulse-x', (bestPulse.x / ctx.vw).toFixed(3));
      root.style.setProperty('--pulse-y', ((bestPulse.y + this.top()) / ctx.vh).toFixed(3));
      root.style.setProperty('--pulse-a', String(Math.max(0, 1 - bestD / 320).toFixed(3)));
      bestPulse.para.el.style.setProperty('--hx', (bestPulse.para.cx / ctx.vw).toFixed(3));
      bestPulse.para.el.style.setProperty('--hy', ((bestPulse.para.cy + this.top()) / ctx.vh).toFixed(3));
    }
  }

  // cache paragraph centers in section-local coords (resize/enter only)
  cacheParas() {
    this.cachedParas = this.paragraphs.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2 - this.top(),
      };
    });
  }
}
