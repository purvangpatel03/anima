// 2D value noise on a wrapping 64×64 lattice + a divergence-free curl field.
const SIZE = 64;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x0A71A);
const lattice = new Float32Array(SIZE * SIZE);
for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

function smooth(t) { return t * t * (3 - 2 * t); }

// x, y in lattice units; wraps in both axes
export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % SIZE) + SIZE) % SIZE, y0 = ((yi % SIZE) + SIZE) % SIZE;
  const x1 = (x0 + 1) % SIZE, y1 = (y0 + 1) % SIZE;
  const a = lattice[y0 * SIZE + x0], b = lattice[y0 * SIZE + x1];
  const c = lattice[y1 * SIZE + x0], d = lattice[y1 * SIZE + x1];
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Curl of the noise — divergence-free, so particles never clump dead.
export function curl(x, y, out) {
  const e = 0.05;
  out.x = (valueNoise(x, y + e) - valueNoise(x, y - e)) / (2 * e);
  out.y = -(valueNoise(x + e, y) - valueNoise(x - e, y)) / (2 * e);
  return out;
}
