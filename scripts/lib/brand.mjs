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
