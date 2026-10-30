# Living study

`living-film.mp4` is an original procedural 8-second film created for Anima.
Translucent cell membranes contain nuclei and suspended organelles while
microscopic pollen drifts in a deep green environment.

- 960 × 540 pixels, 24 fps, H.264/YUV420p, silent, faststart.
- Every motion is periodic; safe to use with the native video `loop` attribute.
- `living-film-poster.jpg` is a frame from the film.
- Complete reproducible renderer: `tools/render-film.py` in this repository.
  Run `python tools/render-film.py anima` with NumPy and FFmpeg installed.
- No third-party media or downloaded footage is used.

For browser use, prefer `muted playsinline loop`, load only when near the
viewport, and display the poster for reduced-motion preferences.
