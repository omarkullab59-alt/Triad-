// ENGRAVE & EMBOSS on any object, like a stamp or a displace modifier in Blender:
// a text, symbol, motif or picture is projected onto one side of the piece and pushed in (engrave)
// or out (emboss). Only the surface that faces that side and is in front gets it (no shine-through).
// Optional: fill the engraving with lime enamel (accent material).
import * as THREE from 'three';
import { finishTagged } from './revolve.js';
import { weld, refine } from './destroy.js';

export const SIDES = [['front', 'Front'], ['back', 'Back'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['around', 'Around (wraps)']];
const VIEW = {
  front: [[0, 0, -1], [0, 1, 0]], back: [[0, 0, 1], [0, 1, 0]],
  left: [[1, 0, 0], [0, 1, 0]], right: [[-1, 0, 0], [0, 1, 0]],
  top: [[0, -1, 0], [0, 0, -1]], bottom: [[0, 1, 0], [0, 0, 1]],
};

/** proj(x,y,z) → [u, v, h] for a side; proj.facing(point, normal) → how much the surface faces that side (−1…1). */
export function projector(box, side, offset = [0, 0], rot = 0) {
  const c = box.getCenter(new THREE.Vector3());
  const around = side === 'around';
  const [fwd, up] = VIEW[side] || VIEW.front;
  const F = new THREE.Vector3(...fwd), U = new THREE.Vector3(...up), R = new THREE.Vector3().crossVectors(F, U), D = F.clone().negate();
  const cr = Math.cos((-rot * Math.PI) / 180), sr = Math.sin((-rot * Math.PI) / 180);
  const proj = (x, y, z) => {
    const px = x - c.x, py = y - c.y, pz = z - c.z;
    let u, v, h;
    if (around) { const r = Math.hypot(px, pz); u = Math.atan2(px, pz) * r; v = py; h = r; }
    else { u = px * R.x + py * R.y + pz * R.z; v = px * U.x + py * U.y + pz * U.z; h = px * D.x + py * D.y + pz * D.z; }
    u -= offset[0]; v -= offset[1];
    return [u * cr - v * sr, u * sr + v * cr, h];
  };
  proj.facing = (x, y, z, nx, ny, nz) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    if (around) { const px = x - c.x, pz = z - c.z; return (nx * px + nz * pz) / (l * (Math.hypot(px, pz) || 1)); }
    return (nx * D.x + ny * D.y + nz * D.z) / l;
  };
  return proj;
}

/** The face size (mm) an engraving can use on that side of a box: [width, height]. */
export function faceSize(box, side) {
  const s = box.getSize(new THREE.Vector3());
  if (side === 'around') return [Math.PI * (s.x + s.z) / 2, s.y];
  if (side === 'top' || side === 'bottom') return [s.x, s.z];
  if (side === 'left' || side === 'right') return [s.z, s.y];
  return [s.x, s.y];
}

/**
 * @param geometry closed BufferGeometry
 * @param o.mask    { sample(u, v) → 0..1, lengthMm } with (0,0) = centre of the motif, v up
 * @param o.box     bounding box of the WHOLE piece (so several parts share one placement)
 * @param o.side    see SIDES
 * @param o.offset  [u, v] mm from the centre of that face
 * @param o.rot     degrees
 * @param o.depth   mm; o.mode 'engrave' | 'emboss'; o.fill → accent material in the engraving
 */
