// A reversible score: every shape and position is a function of scroll alone.
export const clamp = value => Math.max(0, Math.min(1, value));
export const mix = (a, b, t) => a + (b - a) * t;
export function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
}
const between = (p, a, b) => ease((p - a) / (b - a));

export function fieldState(progress, aspect = 16 / 9) {
    const p = clamp(progress);
    const expansion = between(p, 0, .18) * (1 - between(p, .79, .98));
    const wide = ease((aspect - .85) / .65);
    const wideLayout = [[.04, .015, .225], [-.49, -.22, .135], [.55, -.24, .10], [.42, .26, .15], [-.57, .27, .082]];
    const narrowLayout = [[0, .015, .21], [-.27, -.34, .105], [.27, -.32, .085], [.25, .34, .12], [-.28, .32, .075]];
    const layout = wideLayout.map((v, i) => v.map((n, j) => mix(narrowLayout[i][j], n, wide)));
    const cells = [{ x: layout[0][0], y: layout[0][1], r: 0, birth: 1 }];
    let remainingArea = layout.reduce((sum, c) => sum + c[2] ** 2, 0);
    for (let i = 1; i < 5; i++) {
        const t = clamp((p - (.20 + (i - 1) * .075)) / .28);
        const growth = between(t, 0, .72);
        const separation = between(t, .08, 1);
        // A small, damped sideways sway makes the division feel soft and elastic.
        const sway = Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI) * .026;
        const [x, y, radius] = layout[i], r = radius * growth;
        cells.push({
            x: mix(layout[0][0], x, separation) - y * sway,
            y: mix(layout[0][1], y, separation) + x * sway,
            r,
            birth: growth
        });
        remainingArea -= r * r;
    }
    cells[0].r = Math.sqrt(Math.max(.01, remainingArea));
    return { p, expansion, cells, phase: p * 5, stage: p < .20 ? 'ONE QUIET BEGINNING' : p < .74 ? 'A SOFT KIND OF BECOMING' : 'A LITTLE MORE LIFE' };
}

export function frameInsets(width, height, expansion, staticMode = false) {
    const marginX = width * .07;
    const cardHeight = Math.min(height * .86, (width - marginX * 2) / (width <= 800 ? 4 / 3 : 16 / 9));
    return {
        x: marginX * (1 - expansion),
        y: staticMode ? 0 : (height - cardHeight) * .5 * (1 - expansion)
    };
}
