// Picture → outline. Works on plain pixel data so it also runs in tests (no DOM needed).
//
//   mask = toMask(pixels, { threshold, invert, bold })   dark ink on light paper = shape
//   loops = traceMask(mask)                              marching squares → closed loops (pixel units)
//   shapes = groupShapes(loops, { fillHoles })            outer outlines with their holes
//   thin = thinParts(mask, radiusPx)                     share of the shape thinner than 2 × radius

/** pixels: { data: RGBA Uint8ClampedArray, width, height } */
export function toMask({ data, width, height }, { threshold = 128, invert = false, bold = 0 } = {}) {
  const pad = 2 + bold;
  const w = width + pad * 2, h = height + pad * 2;
  let mask = new Uint8Array(w * h);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255;
      // transparent pixels count as white paper
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
      const ink = lum < threshold;
      mask[(y + pad) * w + x + pad] = ink !== invert ? 1 : 0;
    }
  }
  mask = despeckle(mask, w, h);
  if (bold > 0) mask = dilate(mask, w, h, bold);
  return { mask: dropSmall(mask, w, h), width: w, height: h };
}

/** Remove single stray pixels (3×3 majority on isolated points). */
function despeckle(m, w, h) {
  const out = m.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += m[(y + dy) * w + x + dx];
      const i = y * w + x;
      if (m[i] && n <= 1) out[i] = 0;
      else if (!m[i] && n >= 7) out[i] = 1;
    }
  }
  return out;
}

/** Squared-distance transform (two-pass chamfer, 3-4 metric / 3 ≈ pixels). Distance from each pixel to the nearest 0 pixel. */
export function distance(m, w, h, target = 0) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = m[i] === target ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

function dilate(m, w, h, r) {
  const d = distance(m, w, h, 1);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i] <= r ? 1 : 0;
  return out;
}

/** Keep connected parts that are at least 3 % of the biggest one (removes dust and paper texture). */
function dropSmall(m, w, h) {
  const label = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]) continue;
    const id = sizes.length;
    let n = 0;
    stack.push(i); label[i] = id;
    while (stack.length) {
      const j = stack.pop(); n++;
      const x = j % w, y = (j - x) / w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) {
        if (k >= 0 && m[k] && !label[k]) { label[k] = id; stack.push(k); }
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(0, ...sizes);
  const keep = sizes.map((s) => s >= Math.max(4, biggest * 0.03));
  const out = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) out[i] = m[i] && keep[label[i]] ? 1 : 0;
  return out;
}

/** Marching squares. Returns closed loops in pixel coordinates (y down), shape always on the right-hand side. */
export function traceMask({ mask, width: w, height: h }) {
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const W2 = 2 * w + 3;
  const key = (p) => (p[1] * 2 + 2) * W2 + (p[0] * 2 + 2);
  const next = new Map();
  const pts = new Map();
  const add = (a, b, ref, refFilled) => {
    // orient so filled area is on the right (screen coordinates: cross > 0 ⇒ right)
    const cross = (b[0] - a[0]) * (ref[1] - a[1]) - (b[1] - a[1]) * (ref[0] - a[0]);
    if ((cross > 0) !== refFilled) [a, b] = [b, a];
    const ka = key(a), kb = key(b);
    next.set(ka, kb); pts.set(ka, a); pts.set(kb, b);
  };
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const tl = v(x, y), tr = v(x + 1, y), br = v(x + 1, y + 1), bl = v(x, y + 1);
      const c = tl * 8 + tr * 4 + br * 2 + bl;
      if (c === 0 || c === 15) continue;
      const T = [x + 0.5, y], R = [x + 1, y + 0.5], B = [x + 0.5, y + 1], L = [x, y + 0.5];
      const TL = [x, y], TR = [x + 1, y], BR = [x + 1, y + 1], BL = [x, y + 1];
      if (c === 10) { add(T, R, TR, false); add(L, B, BL, false); continue; } // saddle: filled diagonal connected
      if (c === 5) { add(L, T, TL, false); add(R, B, BR, false); continue; }
      const crossings = [];
      if (tl !== tr) crossings.push(T);
      if (tr !== br) crossings.push(R);
      if (br !== bl) crossings.push(B);
      if (bl !== tl) crossings.push(L);
      const filled = [[tl, TL], [tr, TR], [br, BR], [bl, BL]].filter(([on]) => on).map(([, p]) => p);
      const ref = [filled.reduce((s, p) => s + p[0], 0) / filled.length, filled.reduce((s, p) => s + p[1], 0) / filled.length];
      add(crossings[0], crossings[1], ref, true);
    }
  }
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let k = start;
    while (k !== undefined && !seen.has(k)) { seen.add(k); loop.push(pts.get(k)); k = next.get(k); }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