export function engrave(geometry, { mask, box, side = 'front', offset = [0, 0], rot = 0, depth = 0.3, mode = 'engrave', fill = false, height = 10, fine = false }) {
  const c = box.getCenter(new THREE.Vector3());
  const around = side === 'around';
  const [fwd, up] = VIEW[side] || VIEW.front;
  const F = new THREE.Vector3(...fwd), U = new THREE.Vector3(...up), R = new THREE.Vector3().crossVectors(F, U), D = F.clone().negate();
  const cr = Math.cos((-rot * Math.PI) / 180), sr = Math.sin((-rot * Math.PI) / 180);
  const halfW = (mask.lengthMm || height) / 2 + 1, halfH = height / 2 + 1;
  const radius = Math.max(halfW, halfH) * 1.15;
  const maxEdge = Math.max(fine ? 0.03 : 0.05, height / (fine ? 170 : 85));

  // project a point to engraving coordinates (u right, v up, h = how far "in front")
  const proj = (x, y, z) => {
    const px = x - c.x, py = y - c.y, pz = z - c.z;
    let u, v, h;
    if (around) { const r = Math.hypot(px, pz); u = Math.atan2(px, pz) * r; v = py; h = r; }
    else { u = px * R.x + py * R.y + pz * R.z; v = px * U.x + py * U.y + pz * U.z; h = px * D.x + py * D.y + pz * D.z; }
    u -= offset[0]; v -= offset[1];
    return [u * cr - v * sr, u * sr + v * cr, h];
  };
  // only refine the front surface inside the engraving area (not the back or inner walls)
  const welded = weld(geometry);
  let hFront = -Infinity;
  for (let i = 0; i < welded.verts.length; i += 3) {
    const [u, v, h] = proj(welded.verts[i], welded.verts[i + 1], welded.verts[i + 2]);
    if (Math.abs(u) < radius && Math.abs(v) < radius && h > hFront) hFront = h;
  }
  const margin = depth * 3 + radius * 0.3;
  const near = (x, y, z, len) => { const [u, v, h] = proj(x, y, z); return Math.abs(u) < radius + len && Math.abs(v) < radius + len && (!Number.isFinite(hFront) || h > hFront - margin - len); };
  const { verts, tris } = refine(welded, maxEdge, fine ? 900000 : 400000, near);
  const nV = verts.length / 3;

  // normals (outward)
  const nrm = new Float32Array(nV * 3);
  let vol = 0;
  for (let i = 0; i < tris.length; i += 4) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, cc = tris[i + 2] * 3;
    const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
    const vx = verts[cc] - verts[a], vy = verts[cc + 1] - verts[a + 1], vz = verts[cc + 2] - verts[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, cc]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
    vol += verts[a] * nx + verts[a + 1] * ny + verts[a + 2] * nz;
  }
  const sign = vol < 0 ? -1 : 1;

  // which vertices face the viewer, and a depth buffer so only the front surface is engraved
  const cell = maxEdge * 2.5, cols = Math.ceil((2 * radius) / cell) + 1;
  const zbuf = new Map();
  const P = new Float32Array(nV * 3), facing = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) {
    const x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
    let nx = nrm[v * 3] * sign, ny = nrm[v * 3 + 1] * sign, nz = nrm[v * 3 + 2] * sign;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    nrm[v * 3] = nx; nrm[v * 3 + 1] = ny; nrm[v * 3 + 2] = nz;
    const p = proj(x, y, z);
    P[v * 3] = p[0]; P[v * 3 + 1] = p[1]; P[v * 3 + 2] = p[2];
    const dot = around ? (nx * (x - c.x) + nz * (z - c.z)) / (Math.hypot(x - c.x, z - c.z) || 1) : nx * D.x + ny * D.y + nz * D.z;
    if (dot > 0.3 && Math.abs(p[0]) < radius && Math.abs(p[1]) < radius) {
      facing[v] = 1;
      const k = Math.floor((p[0] + radius) / cell) * cols + Math.floor((p[1] + radius) / cell);
      zbuf.set(k, Math.max(zbuf.get(k) ?? -Infinity, p[2]));
    }
  }
  const tol = Math.max(0.4, depth * 3, height * 0.04);
  const out = new Float32Array(verts);
  const m = new Float32Array(nV);
  const dir = mode === 'emboss' ? 1 : -1;
  for (let v = 0; v < nV; v++) {
    if (!facing[v]) continue;
    const u = P[v * 3], w = P[v * 3 + 1];
    if (Math.abs(u) > halfW || Math.abs(w) > halfH) continue;
    const k = Math.floor((u + radius) / cell) * cols + Math.floor((w + radius) / cell);
    if (P[v * 3 + 2] < (zbuf.get(k) ?? Infinity) - tol) continue; // hidden behind the front surface
    const val = mask.sample(u, w);
    if (val <= 0.01) continue;
    m[v] = val;
    for (let j = 0; j < 3; j++) out[v * 3 + j] += nrm[v * 3 + j] * dir * depth * val;
  }
  if (fill) for (let i = 0; i < tris.length; i += 4) if (m[tris[i]] > 0.5 && m[tris[i + 1]] > 0.5 && m[tris[i + 2]] > 0.5) tris[i + 3] = 2;
  return finishTagged(out, tris);
}
