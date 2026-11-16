// TRIAD brand graphics — generated as pure SVG so they stay crisp on every
// screen, can be animated with CSS and exported 1:1 for print, merch and covers.
//
// THE EMBLEM: three serpent-dragons chasing each other around a triangle.
// Each body is drawn as three parallel lines (three forces, three lines, three heads).
// Every head carries one horn and a red eye. The outer ring carries the motto.

const C = 100;
const f = (n) => Math.round(n * 100) / 100;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

function vertex(i, r) {
  const a = ((-90 + i * 120) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function serpent(r = 57) {
  const head = vertex(0, r);
  const tail = vertex(2, r);
  const d = [head[0] - tail[0], head[1] - tail[1]];
  const len = Math.hypot(d[0], d[1]);
  const u = [d[0] / len, d[1] / len]; // forward along the side
  const v = [u[1], -u[0]]; // outward, away from the centre
  // local (forward, outward) -> svg point, anchored at the head
  const L = (a, b) => add(add(head, mul(u, a)), mul(v, b));

  const neck = L(-11, 0);
  const c1 = add(add(tail, mul(u, len * 0.38)), mul(v, 20));
  const c2 = add(add(tail, mul(u, len * 0.72)), mul(v, -9));
  const lines = [-4.2, 0, 4.2]
    .map((o, k) => {
      const a = add(tail, mul(v, o * 0.25));
      const b = add(neck, mul(v, o * 0.85));
      return `<path d="M${pt(a)} C${pt(add(c1, mul(v, o)))} ${pt(add(c2, mul(v, o)))} ${pt(b)}" stroke-width="${k === 1 ? 3 : 1.6}"/>`;
    })
    .join('');

  const P = (arr) => arr.map(([a, b]) => pt(L(a, b))).join(' ');
  const skull = P([[-13, 5.5], [-4, 9], [7, 6.5], [17, 2.4], [19, 0], [9, -1.2], [16, -4.6], [3, -7.5], [-13, -5.5]]);
  const horn1 = P([[-5, 8], [-22, 21], [-10, 6]]);
  const horn2 = P([[-11, 6.5], [-24, 12], [-14, 4]]);
  const eye = L(4, 3.2);
  const t0 = L(18, -1.6);
  const t1 = L(25, -2.4);
  const f1 = L(29, 0);
  const f2 = L(29, -5);

  return `<g class="em-serpent">
  <g class="em-body" fill="none" stroke="currentColor" stroke-linecap="round">${lines}</g>
  <polygon points="${horn2}" fill="currentColor" opacity=".7"/>
  <polygon points="${horn1}" fill="currentColor"/>
  <polygon points="${skull}" fill="currentColor"/>
  <path d="M${pt(eye)} m-2.6 0 l2.6 -1.4 l2.6 1.4 l-2.6 1.4z" class="em-eye" fill="var(--red, #ff5a00)"/>
  <path d="M${pt(t0)} L${pt(t1)} L${pt(f1)} M${pt(t1)} L${pt(f2)}" class="em-tongue" stroke="var(--red, #ff5a00)" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
}

let uid = 0;

/**
 * @param {object} o
 * @param {boolean} o.ring   outer ring with motto
 * @param {string}  o.motto  text around the ring
 * @param {string}  o.cls    extra class names
 * @param {string}  o.title  accessible title (omit = decorative)
 */
export function emblem({ ring = true, motto = 'TRIAD · THREE FORCES · ONE VISION · MMXXVI · ', cls = '', title = '' } = {}) {
  const id = `em${++uid}`;
  const s = serpent();
  const a11y = title ? `role="img" aria-labelledby="${id}t"` : 'aria-hidden="true"';
  return `<svg class="emblem ${cls}" viewBox="0 0 200 200" ${a11y} xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
${title ? `<title id="${id}t">${title}</title>` : ''}
${
  ring
    ? `<g class="em-ring">
  <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" stroke-width=".8"/>
  <circle cx="100" cy="100" r="81" fill="none" stroke="currentColor" stroke-width=".5" stroke-dasharray=".6 2.94"/>
  <path id="${id}p" d="M100 100 m-87 0 a87 87 0 1 1 174 0 a87 87 0 1 1 -174 0" fill="none"/>
  <text font-family="'JetBrains Mono', ui-monospace, monospace" font-size="7.4" letter-spacing="2.4" fill="currentColor"><textPath href="#${id}p" xlink:href="#${id}p">${motto}${motto}</textPath></text>
</g>`
    : ''
}
<g class="em-core">
  <g>${s}</g>
  <g transform="rotate(120 100 100)">${s}</g>
  <g transform="rotate(240 100 100)">${s}</g>
  <g class="em-center" fill="currentColor">
    <circle cx="100" cy="93" r="2.1"/><circle cx="106.06" cy="103.5" r="2.1"/><circle cx="93.94" cy="103.5" r="2.1"/>
  </g>
</g>
</svg>`;
}

/** TRIAD glyph: three plus signs on the corners of a triangle (the "three" symbol). */
export function glyph({ cls = '', color = 'var(--red, #ff5a00)' } = {}) {
  const plus = (x, y) => `<path d="M${x - 13} ${y} H${x + 13} M${x} ${y - 13} V${y + 13}" />`;
  return `<svg class="glyph ${cls}" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 22 L79 72 L21 72 Z" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/>
  <g stroke="${color}" stroke-width="6" stroke-linecap="square">${plus(50, 22)}${plus(79, 72)}${plus(21, 72)}</g>
</svg>`;
}

/** Circular rubber-stamp graphic. */
export function stamp({ top = 'TRIAD ARCHIVE', bottom = 'NOT FOR SALE', center = '003', cls = '' } = {}) {
  const id = `st${++uid}`;
  return `<svg class="stamp ${cls}" viewBox="0 0 200 200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="${id}r"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6"/><feComposite in="SourceGraphic" operator="in"/></filter>
    <path id="${id}a" d="M30 100 a70 70 0 0 1 140 0"/>
    <path id="${id}b" d="M24 100 a76 76 0 0 0 152 0"/>
  </defs>
  <g filter="url(#${id}r)" fill="none" stroke="currentColor">
    <circle cx="100" cy="100" r="92" stroke-width="4"/>
    <circle cx="100" cy="100" r="58" stroke-width="2"/>
    <text fill="currentColor" stroke="none" font-family="'Anton', Impact, sans-serif" font-size="17" letter-spacing="4" text-anchor="middle"><textPath href="#${id}a" startOffset="50%">${top}</textPath></text>
    <text fill="currentColor" stroke="none" font-family="'JetBrains Mono', monospace" font-size="10" letter-spacing="3" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${bottom}</textPath></text>
    <text x="100" y="114" fill="currentColor" stroke="none" font-family="'Anton', Impact, sans-serif" font-size="42" text-anchor="middle">${center}</text>
    <path d="M70 128 H130" stroke-width="2"/>
  </g>
</svg>`;
}

/** Standalone SVG files for the archive / downloads (with fonts referenced, colours fixed). */
export function brandFiles() {
  const wrap = (inner, bg, fg, size = 1200) =>
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="color:${fg};--red:#ff5a00">
<rect width="100%" height="100%" fill="${bg}"/>
${inner}
</svg>`;
  const place = (svg, x, y, w) =>
    svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${w}" `);

  const pattern = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++)
      pattern.push(place(glyph({ color: '#0a0a0a' }), c * 200 + (r % 2 ? 100 : 0) - 50, r * 200, 200));

  const wordStack = `<g font-family="'Anton', Impact, sans-serif" fill="#0a0a0a" text-anchor="middle">
  <text x="600" y="520" font-size="430" letter-spacing="-6">TRI</text>
  <rect x="200" y="566" width="800" height="10" fill="#ff5a00"/>
  <text x="600" y="1000" font-size="430" letter-spacing="-6">AD</text>
  <text x="600" y="1110" font-family="'JetBrains Mono', monospace" font-size="28" letter-spacing="10">EST. MMXXVI — INDEPENDENT</text></g>`;

  return {
    'emblem-black.svg': wrap(place(emblem({ title: 'TRIAD emblem' }), 150, 150, 900), '#0a0a0a', '#fbfaf8'),
    'emblem-orange.svg': wrap(place(emblem({ title: 'TRIAD emblem' }), 150, 150, 900), '#ff5a00', '#0a0a0a'),
    'emblem-white.svg': wrap(place(emblem({ title: 'TRIAD emblem' }), 150, 150, 900), '#fbfaf8', '#0a0a0a'),
    'emblem-mark.svg': wrap(place(emblem({ ring: false }), 150, 150, 900), '#fbfaf8', '#ff5a00'),
    'glyph-pattern.svg': wrap(pattern.join('\n'), '#ff5a00', '#0a0a0a'),
    'stamp-archive.svg': wrap(place(stamp({ top: 'TRIAD ARCHIVE', bottom: 'PROPERTY OF THE COLLECTIVE', center: '003' }), 200, 200, 800), '#fbfaf8', '#ff5a00'),
    'stamp-approved.svg': wrap(place(stamp({ top: 'OUTSIDE THE SYSTEM', bottom: 'APPROVED · NOT FOR SALE', center: 'III' }), 200, 200, 800), '#0a0a0a', '#c9c9c9'),
    'wordmark-stacked.svg': wrap(wordStack, '#fbfaf8', '#0a0a0a'),
  };
}

/* ──────────────────────────────────────────────────────────────────────
   SYMBOL LIBRARY — triangle, triad (Dreiklang), pyramid.
   All drawn from scratch as geometry; public-domain shapes, TRIAD styling.
   Every symbol: 100×100 viewBox, currentColor + var(--red) accent.
   ────────────────────────────────────────────────────────────────────── */
const svg = (inner, cls = '', label = '') =>
  `<svg class="sym ${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} fill="none" stroke="currentColor" stroke-linejoin="miter">${inner}</svg>`;
const ACC = 'var(--red, #ff5a00)';

/** Borromean rings: three rings bound together, no two linked on their own. */
function borromean({ sw = 5 } = {}) {
  const r = 22, R = 14, cx = 50, cy = 53;
  const c = [0, 1, 2].map((i) => {
    const a = ((-90 + i * 120) * Math.PI) / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
  const inter = (p, q) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const a = d / 2, h = Math.sqrt(r * r - a * a);
    const m = [p[0] + ((q[0] - p[0]) * a) / d, p[1] + ((q[1] - p[1]) * a) / d];
    const ox = (-(q[1] - p[1]) * h) / d, oy = ((q[0] - p[0]) * h) / d;
    return [[m[0] + ox, m[1] + oy], [m[0] - ox, m[1] - oy]];
  };
  const ring = (i, color) =>
    `<circle cx="${f(c[i][0])}" cy="${f(c[i][1])}" r="${r}" stroke="var(--bg, #fbfaf8)" stroke-width="${sw + 4}"/><circle cx="${f(c[i][0])}" cy="${f(c[i][1])}" r="${r}" stroke="${color}" stroke-width="${sw}"/>`;
  const id = `bor${++uid}`;
  const clip = (pts) => pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${sw + 3}"/>`).join('');
  // draw order A,B,C then fix the cyclic crossings: B over C, A over B
  return `<defs><clipPath id="${id}bc">${clip(inter(c[1], c[2]))}</clipPath><clipPath id="${id}ab">${clip(inter(c[0], c[1]))}</clipPath></defs>
${ring(0, 'currentColor')}${ring(1, 'currentColor')}${ring(2, ACC)}
<g clip-path="url(#${id}bc)">${ring(1, 'currentColor')}</g>
<g clip-path="url(#${id}ab)">${ring(0, 'currentColor')}</g>`;
}

/** Alchemical element triangles. */
function element(kind) {
  const up = 'M50 14 L88 80 L12 80 Z', down = 'M50 86 L12 20 L88 20 Z';
  const map = {
    fire: `<path d="${up}" stroke-width="5"/>`,
    air: `<path d="${up}" stroke-width="5"/><path d="M22 58 H78" stroke="${ACC}" stroke-width="5"/>`,
    water: `<path d="${down}" stroke-width="5"/>`,
    earth: `<path d="${down}" stroke-width="5"/><path d="M22 42 H78" stroke="${ACC}" stroke-width="5"/>`,
  };
  return map[kind];
}

/** Sierpinski triangle: triangles inside triangles — the archive pattern. */
function sierpinski(depth = 3) {
  const out = [];
  const go = (a, b, c, d) => {
    if (d === 0) { out.push(`${pt(a)} ${pt(b)} ${pt(c)}`); return; }
    const ab = mul(add(a, b), 0.5), bc = mul(add(b, c), 0.5), ca = mul(add(c, a), 0.5);
    go(a, ab, ca, d - 1); go(ab, b, bc, d - 1); go(ca, bc, c, d - 1);
  };
  go([50, 10], [94, 86], [6, 86], depth);
  return out.map((p, i) => `<polygon points="${p}" fill="${i === 0 ? ACC : 'currentColor'}" stroke="none"/>`).join('');
}

/** Tonnetz: in the tone lattice every triangle is a triad (Dreiklang). C–E–G highlighted. */
function tonnetz() {
  const s = 31, h = s * 0.866, ox = 42, oy = 52;
  const P = (x, y) => [ox + x * s, oy - y * h];
  const nodes = { C: [0, 0], G: [1, 0], F: [-1, 0], E: [0.5, 1], A: [-0.5, 1], B: [1.5, 1], Ab: [-0.5, -1], Eb: [0.5, -1] };
  const tri = (a, b, c, fill) => `<polygon points="${[a, b, c].map((k) => pt(P(...nodes[k]))).join(' ')}" fill="${fill}" stroke="currentColor" stroke-width="1.4"/>`;
  return `${tri('F', 'C', 'A', 'none')}${tri('C', 'G', 'E', ACC)}${tri('G', 'B', 'E', 'none')}${tri('A', 'C', 'E', 'none')}${tri('C', 'Eb', 'G', 'none')}${tri('C', 'Ab', 'Eb', 'none')}
${Object.entries(nodes)
  .map(([k, v]) => { const [x, y] = P(...v); return `<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="var(--bg, #fbfaf8)" stroke="currentColor" stroke-width="1.3"/><text x="${f(x)}" y="${f(y + 2.4)}" font-family="'JetBrains Mono', monospace" font-size="${k.length > 1 ? 5.6 : 7}" text-anchor="middle" fill="currentColor" stroke="none">${k.replace('b', '♭')}</text>`; })
  .join('')}`;
}

/** Dreiklang on a staff: C–E–G stacked in thirds (root, third, fifth). */
function chord() {
  const lines = [30, 40, 50, 60, 70].map((y) => `<path d="M8 ${y} H92" stroke-width="1.6"/>`).join('');
  const note = (y, fill) => `<ellipse cx="50" cy="${y}" rx="6.6" ry="4.3" transform="rotate(-22 50 ${y})" fill="${fill}" stroke="currentColor" stroke-width="2.4"/>`;
  return `${lines}<path d="M36 80 H64" stroke-width="1.6"/>${note(80, ACC)}${note(70, 'none')}${note(60, 'none')}
<text x="72" y="83" font-family="'JetBrains Mono', monospace" font-size="8" fill="currentColor" stroke="none">R</text>
<text x="72" y="73" font-family="'JetBrains Mono', monospace" font-size="8" fill="currentColor" stroke="none">3</text>
<text x="72" y="63" font-family="'JetBrains Mono', monospace" font-size="8" fill="currentColor" stroke="none">5</text>`;
}

/** Pyramid: elevation (stepped, three tiers) above, plan view below. */
function pyramid() {
  // elevation: one triangle cut into three tiers, apex in orange; plan view below
  const A = [50, 6], L = [12, 66], R = [88, 66];
  const at = (t) => [mul(add(mul(A, 1 - t), mul(L, t)), 1), mul(add(mul(A, 1 - t), mul(R, t)), 1)];
  const [l1, r1] = at(1 / 3), [l2, r2] = at(2 / 3);
  return `<polygon points="${pt(A)} ${pt(r1)} ${pt(l1)}" fill="${ACC}" stroke="none"/>
<polygon points="${pt(A)} ${pt(R)} ${pt(L)}" stroke-width="3.4"/>
<path d="M${pt(l1)} H${f(r1[0])} M${pt(l2)} H${f(r2[0])}" stroke-width="2.4"/>
<rect x="36" y="74" width="28" height="20" stroke-width="2"/><path d="M36 74 L64 94 M64 74 L36 94" stroke-width="1.2"/>`;
}

/** Delta Δ — change; three plus marks at the corners. */
function delta() {
  const plus = (x, y) => `<path d="M${x - 7} ${y} H${x + 7} M${x} ${y - 7} V${y + 7}" stroke="${ACC}" stroke-width="4"/>`;
  return `<path d="M50 18 L84 78 L16 78 Z" stroke-width="9"/>${plus(50, 18)}${plus(84, 78)}${plus(16, 78)}`;
}

export const SYMBOLS = {
  borromean: { name: 'Borromean Rings', de: 'Borromäische Ringe', meaning: 'Three rings held together — remove one and the other two fall apart. No force stands alone.', draw: borromean },
  fire: { name: 'Fire △', de: 'Feuer', meaning: 'Alchemical fire. Upward energy. Used for IMAGE.', draw: () => element('fire') },
  air: { name: 'Air', de: 'Luft', meaning: 'Alchemical air. Breath, sound, signal. Used for SIGNAL.', draw: () => element('air') },
  earth: { name: 'Earth', de: 'Erde', meaning: 'Alchemical earth. Matter, cloth, the body. Used for FORM.', draw: () => element('earth') },
  water: { name: 'Water ▽', de: 'Wasser', meaning: 'Alchemical water. The inverted triangle — reserved for night editions.', draw: () => element('water') },
  sierpinski: { name: 'Sierpiński Triangle', de: 'Sierpiński-Dreieck', meaning: 'Triangles inside triangles, endlessly. The archive: every piece contains the whole.', draw: () => sierpinski(3) },
  tonnetz: { name: 'Tonnetz', de: 'Tonnetz', meaning: 'In the tone lattice every triangle is a triad. C–E–G, lit orange: the Dreiklang.', draw: tonnetz },
  chord: { name: 'Dreiklang', de: 'Dreiklang', meaning: 'Root, third, fifth. Three notes stacked in thirds — the smallest harmony.', draw: chord },
  pyramid: { name: 'Pyramid', de: 'Pyramide', meaning: 'Three tiers, seen from the side and from above. Structure built to outlast its makers.', draw: pyramid },
  delta: { name: 'Delta + + +', de: 'Delta', meaning: 'Δ means change. Three plus marks: three forces added together.', draw: delta },
};

export function symbol(key, { cls = '', label = '' } = {}) {
  const s = SYMBOLS[key];
  return s ? svg(s.draw(), `sym--${key} ${cls}`, label) : '';
}

export function symbolFiles() {
  const out = {};
  for (const key of Object.keys(SYMBOLS)) {
    const inner = symbol(key).replace('<svg ', '<svg x="200" y="200" width="800" height="800" ');
    out[`symbol-${key}.svg`] = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200" style="color:#0a0a0a;--red:#ff5a00;--bg:#fbfaf8"><rect width="100%" height="100%" fill="#fbfaf8"/>${inner}</svg>`;
  }
  return out;
}
