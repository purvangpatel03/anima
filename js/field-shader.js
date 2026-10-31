export const vertexShader = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const fragmentShader = `
precision highp float;
uniform vec2 uResolution;
uniform vec2 uFrame;
uniform vec4 uCells[5];
uniform float uPhase;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float softUnion(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * .25;
}
float membrane(vec2 p, vec4 cell, float id) {
    vec2 q = p - cell.xy;
    float angle = atan(q.y, q.x);
    float wave = 1.0 + .058 * sin(angle * 5.0 + uPhase + id * 1.7)
                     + .026 * cos(angle * 8.0 - uPhase * .7 + id);
    return length(q * vec2(1.0, 1.055)) - cell.z * wave;
}
void main() {
    float unit = min(uFrame.x, uFrame.y);
    // Top-down coordinates keep the final composition aligned with the page.
    vec2 p = (gl_FragCoord.xy - uResolution * .5) / unit;
    p.y *= -1.0;
    float atmosphere = exp(-dot(p * vec2(.85, 1.15), p * vec2(.85, 1.15)) * 3.0);
    vec3 color = vec3(.012, .035, .023) + vec3(.026, .058, .017) * atmosphere;
    float d = membrane(p, uCells[0], 0.0);
    for (int i = 1; i < 5; i++) {
        if (uCells[i].z > .001) d = softUnion(d, membrane(p, uCells[i], float(i)), .076);
    }
    float aa = 1.1 / unit;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float rim = exp(-pow(d / .0026, 2.0));
    float innerRim = exp(-pow((d + .009) / .008, 2.0));
    float halo = exp(-abs(d) / .017);
    float light = .70 + .30 * sin(p.x * 4.0 - p.y * 5.0 + .8);
    color += vec3(.065, .105, .025) * inside;
    color += vec3(.09, .14, .035) * halo;
    color += vec3(.17, .23, .06) * innerRim;
    color += vec3(.54, .65, .30) * rim * light;
    // Nuclei materialize inside each emerging lobe and stay attached to it.
    for (int i = 0; i < 5; i++) {
        vec4 cell = uCells[i];
        if (cell.z > .002) {
            vec2 q = p - cell.xy;
            vec2 nucleus = vec2(-.20, .14) * cell.z;
            float nr = length(q - nucleus) - cell.z * .235;
            float visibility = smoothstep(.22, .82, cell.w);
            color += vec3(.22, .32, .105) * exp(-pow(nr / .0028, 2.0)) * visibility;
            color += vec3(.033, .045, .009) * exp(-abs(nr) / .012) * visibility;
            for (int j = 0; j < 4; j++) {
                float a = float(j) * 1.91 + float(i) * 2.0 + uPhase * .075;
                vec2 organelle = vec2(cos(a), sin(a)) * cell.z * (.49 + .08 * sin(float(j)));
                float r = length(q - organelle) / max(.002, cell.z * .038);
                color += vec3(.30, .39, .10) * exp(-r * r) * visibility;
            }
        }
    }
    // A deterministic dust field: no video seeking, timers or random frame state.
    vec2 dustP = p * 30.0 + vec2(uPhase * .07, -uPhase * .045);
    vec2 grid = floor(dustP), f = fract(dustP);
    vec2 seed = vec2(hash(grid), hash(grid + 14.7));
    float speck = exp(-dot(f - seed, f - seed) * 480.0) * step(.89, hash(grid + 29.0));
    color += vec3(.26, .33, .13) * speck * .45;
    color += (hash(gl_FragCoord.xy) - .5) * .009;
    gl_FragColor = vec4(color, 1.0);
}
`;
