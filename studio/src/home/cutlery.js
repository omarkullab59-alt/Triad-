import * as THREE from 'three';
import { extrude, deform } from '../jewellery/solid.js';
import { geometryVolume } from '../jewellery/revolve.js';

const MATS = ['steel', 'silver', 'brass', 'black', 'oak', 'walnut'];

/** Top view outline of one piece, lying along +X from 0 (handle end) to L (tip). */
function outline(kind, p) {
  const L = p.length, hw = p.handle / 2;
  const headL = kind === 'knife' ? L * 0.42 : kind === 'fork' ? L * 0.3 : L * 0.3;
  const neck = L - headL;
  const s = new THREE.Shape();
  // handle (bottom edge from end to neck)
  const endR = p.style === 'round' ? hw : hw * 0.35;
  const handleW = (x) => (p.style === 'taper' ? hw * (0.7 + 0.3 * (1 - x / neck)) : hw) * (x > neck * 0.8 ? 1 - 0.55 * ((x - neck * 0.8) / (neck * 0.2)) : 1);
  s.moveTo(endR, -handleW(0));
  for (let i = 1; i <= 20; i++) { const x = endR + ((neck - endR) * i) / 20; s.lineTo(x, -handleW(x)); }
  const nw = handleW(neck);
  if (kind === 'spoon') {
    const bw = Math.max(hw * 1.9, 16), bl = headL;
    const cx = neck + bl / 2 - 2, a = bl / 2 + 2, b = bw / 2;
    const phi = Math.asin(Math.min(0.95, nw / b));
    for (let i = 0; i <= 48; i++) { const t = -Math.PI + phi + ((2 * Math.PI - 2 * phi) * i) / 48; s.lineTo(cx + a * Math.cos(t), b * Math.sin(t)); }
  } else if (kind === 'fork') {
    const bw = Math.max(hw * 1.7, 18), tips = Math.round(p.tines), slot = Math.max(1.2, (bw / tips) * 0.38), tw = (bw - slot * (tips - 1)) / tips;
    const tineStart = neck + headL * 0.42;
    s.lineTo(neck + headL * 0.12, -bw / 2);
    for (let k = 0; k < tips; k++) {
      const y0 = -bw / 2 + k * (tw + slot);
      s.lineTo(L - (k === 0 || k === tips - 1 ? 2 : 0), y0);
      s.lineTo(L, y0 + tw * 0.5);
      s.lineTo(L - (k === 0 || k === tips - 1 ? 2 : 0), y0 + tw);
      if (k < tips - 1) { s.lineTo(tineStart, y0 + tw); s.lineTo(tineStart, y0 + tw + slot); }
    }
    s.lineTo(neck + headL * 0.12, bw / 2);
    s.lineTo(neck, nw);
  } else { // knife
    const bw = Math.max(hw * 1.5, 16);
    s.lineTo(neck + 4, -bw * 0.45);
    s.lineTo(L - bw * 0.5, -bw * 0.5);
    s.quadraticCurveTo(L, -bw * 0.4, L, bw * 0.1);
    s.lineTo(neck + 4, bw * 0.45);
    s.lineTo(neck, nw);
  }
  for (let i = 20; i >= 1; i--) { const x = endR + ((neck - endR) * i) / 20; s.lineTo(x, handleW(x)); }
  if (p.style === 'peaks') { // TRIAD three peaks at the handle end
    s.lineTo(endR, hw); s.lineTo(-hw * 0.5, hw * 0.55); s.lineTo(endR * 0.6, hw * 0.2); s.lineTo(-hw * 0.9, 0); s.lineTo(endR * 0.6, -hw * 0.2); s.lineTo(-hw * 0.5, -hw * 0.55);
  } else s.absarc(endR, 0, hw * (p.style === 'round' ? 1 : 0.999), Math.PI / 2, -Math.PI / 2, false);
  return { shape: s, neck, headL };
}

