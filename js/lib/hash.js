// Uniform spatial hash grid. Rebuild-per-frame for dynamic sets (boids),
// insert-only for growing sets (mycelium nodes).
export class SpatialHash {
  constructor(cellSize) {
    this.cell = cellSize;
    this.map = new Map();
  }
  clear() { this.map.clear(); }
  // integer keys: no per-insert string allocation in the hot loops
  key(cx, cy) { return (cx + 4096) * 16384 + (cy + 4096); }
  insert(x, y, id) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell));
    const arr = this.map.get(k);
    if (arr) arr.push(id);
    else this.map.set(k, [id]);
  }
  // Visit every id stored in cells overlapping the circle (x, y, r).
  query(x, y, r, visit) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.map.get(this.key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) visit(arr[i]);
      }
    }
  }
}
