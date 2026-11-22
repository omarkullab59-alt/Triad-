import * as THREE from 'three';
import { turn } from '../jewellery/solid.js';
import { geometryVolume } from '../jewellery/revolve.js';
import { HOME_MATS } from './plate.js';

export const vessel = {
  id: 'vessel', label: 'Bowl / Cup / Vase', category: 'home', materials: HOME_MATS, defaultMaterial: 'stoneware', minWall: 3,
  params: [
    { key: 'kind', type: 'select', label: 'Type', help: 'Pick what it is. A cup or mug can get a handle.', default: 'bowl', options: [['bowl', 'Bowl'], ['cup', 'Cup'], ['mug', 'Mug'], ['vase', 'Vase']] },
    { key: 'diameter', type: 'range', label: 'Opening', help: 'Width at the top.', min: 30, max: 400, step: 1, unit: 'mm', default: 150 },
    { key: 'height', type: 'range', label: 'Height', help: 'From the table to the top edge.', min: 20, max: 500, step: 1, unit: 'mm', default: 70 },
    { key: 'belly', type: 'range', label: 'Belly', help: 'Negative pulls the middle in, positive makes it round and full.', min: -40, max: 60, step: 1, unit: '%', default: 10 },
    { key: 'thick', type: 'range', label: 'Wall thickness', help: 'Ceramic: 4–6 mm. Metal: 1–2 mm.', min: 1, max: 12, step: 0.5, unit: 'mm', default: 5 },
    // more
    { key: 'base', type: 'range', more: true, label: 'Base width', help: 'Width of the bottom compared with the opening.', min: 20, max: 120, step: 1, unit: '%', default: 50 },
    { key: 'handle', type: 'toggle', more: true, show: (p) => p.kind === 'cup' || p.kind === 'mug', label: 'Handle', help: 'Adds a handle on the side.', default: true },
    { key: 'neck', type: 'range', more: true, show: (p) => p.kind === 'vase', label: 'Neck', help: 'How narrow the top of the vase gets.', min: 0, max: 80, step: 1, unit: '%', default: 45 },
  ],
  templates: [
    { label: 'Rice bowl', p: { kind: 'bowl', diameter: 120, height: 65, belly: 15, base: 45, thick: 4.5 } },
    { label: 'Salad bowl', p: { kind: 'bowl', diameter: 260, height: 100, belly: 20, base: 40, thick: 6 } },
    { label: 'Espresso cup', p: { kind: 'cup', diameter: 62, height: 58, belly: 5, base: 70, thick: 4, handle: true } },
    { label: 'Mug', p: { kind: 'mug', diameter: 85, height: 95, belly: 0, base: 95, thick: 5, handle: true } },
    { label: 'Tall vase', p: { kind: 'vase', diameter: 110, height: 280, belly: 40, base: 70, neck: 55, thick: 5 } },
  ],
  build(p) {
    const Rt = p.diameter / 2, H = p.height, t = p.thick;
    const Rb = Rt * (p.base / 100);
    const n = 48;
    const radius = (k) => { // k: 0 bottom … 1 top
      let r = Rb + (Rt - Rb) * (p.kind === 'bowl' ? Math.sin((k * Math.PI) / 2) : k);
      r *= 1 + (p.belly / 100) * Math.sin(Math.PI * k) * 0.6;
      if (p.kind === 'vase') r *= 1 - (p.neck / 100) * 0.7 * Math.max(0, (k - 0.6) / 0.4) ** 1.2;
      return Math.max(t * 1.5, r);
    };
    const outer = Array.from({ length: n + 1 }, (_, i) => [radius(i / n), (H * i) / n]);
    const base = Math.max(t, 3);
    const prof = [[0, 0], ...outer, [outer[n][0] - t, H]];
    for (let i = n; i >= 0; i--) { const y = (H * i) / n; if (y < base) break; prof.push([Math.max(0.5, outer[i][0] - t), y]); }
    prof.push([0, base]);
    const parts = [{ geometry: turn(prof.reverse(), 128) }];
    let volume = geometryVolume(parts[0].geometry);
    if ((p.kind === 'cup' || p.kind === 'mug') && p.handle) {
      const y0 = H * 0.25, y1 = H * 0.78;
      const r0 = radius(0.25) - t * 0.5, r1 = radius(0.78) - t * 0.5;
      const out = Math.max(18, H * 0.3);
      const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(r0, y0, 0), new THREE.Vector3(r0 + out, y0 - 4, 0), new THREE.Vector3(r1 + out, y1 + 6, 0), new THREE.Vector3(r1, y1, 0));
      const rr = Math.max(3, t * 0.9);
      const tube = new THREE.TubeGeometry(curve, 40, rr, 14, false);
      const cap = (v) => new THREE.SphereGeometry(rr, 14, 10).translate(v.x, v.y, v.z);
      for (const g of [tube, cap(curve.v0), cap(curve.v3)]) parts.push({ geometry: g });
      volume += geometryVolume(tube) * 0.9;
    }
    const capacity = Math.PI * (radius(0.5) - t) ** 2 * (H - base) * 0.85 / 1000; // ml (rough)
    return {
      parts, volume, minWall: t,
      warnings: t < 3 ? ['Under 3 mm only works in metal; ceramic needs about 4 mm.'] : [],
      dims: [['Size', `Ø ${(p.diameter / 10).toFixed(1)} cm · ${(H / 10).toFixed(1)} cm high`], ['Holds', `≈ ${Math.round(capacity / 10) * 10} ml`], ['Wall', `${t} mm · base ${base} mm`]],
      title: { bowl: 'Bowl', cup: 'Cup', mug: 'Mug', vase: 'Vase' }[p.kind],
    };
  },
};
