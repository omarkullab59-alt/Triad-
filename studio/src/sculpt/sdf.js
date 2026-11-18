// Sculpting with distance fields: primitives melted together (smooth union), then turned into a closed mesh
// with marching cubes. Fast because each primitive only touches the grid cells near it.
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { finish } from '../jewellery/revolve.js';

const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/* ── primitives: { d(x,y,z), box: [minx,miny,minz,maxx,maxy,maxz], k (blend), sub } ── */
export const sphere = (c, r, o = {}) => ({ ...o, d: (x, y, z) => len(x - c[0], y - c[1], z - c[2]) - r, box: [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r] });

export function ellipsoid(c, rad, o = {}) {
  const m = Math.min(...rad), M = Math.max(...rad);
  return { ...o, d: (x, y, z) => { const k = len((x - c[0]) / rad[0], (y - c[1]) / rad[1], (z - c[2]) / rad[2]); return (k - 1) * m; },
    box: [c[0] - M, c[1] - M, c[2] - M, c[0] + M, c[1] + M, c[2] + M] };
}

/** Round cone from a (radius ra) to b (radius rb). */
export function capsule(a, b, ra, rb = ra, o = {}) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const bb = bx * bx + by * by + bz * bz || 1e-9;
  const r = Math.max(ra, rb);
  return { ...o, d: (x, y, z) => {
    const px = x - a[0], py = y - a[1], pz = z - a[2];
    const t = clamp01((px * bx + py * by + pz * bz) / bb);
    return len(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
  }, box: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r] };
}

/** Rounded box, optional rotation about Y. */
export function roundBox(c, half, round = 0, o = {}, rotY = 0) {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  const M = len(...half) + round;
  return { ...o, d: (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    const rx = px * cs - pz * sn, rz = px * sn + pz * cs; px = rx; pz = rz;
    const qx = Math.abs(px) - half[0] + round, qy = Math.abs(py) - half[1] + round, qz = Math.abs(pz) - half[2] + round;
    return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round;
  }, box: [c[0] - M, c[1] - M, c[2] - M, c[0] + M, c[1] + M, c[2] + M] };
}

/** Torus in the plane given by normal n (unit). */
export function torus(c, R, r, n = [0, 1, 0], o = {}) {
  return { ...o, d: (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const h = px * n[0] + py * n[1] + pz * n[2];
    const qx = px - h * n[0], qy = py - h * n[1], qz = pz - h * n[2];
    return Math.hypot(len(qx, qy, qz) - R, h) - r;
  }, box: [c[0] - R - r, c[1] - R - r, c[2] - R - r, c[0] + R + r, c[1] + R + r, c[2] + R + r] };
}

/** Thin plate on a triangle (wings, fins, spikes). */
export function triPlate(a, b, cc, thick, o = {}) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const ba = sub(b, a), cb = sub(cc, b), ac = sub(a, cc), nor = cross(ba, ac);
  const seg = (p, e, v) => { const t = clamp01(dot(e, p) / dot(e, e)); const q = [e[0] * t - p[0], e[1] * t - p[1], e[2] * t - p[2]]; return dot(q, q); };
  const xs = [a[0], b[0], cc[0]], ys = [a[1], b[1], cc[1]], zs = [a[2], b[2], cc[2]];
  return { ...o, d: (x, y, z) => {
    const p = [x, y, z], pa = sub(p, a), pb = sub(p, b), pc = sub(p, cc);
    const s = Math.sign(dot(cross(ba, nor), pa)) + Math.sign(dot(cross(cb, nor), pb)) + Math.sign(dot(cross(ac, nor), pc));
    const d2 = s < 2 ? Math.min(seg(pa, ba), seg(pb, cb), seg(pc, ac)) : (dot(nor, pa) ** 2) / dot(nor, nor);
    return Math.sqrt(d2) - thick;
  }, box: [Math.min(...xs) - thick, Math.min(...ys) - thick, Math.min(...zs) - thick, Math.max(...xs) + thick, Math.max(...ys) + thick, Math.max(...zs) + thick] };
}

/** Capsules along a path f(t) with radius r(t). */
export function tube(f, r, n = 24, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(capsule(f(i / n), f((i + 1) / n), r(i / n), r((i + 1) / n), o));
  return out;
}

/** Gyroid lattice (for openwork) — use with sub or intersect. */
export const gyroid = (scale, thick, box, o = {}) => ({ ...o, d: (x, y, z) => Math.abs(Math.sin(x * scale) * Math.cos(y * scale) + Math.sin(y * scale) * Math.cos(z * scale) + Math.sin(z * scale) * Math.cos(x * scale)) / scale - thick, box });

