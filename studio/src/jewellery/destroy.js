// DESTROY MODE: wear a piece down by a percentage, for a raw, brutal, cast-and-buried look.
//   styles: erode (pitted, sanded away), crack (deep fissures), chip (broken-off facets),
//           melt (sagging, dripping), mix (all of it)
//   dirt:   dark grime in every dent (vertex colours) — also on undamaged pieces, for an "old" look
// Works on any closed mesh: weld → refine (so flat faces get vertices) → displace along normals.
import * as THREE from 'three';
import { finishTagged } from './revolve.js';

/* ── seeded 3D gradient noise ───────────────────────────────────── */
export function makeNoise(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const noise = (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(lerp(lerp(grad(p[AA] & 15, x, y, z), grad(p[BA] & 15, x - 1, y, z), u), lerp(grad(p[AB] & 15, x, y - 1, z), grad(p[BB] & 15, x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1] & 15, x, y, z - 1), grad(p[BA + 1] & 15, x - 1, y, z - 1), u), lerp(grad(p[AB + 1] & 15, x, y - 1, z - 1), grad(p[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  };
  const fbm = (x, y, z, oct = 4) => { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < oct; i++) { a += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; } return a; };
  // cellular: id hash of the nearest feature point
  const cell = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let best = 1e9, id = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cx = xi + dx, cy = yi + dy, cz = zi + dz;
      const h = p[(p[(p[cx & 255] + cy) & 255] + cz) & 255];
      const fx = cx + p[(h + 1) & 255] / 255, fy = cy + p[(h + 7) & 255] / 255, fz = cz + p[(h + 13) & 255] / 255;
      const d = (x - fx) ** 2 + (y - fy) ** 2 + (z - fz) ** 2;
      if (d < best) { best = d; id = h; }
    }
    return id / 255;
  };
  return { noise, fbm, cell };
}

/* ── weld + refine (red-green, watertight) ───────────────────────── */
/** Indexed mesh with shared vertices; keeps material groups as a per-triangle tag. */
export function weld(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index ? geometry.index.array : null;
  const triCount = (index ? index.length : pos.count) / 3;
  const tags = new Uint8Array(triCount);
  for (const g of geometry.groups) {
    const a = Math.floor(g.start / 3), b = Math.min(triCount, Math.floor((g.start + (Number.isFinite(g.count) ? g.count : Infinity)) / 3));
    for (let t = a; t < b; t++) tags[t] = Math.max(0, Math.min(2, g.materialIndex | 0));
  }
  const map = new Map(); const verts = []; const tris = [];
  const q = 1e4;
  const vid = (i) => {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
    let id = map.get(key);
    if (id === undefined) { id = verts.length / 3; verts.push(x, y, z); map.set(key, id); }
    return id;
  };
  for (let t = 0; t < triCount; t++) {
    const a = vid(index ? index[t * 3] : t * 3), b = vid(index ? index[t * 3 + 1] : t * 3 + 1), c = vid(index ? index[t * 3 + 2] : t * 3 + 2);
    if (a !== b && b !== c && a !== c) tris.push(a, b, c, tags[t]);
  }
  return { verts, tris };
}

/** Split every edge longer than maxEdge (shared midpoints keep the mesh closed). */
export function refine({ verts, tris }, maxEdge, maxTris = 320000, onlyWhere = null) {
  const len2 = (a, b) => (verts[a * 3] - verts[b * 3]) ** 2 + (verts[a * 3 + 1] - verts[b * 3 + 1]) ** 2 + (verts[a * 3 + 2] - verts[b * 3 + 2]) ** 2;
  const m2 = maxEdge * maxEdge;
  for (let pass = 0; pass < 12; pass++) {
    const mids = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let m = mids.get(key);
      if (m === undefined) {
        m = verts.length / 3;
        verts.push((verts[a * 3] + verts[b * 3]) / 2, (verts[a * 3 + 1] + verts[b * 3 + 1]) / 2, (verts[a * 3 + 2] + verts[b * 3 + 2]) / 2);
        mids.set(key, m);
      }
      return m;
    };
    const split = (a, b) => len2(a, b) > m2 && (!onlyWhere || onlyWhere((verts[a * 3] + verts[b * 3]) / 2, (verts[a * 3 + 1] + verts[b * 3 + 1]) / 2, (verts[a * 3 + 2] + verts[b * 3 + 2]) / 2, Math.sqrt(len2(a, b))));
    let changed = false;
    const out = [];
    for (let i = 0; i < tris.length; i += 4) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2], g = tris[i + 3];
      const sab = split(a, b), sbc = split(b, c), sca = split(c, a);
      const n = sab + sbc + sca;
      if (!n) { out.push(a, b, c, g); continue; }
      changed = true;
      if (n === 3) {
        const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        out.push(a, ab, ca, g, ab, b, bc, g, ca, bc, c, g, ab, bc, ca, g);
      } else if (n === 1) {
        if (sab) { const m = mid(a, b); out.push(a, m, c, g, m, b, c, g); }
        else if (sbc) { const m = mid(b, c); out.push(a, b, m, g, a, m, c, g); }
        else { const m = mid(c, a); out.push(a, b, m, g, m, b, c, g); }
      } else {
        // two edges: rotate so the unsplit edge is c→a
        let [x, y, z] = [a, b, c];
        if (!sab) [x, y, z] = [b, c, a]; else if (!sbc) [x, y, z] = [c, a, b];
        const xy = mid(x, y), yz = mid(y, z);
        out.push(xy, y, yz, g, x, xy, yz, g, x, yz, z, g);
      }
    }
    tris = out;
    if (!changed || tris.length / 4 > maxTris) break;
  }
  return { verts, tris };
}

