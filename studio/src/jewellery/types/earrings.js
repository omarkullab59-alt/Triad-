import * as THREE from 'three';
import { revolve, makeProfile, geometryVolume } from '../revolve.js';
import { MIN_WALL } from '../../lib/sizes.js';
import { outlineFromPixels } from '../outline.js';
import { pixelShapesToThree } from '../solid.js';

const TOP = -Math.PI / 2;

function studShape(kind, s) {
  const h = s / 2;
  const sh = new THREE.Shape();
  if (kind === 'round') sh.absarc(0, 0, h, 0, Math.PI * 2, false);
  else if (kind === 'square') {
    const r = s * 0.15;
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h);
    sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
  } else if (kind === 'triangle') {
    sh.moveTo(0, h); sh.lineTo(h, -h * 0.75); sh.lineTo(-h, -h * 0.75); sh.closePath();
  } else if (kind === 'peaks') {
    // TRIAD three peaks on a base bar
    sh.moveTo(-h, -h * 0.6); sh.lineTo(-h * 0.62, h * 0.45); sh.lineTo(-h * 0.3, -h * 0.1); sh.lineTo(0, h);
    sh.lineTo(h * 0.3, -h * 0.1); sh.lineTo(h * 0.62, h * 0.45); sh.lineTo(h, -h * 0.6); sh.closePath();
  } else { // drop
    sh.moveTo(0, h); sh.bezierCurveTo(h * 0.3, h * 0.4, h * 0.75, 0, h * 0.75, -h * 0.3);
    sh.absarc(0, -h * 0.3, h * 0.75, 0, -Math.PI, true); sh.bezierCurveTo(-h * 0.75, 0, -h * 0.3, h * 0.4, 0, h);
  }
  return sh;
}

