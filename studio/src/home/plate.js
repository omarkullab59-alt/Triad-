import * as THREE from 'three';
import { turn } from '../jewellery/solid.js';
import { geometryVolume } from '../jewellery/revolve.js';

const HOME_MATS = ['ceramic', 'stoneware', 'concrete', 'oak', 'walnut', 'steel', 'silver', 'brass', 'black'];

export const plate = {
  id: 'plate', label: 'Plate', category: 'home', view: 'top', materials: HOME_MATS, defaultMaterial: 'ceramic', minWall: 3,
  params: [
    { key: 'kind', type: 'select', label: 'Type', help: 'Flat plate with a rim, rimless “coupe”, or a deep pasta plate.', default: 'rim', options: [['rim', 'With rim'], ['coupe', 'Coupe (no rim)'], ['deep', 'Deep plate']] },
    { key: 'diameter', type: 'range', label: 'Diameter', help: 'Dinner plates are about 27 cm, side plates 20 cm.', min: 80, max: 400, step: 5, unit: 'mm', default: 270 },
    { key: 'height', type: 'range', label: 'Height', help: 'From the table to the top of the rim.', min: 10, max: 90, step: 1, unit: 'mm', default: 26 },
    { key: 'thick', type: 'range', label: 'Wall thickness', help: 'Ceramic needs 4–6 mm, metal 1.5 mm or more.', min: 1.5, max: 14, step: 0.5, unit: 'mm', default: 5 },
    { key: 'edge', type: 'select', label: 'Edge', help: 'Shape of the outer edge seen from above.', default: 'round', options: [['round', 'Round'], ['wave', 'Wavy'], ['peaks', 'TRIAD three peaks'], ['facet', 'Faceted']] },
    // more
    { key: 'rim', type: 'range', more: true, show: (p) => p.kind === 'rim', label: 'Rim width', help: 'Width of the flat outer ring.', min: 10, max: 80, step: 1, unit: 'mm', default: 36 },
    { key: 'foot', type: 'toggle', more: true, label: 'Foot ring', help: 'A small ring underneath so the plate stands steady.', default: true },
    { key: 'waves', type: 'range', more: true, show: (p) => p.edge === 'wave' || p.edge === 'facet', label: 'Number of waves / sides', help: 'How many waves or flat sides the edge has.', min: 3, max: 24, step: 1, unit: '', default: 9 },
  ],
  templates: [
    { label: 'Dinner plate', p: { kind: 'rim', diameter: 270, height: 26, thick: 5, edge: 'round' } },
    { label: 'Side plate', p: { kind: 'coupe', diameter: 200, height: 20, thick: 4.5, edge: 'round' } },
    { label: 'Pasta plate', p: { kind: 'deep', diameter: 240, height: 48, thick: 5, edge: 'round' } },
    { label: 'Wavy dessert', p: { kind: 'coupe', diameter: 190, height: 22, thick: 4.5, edge: 'wave', waves: 8 } },
    { label: 'TRIAD plate', p: { kind: 'rim', diameter: 260, height: 26, thick: 5, edge: 'peaks', accent: true } },
  ],
  build(p) {
    const R = p.diameter / 2, H = p.height, t = p.thick;
    const well = p.kind === 'rim' ? R - p.rim : p.kind === 'deep' ? R * 0.55 : R * 0.75;
    const footR = well * 0.72, footH = p.foot ? Math.min(4, H * 0.18) : 0;
    // outer (bottom) surface from the centre out to the edge, then the top surface back in
    const outer = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const r = (R * i) / n;
      let y;
      if (r <= well) y = footH + (p.kind === 'deep' ? (H - footH - t) * (r / well) ** 2 * 0.55 : 0);
      else {
        const k = (r - well) / (R - well);
        const yWell = footH + (p.kind === 'deep' ? (H - footH - t) * 0.55 : 0);
        y = yWell + (H - t - yWell) * (p.kind === 'rim' ? Math.min(1, k * 3) ** 0.7 : k ** 1.6);
      }
      outer.push([r, y]);
    }
    const prof = [[0, footH]];
    if (p.foot) prof.push([footR - 3, footH], [footR - 3, 0], [footR + 3, 0], [footR + 3, footH]);
    for (const [r, y] of outer) if (r > (p.foot ? footR + 3 : 0)) prof.push([r, y]);
    prof.push([R, outer[n][1] + t * 0.5]);
    for (let i = n; i >= 0; i--) { const [r, y] = outer[i]; prof.push([Math.max(0, r - t * 0.3 * (i / n)), y + t]); }
    const g = turn(prof.reverse(), 160);
    // edge shape seen from above
    if (p.edge !== 'round') {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
        if (r < well) continue;
        const a = Math.atan2(z, x);
        const k = (r - well) / (R - well);
        let s = 1;
        if (p.edge === 'wave') s = 1 + 0.035 * Math.sin(a * p.waves) * k;
        else if (p.edge === 'facet') { const seg = (2 * Math.PI) / p.waves; const d = ((a % seg) + seg) % seg - seg / 2; s = 1 - (1 - Math.cos(Math.PI / p.waves) / Math.cos(d)) * k; }
        else if (p.edge === 'peaks') { const d = Math.abs(((a + Math.PI / 2) % (2 * Math.PI / 3) + 2 * Math.PI / 3) % (2 * Math.PI / 3) - Math.PI / 3); s = 1 + 0.06 * Math.max(0, 1 - d / 0.22) * k; }
        pos.setX(i, x * s); pos.setZ(i, z * s);
      }
      g.computeVertexNormals();
    }
    const volume = geometryVolume(g);
    return {
      parts: [{ geometry: g }], volume, minWall: t,
      warnings: t < 3.5 ? ['Under 3.5 mm works in metal or wood, but ceramic plates chip easily.'] : [],
      dims: [['Plate', `Ø ${(p.diameter / 10).toFixed(1)} cm · ${p.height} mm high`], ['Wall', `${t} mm`], ['Well', `Ø ${(well * 2 / 10).toFixed(1)} cm`]],
      title: { rim: 'Plate', coupe: 'Coupe plate', deep: 'Deep plate' }[p.kind],
    };
  },
};
export { HOME_MATS };
