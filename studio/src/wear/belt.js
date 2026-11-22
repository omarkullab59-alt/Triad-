// BELT: a strap with holes and tip (lying flat, true to size — also a cutting template for leather)
// plus a buckle as its own 3D part (cast or 3D-printed metal).
import * as THREE from 'three';
import { geometryVolume } from '../jewellery/revolve.js';
import { extrude } from '../jewellery/solid.js';
import { METALS } from '../lib/sizes.js';

const STRAPS = ['leather_black', 'leather_brown', 'nylon', 'denim', 'cotton'];

/** Strap outline (mm), lying along +x from the buckle end (x = 0) to the tip. */
function strapOutline(p) {
  const W = p.width, L = p.length;
  const s = new THREE.Shape();
  const tip = Math.min(W * 0.6, 40);
  s.moveTo(0, -W / 2);
  s.lineTo(L - tip, -W / 2);
  if (p.tip === 'pointed') { s.lineTo(L, 0); s.lineTo(L - tip, W / 2); }
  else if (p.tip === 'square') { s.lineTo(L - 4, -W / 2); s.quadraticCurveTo(L, -W / 2, L, -W / 2 + 4); s.lineTo(L, W / 2 - 4); s.quadraticCurveTo(L, W / 2, L - 4, W / 2); s.lineTo(L - tip, W / 2); }
  else { s.absarc(L - W / 2, 0, W / 2, -Math.PI / 2, Math.PI / 2, false); if (L - W / 2 > L - tip) s.lineTo(L - tip, W / 2); }
  s.lineTo(0, W / 2);
  s.closePath();
  // holes: the middle hole sits at the waist size, measured from the buckle prong (x = 20)
  const holes = [];
  for (let i = 0; i < p.holes; i++) {
    const x = 20 + p.waist * 10 + (i - (p.holes - 1) / 2) * p.spacing;
    if (x > L - 15) continue;
    const h = new THREE.Path(); h.absarc(x, 0, p.hole / 2, 0, Math.PI * 2, true); s.holes.push(h); holes.push(x);
  }
  // fold for the buckle
  const slot = new THREE.Path(); slot.moveTo(12, -2.5); slot.lineTo(28, -2.5); slot.lineTo(28, 2.5); slot.lineTo(12, 2.5); slot.closePath(); s.holes.push(slot);
  return { shape: s, holes };
}

function buckle(p) {
  const W = p.width, bar = Math.max(3.5, W * 0.12), gap = 2;
  const H = W + 2 * gap + 2 * bar; // across the strap
  const D = Math.max(W * 0.75, 28) + 2 * bar; // along the strap
  const t = p.bthick;
  const parts = [];
  const frame = new THREE.Shape();
  const ring = (w, h, r) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return sh; };
  const hole = (sh) => { const h = new THREE.Path(sh.getPoints(8)); return h; };
  let shape;
  if (p.buckle === 'plate') shape = ring(D * 1.15, H, 6);
  else if (p.buckle === 'round') { shape = new THREE.Shape(); shape.absarc(0, 0, H / 2, 0, Math.PI * 2); const h = new THREE.Path(); h.absarc(0, 0, H / 2 - bar, 0, Math.PI * 2, true); shape.holes.push(h); }
  else if (p.buckle === 'triad') {
    shape = new THREE.Shape(); const R = H * 0.62; for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i * 2 * Math.PI) / 3; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.8 + R * 0.15, Math.sin(a) * R); } shape.closePath();
    const h = new THREE.Path(); const r = R - bar * 2.2; for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i * 2 * Math.PI) / 3; h[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.8 + R * 0.15, Math.sin(a) * r); } h.closePath(); shape.holes.push(h);
  } else { shape = ring(D, H, Math.min(8, bar * 2)); shape.holes.push(hole(ring(D - 2 * bar, H - 2 * bar, Math.max(1, bar)))); }
  const g = extrude(shape, t, { bevel: Math.min(0.8, t / 4) });
  for (const gr of g.groups) gr.materialIndex = 1;
  g.rotateX(-Math.PI / 2);
  g.translate(20, p.thick + t / 2 - 0.2, 0);
  parts.push(g);
  if (p.buckle !== 'plate') { // prong lying over the strap
    const prong = new THREE.CylinderGeometry(bar * 0.35, bar * 0.35, D / 2 + bar, 16);
    prong.rotateZ(Math.PI / 2); prong.translate(20 + D / 4 - bar / 2, p.thick + bar * 0.35, 0);
    for (const gr of prong.groups) gr.materialIndex = 1; prong.userData.groups = true;
    parts.push(prong);
  }
  return { parts, D, H };
}

