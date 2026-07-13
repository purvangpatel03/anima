# ANIMA

*It noticed you the moment you arrived.*

A single-page living organism built in pure vanilla HTML, CSS, and JavaScript.
No libraries. No build step. No exceptions.

## Run it

Any static server from this folder:

```bash
python3 -m http.server 4173
# → http://localhost:4173
```

(Opening `index.html` directly won't work — ES modules require a server.)

## What it is

You don't visit ANIMA — you intrude on it. Six biological acts:

1. **MEMBRANE** — a soft-body cell breathing at 12bpm, the word ANIMA living
   inside it. Poke it and it ruptures, spills, and heals — differently every time.
2. **DRIFT** — thousands of plankton in a divergence-free current that parts
   around your cursor like water around a predator.
3. **MITOSIS** — your scrollbar is the timeline of cell division. Scrub
   backwards and division reverses.
4. **MYCELIUM** — a root network grown by space colonization, bending toward
   the nutrients your attention deposits.
5. **MURMURATION** — 400 boids that fear your cursor, then forgive you by
   spelling a word. Feed them a word of your own.
6. **ANAMNESIS** — the inversion. The organism replays your entire visit,
   annotated ("you hesitated here — 0:34"), names you taxonomically, and
   offers you your specimen record as a downloadable SVG. Then it lets you go.

## Engineering notes

- One `requestAnimationFrame` loop; sections sleep entirely off-screen.
- One broadcast "agitation" scalar drives breath rate, the variable-font SOFT
  axis, particle behavior, and the sitewide systole — one nervous system.
- Canvas 2D only: Verlet soft body, curl-noise flow field, GPU-composited
  gooey metaballs (blur+contrast), space colonization with a never-cleared
  persistent buffer, spatial-hashed boids.
- `prefers-reduced-motion` (and the DORMANCY toggle) swaps every act for a
  designed static state — the reduced-motion visitor still gets the
  inversion, the annotations, and the specimen slide.
- Every cursor-driven moment has a focusable keyboard twin, and focus history
  feeds the finale exactly like cursor history.
- Your path never leaves the page. Nothing is sent. Nothing is stored.
