// Hand-rolled damped spring, semi-implicit Euler, mass 1.
// Hover is impulse, not state: prefer impulse() over set() for interactions,
// so values overshoot and ring down instead of tweening.
export class Spring {
  constructor(k, c, value = 0) {
    this.k = k;
    this.c = c;
    this.x = value;
    this.v = 0;
    this.target = value;
  }
  set(value) { this.x = value; this.target = value; this.v = 0; }
  impulse(velocity) { this.v += velocity; }
  update(dt) {
    const a = -this.k * (this.x - this.target) - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}
