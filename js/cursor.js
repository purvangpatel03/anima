// The cursor is an amoeba: a sprung vesicle that stretches along its velocity,
// waves eight cilia, and performs phagocytosis on anything interactive.
import { Spring } from './lib/spring.js';

const TAU = Math.PI * 2;
const POINTS = 16;
const W = 280, H = 200;
const INTERACTIVE = 'a, button, input, [data-cell]';

export class Amoeba {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = document.getElementById('amoeba');
    this.g = this.el.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.el.width = W * dpr;
    this.el.height = H * dpr;
    this.el.style.width = W + 'px';
    this.el.style.height = H + 'px';
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.x = new Spring(180, 22, ctx.pointer.x);
    this.y = new Spring(180, 22, ctx.pointer.y);
    this.radii = [];
    for (let i = 0; i < POINTS; i++) this.radii.push(new Spring(120, 17, 10));
    this.target = null;       // element being engulfed
    this.targetRect = null;
    this.focusMode = false;   // gliding to a focused element

    // rects are measured HERE, at event time (never in the rAF loop) —
    // stored doc-relative so scrolling needs no re-measure
    const acquire = (el) => {
      this.target = el;
      const r = el.getBoundingClientRect();
      this.targetDocRect = {
        left: r.left,
        topDoc: r.top + this.ctx.scrollY,
        width: r.width,
        height: r.height,
      };
    };
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest && e.target.closest(INTERACTIVE);
      if (el) { acquire(el); this.focusMode = false; }
    });
    document.addEventListener('pointerout', (e) => {
      const el = e.target.closest && e.target.closest(INTERACTIVE);
      if (el && el === this.target && !this.focusMode) this.target = null;
    });
    // Keyboard users have a cursor too: glide to focus and engulf it.
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest(INTERACTIVE);
      if (el) { acquire(el); this.focusMode = true; }
    });
    document.addEventListener('focusout', () => {
      if (this.focusMode) { this.target = null; this.focusMode = false; }
    });
    document.addEventListener('pointermove', () => { this.focusMode = false; });
  }

  update(dt, t) {
    const ctx = this.ctx;
    const reduced = ctx.reduced();

    // viewport rect derived from the doc-relative cache — zero layout reads
    if (this.target && this.targetDocRect) {
      const d = this.targetDocRect;
      this.targetRect = {
        left: d.left,
        top: d.topDoc - ctx.scrollY,
        width: d.width,
        height: d.height,
      };
    } else {
      this.targetRect = null;
    }

    if (this.targetRect) {
      this.x.target = this.targetRect.left + this.targetRect.width / 2;
      this.y.target = this.targetRect.top + this.targetRect.height / 2;
    } else {
      this.x.target = ctx.pointer.x;
      this.y.target = ctx.pointer.y;
    }
    this.x.update(dt);
    this.y.update(dt);

    // Membrane point targets: resting circle, or the outline of the prey.
    for (let i = 0; i < POINTS; i++) {
      const s = this.radii[i];
      if (this.targetRect) {
        const a = (i / POINTS) * TAU;
        const hw = Math.min(this.targetRect.width / 2 + 10, W / 2 - 8);
        const hh = Math.min(this.targetRect.height / 2 + 8, H / 2 - 8);
        // distance from center to a rounded-rect outline along angle a
        const ca = Math.cos(a), sa = Math.sin(a);
        const tx = ca !== 0 ? hw / Math.abs(ca) : Infinity;
        const ty = sa !== 0 ? hh / Math.abs(sa) : Infinity;
        s.target = Math.min(tx, ty, Math.hypot(hw, hh) * 0.96);
      } else {
        s.target = 10 + (reduced ? 0 : Math.sin(t * 2 + i * 1.7) * 1.2);
      }
      s.update(dt);
    }

    this.el.style.transform =
      `translate3d(${(this.x.x - W / 2).toFixed(1)}px, ${(this.y.x - H / 2).toFixed(1)}px, 0)`;
  }

  draw(t) {
    const g = this.g;
    const ctx = this.ctx;
    const reduced = ctx.reduced();
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;

    if (reduced) {
      g.beginPath();
      g.arc(cx, cy, 9, 0, TAU);
      g.strokeStyle = 'rgba(94,242,214,0.9)';
      g.lineWidth = 2;
      g.stroke();
      return;
    }

    const vx = this.x.v, vy = this.y.v;
    const speed = Math.hypot(vx, vy);
    const stretch = this.targetRect ? 0 : Math.min(0.45, speed * 0.0009);
    const heading = Math.atan2(vy, vx);

    g.save();
    g.translate(cx, cy);
    if (stretch > 0.01) {
      g.rotate(heading);
      g.scale(1 + stretch, 1 / (1 + stretch));
      g.rotate(-heading);
    }

    // body — smooth closed loop through sprung radial points
    g.beginPath();
    const px = [], py = [];
    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * TAU;
      px.push(Math.cos(a) * this.radii[i].x);
      py.push(Math.sin(a) * this.radii[i].x);
    }
    for (let i = 0; i < POINTS; i++) {
      const j = (i + 1) % POINTS;
      const mx = (px[i] + px[j]) / 2, my = (py[i] + py[j]) / 2;
      if (i === 0) g.moveTo(mx, my);
      else g.quadraticCurveTo(px[i], py[i], mx, my);
    }
    g.quadraticCurveTo(px[0], py[0], (px[0] + px[1]) / 2, (py[0] + py[1]) / 2);
    g.closePath();
    g.fillStyle = 'rgba(94,242,214,0.16)';
    g.fill();
    g.strokeStyle = 'rgba(94,242,214,0.85)';
    g.lineWidth = 1.5;
    g.stroke();

    // cilia — double count when idle and curious
    const idle = ctx.idleSeconds > 8 && !this.targetRect;
    const cilia = idle ? 16 : 8;
    const freq = 3 + 5 * ctx.nervous.agitation;
    g.strokeStyle = 'rgba(94,242,214,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < cilia; i++) {
      const a = (i / cilia) * TAU;
      const baseIdx = Math.floor((i / cilia) * POINTS) % POINTS;
      const r = this.radii[baseIdx].x;
      const wave = Math.sin(t * freq + i * (Math.PI / 4)) * 0.35;
      const len = 5 + 3 * Math.sin(t * freq + i);
      const ax = Math.cos(a) * r, ay = Math.sin(a) * r;
      g.moveTo(ax, ay);
      g.lineTo(ax + Math.cos(a + wave) * len, ay + Math.sin(a + wave) * len);
    }
    g.stroke();

    // idle curiosity: two dot-eyes track the nearest heading
    if (idle && ctx.nearestHeading) {
      const hx = ctx.nearestHeading.x - this.x.x;
      const hy = ctx.nearestHeading.y - this.y.x;
      const ha = Math.atan2(hy, hx);
      g.fillStyle = 'rgba(233,244,238,0.9)';
      for (const side of [-0.5, 0.5]) {
        g.beginPath();
        g.arc(Math.cos(ha + side) * 4, Math.sin(ha + side) * 4, 1.4, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }
}
