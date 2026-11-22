// WORLD — object library (editable geometry parameters) and scatter layers (instanced trees, rocks …).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeNoise, rng, heightAt } from './terrain.js';
import { makeMaterial } from '../ether/materials.js';

/** type → label, default geometry params (all editable in the panel), default material. */
export const OBJECTS = {
  sphere: { label: 'Sphere', p: { radius: 6, detail: 48 }, mat: ['chrome', '#e8ebee'] },
  cube: { label: 'Cube', p: { width: 10, height: 10, depth: 10, bevel: 0.4 }, mat: ['plastic', '#f4f5f6'] },
  cylinder: { label: 'Cylinder', p: { radius: 4, height: 14, sides: 48 }, mat: ['concrete', '#eceae6'] },
  cone: { label: 'Cone', p: { radius: 6, height: 14, sides: 48 }, mat: ['plastic', '#f4f5f6'] },
  pyramid: { label: 'Pyramid', p: { radius: 8, height: 12, sides: 4 }, mat: ['concrete', '#d9c9a3'] },
  torus: { label: 'Torus', p: { radius: 8, tube: 1.6, sides: 96 }, mat: ['chrome', '#e8ebee'] },
  rock: { label: 'Rock', p: { size: 6, roughness: 0.5, seed: 3 }, mat: ['concrete', '#8a837a'] },
  tree: { label: 'Tree', p: { height: 14, crown: 5, kind: 0, seed: 1 }, mat: ['fabric', '#4d7a33'] },
  building: { label: 'Building', p: { width: 14, depth: 14, floors: 18, floorHeight: 3.4, taper: 0.15, seed: 2 }, mat: ['glass', '#bfe0f0'] },
  planet: { label: 'Planet', p: { radius: 12, ring: 1, seed: 4 }, mat: ['silver', '#d9b38c'] },
  island: { label: 'Floating island', p: { radius: 22, depth: 26, seed: 5 }, mat: ['fabric', '#5f9a4a'] },
  arch: { label: 'Rock arch', p: { span: 24, height: 18, thickness: 4.5, seed: 6 }, mat: ['concrete', '#b86e42'] },
  crystal: { label: 'Crystal', p: { height: 9, count: 5, seed: 7 }, mat: ['glass', '#bff5ff'] },
  monolith: { label: 'Monolith', p: { width: 4, height: 22, depth: 1.2 }, mat: ['latex', '#0c0c0d'] },
  knot: { label: 'Abstract knot', p: { radius: 6, tube: 1.4, p: 2, q: 3 }, mat: ['holo', '#e6edf2'] },
  sculpture: { label: 'Sculpture (twist)', p: { height: 16, width: 5, twist: 2.5, sides: 5 }, mat: ['silver', '#d4d7db'] },
  chair: { label: 'Chair', p: { width: 1, height: 1, seed: 1 }, mat: ['plastic', '#f4f5f6'] },
  table: { label: 'Table', p: { width: 3, depth: 1.6, height: 1.6 }, mat: ['brushed', '#c9ccd1'] },
  figure: { label: 'Character (Ether)', p: { height: 1.78, preset: 0 }, mat: ['skin', '#e8cdb8'] },
  image: { label: 'Image plane', p: { width: 20 }, mat: ['plastic', '#ffffff'] },
  model: { label: 'Imported model', p: { scale: 1 }, mat: ['silver', '#d4d7db'] },
  group: { label: 'Group', p: {}, mat: ['plastic', '#ffffff'] },
};
export const PLACEABLE = Object.entries(OBJECTS).filter(([k]) => !['image', 'model', 'group'].includes(k)).map(([k, v]) => [k, v.label]);

