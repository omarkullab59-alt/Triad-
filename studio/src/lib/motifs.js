// Motif library: ready-made shapes to engrave, emboss, cut out or build on.
// Every motif draws in black on a transparent square canvas.
const TAU = Math.PI * 2;

/** Body along a centre line: f(t) → [x, y], width w(t). Draws a filled tapered tube. */
function body(c, f, w, n = 160) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = f(t);
    const [x2, y2] = f(Math.min(1, t + 1 / n)), [x0, y0] = f(Math.max(0, t - 1 / n));
    let dx = x2 - x0, dy = y2 - y0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const r = w(t) / 2;
    L.push([x - dy * r, y + dx * r]); R.push([x + dy * r, y - dx * r]);
  }
  c.beginPath();
  L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
  c.closePath(); c.fill();
  return { L, R };
}
const frame = (f, t, n = 400) => { const [x, y] = f(t); const [x2, y2] = f(Math.min(1, t + 1 / n)); const [x0, y0] = f(Math.max(0, t - 1 / n)); const a = Math.atan2(y2 - y0, x2 - x0); return { x, y, a }; };
const cut = (c, fn) => { c.save(); c.globalCompositeOperation = 'destination-out'; fn(); c.restore(); };

/** Snake head at the end of a body, facing angle a. */
function snakeHead(c, x, y, a, s, { tongue = true, horns = false } = {}) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.moveTo(-s * 0.2, -s * 0.42); c.quadraticCurveTo(s * 0.55, -s * 0.55, s * 0.95, -s * 0.12);
  c.quadraticCurveTo(s * 1.05, 0, s * 0.95, s * 0.12); c.quadraticCurveTo(s * 0.55, s * 0.55, -s * 0.2, s * 0.42); c.closePath(); c.fill();
  if (horns) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.1, k * s * 0.35); c.lineTo(-s * 0.75, k * s * 0.95); c.lineTo(s * 0.35, k * s * 0.3); c.fill(); }
  if (tongue) { c.lineWidth = s * 0.09; c.lineCap = 'round'; c.beginPath(); c.moveTo(s * 0.95, 0); c.lineTo(s * 1.4, 0); c.lineTo(s * 1.65, -s * 0.18); c.moveTo(s * 1.4, 0); c.lineTo(s * 1.65, s * 0.18); c.strokeStyle = '#000'; c.stroke(); }
  cut(c, () => { c.beginPath(); c.ellipse(s * 0.45, -s * 0.2, s * 0.11, s * 0.07, 0.3, 0, TAU); c.ellipse(s * 0.45, s * 0.2, s * 0.11, s * 0.07, -0.3, 0, TAU); c.fill(); });
  c.restore();
}
function scales(c, f, w, from = 0.08, to = 0.95, step = 0.025) {
  cut(c, () => {
    for (let t = from; t < to; t += step) {
      const { x, y, a } = frame(f, t);
      const r = w(t) * 0.26;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(-r * 0.6, -r); c.lineTo(r * 0.5, 0); c.lineTo(-r * 0.6, r); c.lineWidth = Math.max(1, w(t) * 0.07); c.strokeStyle = '#000'; c.stroke();
      c.restore();
    }
  });
}

/** The TRIAD emblem: three serpent-dragons around a triangle (same drawing as the TRIAD site). */
function triadDragons() {
  const C = 100;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k], pt = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const vertex = (i, r) => { const a = ((-90 + i * 120) * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const r = 57, head = vertex(0, r), tail = vertex(2, r);
  const d = [head[0] - tail[0], head[1] - tail[1]], len = Math.hypot(...d);
  const u = [d[0] / len, d[1] / len], v = [u[1], -u[0]];
  const L = (a, b) => add(add(head, mul(u, a)), mul(v, b));
  const neck = L(-11, 0);
  const c1 = add(add(tail, mul(u, len * 0.38)), mul(v, 20)), c2 = add(add(tail, mul(u, len * 0.72)), mul(v, -9));
  const lines = [-4.2, 0, 4.2].map((o, k) => `<path d="M${pt(add(tail, mul(v, o * 0.25)))} C${pt(add(c1, mul(v, o)))} ${pt(add(c2, mul(v, o)))} ${pt(add(neck, mul(v, o * 0.85)))}" stroke-width="${k === 1 ? 4.2 : 2.6}"/>`).join('');
  const P = (arr) => arr.map(([a, b]) => pt(L(a, b))).join(' ');
  const s = `<g fill="none" stroke="#000" stroke-linecap="round">${lines}</g>
<polygon points="${P([[-11, 6.5], [-24, 12], [-14, 4]])}"/><polygon points="${P([[-5, 8], [-22, 21], [-10, 6]])}"/>
<polygon points="${P([[-13, 5.5], [-4, 9], [7, 6.5], [17, 2.4], [19, 0], [9, -1.2], [16, -4.6], [3, -7.5], [-13, -5.5]])}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 180 180"><g fill="#000">${s}<g transform="rotate(120 100 100)">${s}</g><g transform="rotate(240 100 100)">${s}</g>
<circle cx="100" cy="93" r="2.6"/><circle cx="106.06" cy="103.5" r="2.6"/><circle cx="93.94" cy="103.5" r="2.6"/></g></svg>`;
}
const svgCache = new Map();
function svgImage(svg) {
  if (svgCache.has(svg)) return svgCache.get(svg);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; });
  svgCache.set(svg, p);
  return p;
}