/* ── the damage ───────────────────────────────────────────────── */
export const DESTROY_STYLES = [['erode', 'Eroded'], ['crack', 'Cracked'], ['chip', 'Chipped'], ['melt', 'Melted'], ['mix', 'All of it']];

/**
 * @param geometry  closed BufferGeometry (mm)
 * @param o.amount  0..1   how destroyed
 * @param o.dirt    0..1   grime in the dents
 * @param o.style   see DESTROY_STYLES
 * @param o.seed    integer
 * @param o.wall    thinnest wall of the piece (mm) — damage depth is limited by it
 * @returns { geometry, depth }
 */
export function destroy(geometry, { amount = 0, dirt = 0, style = 'erode', seed = 1, wall = 1 } = {}) {
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const diag = size.length();
  const depth = amount * Math.min(diag * 0.035, wall * 0.75) * (amount > 0.8 ? 1.5 : 1);
  const maxEdge = Math.max(diag / 110, 0.08);
  const mesh = refine(weld(geometry), maxEdge);
  const { verts, tris } = mesh;
  const nV = verts.length / 3;

  // normals of the refined mesh
  const nrm = new Float32Array(nV * 3);
  for (let i = 0; i < tris.length; i += 4) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
    const vx = verts[c] - verts[a], vy = verts[c + 1] - verts[a + 1], vz = verts[c + 2] - verts[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
  }
  // make sure normals point outward (mesh orientation from the builders can be either way)
  let vol = 0;
  for (let i = 0; i < tris.length; i += 4) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    vol += verts[a] * (verts[b + 1] * verts[c + 2] - verts[b + 2] * verts[c + 1]) - verts[a + 1] * (verts[b] * verts[c + 2] - verts[b + 2] * verts[c]) + verts[a + 2] * (verts[b] * verts[c + 1] - verts[b + 1] * verts[c]);
  }
  const sign = vol < 0 ? -1 : 1;

  const N = makeNoise(seed);
  const f = 6 / Math.max(diag, 1e-3);      // feature size ≈ 1/6 of the piece
  const out = new Float32Array(nV * 3);
  const cav = new Float32Array(nV);
  const styles = style === 'mix' ? ['erode', 'crack', 'chip'] : [style];
  for (let v = 0; v < nV; v++) {
    const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
    let nx = nrm[v * 3] * sign, ny = nrm[v * 3 + 1] * sign, nz = nrm[v * 3 + 2] * sign;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let d = 0, sag = 0;
    for (const st of styles) {
      const k = styles.length > 1 ? 0.7 : 1;
      if (st === 'erode') {
        const e = N.fbm(x * f * 1.7 + 11, y * f * 1.7, z * f * 1.7, 5);
        d -= k * depth * Math.max(0, e * 2.2 + (amount - 0.5)) ** 1.4 * 0.8;
        d -= k * depth * 0.25 * Math.max(0, N.noise(x * f * 9, y * f * 9, z * f * 9)); // pits
      } else if (st === 'crack') {
        const r = 1 - Math.abs(N.fbm(x * f * 1.3 + 3, y * f * 1.3, z * f * 1.3, 3) * 2);
        const width = 0.035 + amount * 0.07;
        d -= k * depth * 1.6 * Math.max(0, (r - (1 - width)) / width) ** 0.6;
      } else if (st === 'chip') {
        const c = N.cell(x * f * 1.4, y * f * 1.4, z * f * 1.4);
        if (c < amount * 0.55) d -= k * depth * (0.55 + 0.45 * ((c * 7.3) % 1));
      } else if (st === 'melt') {
        const m = N.fbm(x * f, y * f * 0.35, z * f, 3) + 0.25;
        sag += depth * 2.4 * Math.max(0, m) ** 1.5;
        d += depth * 0.35 * N.noise(x * f * 3, y * f * 3, z * f * 3);
      }
    }
    out[v * 3] = x + nx * d;
    out[v * 3 + 1] = y + ny * d - sag;
    out[v * 3 + 2] = z + nz * d;
    cav[v] = depth > 0 ? Math.min(1, Math.max(0, -d / depth)) : 0;
  }

  const g = finishTagged(out, tris);
  if (dirt > 0) {
    const col = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) {
      const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
      // fine grime everywhere + streaks, strongest in the dents
      const fine = Math.max(0, N.fbm(x * f * 9 + 40, y * f * 9, z * f * 9, 4) + 0.2);
      const streak = Math.max(0, N.fbm(x * f * 3, y * f * 0.6 + 9, z * f * 3, 3));
      const k = Math.min(0.92, dirt * (1.1 * cav[v] + 0.55 * fine + 0.35 * streak));
      col[v * 3] = 1 - k * 0.8; col[v * 3 + 1] = 1 - k * 0.83; col[v * 3 + 2] = 1 - k * 0.88;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return { geometry: g, depth: amount > 0 ? depth * (styles.includes('crack') ? 1.6 : 1) : 0 };
}
