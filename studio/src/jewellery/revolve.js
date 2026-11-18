// Sweep a closed 2D profile around a circle or oval. Used for rings, bangles, cuffs and hoops.
//
// profile: closed loop of points { u, v, tag } where
//   u = distance outward from the inner surface (mm), v = position across the band (mm),
//   tag = 'inner' | 'outer' | 'side'
// The base curve is an ellipse (rx, rz) in the XZ plane; the band's width runs along Y.
// modify(theta, point) may return { u, v, accent } to shape the band (signet plate, peaks, engraving, hammering).
import * as THREE from 'three';

export function revolve({ profile, rx, rz = rx, segments = 192, start = 0, end = Math.PI * 2, modify }) {
  const closed = Math.abs(end - start - Math.PI * 2) < 1e-6;
  const rings = closed ? segments : segments + 1;
  const P = profile.length;
  const pos = new Float32Array(rings * P * 3);
  const accent = new Uint8Array(rings * P);

  for (let i = 0; i < rings; i++) {
    const t = start + ((end - start) * i) / segments;
    const c = Math.cos(t), s = Math.sin(t);
    const cx = rx * c, cz = rz * s;
    // outward normal of the ellipse
    let nx = c / rx, nz = s / rz;
    const nl = Math.hypot(nx, nz);
    nx /= nl; nz /= nl;
    for (let j = 0; j < P; j++) {
      const p = profile[j];
      const m = modify ? modify(t, p) : null;
      const u = m?.u ?? p.u;
      const v = m?.v ?? p.v;
      const k = (i * P + j) * 3;
      pos[k] = cx + nx * u;
      pos[k + 1] = v;
      pos[k + 2] = cz + nz * u;
      accent[i * P + j] = m?.accent ? 1 : 0;
    }
  }

  const main = [];
  const acc = [];
  const quads = closed ? rings : rings - 1;
  for (let i = 0; i < quads; i++) {
    const i2 = (i + 1) % rings;
    for (let j = 0; j < P; j++) {
      const j2 = (j + 1) % P;
      const a = i * P + j, b = i2 * P + j, c = i2 * P + j2, d = i * P + j2;
      const target = accent[a] + accent[b] + accent[c] + accent[d] >= 3 ? acc : main;
      target.push(a, b, d, b, c, d);
    }
  }

  let positions = pos;
  if (!closed) {
    // End caps: triangulate the (modified) profile at both ends.
    const extra = [];
    const base = rings * P;
    const flat = profile.map((p) => new THREE.Vector2(p.u, p.v));
    // Start cap must wind like the profile, end cap the other way (so every edge is shared in opposite directions).
    const profileCCW = !THREE.ShapeUtils.isClockWise(flat);
    const tris = THREE.ShapeUtils.triangulateShape(flat, []).map(([a, b, c]) => {
      const ccw = (flat[b].x - flat[a].x) * (flat[c].y - flat[a].y) - (flat[b].y - flat[a].y) * (flat[c].x - flat[a].x) > 0;
      return ccw === profileCCW ? [a, b, c] : [a, c, b];
    });
    const capStart = base;
    const capEnd = base + P;
    for (let j = 0; j < P; j++) extra.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    const last = (rings - 1) * P;
    for (let j = 0; j < P; j++) extra.push(pos[(last + j) * 3], pos[(last + j) * 3 + 1], pos[(last + j) * 3 + 2]);
    for (const [a, b, c] of tris) {
      main.push(capStart + a, capStart + b, capStart + c);
      main.push(capEnd + a, capEnd + c, capEnd + b);
    }
    positions = new Float32Array(pos.length + extra.length);
    positions.set(pos);
    positions.set(extra, pos.length);
  }
  return finish(positions, main, acc);
}

/** Build an indexed BufferGeometry with group 0 = metal, group 1 = accent. Faces are flipped if inside-out. */
export function finish(positions, main, acc = []) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const all = main.concat(acc);
  if (signedVolume(positions, all) < 0) {
    for (const list of [main, acc]) for (let i = 0; i < list.length; i += 3) { const t = list[i + 1]; list[i + 1] = list[i + 2]; list[i + 2] = t; }
  }
  g.setIndex(main.concat(acc));
  g.addGroup(0, main.length, 0);
  if (acc.length) g.addGroup(main.length, acc.length, 1);
  g.userData.groups = true;
  g.computeVertexNormals();
  return g;
}

/** Volume of a closed triangle mesh (mm³), sign tells orientation. */
export function signedVolume(pos, index) {
  let v = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    v += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
       - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
       + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  return v / 6;
}

/** Volume of any geometry (indexed or not) after applying a matrix. */
export function geometryVolume(geometry, matrix) {
  const g = matrix ? geometry.clone().applyMatrix4(matrix) : geometry;
  const pos = g.attributes.position.array;
  const index = g.index ? g.index.array : Array.from({ length: pos.length / 3 }, (_, i) => i);
  return Math.abs(signedVolume(pos, index));
}