function piece(kind, p) {
  const { shape, neck, headL } = outline(kind, p);
  let g = extrude(shape, p.thick, { bevel: Math.min(0.5, p.thick / 4), accentFaces: false, curveSegments: 16 });
  // accent: the handle faces (lime enamel inlay)
  const L = p.length;
  const bend = (p.bend * Math.PI) / 180;
  g = deform(g, Math.max(1.2, p.handle / 6), ([x, y, z]) => {
    let zz = z;
    if (kind === 'spoon') { // bowl
      const cx = neck + headL / 2, a = headL / 2 - 1, b = Math.max(p.handle * 0.95, 8) * 0.9;
      const q = 1 - ((x - cx) / a) ** 2 - (y / b) ** 2;
      if (q > 0) zz -= Math.min(headL * 0.16, 9) * q;
    }
    if (kind === 'knife' && x > neck + 4) zz *= 1 - 0.65 * Math.max(0, -y / (p.handle * 0.8)); // thinner towards the edge
    // gentle S-bend: handle tips up, head down
    const k = x / L;
    zz += Math.sin(bend) * L * 0.18 * (Math.sin(Math.PI * (k - 0.5)) * 0.5);
    return [x - L / 2, y, zz];
  });
  return g;
}

export const cutlery = {
  id: 'cutlery', label: 'Cutlery', category: 'home', view: 'top', materials: MATS, defaultMaterial: 'steel', minWall: 1.5,
  params: [
    { key: 'kind', type: 'select', label: 'Piece', help: 'One piece, or a set of fork, knife and spoon.', default: 'set', options: [['set', 'Set of 3'], ['fork', 'Fork'], ['knife', 'Knife'], ['spoon', 'Spoon']] },
    { key: 'length', type: 'range', label: 'Length', help: 'Dinner cutlery is about 20 cm, dessert 17 cm.', min: 100, max: 280, step: 1, unit: 'mm', default: 200 },
    { key: 'handle', type: 'range', label: 'Handle width', help: 'How wide the handle is.', min: 6, max: 24, step: 0.5, unit: 'mm', default: 12 },
    { key: 'thick', type: 'range', label: 'Thickness', help: 'Metal: 2–3 mm. Wood: 5 mm or more.', min: 1.2, max: 8, step: 0.1, unit: 'mm', default: 2.6 },
    { key: 'style', type: 'select', label: 'Handle end', help: 'The shape at the end of the handle.', default: 'round', options: [['round', 'Round'], ['taper', 'Tapered'], ['peaks', 'TRIAD three peaks']] },
    // more
    { key: 'tines', type: 'range', more: true, label: 'Fork tines', help: 'How many points the fork has.', min: 2, max: 5, step: 1, unit: '', default: 4 },
    { key: 'bend', type: 'range', more: true, label: 'Bend', help: 'Curves the piece gently from the side.', min: 0, max: 25, step: 1, unit: '°', default: 10 },
  ],
  templates: [
    { label: 'Dinner set', p: { kind: 'set', length: 205, handle: 12, thick: 2.6, style: 'round' } },
    { label: 'TRIAD set', p: { kind: 'set', length: 205, handle: 13, thick: 2.8, style: 'peaks' } },
    { label: 'Dessert spoon', p: { kind: 'spoon', length: 170, handle: 10, thick: 2.2, style: 'taper' } },
    { label: 'Wooden spoon', p: { kind: 'spoon', length: 260, handle: 18, thick: 7, style: 'round', bend: 4 } },
  ],
  build(p) {
    const kinds = p.kind === 'set' ? ['fork', 'knife', 'spoon'] : [p.kind];
    const parts = []; let volume = 0;
    kinds.forEach((k, i) => {
      const g = piece(k, p);
      g.translate(0, (i - (kinds.length - 1) / 2) * (p.handle * 2.8 + 12), 0);
      g.rotateX(-Math.PI / 2);
      parts.push({ geometry: g });
      volume += geometryVolume(g);
    });
    return {
      parts, volume, minWall: p.thick * (kinds.includes('knife') ? 0.35 : 1),
      warnings: p.thick < 1.5 ? ['Under 1.5 mm cutlery bends in use.'] : [],
      dims: [['Pieces', kinds.join(', ')], ['Length', `${(p.length / 10).toFixed(1)} cm`], ['Handle', `${p.handle} mm wide · ${p.thick} mm thick`]],
      title: p.kind === 'set' ? 'Cutlery set' : kinds[0][0].toUpperCase() + kinds[0].slice(1),
    };
  },
};
