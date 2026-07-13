// "Keep your specimen record" — serialize the visit to a downloadable SVG
// slide with a procedurally derived taxonomic name. Nothing leaves the page
// except by the visitor's own hand.

function fnv1a(buf) {
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i] & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
}

// Ramer–Douglas–Peucker, ε in slide units
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    return [
      ...simplify(pts.slice(0, idx + 1), eps).slice(0, -1),
      ...simplify(pts.slice(idx), eps),
    ];
  }
  return [a, b];
}

export function taxonomy(rec, durationS) {
  const genus = rec.pokes >= 2 ? 'Perturbatrix'
    : rec.fedWord ? 'Nutrix'
    : rec.startles >= 2 ? 'Turbatrix'
    : 'Visitatrix';
  const pace = rec.scrollTravel / Math.max(1, durationS); // px/s averaged
  const species = pace > 260 ? 'festinans' : pace > 90 ? 'vagans' : 'morans';
  const nicknames = {
    'Perturbatrix festinans': 'The Restless Prodder',
    'Perturbatrix vagans': 'The Curious Intruder',
    'Perturbatrix morans': 'The Hesitant Intruder',
    'Nutrix festinans': 'The Generous Rush',
    'Nutrix vagans': 'The Gentle Feeder',
    'Nutrix morans': 'The Patient Keeper',
    'Turbatrix festinans': 'The Storm That Passed',
    'Turbatrix vagans': 'The Hawk Apologist',
    'Turbatrix morans': 'The Quiet Menace',
    'Visitatrix festinans': 'The Brief Comet',
    'Visitatrix vagans': 'The Slow Wanderer',
    'Visitatrix morans': 'The Long Look',
  };
  return { genus, species, nickname: nicknames[`${genus} ${species}`] || 'The Unclassified' };
}

export function buildSpecimenSVG(journey, rec, annotations) {
  const W = 1000, H = 700;
  const pts = journey.map((p) => ({ x: p.x * (W - 120) + 60, y: p.y * (H - 220) + 60 }));
  const simple = simplify(pts, 2);
  const durationS = journey.length ? journey[journey.length - 1].t : 0;
  const tax = taxonomy(rec, durationS);
  const id = 'ANIMA-' + fnv1a(new Uint8Array(rec.xs.buffer, 0, Math.min(rec.count * 4, rec.xs.byteLength)));
  const mins = Math.floor(durationS / 60);
  const secs = Math.round(durationS % 60);
  const date = new Date().toISOString().slice(0, 10);

  // 12 segments of stepped opacity: tail faint, head bright
  let paths = '';
  const segLen = Math.max(2, Math.ceil(simple.length / 12));
  for (let s = 0; s < 12; s++) {
    const seg = simple.slice(s * segLen, (s + 1) * segLen + 1);
    if (seg.length < 2) continue;
    const d = 'M' + seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    const o = (0.12 + 0.88 * (s / 11)).toFixed(2);
    paths += `<path d="${d}" fill="none" stroke="#5EF2D6" stroke-width="1.5" stroke-opacity="${o}" stroke-linecap="round"/>\n`;
  }

  let notes = '';
  annotations.slice(0, 3).forEach((n) => {
    const x = n.x * (W - 120) + 60;
    const y = n.y * (H - 220) + 60;
    notes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#5EF2D6"/>\n` +
      `<text x="${(x + 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-family="IBM Plex Mono, SF Mono, Menlo, monospace" font-size="11" letter-spacing="1" fill="#7FA396">${n.text}</text>\n`;
  });

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ANIMA specimen record">
  <rect width="${W}" height="${H}" fill="#060B0D"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#2E5F58" stroke-width="1"/>
  ${paths}
  ${notes}
  <g font-family="IBM Plex Mono, SF Mono, Menlo, monospace" letter-spacing="1.5">
    <text x="60" y="${H - 116}" font-size="20" fill="#E9F4EE">${id} — <tspan font-style="italic">${tax.genus} ${tax.species}</tspan></text>
    <text x="60" y="${H - 86}" font-size="13" fill="#5EF2D6">"${esc(tax.nickname)}"</text>
    <text x="60" y="${H - 60}" font-size="11" fill="#7FA396">OBSERVED ${date} — DURATION ${mins}M${String(secs).padStart(2, '0')}S — POKES ${rec.pokes} — DEPOSITS ${rec.deposits}${rec.fedWord ? ` — FED "${esc(rec.fedWord)}"` : ''}</text>
    <text x="60" y="${H - 40}" font-size="11" fill="#2E5F58">ANIMA — SPECIMEN RECORD — IT NOTICED YOU THE MOMENT YOU ARRIVED</text>
  </g>
</svg>`;
}
