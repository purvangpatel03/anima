import { clamp, fieldState, frameInsets } from './field-state.js';
import { vertexShader, fragmentShader } from './field-shader.js';

function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || 'Field shader could not compile.');
    }
    return shader;
}

function createSurface(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL is unavailable.');
    const program = gl.createProgram();
    const shaders = [compile(gl, gl.VERTEX_SHADER, vertexShader), compile(gl, gl.FRAGMENT_SHADER, fragmentShader)];
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Field shader could not link.');
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'uResolution');
    const frame = gl.getUniformLocation(program, 'uFrame');
    const cells = gl.getUniformLocation(program, 'uCells[0]');
    const phase = gl.getUniformLocation(program, 'uPhase');
    return {
        draw(state, width, height, inset) {
            // Bound fragment work on large displays; the soft material tolerates this well.
            const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / width, 1200 / height);
            const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
            }
            gl.uniform2f(resolution, w, h);
            gl.uniform2f(frame, (width - inset.x * 2) * ratio, (height - inset.y * 2) * ratio);
            gl.uniform4fv(cells, new Float32Array(state.cells.flatMap(c => [c.x, c.y, c.r, c.birth])));
            gl.uniform1f(phase, state.phase);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    };
}

export function createFieldStudy(wake) {
    const track = document.querySelector('[data-field-scroll]');
    if (!track) return null;
    const pin = track.querySelector('.field-pin');
    const figure = track.querySelector('.film');
    const canvas = track.querySelector('canvas');
    const phase = track.querySelector('[data-field-phase]');
    const hint = track.querySelector('[data-field-hint]');
    const skip = track.querySelector('[data-field-skip]');
    let surface;
    try { surface = createSurface(canvas); }
    catch { return null; } // The original poster stays visible if graphics cannot start.
    let lastKey = '', lastP = 0, goingBack = false, staticMode = false, failed = false;
    track.classList.add('is-live');
    skip.hidden = false;
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        failed = true;
        track.classList.remove('is-live');
        skip.hidden = true;
        wake();
    });
    skip.addEventListener('click', () => {
        const target = document.querySelector('.field-caption');
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'instant', block: 'center' });
        wake();
    });
    return {
        update(paused) {
            if (failed) return;
            if (staticMode !== paused) {
                const before = track.getBoundingClientRect();
                const wasVisible = before.top < innerHeight && before.bottom > 0;
                const documentTop = before.top + scrollY;
                staticMode = paused;
                track.dataset.static = String(paused);
                // Keep a visitor inside the scene when its long scroll track collapses.
                if (wasVisible && (before.top <= 0 || !paused)) {
                    const target = paused
                        ? documentTop - Math.max(0, (innerHeight - pin.clientHeight) * .5)
                        : documentTop + track.offsetHeight - pin.clientHeight;
                    window.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
                }
                lastKey = '';
            }
            const rect = track.getBoundingClientRect();
            const height = pin.clientHeight || innerHeight;
            if (rect.top > innerHeight || rect.bottom < 0) return;
            const width = pin.clientWidth || innerWidth;
            const p = paused ? 1 : clamp(-rect.top / Math.max(1, track.offsetHeight - height));
            if (Math.abs(p - lastP) > .00001) goingBack = p < lastP;
            lastP = p;
            const key = `${p.toFixed(6)}:${width}:${height}:${paused}`;
            if (key === lastKey) return;
            lastKey = key;
            const expansion = fieldState(p).expansion;
            const inset = frameInsets(width, height, paused ? 0 : expansion, paused);
            const aspect = (width - inset.x * 2) / (height - inset.y * 2);
            const state = fieldState(p, aspect);
            figure.style.setProperty('--field-x', `${inset.x.toFixed(2)}px`);
            figure.style.setProperty('--field-y', `${inset.y.toFixed(2)}px`);
            phase.textContent = state.stage;
            hint.textContent = paused ? 'FIVE SMALL WORLDS' : goingBack ? 'SCROLL TO GATHER ↑' : p < .74 ? 'SCROLL TO SEPARATE ↓' : 'KEEP EXPLORING ↓';
            surface.draw(state, width, height, inset);
        }
    };
}