function jitter(g, amount, seed) {
  const n = makeNoise(seed), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + amount * (n(v.x * 0.35 + 3, v.y * 0.35 + v.z * 0.2) * 0.7 + n(v.x * 1.1, v.z * 1.1 - 4) * 0.3); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function merge(list) {
  const geos = list.map((g) => { if (!g.index) return g; const ng = g.toNonIndexed(); ng.userData = g.userData; return ng; });
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const g of geos) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); const c = g.userData.color; for (let i = 0; i < g.attributes.position.count; i++) col.set(c || [1, 1, 1], (o + i) * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const tint = (g, hex) => { const c = new THREE.Color(hex); g.userData.color = [c.r, c.g, c.b]; return g; };
/** Paint the white (“main colour”) parts of a multi-part geometry; other parts (trunks, rock undersides) keep their own colour. */
export function recolor(geo, hex) {
  const a = geo.attributes.color; if (!a) return false;
  if (!geo.userData.base) geo.userData.base = a.array.slice();
  const b = geo.userData.base, c = new THREE.Color(hex);
  for (let i = 0; i < b.length; i += 3) { if (b[i] > 0.99 && b[i + 1] > 0.99 && b[i + 2] > 0.99) { a.array[i] = c.r; a.array[i + 1] = c.g; a.array[i + 2] = c.b; } else { a.array[i] = b[i]; a.array[i + 1] = b[i + 1]; a.array[i + 2] = b[i + 2]; } }
  a.needsUpdate = true; return true;
}

/** Geometry for an object (local origin at its base). */
export function objectGeometry(type, p) {
  switch (type) {
    case 'sphere': { const g = new THREE.SphereGeometry(p.radius, p.detail, Math.round(p.detail * 0.66)); g.translate(0, p.radius, 0); return g; }
    case 'cube': { const g = new RoundedBoxGeometry(p.width, p.height, p.depth, 3, Math.min(p.bevel, Math.min(p.width, p.height, p.depth) / 2 - 0.01)); g.translate(0, p.height / 2, 0); return g; }
    case 'cylinder': { const g = new THREE.CylinderGeometry(p.radius, p.radius, p.height, p.sides); g.translate(0, p.height / 2, 0); return g; }
    case 'cone': { const g = new THREE.ConeGeometry(p.radius, p.height, p.sides); g.translate(0, p.height / 2, 0); return g; }
    case 'pyramid': { const g = new THREE.ConeGeometry(p.radius, p.height, Math.max(3, Math.round(p.sides))); g.rotateY(Math.PI / 4); g.translate(0, p.height / 2, 0); return g; }
    case 'torus': { const g = new THREE.TorusGeometry(p.radius, p.tube, 32, p.sides); g.translate(0, p.radius + p.tube, 0); return g; }
    case 'knot': { const g = new THREE.TorusKnotGeometry(p.radius, p.tube, 220, 24, Math.round(p.p), Math.round(p.q)); g.translate(0, p.radius * 1.6, 0); return g; }
    case 'rock': { const g = jitter(new THREE.IcosahedronGeometry(p.size, 4), p.roughness, p.seed); g.scale(1, 0.7, 1); g.translate(0, p.size * 0.45, 0); return g; }
    case 'monolith': { const g = new THREE.BoxGeometry(p.width, p.height, p.depth); g.translate(0, p.height / 2, 0); return g; }
    case 'crystal': {
      const r = rng(p.seed), parts = [];
      for (let i = 0; i < Math.round(p.count); i++) { const h = p.height * (0.5 + r() * 0.6), g = new THREE.CylinderGeometry(0, h * 0.16, h, 6); g.translate(0, h / 2, 0); g.rotateZ((r() - 0.5) * 0.9); g.rotateX((r() - 0.5) * 0.9); g.translate((r() - 0.5) * p.height * 0.3, 0, (r() - 0.5) * p.height * 0.3); parts.push(g); }
      return merge(parts);
    }
    case 'tree': {
      const r = rng(p.seed), trunk = new THREE.CylinderGeometry(p.height * 0.03, p.height * 0.05, p.height * 0.45, 8); trunk.translate(0, p.height * 0.22, 0); tint(trunk, '#5a4030');
      const crowns = [];
      if (p.kind < 0.5) for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(p.crown * (1 - i * 0.22), p.height * 0.38, 9); c.translate(0, p.height * (0.42 + i * 0.18), 0); crowns.push(tint(c, '#ffffff')); }
      else for (let i = 0; i < 4; i++) { const c = jitter(new THREE.IcosahedronGeometry(p.crown * (0.6 + r() * 0.4), 2), 0.2, p.seed + i); c.translate((r() - 0.5) * p.crown, p.height * (0.6 + r() * 0.3), (r() - 0.5) * p.crown); crowns.push(tint(c, '#ffffff')); }
      return merge([trunk, ...crowns]);
    }
    case 'building': {
      const r = rng(p.seed), parts = [], H = p.floors * p.floorHeight;
      const segs = 3;
      for (let s = 0; s < segs; s++) { const k = 1 - p.taper * s, h = H / segs; const b = new RoundedBoxGeometry(p.width * k, h, p.depth * k, 2, 0.3); b.translate(0, h * s + h / 2, 0); parts.push(tint(b, '#ffffff')); }
      for (let f = 1; f < p.floors; f += 2) { const band = new THREE.BoxGeometry(p.width * (1 - p.taper * Math.floor(f / (p.floors / segs))) + 0.4, 0.25, p.depth * (1 - p.taper * Math.floor(f / (p.floors / segs))) + 0.4); band.translate(0, f * p.floorHeight, 0); parts.push(tint(band, '#c9ccd1')); }
      const spire = new THREE.CylinderGeometry(0.05, 0.4, H * 0.18 * (0.5 + r()), 6); spire.translate(0, H + H * 0.09, 0); parts.push(tint(spire, '#c9ccd1'));
      return merge(parts);
    }
    case 'planet': {
      const parts = [jitter(new THREE.SphereGeometry(p.radius, 64, 40), 0.03, p.seed)]; parts[0].translate(0, p.radius, 0); tint(parts[0], '#ffffff');
      if (p.ring) { const ring = new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.2, 96); ring.rotateX(-Math.PI / 2 + 0.4); ring.translate(0, p.radius, 0); parts.push(tint(ring, '#e8dccb')); }
      return merge(parts);
    }
    case 'island': {
      const n = makeNoise(p.seed), top = new THREE.CircleGeometry(p.radius, 64, 0, Math.PI * 2); top.rotateX(-Math.PI / 2);
      const tp = top.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i), d = Math.hypot(x, z) / p.radius; tp.setY(i, (n(x * 0.08, z * 0.08) * 0.5 + 0.5) * p.radius * 0.25 * (1 - d * d)); }
      tint(top, '#ffffff');
      const under = new THREE.ConeGeometry(p.radius, p.depth, 64, 8, true); under.rotateX(Math.PI); under.translate(0, -p.depth / 2, 0);
      const up = under.attributes.position; for (let i = 0; i < up.count; i++) { const x = up.getX(i), y = up.getY(i), z = up.getZ(i); const k = 1 + n(x * 0.12 + 5, y * 0.15) * 0.25; up.setXYZ(i, x * k, y * (1 + Math.max(0, n(x * 0.3, z * 0.3)) * 0.6), z * k); }
      tint(under, '#7a6a58');
      const g = merge([top, under]); g.translate(0, p.depth, 0); return g;
    }
    case 'arch': {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-p.span / 2, 0, 0), new THREE.Vector3(-p.span / 2.4, p.height * 0.7, 0), new THREE.Vector3(0, p.height, 0), new THREE.Vector3(p.span / 2.4, p.height * 0.7, 0), new THREE.Vector3(p.span / 2, 0, 0)]);
      return jitter(new THREE.TubeGeometry(curve, 64, p.thickness, 12), 0.18, p.seed);
    }
    case 'sculpture': {
      const g = new THREE.CylinderGeometry(p.width * 0.6, p.width, p.height, Math.max(3, Math.round(p.sides)), 60); const pp = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const t = (v.y / p.height + 0.5); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), t * p.twist); v.x *= 1 + 0.25 * Math.sin(t * Math.PI * 2); v.z *= 1 + 0.25 * Math.sin(t * Math.PI * 2); pp.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); g.translate(0, p.height / 2, 0); return g;
    }
    case 'chair': {
      const w = 0.5 * p.width, h = p.height, parts = [];
      const seat = new RoundedBoxGeometry(w, 0.06, w, 2, 0.02); seat.translate(0, 0.46 * h, 0); parts.push(seat);
      const back = new RoundedBoxGeometry(w, 0.5 * h, 0.05, 2, 0.02); back.translate(0, 0.72 * h, -w / 2); parts.push(back);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.CylinderGeometry(0.02, 0.02, 0.46 * h, 8); l.translate(x * w * 0.42, 0.23 * h, z * w * 0.42); parts.push(l); }
      return merge(parts);
    }
    case 'table': {
      const parts = [], top = new RoundedBoxGeometry(p.width, 0.06, p.depth, 2, 0.02); top.translate(0, p.height * 0.47, 0); parts.push(top);
      const leg = new THREE.CylinderGeometry(0.05, 0.08, p.height * 0.46, 12); leg.translate(0, p.height * 0.23, 0); parts.push(leg);
      const foot = new THREE.CylinderGeometry(p.depth * 0.3, p.depth * 0.32, 0.03, 32); foot.translate(0, 0.015, 0); parts.push(foot);
      return merge(parts);
    }
    default: { const g = new THREE.BoxGeometry(2, 2, 2); g.translate(0, 1, 0); return g; }
  }
}

