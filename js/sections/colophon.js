// COLOPHON — the organism's last act of cooperation: the credits exist
// only where your light falls. Tab walks the glow between the lines.
export class Colophon {
  constructor(ctx, sec) {
    this.ctx = ctx;
    this.sec = sec;
    this.credits = sec.querySelector('#credits');
    this.awake = false;
    this.mx = 50;
    this.my = 50;
    this.lit = false;

    if (!ctx.reduced()) this.credits.classList.add('masked');

    sec.querySelector('#lights').addEventListener('click', (e) => {
      this.lit = !this.lit;
      this.credits.classList.toggle('masked', !this.lit && !ctx.reduced());
      e.target.textContent = this.lit ? 'TURN OFF THE LIGHTS' : 'TURN ON THE LIGHTS';
      e.target.setAttribute('aria-pressed', String(this.lit));
    });

    // Tab walks the glow between credits
    sec.addEventListener('focusin', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const r = li.getBoundingClientRect();
      const c = this.credits.getBoundingClientRect();
      this.mx = ((r.left + 40 - c.left) / c.width) * 100;
      this.my = ((r.top + r.height / 2 - c.top) / c.height) * 100;
    });

    const dormBtn = sec.querySelector('#dormancy');
    dormBtn.addEventListener('click', () => {
      const on = ctx.toggleDormancy();
      dormBtn.setAttribute('aria-pressed', String(on));
      dormBtn.textContent = `DORMANCY MODE: ${on ? 'ON' : 'OFF'}`;
      this.credits.classList.toggle('masked', !on && !this.lit);
    });
    if (ctx.dormant) {
      dormBtn.setAttribute('aria-pressed', 'true');
      dormBtn.textContent = 'DORMANCY MODE: ON';
    }
  }

  // doc-relative rect cached on wake/resize; per-frame math only
  cacheRect() {
    const r = this.credits.getBoundingClientRect();
    this._rect = {
      left: r.left,
      top: r.top + this.ctx.scrollY,
      width: r.width,
      height: r.height,
    };
  }

  wake() { this.cacheRect(); }

  update() {
    if (!this.awake || this.lit || this.ctx.reduced()) return;
    if (!this._rect) this.cacheRect();
    const r = this._rect;
    const top = r.top - this.ctx.scrollY;
    const px = ((this.ctx.pointer.x - r.left) / Math.max(1, r.width)) * 100;
    const py = ((this.ctx.pointer.y - top) / Math.max(1, r.height)) * 100;
    if (px > -40 && px < 140 && py > -80 && py < 180) {
      this.mx += (px - this.mx) * 0.2;
      this.my += (py - this.my) * 0.2;
    }
    this.credits.style.setProperty('--mx', this.mx.toFixed(1) + '%');
    this.credits.style.setProperty('--my', this.my.toFixed(1) + '%');
  }

  resize() {
    if (this.awake) this.cacheRect();
    else this._rect = null;
  }
}
