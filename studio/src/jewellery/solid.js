// Small helpers shared by the home-object and sketch builders.
import * as THREE from 'three';
import { finish } from './revolve.js';
import { weld, refine } from './destroy.js';

/** Box with metal (0) or accent (1) material, centred at (x, y, z). */
export function box(w, h, d, x = 0, y = 0, z = 0, accent = false) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  for (const gr of g.groups) gr.materialIndex = accent ? 1 : 0;
  g.userData.groups = true;
  return g;
}

export function cylinder(r, h, x = 0, y = 0, z = 0, accent = false, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(x, y, z);
  for (const gr of g.groups) gr.materialIndex = accent ? 1 : 0;
  g.userData.groups = true;
  return g;
}

/** Closed profile [[r, y], …] (counter-clockwise) turned around the Y axis. */
export function turn(profile, segments = 128) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  pts.push(pts[0].clone());
  const g = new THREE.LatheGeometry(pts, segments);
  g.deleteAttribute('uv');
  const { verts, tris } = weld(g);
  const main = [];
  for (let i = 0; i < tris.length; i += 4) main.push(tris[i], tris[i + 1], tris[i + 2]);
  return finish(new Float32Array(verts), main);
}

/** Refine a closed mesh, then move every vertex with fn([x, y, z]) → [x, y, z]. Keeps accent groups. */
export function deform(geometry, maxEdge, fn) {
  const { verts, tris } = refine(weld(geometry), maxEdge, 200000);
  const out = new Float32Array(verts.length);
  for (let i = 0; i < verts.length; i += 3) {
    const [x, y, z] = fn([verts[i], verts[i + 1], verts[i + 2]]);
    out[i] = x; out[i + 1] = y; out[i + 2] = z;
  }
  const main = [], acc = [];
  for (let i = 0; i < tris.length; i += 4) (tris[i + 3] ? acc : main).push(tris[i], tris[i + 1], tris[i + 2]);
  return finish(out, main, acc);
}

/** THREE.Shape(s) → solid, faces as accent group 1 (if accentFaces). */
export function extrude(shapes, depth, { bevel = 0, accentFaces = false, curveSegments = 12 } = {}) {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: Math.max(0.05, depth - 2 * bevel), bevelEnabled: bevel > 0.01, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelOffset: 0, bevelSegments: 3, curveSegments,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  for (const gr of g.groups) gr.materialIndex = accentFaces && gr.materialIndex === 0 ? 1 : 0;
  g.userData.groups = true;
  g.computeVertexNormals();
  return g;
}

/** Outline shapes in pixel units (y down) → THREE.Shapes scaled so the height is `height` mm, centred. */
export function pixelShapesToThree(shapes, box, height) {
  const scale = height / Math.max(1e-6, box.maxY - box.minY);
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const toV = ([x, y]) => new THREE.Vector2((x - cx) * scale, -(y - cy) * scale);
  return {
    scale,
    shapes: shapes.map((s) => { const sh = new THREE.Shape(s.outer.map(toV)); sh.holes = s.holes.map((h) => new THREE.Path(h.map(toV))); return sh; }),
    width: (box.maxX - box.minX) * scale,
  };
}