const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = clamp01(0.5 + (0.5 * (b - a)) / k); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);

/**
 * Build a closed mesh from primitives.
 * @param prims     list of primitives; prim.k = blend radius, prim.sub = carve away, prim.inter = keep only inside
 * @param res       cells along the longest side
 */
export function polygonize(prims, res = 90) {
  const adds = prims.filter((p) => !p.sub && !p.inter);
  let bx = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of adds) for (let i = 0; i < 3; i++) { bx[i] = Math.min(bx[i], p.box[i]); bx[i + 3] = Math.max(bx[i + 3], p.box[i + 3]); }
  const size = Math.max(bx[3] - bx[0], bx[4] - bx[1], bx[5] - bx[2]);
  const h = size / res;
  const pad = 3;
  const o = [bx[0] - pad * h, bx[1] - pad * h, bx[2] - pad * h];
  const nx = Math.ceil((bx[3] - bx[0]) / h) + 2 * pad + 1, ny = Math.ceil((bx[4] - bx[1]) / h) + 2 * pad + 1, nz = Math.ceil((bx[5] - bx[2]) / h) + 2 * pad + 1;
  const far = h * 4;
  const F = new Float32Array(nx * ny * nz).fill(far);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const splat = (p, op) => {
    const m = (p.k || 0) + h * 2;
    const i0 = Math.max(0, Math.floor((p.box[0] - m - o[0]) / h)), i1 = Math.min(nx - 1, Math.ceil((p.box[3] + m - o[0]) / h));
    const j0 = Math.max(0, Math.floor((p.box[1] - m - o[1]) / h)), j1 = Math.min(ny - 1, Math.ceil((p.box[4] + m - o[1]) / h));
    const k0 = Math.max(0, Math.floor((p.box[2] - m - o[2]) / h)), k1 = Math.min(nz - 1, Math.ceil((p.box[5] + m - o[2]) / h));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = idx(i, j, k);
      const d = p.d(o[0] + i * h, o[1] + j * h, o[2] + k * h);
      F[id] = op(F[id], d, p.k || 0);
    }
  };
  for (const p of adds) splat(p, smin);
  for (const p of prims) if (p.sub) splat(p, (a, d, k) => smax(a, -d, k));
  for (const p of prims) if (p.inter) { for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const id = idx(i, j, k); F[id] = smax(F[id], p.d(o[0] + i * h, o[1] + j * h, o[2] + k * h), p.k || 0); } }
  // keep the grid border outside so the mesh is always closed
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!i || !j || !k || i === nx - 1 || j === ny - 1 || k === nz - 1) F[idx(i, j, k)] = Math.max(F[idx(i, j, k)], h);

  // marching cubes with shared edge vertices
  const C = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const E = [[0, 1], [1, 2], [3, 2], [0, 3], [4, 5], [5, 6], [7, 6], [4, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const EA = [[0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1], [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2]];
  const verts = [];
  const cache = new Map();
  const tris = [];
  const val = new Float32Array(8);
  const ev = new Int32Array(12);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let cube = 0;
    for (let c = 0; c < 8; c++) { val[c] = F[idx(i + C[c][0], j + C[c][1], k + C[c][2])]; if (val[c] < 0) cube |= 1 << c; }
    const edges = edgeTable[cube];
    if (!edges) continue;
    for (let e = 0; e < 12; e++) {
      if (!(edges & (1 << e))) continue;
      const [ax, ay, az, axis] = EA[e];
      const key = idx(i + ax, j + ay, k + az) * 3 + axis;
      let v = cache.get(key);
      if (v === undefined) {
        const [c0, c1] = E[e];
        const a = val[c0], b = val[c1];
        const t = a === b ? 0.5 : a / (a - b);
        const p0 = C[c0], p1 = C[c1];
        v = verts.length / 3;
        verts.push(o[0] + (i + p0[0] + (p1[0] - p0[0]) * t) * h, o[1] + (j + p0[1] + (p1[1] - p0[1]) * t) * h, o[2] + (k + p0[2] + (p1[2] - p0[2]) * t) * h);
        cache.set(key, v);
      }
      ev[e] = v;
    }
    for (let t = cube * 16; triTable[t] !== -1; t += 3) {
      const a = ev[triTable[t]], b = ev[triTable[t + 1]], c = ev[triTable[t + 2]];
      if (a !== b && b !== c && a !== c) tris.push(a, b, c);
    }
  }
  return finish(new Float32Array(verts), tris);
}