export const earrings = {
  id: 'earrings',
  label: 'Earrings',
  params: [
    { key: 'kind', type: 'select', label: 'Type', help: 'Studs sit on the earlobe. Hoops (creoles) hang through it.', default: 'hoop', options: [['hoop', 'Hoops (creoles)'], ['stud', 'Studs']] },
    { key: 'diameter', type: 'range', show: (p) => p.kind === 'hoop', label: 'Hoop diameter', help: 'Outside width of each hoop.', min: 8, max: 70, step: 0.5, unit: 'mm', default: 22 },
    { key: 'wire', type: 'range', show: (p) => p.kind === 'hoop', label: 'Wire thickness', help: 'How thick the hoop is. 1.5–3 mm looks bold.', min: 0.6, max: 5, step: 0.1, unit: 'mm', default: 2 },
    { key: 'profile', type: 'select', show: (p) => p.kind === 'hoop', label: 'Wire shape', help: 'Round wire or a flat band.', default: 'round', options: [['round', 'Round'], ['flat', 'Flat band'], ['d', 'D-shape']] },
    { key: 'band', type: 'range', more: true, show: (p) => p.kind === 'hoop' && p.profile !== 'round', label: 'Band width', help: 'Width of the flat band, seen from the front.', min: 1, max: 10, step: 0.1, unit: 'mm', default: 3 },
    { key: 'shape', type: 'select', show: (p) => p.kind === 'stud', label: 'Stud shape', help: 'The front you see on the ear.', default: 'peaks', options: [['peaks', 'TRIAD three peaks'], ['round', 'Round'], ['square', 'Square'], ['triangle', 'Triangle'], ['drop', 'Drop'], ['mine', 'My symbol']] },
    { key: 'sym', type: 'symbol', show: (p) => p.kind === 'stud' && p.shape === 'mine', label: 'Which symbol', help: 'Pick one of your symbols (make them in “Symbol”).', default: '' },
    { key: 'size', type: 'range', show: (p) => p.kind === 'stud', label: 'Stud size', help: 'Width of the front.', min: 3, max: 18, step: 0.5, unit: 'mm', default: 8 },
    { key: 'sthick', type: 'range', show: (p) => p.kind === 'stud', label: 'Stud thickness', help: 'Thickness of the front plate.', min: 0.6, max: 4, step: 0.1, unit: 'mm', default: 1.4 },
    { key: 'pair', type: 'toggle', label: 'Make a pair', help: 'Shows and exports two earrings.', default: true },
    // more
    { key: 'gap', type: 'range', more: true, show: (p) => p.kind === 'hoop', label: 'Opening', help: 'Small gap at the top for the ear. Your jeweller adds the clasp.', min: 0, max: 4, step: 0.1, unit: 'mm', default: 1.2 },
    { key: 'post', type: 'range', more: true, show: (p) => p.kind === 'stud', label: 'Post length', help: 'The pin that goes through the ear. 10 mm is standard.', min: 7, max: 13, step: 0.5, unit: 'mm', default: 10 },
    { key: 'postD', type: 'range', more: true, show: (p) => p.kind === 'stud', label: 'Post thickness', help: 'Standard ear posts are 0.8 mm.', min: 0.6, max: 1.2, step: 0.05, unit: 'mm', default: 0.8 },
  ],
  templates: [
    { label: 'Classic hoops', p: { kind: 'hoop', diameter: 22, wire: 2, profile: 'round' } },
    { label: 'Big creoles', p: { kind: 'hoop', diameter: 45, wire: 2.5, profile: 'round' } },
    { label: 'Flat hoops', p: { kind: 'hoop', diameter: 26, wire: 1.4, profile: 'flat', band: 4 } },
    { label: 'Huggies', p: { kind: 'hoop', diameter: 12, wire: 2.4, profile: 'd', band: 3 } },
    { label: 'TRIAD studs', p: { kind: 'stud', shape: 'peaks', size: 9, sthick: 1.4, accent: true } },
    { label: 'Round studs', p: { kind: 'stud', shape: 'round', size: 6, sthick: 1.6 } },
  ],

  build(p, ctx = {}) {
    const parts = [];
    let one = 0, width = 0, minWall, dims;
    if (p.kind === 'hoop') {
      const T = p.wire;
      const W = p.profile === 'round' ? T : p.band;
      const rIn = p.diameter / 2 - T;
      const gapA = p.gap > 0 ? 2 * Math.asin(Math.min(0.9, p.gap / 2 / Math.max(rIn, 1))) : 0;
      const profile = makeProfile(p.profile, W, T, { innerStep: 0.5, outerStep: 0.5 });
      const g = revolve({ profile, rx: rIn, segments: 160, start: TOP + gapA / 2, end: TOP + Math.PI * 2 - gapA / 2 });
      g.rotateX(Math.PI / 2);
      parts.push({ geometry: g });
      one = geometryVolume(g);
      width = p.diameter;
      minWall = Math.min(T, W);
      dims = [['Hoop', `Ø ${p.diameter} mm outside · ${W === T ? `${T} mm wire` : `${W} × ${T} mm band`}`], ['Opening', p.gap > 0 ? `${p.gap} mm` : 'closed']];
    } else {
      let shapeIn = studShape(p.shape === 'mine' ? 'round' : p.shape, p.size);
      if (p.shape === 'mine' && ctx.symbolPixels?.(p.sym)) {
        const res = outlineFromPixels(ctx.symbolPixels(p.sym), { threshold: 128, bold: 1 });
        if (res.shapes.length) shapeIn = pixelShapesToThree(res.shapes, res.box, p.size).shapes;
      }
      const front = new THREE.ExtrudeGeometry(shapeIn, {
        depth: Math.max(0.05, p.sthick - 0.3), bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelOffset: -0.15, bevelSegments: 2, curveSegments: 24,
      });
      for (const gr of front.groups) gr.materialIndex = gr.materialIndex === 0 ? 1 : 0;
      front.userData.groups = true;
      front.computeVertexNormals();
      const post = new THREE.CylinderGeometry(p.postD / 2, p.postD / 2, p.post + 0.3, 20);
      post.rotateX(Math.PI / 2);
      post.translate(0, 0, -p.post / 2);
      parts.push({ geometry: front }, { geometry: post });
      one = geometryVolume(front) + geometryVolume(post);
      width = p.size;
      minWall = p.postD < 0.7 ? p.postD : p.sthick;
      dims = [['Stud', `${p.size} mm wide · ${p.sthick} mm thick`], ['Post', `${p.post} × ${p.postD} mm`]];
    }
    // the pair: second earring to the right; the whole set is centred later
    if (p.pair) {
      const dx = width + Math.max(6, width * 0.25);
      const copies = parts.map((part) => ({ geometry: part.geometry.clone().translate(dx, 0, 0) }));
      parts.push(...copies);
    }
    const warnings = [];
    if (minWall < MIN_WALL) warnings.push(`Thinnest part is ${minWall} mm. Below ${MIN_WALL} mm it can bend or break when cast.`);
    if (p.kind === 'hoop' && p.diameter > 40 && p.wire > 3) warnings.push('Large, thick hoops get heavy. Check the weight below.');
    return { parts, volume: one * (p.pair ? 2 : 1), minWall, warnings, dims: [...dims, ['Count', p.pair ? 'Pair (2 pieces)' : 'Single']], title: p.kind === 'hoop' ? 'Hoop earrings' : 'Stud earrings' };
  },
};