/** Signed area; positive = shape on the right in y-down coordinates = counter-clockwise once y is flipped. */
export function area(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function inside(pt, loop) {
  let c = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Ramer–Douglas–Peucker on a closed loop. */
export function simplify(loop, eps = 0.7) {
  if (loop.length < 8) return loop;
  // split at the point farthest from loop[0]
  let far = 0, fd = -1;
  for (let i = 1; i < loop.length; i++) { const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const rdp = (pts) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let idx = 0, best = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > best) { best = d; idx = i; }
    }
    if (best <= eps) return [a, b];
    const l = rdp(pts.slice(0, idx + 1)), r = rdp(pts.slice(idx));
    return l.slice(0, -1).concat(r);
  };
  const first = rdp(loop.slice(0, far + 1));
  const second = rdp(loop.slice(far).concat([loop[0]]));
  return first.slice(0, -1).concat(second.slice(0, -1));
}

/** Chaikin corner cutting: turns pixel stairs into smooth curves. */
export function smooth(loop, rounds = 2) {
  let pts = loop;
  for (let r = 0; r < rounds; r++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    pts = out;
  }
  return pts;
}

/** Group loops into { outer, holes[] }. */
export function groupShapes(loops, { fillHoles = false } = {}) {
  const outers = loops.filter((l) => area(l) > 0).map((outer) => ({ outer, holes: [], a: area(outer) }));
  if (!fillHoles) {
    for (const hole of loops.filter((l) => area(l) < 0)) {
      const owner = outers.filter((o) => inside(hole[0], o.outer)).sort((x, y) => x.a - y.a)[0];
      if (owner) owner.holes.push(hole);
    }
  } else {
    // drop outlines that sit inside another outline (they become part of the solid)
    return outers.filter((o) => !outers.some((p) => p !== o && p.a > o.a && inside(o.outer[0], p.outer))).map(({ outer }) => ({ outer, holes: [] }));
  }
  return outers.map(({ outer, holes }) => ({ outer, holes }));
}

/** Share (0..1) of the shape that disappears when opened with radius r: parts thinner than 2r. */
export function thinParts({ mask, width: w, height: h }, r) {
  if (r <= 0.5) return 0;
  const toEdge = distance(mask, w, h, 0);
  const core = new Uint8Array(w * h);
  let total = 0;
  for (let i = 0; i < mask.length; i++) { total += mask[i]; core[i] = toEdge[i] > r ? 1 : 0; }
  if (!total) return 0;
  const toCore = distance(core, w, h, 1);
  let lost = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] && toCore[i] > r + 1) lost++;
  return lost / total;
}

/** Full pipeline: pixels → shapes (y-down pixel units) + bounding box + mask. */
export function outlineFromPixels(pixels, opts = {}) {
  const m = toMask(pixels, opts);
  const loops = traceMask(m).map((l) => simplify(smooth(l, 2), 0.7));
  const shapes = groupShapes(loops, opts);
  return { shapes, box: boxOf(shapes), mask: m };
}

/* ── compact outline encoding for share links ────────────────────────── */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** shapes in any units + box → "outer~hole~hole.outer…" with 2 chars per coordinate (0..4095). */
export function encodeShapes(shapes, box) {
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY) || 1;
  const q = (n, o) => { const k = Math.max(0, Math.min(4095, Math.round(((n - o) / size) * 4095))); return B64[k >> 6] + B64[k & 63]; };
  const loop = (l) => simplify(l, size / 500).map(([x, y]) => q(x, box.minX) + q(y, box.minY)).join('');
  return shapes.map((s) => [s.outer, ...s.holes].map(loop).join('~')).join('.');
}
export function decodeShapes(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9\-_~.]+$/.test(str)) return null;
  const n = (a, b) => (B64.indexOf(a) << 6) | B64.indexOf(b);
  const loop = (s) => { const out = []; for (let i = 0; i + 3 < s.length; i += 4) out.push([n(s[i], s[i + 1]), n(s[i + 2], s[i + 3])]); return out; };
  const shapes = str.split('.').map((part) => { const [outer, ...holes] = part.split('~').map(loop); return { outer, holes }; }).filter((s) => s.outer.length >= 3);
  if (!shapes.length) return null;
  return { shapes, box: boxOf(shapes), decoded: true };
}
export function boxOf(shapes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) for (const [x, y] of s.outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return shapes.length ? { minX, minY, maxX, maxY } : null;
}
