// HATS: beanie, cap, bucket hat and balaclava, shaped on the same head as the couture masks.
// Distance-field shells (knit ribs, panel seams, brims), all sized by head circumference.
import * as THREE from 'three';
import { polygonize, sphere } from '../sculpt/sdf.js';
import { headSDF } from '../sculpt/couture.js';
import { geometryVolume } from '../jewellery/revolve.js';

const TEXTILES = ['knit_black', 'knit_grey', 'knit_cream', 'cotton', 'denim', 'nylon', 'leather_black'];

export const hat = {
  id: 'hat',
  label: 'Hats',
  category: 'wear',
  materials: TEXTILES,
  defaultMaterial: 'knit_black',
  minWall: 1,
  view: 'front',
  slow: true,
  engraveDefault: { side: 'front', y: -30, size: 28, depth: 1 },
  params: [
    { key: 'kind', type: 'select', label: 'Type', help: 'Beanie, cap, bucket hat or balaclava.', default: 'beanie', options: [['beanie', 'Beanie'], ['cap', 'Cap'], ['bucket', 'Bucket hat'], ['balaclava', 'Balaclava']] },
    { key: 'head', type: 'range', label: 'Head size', help: 'Around the head at the forehead. S 54–55, M 56–57, L 58–59, XL 60–61 cm.', min: 500, max: 640, step: 5, unit: 'mm', default: 570 },
    { key: 'slouch', type: 'range', show: (p) => p.kind === 'beanie', label: 'Slouch', help: 'Extra height for a loose, slouchy fit.', min: 0, max: 60, step: 1, unit: 'mm', default: 10 },
    { key: 'brim', type: 'range', show: (p) => p.kind === 'cap' || p.kind === 'bucket', label: 'Brim', help: 'How far the brim sticks out.', min: 30, max: 100, step: 1, unit: 'mm', default: 70 },
    { key: 'opening', type: 'select', show: (p) => p.kind === 'balaclava', label: 'Face opening', help: 'Just the eyes, eyes and mouth, or the whole face.', default: 'face', options: [['eyes', 'Eye slit'], ['three', 'Eyes + mouth'], ['face', 'Whole face']] },
    // more
    { key: 'cuff', type: 'toggle', more: true, show: (p) => p.kind === 'beanie', label: 'Turn-up cuff', help: 'A folded band at the bottom.', default: true },
    { key: 'ribs', type: 'toggle', more: true, show: (p) => p.kind === 'beanie' || p.kind === 'balaclava', label: 'Rib knit', help: 'Vertical knit ribs.', default: true },
    { key: 'pom', type: 'toggle', more: true, show: (p) => p.kind === 'beanie', label: 'Pom-pom', help: 'A ball on top.', default: false },
    { key: 'curve', type: 'range', more: true, show: (p) => p.kind === 'cap', label: 'Brim curve', help: 'Flat (snapback) to strongly curved.', min: 0, max: 100, step: 1, unit: '%', default: 55 },
    { key: 'droop', type: 'range', more: true, show: (p) => p.kind === 'bucket', label: 'Brim angle', help: 'How much the brim points down.', min: 0, max: 45, step: 1, unit: '°', default: 22 },
    { key: 'thick', type: 'range', more: true, label: 'Material thickness', help: 'Knit 3–5 mm, cotton 1.5–2 mm.', min: 1, max: 8, step: 0.5, unit: 'mm', default: 4 },
    { key: 'detail', type: 'select', more: true, label: 'Detail', help: 'Fine is smoother but slower.', default: 'normal', options: [['draft', 'Draft'], ['normal', 'Normal'], ['fine', 'Fine']] },
  ],
  templates: [
    { label: 'Rib beanie', p: { kind: 'beanie', slouch: 8, cuff: true, ribs: true, pom: false, thick: 4.5 } },
    { label: 'Slouch beanie', p: { kind: 'beanie', slouch: 45, cuff: false, ribs: true, thick: 4 } },
    { label: 'Pom beanie', p: { kind: 'beanie', slouch: 15, cuff: true, ribs: true, pom: true, thick: 4.5 } },
    { label: 'Cap', p: { kind: 'cap', brim: 72, curve: 60, thick: 2 } },
    { label: 'Snapback', p: { kind: 'cap', brim: 75, curve: 5, thick: 2 } },
    { label: 'Bucket hat', p: { kind: 'bucket', brim: 60, droop: 24, thick: 2 } },
    { label: 'Balaclava', p: { kind: 'balaclava', opening: 'face', ribs: true, thick: 4 } },
  ],

  build(p) {
    const s = p.head / 570;
    const base = headSDF(s);
    const t = p.thick, gap = 1.2;
    const sl = p.kind === 'beanie' ? p.slouch / (110 * s) : 0;
    const head = (x, y, z) => base(x, y > 0 ? y / (1 + sl * Math.min(1, y / (110 * s))) : y, z);
    const N = Math.round((p.head * 1.05) / 7); // ribs around
    const prims = [];
    const big = [-110 * s, -260 * s, -140 * s, 110 * s, 180 * s, 140 * s];
    const shell = (extra) => (x, y, z) => {
      const th = Math.atan2(x, z);
      let tt = t;
      if (p.ribs && (p.kind === 'beanie' || p.kind === 'balaclava')) tt += t * 0.32 * Math.max(0, Math.sin(th * N));
      if (p.kind === 'cap') tt -= Math.max(0, 1 - Math.abs(Math.sin(th * 3)) * 9) * t * 0.5; // 6 panel seams
      const e = extra ? extra(x, y, z, th) : 0;
      return Math.abs(head(x, y, z) - gap - (tt + e) / 2) - (tt + e) / 2;
    };
    let lower; // where the hat ends at the bottom
    if (p.kind === 'beanie') lower = (x, y, z) => 26 * s + 0.28 * z - y; // lower at the back (covers ears)
    else if (p.kind === 'cap' || p.kind === 'bucket') lower = (x, y, z) => 34 * s + 0.12 * z - y;
    else lower = () => -1; // balaclava: everything
    const cuff = p.kind === 'beanie' && p.cuff ? (x, y, z) => (y - (26 * s + 0.28 * z) < 45 * s ? t * 0.9 : 0) : null;
    prims.push({ d: (x, y, z) => Math.max(shell(cuff)(x, y, z), lower(x, y, z)), box: [-100 * s, -130 * s, -120 * s, 100 * s, 175 * s, 125 * s], k: 0, narrow: true });

    if (p.kind === 'beanie' && p.pom) {
      const top = 110 * s * (1 + sl) + 14 * s;
      prims.push({ ...sphere([0, top + 22 * s, -4 * s], 32 * s, { k: 6 }), d: (x, y, z) => Math.hypot(x, y - top - 22 * s, z + 4 * s) - 32 * s - 2.2 * Math.sin(x * 0.9) * Math.sin(y * 0.9) * Math.sin(z * 0.9) });
    }
    if (p.kind === 'cap') {
      // curved front brim
      const y0 = 33 * s, zf = 92 * s, w = 88 * s, L = p.brim, c = p.curve / 100;
      prims.push({ d: (x, y, z) => {
        const yc = 34 * s + 0.12 * zf + t * 0.3 - c * 22 * s * (x / w) ** 2 - 0.06 * (z - zf);
        const zz = (z - (zf - 30 * s)) / (L + 30 * s), xx = x / w;
        const e = Math.max(Math.hypot(xx, Math.max(0, zz)) - 1, -zz) * Math.min(w, L);
        return Math.max(Math.abs(y - yc) - t * 0.7, e);
      }, box: [-w - 5, y0 - 30 * s, zf - 40 * s, w + 5, y0 + 40 * s, zf + L + 10], k: 4 });
      prims.push(sphere([0, 112 * s, -6 * s], 7 * s, { k: 2 })); // button
    }
    if (p.kind === 'bucket') {
      const y0 = 34 * s + t * 0.3, a = (p.droop * Math.PI) / 180, W = p.brim;
      prims.push({ d: (x, y, z) => {
        const rho = (Math.hypot(x / (73 * s), z / (93 * s)) - 1) * 83 * s; // mm outside the crown edge
        const u = Math.max(0, Math.min(W, rho));
        const yy = y0 + 0.12 * z - u * Math.tan(a);
        return Math.max(Math.hypot(rho - u, y - yy) - t * 0.6, -rho - 12);
      }, box: [-73 * s - W - 5, y0 - W - 20, -93 * s - W - 5, 73 * s + W + 5, y0 + 30, 93 * s + W + 5], k: 3 });
      // flatter top
      prims.push({ sub: true, k: 4, d: (x, y, z) => -(y - 118 * s * (1 + 0)), box: [-100 * s, 115 * s, -120 * s, 100 * s, 140 * s, 120 * s] });
    }
    if (p.kind === 'balaclava') {
      // neck tube
      prims.push({ d: (x, y, z) => { const r = Math.hypot(x / 62, (z + 10 * s) / 66) * 64 * s; return Math.max(Math.abs(r - 64 * s - t / 2) - t / 2, y - -80 * s, -175 * s - y); }, box: [-80 * s, -180 * s, -90 * s, 80 * s, -70 * s, 75 * s], k: 8, narrow: true });
      const holes = p.opening === 'face' ? [[0, -5, 44, 66]] : p.opening === 'three' ? [[-30, 12, 18, 11], [30, 12, 18, 11], [0, -55, 22, 9]] : [[0, 12, 56, 12]];
      for (const [hx, hy, rx, ry] of holes) prims.push({ sub: true, k: 2, d: (x, y, z) => (Math.hypot((x - hx * s) / (rx * s), (y - hy * s) / (ry * s)) - 1) * Math.min(rx, ry) * s - Math.max(0, 20 * s - z) * 4, box: [(hx - rx) * s - 4, (hy - ry) * s - 4, 20 * s, (hx + rx) * s + 4, (hy + ry) * s + 4, 130 * s] });
    }
    const ribCell = (p.head * 1.05) / N / 3.2;
    const knit = p.ribs && (p.kind === 'beanie' || p.kind === 'balaclava');
    const cell = knit ? Math.min({ draft: 0.7, normal: 0.5, fine: 0.38 }[p.detail] * Math.max(t, 1.6), ribCell) : { draft: 1.0, normal: 0.75, fine: 0.55 }[p.detail] * Math.max(t, 1.6);
    const geometry = polygonize(prims, Math.min(420, Math.ceil(300 / cell)));
    geometry.computeBoundingBox();
    const sz = geometry.boundingBox.getSize(new THREE.Vector3());
    const size = p.head < 545 ? 'S' : p.head < 565 ? 'M' : p.head < 585 ? 'L' : p.head < 605 ? 'XL' : 'XXL';
    void big;
    return {
      parts: [{ geometry }], volume: geometryVolume(geometry), minWall: t,
      warnings: [],
      dims: [['Type', { beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', balaclava: 'Balaclava' }[p.kind]], ['Size', `${(p.head / 10).toFixed(1)} cm head · ${size}`], ['Outside', `${sz.x.toFixed(0)} × ${sz.y.toFixed(0)} × ${sz.z.toFixed(0)} mm`]],
      title: { beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', balaclava: 'Balaclava' }[p.kind],
    };
  },
};