/* ── scatter: instanced vegetation & props placed by height / slope rules ── */
export const SCATTER = {
  trees: { label: 'Trees', type: 'tree', p: { height: 12, crown: 4, kind: 0, seed: 1 }, color: '#3f6b2a', minH: 0.02, maxH: 0.7, slope: 0.75, scale: [0.6, 1.4] },
  rocks: { label: 'Rocks', type: 'rock', p: { size: 2.2, roughness: 0.55, seed: 3 }, color: '#7a7268', minH: -1, maxH: 2, slope: 0, scale: [0.4, 2.2] },
  crystals: { label: 'Crystals', type: 'crystal', p: { height: 6, count: 4, seed: 7 }, color: '#9ff5e8', minH: 0.05, maxH: 2, slope: 0.4, scale: [0.6, 2] },
  cacti: { label: 'Cacti', type: 'cylinder', p: { radius: 0.5, height: 5, sides: 8 }, color: '#4f7a3a', minH: 0, maxH: 2, slope: 0.85, scale: [0.6, 1.5] },
  spheres: { label: 'Chrome spheres', type: 'sphere', p: { radius: 6, detail: 48 }, color: '#e8ebee', minH: -1, maxH: 2, slope: 0, scale: [0.5, 2.2], chrome: true },
  monoliths: { label: 'Monoliths', type: 'monolith', p: { width: 4, height: 22, depth: 1.2 }, color: '#0c0c0d', minH: -1, maxH: 2, slope: 0, scale: [0.5, 1.6] },
  city: { label: 'Towers', type: 'building', p: { width: 14, depth: 14, floors: 18, floorHeight: 3.4, taper: 0.15, seed: 2 }, color: '#bfe0f0', minH: -1, maxH: 2, slope: 0, scale: [0.4, 2.6], grid: true, glass: true },
  floating: { label: 'Floating islands', type: 'island', p: { radius: 22, depth: 26, seed: 5 }, color: '#5f9a4a', minH: -1, maxH: 2, slope: 0, scale: [0.5, 1.4], float: true },
  arches: { label: 'Rock arches', type: 'arch', p: { span: 24, height: 18, thickness: 4.5, seed: 6 }, color: '#b86e42', minH: -1, maxH: 2, slope: 0, scale: [0.7, 1.5] },
};

