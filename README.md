# Anima — A Garden That Remembers You

An editorial botanical world built around the journey from a seed to an impossible bloom. Deep forest green, pistachio, translucent petals and pale pink give this experience its own identity.

## Experience

- Original imagegen glass botanical specimen, delivered as a 138 KB WebP; full PNG retained.
- A living Three.js specimen unfurls with scrolling and closes when the visitor returns.
- The specimen becomes a small companion between chapters and hops with scroll direction.
- An original eight-second microscopic film, with poster and pause control.
- Visitors can plant memories in a garden and download an SVG specimen containing their visit's chapter/memory counts.
- All visit state stays in memory in the current page. No analytics, storage or external data transmission.
- Responsive narration, keyboard controls, reduced motion, video pausing and a non-WebGL fallback.
- `made with Purvang` links to https://purvang.vercel.app/ in the footer.

## Run

```sh
python3 -m http.server 4501 --bind 127.0.0.1
```

Serve over HTTP for ES modules. No build step. Three.js and fonts are vendored locally. The active entry point is `js/main.js`; `js/experience.js` owns the new interaction system. Earlier section modules are retained but no longer loaded.

## Assets and validation

Exact built-in imagegen prompt: [assets/ASSETS.md](assets/ASSETS.md). Film provenance: [assets/VIDEO.md](assets/VIDEO.md). No stock media was used.

Source-level checks cover local assets, fonts, anchors, unique IDs, CSS/JS syntax, reversible botanical geometry, scroll direction, motion/video controls, memory planting and SVG download. Media passed FFmpeg decode verification. Browser visual testing was blocked by a saved browser permission setting and has not been completed.
