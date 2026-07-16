// Site-wide memory. The organism is taking notes from the moment you arrive.
// Coordinates are viewport-normalized (0..1); keyboard focus positions are
// pushed exactly like cursor positions — nobody's visit doesn't count.
export const FLAG = {
  NONE: 0,
  CLICK: 1,
  POKE: 2,
  DEPOSIT: 3,
  STARTLE: 4,
  WORD: 5,
  SECTION: 6,
  FOCUS: 7,
};

export class Recorder {
  constructor(cap = 4000) {
    this.cap = cap;
    this.xs = new Float32Array(cap);
    this.ys = new Float32Array(cap);
    this.ts = new Float32Array(cap);
    this.flags = new Uint8Array(cap);
    this.head = 0;
    this.count = 0;
    this.t0 = performance.now();
    this.accum = 0;
    this.pokes = 0;
    this.deposits = 0;
    this.startles = 0;
    this.fedWord = '';
    this.scrollTravel = 0;       // total px scrolled, for taxonomy
  }

  now() { return (performance.now() - this.t0) / 1000; }

  push(x, y, flag = 0) {
    const i = this.head;
    this.xs[i] = x; this.ys[i] = y;
    this.ts[i] = this.now();
    this.flags[i] = flag;
    this.head = (i + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  // Call every frame; samples at 20Hz.
  sample(dt, x, y) {
    this.accum += dt;
    if (this.accum >= 0.05) {
      this.accum %= 0.05;
      this.push(x, y);
    }
  }

  event(flag, x, y) {
    this.push(x, y, flag);
    if (flag === FLAG.POKE) this.pokes++;
    if (flag === FLAG.DEPOSIT) this.deposits++;
    if (flag === FLAG.STARTLE) this.startles++;
  }

  // Chronological copy of the ring buffer.
  journey() {
    const out = [];
    const start = this.count < this.cap ? 0 : this.head;
    for (let n = 0; n < this.count; n++) {
      const i = (start + n) % this.cap;
      out.push({ x: this.xs[i], y: this.ys[i], t: this.ts[i], flag: this.flags[i] });
    }
    return out;
  }

  // Windows where you barely moved for >1.5s — top 5 by duration.
  hesitations(journey) {
    const out = [];
    let i = 0;
    while (i < journey.length - 1) {
      let j = i + 1;
      while (j < journey.length &&
             Math.hypot(journey[j].x - journey[i].x, journey[j].y - journey[i].y) < 0.024) j++;
      const end = Math.min(j, journey.length - 1);
      const dur = journey[end].t - journey[i].t;
      if (dur > 1.5) out.push({ index: i, t: journey[i].t, dur, x: journey[i].x, y: journey[i].y });
      i = Math.max(j, i + 1);
    }
    return out.sort((a, b) => b.dur - a.dur).slice(0, 5);
  }
}