/** InstancedMesh for one scatter layer, placed on the heightfield. */
export function buildScatter(key, count, h, n, size, waterLevel, seed = 1) {
  const S = SCATTER[key]; if (!S || !count) return null;
  const geo = objectGeometry(S.type, S.p);
  const mat = S.chrome ? makeMaterial({ preset: 'chrome', color: S.color }) : S.glass ? makeMaterial({ preset: 'glass', color: S.color, transmission: 0.6, roughness: 0.1 }) : new THREE.MeshStandardMaterial({ color: S.color, roughness: 0.85, vertexColors: !!geo.attributes.color, flatShading: S.type === 'rock' || S.type === 'crystal' });
  if (geo.attributes.color && !S.chrome && !S.glass) { recolor(geo, S.color); mat.color.set('#ffffff'); }
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = S.label;
  let lo = Infinity, hi = -Infinity; for (const v of h) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const r = rng(seed + key.length * 31), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  let placed = 0;
  const cell = size / (n - 1);
  for (let tries = 0; tries < count * 12 && placed < count; tries++) {
    let x, z;
    if (S.grid) { const g = Math.ceil(Math.sqrt(count)), gi = placed % g, gj = Math.floor(placed / g), step = size * 0.7 / g; x = (gi - g / 2 + 0.5) * step + (r() - 0.5) * step * 0.3; z = (gj - g / 2 + 0.5) * step + (r() - 0.5) * step * 0.3; }
    else { x = (r() - 0.5) * size * 0.94; z = (r() - 0.5) * size * 0.94; }
    const y = heightAt(h, n, size, x, z);
    const rel = (y - lo) / (hi - lo || 1);
    if (!S.float && !S.grid && (rel < S.minH || rel > S.maxH)) continue;
    if (!S.float && y < waterLevel + 0.5 && S.type !== 'rock' && S.type !== 'sphere' && S.type !== 'monolith') continue;
    if (S.slope) { const dx = heightAt(h, n, size, x + cell, z) - heightAt(h, n, size, x - cell, z), dz = heightAt(h, n, size, x, z + cell) - heightAt(h, n, size, x, z - cell); const ny = 1 / Math.hypot(dx / (2 * cell), dz / (2 * cell), 1); if (ny < S.slope) continue; }
    const k = S.scale[0] + r() * (S.scale[1] - S.scale[0]);
    if (S.grid) { const w = 0.35 + r() * 0.45; s.set(w, w * (0.6 + r() * 2.2), w); } else s.set(k, k, k);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), S.grid ? Math.round(r() * 4) * Math.PI / 2 : r() * Math.PI * 2);
    pos.set(x, S.float ? Math.max(y, waterLevel) + 40 + r() * 90 : y - 0.2, z);
    m.compose(pos, q, s); mesh.setMatrixAt(placed++, m);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