/* ── profiles (cross-sections) ───────────────────────────────────────────── */
// Points run counter-clockwise in (u, v). `step` controls how finely the inner/outer faces are divided
// (fine steps are needed for engraving and hammering).

function line(out, u0, v0, u1, v1, tag, step) {
  const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / step));
  for (let i = 0; i < n; i++) out.push({ u: u0 + ((u1 - u0) * i) / n, v: v0 + ((v1 - v0) * i) / n, tag });
}
function arc(out, cu, cv, ru, rv, a0, a1, tag, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push({ u: cu + ru * Math.cos(a), v: cv + rv * Math.sin(a), tag });
  }
}

export function makeProfile(kind, width, thick, { innerStep = 0.5, outerStep = 0.5 } = {}) {
  const W = width / 2, T = thick;
  const out = [];
  const rc = Math.min(0.35, T / 3, W / 3);
  const HALF = Math.PI / 2;
  if (kind === 'round') {
    const n = Math.max(32, Math.ceil((Math.PI * (T + width)) / Math.min(innerStep, outerStep, 0.4)));
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (2 * Math.PI * i) / n; // start at the inner side
      const c = Math.cos(a);
      out.push({ u: T / 2 + (T / 2) * c, v: W * Math.sin(a), tag: c < -0.5 ? 'inner' : c > 0.5 ? 'outer' : 'side' });
    }
    return out;
  }
  // inner face (u = 0), walking v from +W to −W … going counter-clockwise: inner, bottom side, outer, top side
  line(out, 0, W - rc, 0, -W + rc, 'inner', innerStep);
  arc(out, rc, -W + rc, rc, rc, Math.PI, Math.PI + HALF, 'side', 4);
  if (kind === 'd') {
    // flat inside, half-round outside
    line(out, rc, -W, T * 0.35, -W, 'side', 0.5);
    const n = Math.max(24, Math.ceil((Math.PI * W) / outerStep));
    for (let i = 0; i < n; i++) {
      const a = -HALF + (Math.PI * i) / n;
      const c = Math.cos(a);
      out.push({ u: T * 0.35 + T * 0.65 * c, v: W * Math.sin(a), tag: c > 0.35 ? 'outer' : 'side' });
    }
    line(out, T * 0.35, W, rc, W, 'side', 0.5);
  } else {
    // flat / hammered: rectangle with rounded corners
    line(out, rc, -W, T - rc, -W, 'side', 0.5);
    arc(out, T - rc, -W + rc, rc, rc, -HALF, 0, 'side', 4);
    line(out, T, -W + rc, T, W - rc, 'outer', outerStep);
    arc(out, T - rc, W - rc, rc, rc, 0, HALF, 'side', 4);
    line(out, T - rc, W, rc, W, 'side', 0.5);
  }
  arc(out, rc, W - rc, rc, rc, HALF, Math.PI, 'side', 4);
  return out;
}

/* ── surface effects ─────────────────────────────────────────────────────── */

const fract = (x) => x - Math.floor(x);
const hash = (i, j) => fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453);

/** Hammered dents: depth in mm (inward) at arc position s (periodic over `period`) and width position v. */
export function hammerDepth(s, v, depth, period, cell = 1.7) {
  const n = Math.max(3, Math.round(period / cell));
  const cs = period / n;
  const gi = Math.floor(s / cs), gj = Math.floor(v / cell);
  let best = 1e9;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const i = gi + di, j = gj + dj;
      const im = ((i % n) + n) % n;
      const px = (i + 0.15 + 0.7 * hash(im, j)) * cs;
      const py = (j + 0.15 + 0.7 * hash(j + 17, im)) * cell;
      const d = Math.hypot(s - px, v - py);
      if (d < best) best = d;
    }
  }
  const r = cell * 0.85;
  return depth * Math.max(0, 1 - (best / r) ** 2);
}

/** Rasterise text for engraving. Returns a sampler (s, v in mm, centred) → 0..1. */
export function textMask(text, heightMm, makeCanvas) {
  const pxPerMm = 24;
  const fontPx = Math.round(heightMm * pxPerMm);
  const canvas = makeCanvas(8, 8);
  let ctx = canvas.getContext('2d');
  const font = `600 ${fontPx}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 8;
  const h = Math.ceil(fontPx * 1.3);
  canvas.width = w; canvas.height = h;
  ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lengthMm = w / pxPerMm;
  const sample = (s, v) => {
    const x = s * pxPerMm + w / 2;
    const y = h / 2 - v * pxPerMm;
    if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (xx, yy) => data[(yy * w + xx) * 4] / 255;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  return { sample, lengthMm };
}

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Smallest signed difference between two angles. */
export const angleDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
