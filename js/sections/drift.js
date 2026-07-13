// 02 / DRIFT — plankton advected through a divergence-free current.
// Your cursor is a predator the stream parts around; the copy condenses
// out of the same water, letter by letter.
import { curl, valueNoise, mulberry32 } from '../lib/noise.js';

export class Drift {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.canvas = sec.querySelector('canvas.stage');
    this.g = this.canvas.getContext('2d');
    this.awake = false;
    this.zoff = 0;
    this.fieldTick = 0;
    this.condensed = false;
    this.condenseT = -1;
    this.sweep = -1;            // keyboard twin: a repulsor crosses the canvas
    this.staticDone = false;

    // build the condensing glyphs once, from data-condense
    const holder = sec.querySelector('[data-condense]');
    const text = holder.getAttribute('data-condense');
    const rand = mulberry32(0xD81F7);
    this.spans = [];
    const frag = document.createDocumentFragment();
    for (const word of text.split(' ')) {
      const w = document.createElement('span');
      w.style.whiteSpace = 'nowrap';
      w.style.display = 'inline-block';
      for (const ch of word) {
        const s = document.createElement('span');
        s.textContent = ch;
        s._nx = (rand() - 0.5) * 2;
        s._ny = (rand() - 0.5) * 2;
        this.spans.push(s);
        w.appendChild(s);
      }
      frag.appendChild(w);
      frag.appendChild(document.createTextNode(' '));
    }
    holder.appendChild(frag);

    sec.querySelector('[data-stim="part"]').addEventListener('click', () => {
      this.sweep = 0;
      this.ctx.nervous.impulse(0.3);
    });

    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = this.sec.clientWidth, h = this.sec.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.secTop = this.sec.getBoundingClientRect().top + this.ctx.scrollY;

    const count = Math.max(800, Math.min(3000, Math.round((w * h) / 700)));
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    const rand = mulberry32(0x5EA);
    for (let i = 0; i < count; i++) {
      this.x[i] = rand() * w;
      this.y[i] = rand() * h;
    }
    this.g.fillStyle = '#0E1F22';
    this.g.fillRect(0, 0, w, h);
    this.staticDone = false;
  }

  wake() {
    if (!this.condensed) {
      this.condensed = true;
      this.condenseT = 0;
      if (!this.ctx.reduced()) {
        for (const s of this.spans) s.style.willChange = 'transform';
      }
    }
  }

  update(dt, t) {
    const ctx = this.ctx;
    if (ctx.reduced()) return;
    this.zoff += dt * 0.6;

    // condensing copy: glyph offsets ride the noise, then lerp to zero
    if (this.condenseT >= 0) {
      this.condenseT += dt;
      let allDone = true;
      for (let i = 0; i < this.spans.length; i++) {
        const s = this.spans[i];
        const local = Math.max(0, Math.min(1, (this.condenseT - i * 0.018) / 1.2));
        const e = 1 - Math.pow(1 - local, 3);
        const f = 1 - e;
        if (f > 0.001) {
          allDone = false;
          const nx = valueNoise(i * 0.7 + this.zoff, this.zoff) - 0.5;
          const ny = valueNoise(this.zoff, i * 0.9 + this.zoff) - 0.5;
          s.style.transform = `translate(${(s._nx + nx) * 46 * f}px, ${(s._ny + ny) * 40 * f}px)`;
          s.style.opacity = String(0.25 + 0.75 * e);
        } else if (s.style.transform !== '') {
          s.style.transform = '';
          s.style.opacity = '';
          s.style.willChange = 'auto';
        }
      }
      if (allDone) this.condenseT = -1;
    }

    if (this.sweep >= 0) {
      this.sweep += dt / 1.6;
      if (this.sweep > 1) this.sweep = -1;
    }
  }

  draw(t) {
    const g = this.g;
    const ctx = this.ctx;

    if (ctx.reduced()) {
      // one pre-rendered still: long strokes along the streamlines
      if (this.staticDone) return;
      this.staticDone = true;
      g.fillStyle = '#0E1F22';
      g.fillRect(0, 0, this.w, this.h);
      const rand = mulberry32(0xACE);
      const v = { x: 0, y: 0 };
      g.strokeStyle = 'rgba(94,242,214,0.16)';
      g.lineWidth = 1;
      for (let s = 0; s < 600; s++) {
        let x = rand() * this.w, y = rand() * this.h;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 40; k++) {
          curl(x * 0.012, y * 0.012, v);
          x += v.x * 6;
          y += v.y * 6;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      return;
    }

    // trail fade, then additive motes
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(14,31,34,0.08)';
    g.fillRect(0, 0, this.w, this.h);

    const mx = ctx.pointer.x;
    const my = ctx.pointer.y - (this.secTop - ctx.scrollY);
    let sweepX = -1e4, sweepY = 0;
    if (this.sweep >= 0) {
      sweepX = this.sweep * (this.w + 400) - 200;
      sweepY = this.h * 0.5 + Math.sin(this.sweep * Math.PI * 2) * this.h * 0.18;
    }

    const v = { x: 0, y: 0 };
    const speedBase = 26 + 50 * ctx.nervous.agitation;
    g.globalCompositeOperation = 'lighter';

    // three passes bucketed by speed → three stroke styles, not 3000
    const dt = 1 / 60;
    for (let pass = 0; pass < 3; pass++) {
      g.beginPath();
      for (let i = pass; i < this.count; i += 3) {
        let x = this.x[i], y = this.y[i];
        curl(x * 0.012 + this.zoff, y * 0.012, v);
        let vx = v.x * speedBase, vy = v.y * speedBase;
        // predator wake: inverse-square, hard falloff at 220px
        let dx = x - mx, dy = y - my;
        let d2 = dx * dx + dy * dy;
        if (d2 < 220 * 220 && d2 > 4) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 220) * 2400 / d;
          vx += dx * f * 0.06;
          vy += dy * f * 0.06;
        }
        dx = x - sweepX; dy = y - sweepY;
        d2 = dx * dx + dy * dy;
        if (d2 < 260 * 260 && d2 > 4) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 260) * 3200 / d;
          vx += dx * f * 0.06;
          vy += dy * f * 0.06;
        }
        x += vx * dt * 3;
        y += vy * dt * 3;
        if (x < -5) x += this.w + 10; else if (x > this.w + 5) x -= this.w + 10;
        if (y < -5) y += this.h + 10; else if (y > this.h + 5) y -= this.h + 10;
        this.x[i] = x; this.y[i] = y;
        g.moveTo(x, y);
        g.lineTo(x - vx * 0.06, y - vy * 0.06);
      }
      g.lineWidth = 1.1;
      g.strokeStyle = pass === 0
        ? 'rgba(94,242,214,0.32)'
        : pass === 1
          ? 'rgba(155,232,196,0.22)'
          : 'rgba(94,242,214,0.14)';
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
}
