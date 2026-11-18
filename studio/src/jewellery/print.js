// PRINT (colour on the surface): a picture, motif, text or repeating pattern projected onto one side
// like a decal / UV print / ceramic transfer. Adds UV coordinates and material group 3, which gets a texture.
// The geometry does not change, so the STL stays the same; GLB export keeps the colours.
import * as THREE from 'three';
import { finishTagged } from './revolve.js';
import { weld, refine } from './destroy.js';
import { projector } from './engrave.js';

export function printOnto(geometry, { box, side = 'front', offset = [0, 0], rot = 0, width = 20, height = 20 }) {
  const proj = projector(box, side, offset, rot);
  const halfW = width / 2, halfH = height / 2;
  const maxEdge = Math.max(0.1, Math.min(width, height) / 40);
  const welded = weld(geometry);
  const near = (x, y, z, l) => { const [u, v] = proj(x, y, z); return Math.abs(u) < halfW + l && Math.abs(v) < halfH + l; };
  const { verts, tris } = refine(welded, maxEdge, 300000, near);
  const nV = verts.length / 3;
  // facing test with averaged normals
  const nrm = new Float32Array(nV * 3);
  let vol = 0;
  for (let i = 0; i < tris.length; i += 4) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
    const vx = verts[c] - verts[a], vy = verts[c + 1] - verts[a + 1], vz = verts[c + 2] - verts[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
    vol += verts[a] * nx + verts[a + 1] * ny + verts[a + 2] * nz;
  }
  const sign = vol < 0 ? -1 : 1;
  const uv = new Float32Array(nV * 2);
  const ok = new Uint8Array(nV);
  const P = new Float32Array(nV * 3);
  let hFront = -Infinity;
  for (let v = 0; v < nV; v++) {
    const [u, w, h] = proj(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]);
    P[v * 3] = u; P[v * 3 + 1] = w; P[v * 3 + 2] = h;
    const facing = proj.facing(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2], nrm[v * 3] * sign, nrm[v * 3 + 1] * sign, nrm[v * 3 + 2] * sign);
    if (facing > 0.25 && Math.abs(u) <= halfW && Math.abs(w) <= halfH) { ok[v] = 1; if (h > hFront) hFront = h; }
    uv[v * 2] = u / width + 0.5; uv[v * 2 + 1] = w / height + 0.5;
  }
  // only the front-most layer (not the back wall seen through)
  const depthLimit = Math.max(2, Math.min(width, height) * 0.35);
  for (let v = 0; v < nV; v++) if (ok[v] && P[v * 3 + 2] < hFront - depthLimit) ok[v] = 0;
  for (let i = 0; i < tris.length; i += 4) if (ok[tris[i]] && ok[tris[i + 1]] && ok[tris[i + 2]]) tris[i + 3] = 3;
  const g = finishTagged(new Float32Array(verts), tris);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