export const MOTIFS = {
  snake: { label: 'Snake', draw(c, S) {
    const f = (t) => [S * (0.1 + 0.72 * t), S * (0.5 + 0.22 * Math.sin(TAU * 1.15 * t + 0.6))];
    const w = (t) => S * (0.012 + 0.075 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.55));
    body(c, f, w); scales(c, f, w);
    const e = frame(f, 1); snakeHead(c, e.x, e.y, e.a, S * 0.075);
  } },
  coil: { label: 'Coiled snake', draw(c, S) {
    const f = (t) => { const a = t * TAU * 2.6; const r = S * (0.06 + 0.3 * t); return [S / 2 + r * Math.cos(a), S / 2 + r * Math.sin(a)]; };
    const w = (t) => S * (0.02 + 0.07 * t);
    body(c, f, w); scales(c, f, w, 0.15, 0.97, 0.018);
    const e = frame(f, 1); snakeHead(c, e.x, e.y, e.a, S * 0.08);
  } },
  ouroboros: { label: 'Ouroboros', draw(c, S) {
    const f = (t) => { const a = -Math.PI / 2 + t * TAU * 0.94; return [S / 2 + S * 0.36 * Math.cos(a), S / 2 + S * 0.36 * Math.sin(a)]; };
    const w = (t) => S * (0.03 + 0.07 * Math.min(1, t * 2.5));
    body(c, f, w); scales(c, f, w, 0.05, 0.95, 0.02);
    const e = frame(f, 1); snakeHead(c, e.x, e.y, e.a, S * 0.085, { tongue: false });
  } },
  cobra: { label: 'Rising cobra', draw(c, S) {
    const f = (t) => (t < 0.55 ? (() => { const a = t / 0.55 * TAU * 1.5; const r = S * 0.28 * (1 - t * 0.6); return [S / 2 + r * Math.cos(a), S * 0.78 + r * 0.35 * Math.sin(a)]; })() : [S / 2 + S * 0.05 * Math.sin((t - 0.55) * 9), S * (0.78 - (t - 0.55) * 1.35)]);
    const w = (t) => S * (0.03 + 0.05 * Math.min(1, t * 2)) * (t > 0.8 ? 1 + (t - 0.8) * 4 : 1);
    body(c, f, w); scales(c, f, w, 0.1, 0.8, 0.02);
    const e = frame(f, 1); snakeHead(c, e.x, e.y, e.a, S * 0.08);
  } },
  dragon: { label: 'Dragon', draw(c, S) {
    const f = (t) => [S * (0.12 + 0.76 * t), S * (0.52 + 0.2 * Math.sin(TAU * 1.4 * t + 2.2) * (0.4 + 0.6 * t))];
    const w = (t) => S * (0.015 + 0.07 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.6));
    body(c, f, w);
    // dorsal spikes
    for (let t = 0.06; t < 0.92; t += 0.045) {
      const { x, y, a } = frame(f, t); const r = w(t) / 2, h = S * 0.035 + r * 0.7;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(-h * 0.45, -r * 0.8); c.lineTo(h * 0.25, -r - h); c.lineTo(h * 0.45, -r * 0.8); c.fill(); c.restore();
    }
    // legs with three claws
    for (const t of [0.35, 0.68]) {
      const { x, y, a } = frame(f, t); const r = w(t) / 2, s = S * 0.06;
      c.save(); c.translate(x, y); c.rotate(a);
      c.lineWidth = s * 0.45; c.lineCap = 'round'; c.strokeStyle = '#000';
      c.beginPath(); c.moveTo(0, r * 0.5); c.lineTo(-s * 0.4, r + s); c.lineTo(s * 0.3, r + s * 1.5); c.stroke();
      c.lineWidth = s * 0.18;
      for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(s * 0.3, r + s * 1.5); c.lineTo(s * (0.75 + 0.1 * k), r + s * (1.6 + 0.35 * k)); c.stroke(); }
      c.restore();
    }
    scales(c, f, w, 0.1, 0.9, 0.03);
    const e = frame(f, 1); snakeHead(c, e.x, e.y, e.a, S * 0.09, { horns: true });
    // whiskers
    c.save(); c.translate(e.x, e.y); c.rotate(e.a); c.lineWidth = S * 0.01; c.strokeStyle = '#000';
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(S * 0.07, k * S * 0.03); c.bezierCurveTo(S * 0.12, k * S * 0.15, S * 0.02, k * S * 0.2, S * 0.08, k * S * 0.27); c.stroke(); }
    c.restore();
  } },
  triad: { label: 'TRIAD dragons', svg: triadDragons },
  skull: { label: 'Skull', draw(c, S) {
    c.beginPath(); c.ellipse(S / 2, S * 0.42, S * 0.3, S * 0.3, 0, 0, TAU); c.fill();
    c.beginPath(); c.roundRect(S * 0.32, S * 0.55, S * 0.36, S * 0.28, S * 0.06); c.fill();
    cut(c, () => {
      c.beginPath(); c.ellipse(S * 0.39, S * 0.47, S * 0.075, S * 0.085, 0.2, 0, TAU); c.ellipse(S * 0.61, S * 0.47, S * 0.075, S * 0.085, -0.2, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(S / 2, S * 0.56); c.lineTo(S * 0.465, S * 0.64); c.lineTo(S * 0.535, S * 0.64); c.fill();
      c.lineWidth = S * 0.012; c.strokeStyle = '#000';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(S * (0.38 + i * 0.048), S * 0.715); c.lineTo(S * (0.38 + i * 0.048), S * 0.78); c.stroke(); }
      c.beginPath(); c.moveTo(S * 0.37, S * 0.715); c.lineTo(S * 0.63, S * 0.715); c.stroke();
    });
  } },
  rose: { label: 'Rose', draw(c, S) {
    c.lineCap = 'round'; c.strokeStyle = '#000';
    c.lineWidth = S * 0.03; c.beginPath(); c.moveTo(S / 2, S * 0.5); c.bezierCurveTo(S * 0.52, S * 0.7, S * 0.45, S * 0.8, S * 0.5, S * 0.96); c.stroke();
    for (const [x, y, a] of [[0.4, 0.74, -0.6], [0.6, 0.82, 0.6]]) { c.beginPath(); c.ellipse(S * x, S * y, S * 0.08, S * 0.035, a, 0, TAU); c.fill(); }
    c.beginPath(); c.arc(S / 2, S * 0.36, S * 0.22, 0, TAU); c.fill();
    cut(c, () => {
      c.lineWidth = S * 0.018;
      c.beginPath(); for (let i = 0; i <= 200; i++) { const t = i / 200, a = t * TAU * 2.6, r = S * (0.02 + 0.17 * t); c.lineTo(S / 2 + r * Math.cos(a), S * 0.36 + r * Math.sin(a)); } c.stroke();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; c.beginPath(); c.arc(S / 2 + S * 0.15 * Math.cos(a), S * 0.36 + S * 0.15 * Math.sin(a), S * 0.09, a + 1.2, a + 3.6); c.stroke(); }
    });
  } },
  flame: { label: 'Flames', draw(c, S) {
    const tongue = (x, h, w) => { c.beginPath(); c.moveTo(x - w, S * 0.92); c.bezierCurveTo(x - w * 1.3, S * 0.92 - h * 0.5, x - w * 0.1, S * 0.92 - h * 0.6, x + w * 0.2, S * 0.92 - h); c.bezierCurveTo(x + w * 0.1, S * 0.92 - h * 0.55, x + w * 1.4, S * 0.92 - h * 0.45, x + w, S * 0.92); c.closePath(); c.fill(); };
    tongue(S * 0.5, S * 0.84, S * 0.2); tongue(S * 0.28, S * 0.55, S * 0.14); tongue(S * 0.72, S * 0.62, S * 0.14);
    cut(c, () => { c.beginPath(); c.moveTo(S * 0.44, S * 0.92); c.bezierCurveTo(S * 0.38, S * 0.75, S * 0.5, S * 0.68, S * 0.52, S * 0.5); c.bezierCurveTo(S * 0.56, S * 0.68, S * 0.66, S * 0.78, S * 0.56, S * 0.92); c.fill(); });
  } },
  lightning: { label: 'Lightning', draw(c, S) {
    c.beginPath(); [[0.58, 0.04], [0.26, 0.52], [0.47, 0.52], [0.36, 0.96], [0.76, 0.4], [0.54, 0.4], [0.7, 0.04]].forEach(([x, y], i) => (i ? c.lineTo(S * x, S * y) : c.moveTo(S * x, S * y))); c.closePath(); c.fill();
  } },
  thorns: { label: 'Thorn vine', draw(c, S) {
    const f = (t) => [S * (0.02 + 0.96 * t), S * (0.5 + 0.12 * Math.sin(TAU * 2 * t))];
    body(c, f, () => S * 0.035);
    for (let t = 0.04; t < 0.98; t += 0.07) {
      const { x, y, a } = frame(f, t); const k = Math.round(t * 100) % 2 ? 1 : -1;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(-S * 0.025, 0); c.lineTo(S * 0.03, k * S * 0.09); c.lineTo(S * 0.025, 0); c.fill(); c.restore();
    }
  } },
  barbed: { label: 'Barbed wire', draw(c, S) {
    c.strokeStyle = '#000'; c.lineWidth = S * 0.018;
    for (const ph of [0, Math.PI]) { c.beginPath(); for (let i = 0; i <= 200; i++) { const t = i / 200; c.lineTo(S * t, S * 0.5 + S * 0.025 * Math.sin(t * TAU * 8 + ph)); } c.stroke(); }
    c.lineWidth = S * 0.014;
    for (let x = 0.1; x < 1; x += 0.2) { c.beginPath(); c.moveTo(S * (x - 0.04), S * 0.42); c.lineTo(S * (x + 0.04), S * 0.58); c.moveTo(S * (x + 0.04), S * 0.42); c.lineTo(S * (x - 0.04), S * 0.58); c.stroke(); }
  } },
  wings: { label: 'Wings', draw(c, S) {
    for (const k of [-1, 1]) {
      c.save(); c.translate(S / 2 + k * S * 0.04, S * 0.45); c.scale(k, 1);
      for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.27, l = S * (0.42 - i * 0.035); c.save(); c.rotate(a); c.beginPath(); c.ellipse(l / 2, 0, l / 2, S * 0.035, 0, 0, TAU); c.fill(); c.restore(); }
      c.restore();
    }
    c.beginPath(); c.ellipse(S / 2, S * 0.5, S * 0.05, S * 0.12, 0, 0, TAU); c.fill();
  } },
  eye: { label: 'Eye', draw(c, S) {
    c.beginPath(); c.moveTo(S * 0.06, S / 2); c.quadraticCurveTo(S / 2, S * 0.08, S * 0.94, S / 2); c.quadraticCurveTo(S / 2, S * 0.92, S * 0.06, S / 2); c.fill();
    cut(c, () => { c.beginPath(); c.moveTo(S * 0.14, S / 2); c.quadraticCurveTo(S / 2, S * 0.2, S * 0.86, S / 2); c.quadraticCurveTo(S / 2, S * 0.8, S * 0.14, S / 2); c.fill(); });
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.17, 0, TAU); c.fill();
    cut(c, () => { c.beginPath(); c.arc(S * 0.55, S * 0.45, S * 0.045, 0, TAU); c.fill(); });
  } },
  moon: { label: 'Moon & star', draw(c, S) {
    c.beginPath(); c.arc(S * 0.45, S / 2, S * 0.36, 0, TAU); c.fill();
    cut(c, () => { c.beginPath(); c.arc(S * 0.6, S * 0.44, S * 0.31, 0, TAU); c.fill(); });
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? S * 0.035 : S * 0.11; c.lineTo(S * 0.72 + r * Math.cos(a), S * 0.42 + r * Math.sin(a)); } c.fill();
  } },
  sun: { label: 'Sun', draw(c, S) {
    c.beginPath(); c.arc(S / 2, S / 2, S * 0.2, 0, TAU); c.fill();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.save(); c.translate(S / 2, S / 2); c.rotate(a); c.beginPath(); c.moveTo(S * 0.24, -S * 0.04); c.lineTo(S * (i % 2 ? 0.4 : 0.47), 0); c.lineTo(S * 0.24, S * 0.04); c.fill(); c.restore(); }
  } },
  cross: { label: 'Gothic cross', draw(c, S) {
    const arm = (a) => { c.save(); c.translate(S / 2, S * 0.42); c.rotate(a); c.beginPath(); c.moveTo(-S * 0.05, 0); c.lineTo(-S * 0.05, -S * 0.28); c.lineTo(-S * 0.11, -S * 0.36); c.lineTo(0, -S * 0.33); c.lineTo(S * 0.11, -S * 0.36); c.lineTo(S * 0.05, -S * 0.28); c.lineTo(S * 0.05, 0); c.fill(); c.restore(); };
    arm(0); arm(Math.PI / 2); arm(-Math.PI / 2);
    c.save(); c.translate(S / 2, S * 0.42); c.scale(1, 1.55); c.rotate(Math.PI); c.beginPath(); c.moveTo(-S * 0.05, 0); c.lineTo(-S * 0.05, -S * 0.28); c.lineTo(-S * 0.11, -S * 0.36); c.lineTo(0, -S * 0.33); c.lineTo(S * 0.11, -S * 0.36); c.lineTo(S * 0.05, -S * 0.28); c.lineTo(S * 0.05, 0); c.fill(); c.restore();
  } },
  glyph: { label: 'TRIAD glyph', draw(c, S) {
    c.lineWidth = S * 0.075; c.lineCap = 'square'; c.strokeStyle = '#000';
    for (const [x, y] of [[0.5, 0.2], [0.82, 0.76], [0.18, 0.76]]) { c.beginPath(); c.moveTo(S * (x - 0.13), S * y); c.lineTo(S * (x + 0.13), S * y); c.moveTo(S * x, S * (y - 0.13)); c.lineTo(S * x, S * (y + 0.13)); c.stroke(); }
    c.lineWidth = S * 0.02; c.setLineDash([S * 0.03, S * 0.03]); c.beginPath(); c.moveTo(S * 0.5, S * 0.2); c.lineTo(S * 0.82, S * 0.76); c.lineTo(S * 0.18, S * 0.76); c.closePath(); c.stroke();
  } },
  fire: { label: 'Fire △', draw(c, S) { c.lineWidth = S * 0.07; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(S / 2, S * 0.12); c.lineTo(S * 0.9, S * 0.82); c.lineTo(S * 0.1, S * 0.82); c.closePath(); c.stroke(); } },
  earth: { label: 'Earth ▽', draw(c, S) { c.lineWidth = S * 0.07; c.strokeStyle = '#000'; c.beginPath(); c.moveTo(S / 2, S * 0.88); c.lineTo(S * 0.1, S * 0.18); c.lineTo(S * 0.9, S * 0.18); c.closePath(); c.moveTo(S * 0.2, S * 0.42); c.lineTo(S * 0.8, S * 0.42); c.stroke(); } },
  sierpinski: { label: 'Sierpiński', draw(c, S) {
    const go = (a, b, d0, d) => { if (!d) { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d0); c.fill(); return; } const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; go(a, m(a, b), m(a, d0), d - 1); go(m(a, b), b, m(b, d0), d - 1); go(m(a, d0), m(b, d0), d0, d - 1); };
    go([S / 2, S * 0.08], [S * 0.95, S * 0.86], [S * 0.05, S * 0.86], 3);
  } },
  rings: { label: 'Three rings', draw(c, S) {
    c.lineWidth = S * 0.06; c.strokeStyle = '#000';
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; c.beginPath(); c.arc(S / 2 + S * 0.15 * Math.cos(a), S / 2 + S * 0.15 * Math.sin(a), S * 0.23, 0, TAU); c.stroke(); }
  } },
};
export const motifOptions = () => Object.entries(MOTIFS).map(([k, m]) => [k, m.label]);

/** Crop a canvas to its visible (non-transparent) part. */
export function trimCanvas(src, pad = 0) {
  const { width: w, height: h } = src;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return src;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Motif as black shape on a transparent square canvas. */
export async function renderMotif(id, size = 600) {
  const m = MOTIFS[id] || MOTIFS.snake;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = x.strokeStyle = '#000';
  if (m.svg) { const img = await svgImage(m.svg()); if (img) x.drawImage(img, 0, 0, size, size); }
  else m.draw(x, size);
  return c;
}
/** Motif as black on white pixels (for the outline pipeline). */
export async function motifPixels(id, size = 400) {
  const c = await renderMotif(id, size);
  const o = document.createElement('canvas'); o.width = o.height = size;
  const x = o.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.drawImage(c, 0, 0);
  return x.getImageData(0, 0, size, size);
}