export const belt = {
  id: 'belt',
  label: 'Belt',
  category: 'wear',
  view: 'top',
  materials: STRAPS,
  defaultMaterial: 'leather_black',
  partMaterialParam: 'bmetal',
  minWall: 1.5,
  params: [
    { key: 'waist', type: 'range', label: 'Waist', help: 'Around your waist where the belt sits (or the trouser size in cm).', min: 55, max: 140, step: 1, unit: 'cm', default: 85 },
    { key: 'width', type: 'range', label: 'Width', help: 'Jeans belts: 38–40 mm. Dress belts: 30–35 mm.', min: 15, max: 70, step: 1, unit: 'mm', default: 38 },
    { key: 'buckle', type: 'select', label: 'Buckle', help: 'Frame with a prong, a flat plate you can engrave, round, or the TRIAD triangle.', default: 'frame', options: [['frame', 'Frame'], ['plate', 'Plate'], ['round', 'Round'], ['triad', 'TRIAD triangle']] },
    { key: 'bmetal', type: 'select', label: 'Buckle metal', help: 'The metal of the buckle.', default: 'silver', options: Object.entries(METALS).map(([k, m]) => [k, m.label]) },
    { key: 'tip', type: 'select', label: 'Tip', help: 'Shape of the end.', default: 'round', options: [['round', 'Round'], ['pointed', 'Pointed'], ['square', 'Square']] },
    // more
    { key: 'holes', type: 'range', more: true, label: 'Holes', help: 'How many holes.', min: 1, max: 9, step: 1, unit: '', default: 5 },
    { key: 'spacing', type: 'range', more: true, label: 'Hole spacing', help: 'Distance between holes. 25 mm is usual.', min: 15, max: 40, step: 1, unit: 'mm', default: 25 },
    { key: 'hole', type: 'range', more: true, label: 'Hole size', help: 'Diameter of a hole.', min: 3, max: 8, step: 0.5, unit: 'mm', default: 4.5 },
    { key: 'thick', type: 'range', more: true, label: 'Strap thickness', help: 'Leather 3–4.5 mm, webbing 1.5–2 mm.', min: 1, max: 6, step: 0.1, unit: 'mm', default: 3.6 },
    { key: 'bthick', type: 'range', more: true, label: 'Buckle thickness', help: 'Thickness of the buckle metal.', min: 2, max: 8, step: 0.5, unit: 'mm', default: 4 },
  ],
  templates: [
    { label: 'Jeans belt', p: { width: 40, buckle: 'frame', tip: 'round', bmetal: 'silver' } },
    { label: 'Plate buckle', p: { width: 40, buckle: 'plate', tip: 'square', bmetal: 'chrome' } },
    { label: 'TRIAD belt', p: { width: 38, buckle: 'triad', tip: 'pointed', bmetal: 'black', accent: true } },
    { label: 'Thin waist belt', p: { width: 20, buckle: 'round', tip: 'round', bmetal: 'gold' } },
  ],

  build(p) {
    const length = p.waist * 10 + 20 + ((p.holes - 1) / 2) * p.spacing + 160;
    const q = { ...p, length };
    const { shape, holes } = strapOutline(q);
    const strap = extrude(shape, p.thick, { bevel: Math.min(0.5, p.thick / 5), curveSegments: 16 });
    for (const gr of strap.groups) gr.materialIndex = 0;
    strap.rotateX(-Math.PI / 2);
    strap.translate(0, p.thick / 2, 0);
    const b = buckle(p);
    const parts = [{ geometry: strap }, ...b.parts.map((geometry) => ({ geometry }))];
    const volume = geometryVolume(strap);
    const buckleGrams = (b.parts.reduce((s, g) => s + geometryVolume(g), 0) / 1000) * METALS[p.bmetal].density;
    // cutting template (SVG, 1:1 in mm) for the strap
    const svg = () => {
      const pts = shape.getPoints(24).map((v) => `${v.x.toFixed(2)},${(-v.y).toFixed(2)}`).join(' ');
      const hs = shape.holes.map((h) => `<polygon points="${h.getPoints(16).map((v) => `${v.x.toFixed(2)},${(-v.y).toFixed(2)}`).join(' ')}"/>`).join('');
      const W = length + 20, H = p.width + 30;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="-10 ${-p.width / 2 - 15} ${W} ${H}"><g fill="none" stroke="#000" stroke-width="0.3"><polygon points="${pts}"/>${hs}</g><text x="0" y="${p.width / 2 + 10}" font-family="sans-serif" font-size="5">TRIAD Studio belt · ${p.waist} cm · ${p.width} mm · 1:1 (print at 100 %)</text></svg>`;
    };
    return {
      parts, volume, minWall: p.thick,
      warnings: p.thick < 2.5 && /leather/.test(p.mat || '') ? ['Leather under 2.5 mm stretches; fine for webbing.'] : [],
      dims: [['Waist', `${p.waist} cm (middle hole)`], ['Strap', `${(length / 10).toFixed(1)} cm long · ${p.width} mm wide · ${p.thick} mm`], ['Holes', `${holes.length} × Ø ${p.hole} mm, ${p.spacing} mm apart`], ['Buckle', `${b.D.toFixed(0)} × ${b.H.toFixed(0)} mm · ≈ ${buckleGrams.toFixed(0)} g ${METALS[p.bmetal].label}`]],
      title: 'Belt',
      downloads: [{ label: 'Cutting template (SVG, 1:1)', small: 'for leather or webbing', filename: 'belt-cutting-template.svg', make: () => new Blob([svg()], { type: 'image/svg+xml' }) }],
    };
  },
};
