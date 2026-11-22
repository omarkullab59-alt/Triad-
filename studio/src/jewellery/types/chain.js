import * as THREE from 'three';
import { finish, geometryVolume } from '../revolve.js';
import { MIN_WALL } from '../../lib/sizes.js';

const CLEAR = 0.3; // mm of play between links so a printed / cast chain moves

/** Centre line of one link in its own XY plane, long side along X. */
function linkPath(kind, L, W, n = 64) {
  const pts = [];
  if (kind === 'square') {
    const r = Math.min(L, W) * 0.3;
    const hx = L / 2 - r, hy = W / 2 - r;
    const per = 4 * (hx + hy) + 2 * Math.PI * r;
    for (let i = 0; i < n; i++) {
      let d = (i / n) * per;
      const segs = [
        [2 * hy, (t) => [L / 2, -hy + t]], [Math.PI * r / 2, (t) => { const a = t / r; return [hx + r * Math.cos(a), hy + r * Math.sin(a)]; }],
        [2 * hx, (t) => [hx - t, W / 2]], [Math.PI * r / 2, (t) => { const a = Math.PI / 2 + t / r; return [-hx + r * Math.cos(a), hy + r * Math.sin(a)]; }],
        [2 * hy, (t) => [-L / 2, hy - t]], [Math.PI * r / 2, (t) => { const a = Math.PI + t / r; return [-hx + r * Math.cos(a), -hy + r * Math.sin(a)]; }],
        [2 * hx, (t) => [-hx + t, -W / 2]], [Math.PI * r / 2, (t) => { const a = 1.5 * Math.PI + t / r; return [hx + r * Math.cos(a), -hy + r * Math.sin(a)]; }],
      ];
      for (const [len, f] of segs) { if (d <= len) { pts.push(f(d)); break; } d -= len; }
    }
    return pts;
  }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([(L / 2) * Math.cos(a), (W / 2) * Math.sin(a)]); }
  return pts;
}

/** Tube of radius r around a closed planar path. */
export function linkGeometry(kind, L, W, wire) {
  const c = linkPath(kind, L - wire, W - wire, 72);
  const n = c.length, m = 14, r = wire / 2;
  const pos = new Float32Array(n * m * 3);
  for (let i = 0; i < n; i++) {
    const a = c[(i - 1 + n) % n], b = c[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty, ny = -tx; // in-plane normal
    for (let j = 0; j < m; j++) {
      const phi = (j / m) * Math.PI * 2;
      const k = (i * m + j) * 3;
      pos[k] = c[i][0] + r * Math.cos(phi) * nx;
      pos[k + 1] = c[i][1] + r * Math.cos(phi) * ny;
      pos[k + 2] = r * Math.sin(phi);
    }
  }
  const idx = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * m + j, b = ((i + 1) % n) * m + j, cc = ((i + 1) % n) * m + ((j + 1) % m), d = i * m + ((j + 1) % m);
    idx.push(a, b, d, b, cc, d);
  }
  return finish(pos, idx);
}

export const chain = {
  id: 'chain',
  label: 'Chain',
  params: [
    { key: 'link', type: 'select', label: 'Link shape', help: 'The shape of each link.', default: 'oval', options: [['oval', 'Oval (anchor)'], ['round', 'Round'], ['square', 'Square (box)']] },
    { key: 'size', type: 'range', label: 'Link length', help: 'Outside length of one link.', min: 3, max: 30, step: 0.5, unit: 'mm', default: 8 },
    { key: 'wire', type: 'range', label: 'Wire thickness', help: 'Thickness of each link’s wire.', min: 0.6, max: 4, step: 0.1, unit: 'mm', default: 1.4 },
    { key: 'length', type: 'range', label: 'Chain length', help: 'Full length when closed. 45 cm sits at the collarbone.', min: 15, max: 90, step: 1, unit: 'cm', default: 45 },
    // more
    { key: 'ratio', type: 'range', more: true, show: (p) => p.link !== 'round', label: 'Link width', help: 'Width of a link compared with its length.', min: 0.45, max: 0.95, step: 0.01, unit: '×', default: 0.66 },
  ],
  templates: [
    { label: 'Fine anchor', p: { link: 'oval', size: 5, wire: 0.9, length: 45 } },
    { label: 'Bold anchor', p: { link: 'oval', size: 14, wire: 2.6, length: 50 } },
    { label: 'Rolo', p: { link: 'round', size: 6, wire: 1.4, length: 45 } },
    { label: 'Box links', p: { link: 'square', size: 10, wire: 1.8, length: 55, ratio: 0.8 } },
    { label: 'Bracelet', p: { link: 'oval', size: 9, wire: 1.8, length: 19 } },
  ],

  build(p) {
    const w = p.wire;
    const warnings = [];
    let L = p.size;
    const minL = 3 * w + 1.2;
    if (L < minL) { warnings.push(`Links shorter than ${minL.toFixed(1)} mm can’t hook into each other with this wire. Using ${minL.toFixed(1)} mm.`); L = minL; }
    let W = p.link === 'round' ? L : L * p.ratio;
    if (W < 3 * w + CLEAR * 2) W = 3 * w + CLEAR * 2;
    const pitch = L - 2 * w - CLEAR; // centre-to-centre distance of interlocked links
    const n = Math.max(6, Math.round((p.length * 10) / pitch));
    const geometry = linkGeometry(p.link, L, W, w);
    const Rc = (n * pitch) / (2 * Math.PI);
    const instances = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const t = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
      const z = i % 2 ? new THREE.Vector3(Math.cos(a), Math.sin(a), 0) : new THREE.Vector3(0, 0, 1);
      const y = new THREE.Vector3().crossVectors(z, t);
      m.makeBasis(t, y, z).setPosition(Rc * Math.cos(a), Rc * Math.sin(a), 0);
      instances.push(m.clone());
    }
    const volume = geometryVolume(geometry) * n;
    if (w < MIN_WALL) warnings.push(`Wire ${w} mm is below ${MIN_WALL} mm and may break when cast.`);
    return {
      parts: [{ geometry, instances }], volume, minWall: w, warnings,
      dims: [
        ['Link', `${L.toFixed(1)} × ${W.toFixed(1)} mm · wire ${w} mm`],
        ['Chain', `${((n * pitch) / 10).toFixed(1)} cm · ${n} links`],
      ],
      title: 'Chain',
    };
  },
};
