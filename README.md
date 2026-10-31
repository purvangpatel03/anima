# Anima — A Garden That Remembers You

An editorial botanical world built around the journey from a seed to an impossible bloom. Deep forest green, pistachio, translucent petals and pale pink give this experience its own identity.

## Experience

- Original imagegen glass botanical specimen, delivered as a 138 KB WebP; full PNG retained.
- A living Three.js specimen unfurls with scrolling and closes when the visitor returns.
- The specimen becomes a small companion between chapters and hops with scroll direction.
- A scroll-controlled microscopic field study: a framed green world expands to fill the screen, one soft membrane divides into five, and the five organisms settle as the frame shrinks back into the page. Scrolling upward reverses every stage.
- Smoothly joined membranes, luminous nuclei and suspended dust are drawn live by a small WebGL shader. The field redraws only when scroll or layout changes. The original film poster is the graphics fallback; the earlier eight-second film is retained as an asset.
- Visitors can plant memories in a garden and download an SVG specimen containing their visit's chapter/memory counts.
- All visit state stays in memory in the current page. No analytics, storage or external data transmission.
- Responsive narration, keyboard controls, reduced motion, video pausing and a non-WebGL fallback.
- `made with Purvang` links to https://purvang.vercel.app/ in the footer.

## Run

```sh
python3 -m http.server 4501 --bind 127.0.0.1
```

Serve over HTTP for ES modules. No build step. Three.js and fonts are vendored locally. The active entry point is `js/main.js`; `js/experience.js` owns the new interaction system. Earlier section modules are retained but no longer loaded.

The field study lives in `js/field-study.js`, with its reversible choreography in `js/field-state.js` and membrane material in `js/field-shader.js`. Its sticky stage runs for 420 small viewport heights on desktop and 390 on mobile. The composition adapts between portrait and landscape. **Continue** exits to the caption; **Motion off** collapses the passage to the final framed composition while retaining the visitor's place. No timer or forward-only playback controls the division.

## Assets and validation

Exact built-in imagegen prompt: [assets/ASSETS.md](assets/ASSETS.md). Film provenance: [assets/VIDEO.md](assets/VIDEO.md). No stock media was used.

Source-level checks cover local assets, fonts, anchors, unique IDs, CSS/JS syntax, reversible botanical geometry, scroll direction, motion controls, memory planting and SVG download. The field-study checks exercise continuous one-to-five division, separate final membranes, conserved area, exact rewind inputs, portrait/landscape framing, idle/offscreen suspension, motion-mode position retention, reduced-motion startup, Continue focus and context-loss fallback. Media passed FFmpeg decode verification. Browser visual testing and GPU shader compilation could not be verified because of the saved browser permission restriction; simulated-DOM checks do not replace those checks.
