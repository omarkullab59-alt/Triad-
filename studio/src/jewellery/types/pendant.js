import * as THREE from 'three';
import { geometryVolume } from '../revolve.js';
import { outlineFromPixels, decodeShapes, thinParts } from '../outline.js';
import { MIN_WALL } from '../../lib/sizes.js';

// Built-in starting shapes, drawn on a canvas and run through the same outline pipeline as uploads.
export const SHAPES = {
  triad: { label: 'TRIAD triangle', draw(c, s) {
    c.beginPath(); c.moveTo(s / 2, s * 0.08); c.lineTo(s * 0.94, s * 0.86); c.lineTo(s * 0.06, s * 0.86); c.closePath(); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.moveTo(s / 2, s * 0.36); c.lineTo(s * 0.72, s * 0.74); c.lineTo(s * 0.28, s * 0.74); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
  } },
  peaks: { label: 'Three peaks', draw(c, s) {
    c.beginPath(); c.moveTo(s * 0.06, s * 0.82); c.lineTo(s * 0.2, s * 0.3); c.lineTo(s * 0.34, s * 0.62); c.lineTo(s * 0.5, s * 0.1);
    c.lineTo(s * 0.66, s * 0.62); c.lineTo(s * 0.8, s * 0.3); c.lineTo(s * 0.94, s * 0.82); c.closePath(); c.fill();
  } },
  drop: { label: 'Drop', draw(c, s) {
    c.beginPath(); c.moveTo(s / 2, s * 0.06); c.bezierCurveTo(s * 0.6, s * 0.3, s * 0.82, s * 0.48, s * 0.82, s * 0.66);
    c.arc(s / 2, s * 0.66, s * 0.32, 0, Math.PI); c.bezierCurveTo(s * 0.18, s * 0.48, s * 0.4, s * 0.3, s / 2, s * 0.06); c.fill();
  } },
  star: { label: 'Star', draw(c, s) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? s * 0.2 : s * 0.46; c.lineTo(s / 2 + r * Math.cos(a), s * 0.53 + r * Math.sin(a)); }
    c.closePath(); c.fill();
  } },
  moon: { label: 'Moon', draw(c, s) {
    c.beginPath(); c.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(s * 0.66, s * 0.4, s * 0.36, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
  } },
  shield: { label: 'Tag', draw(c, s) {
    const r = s * 0.08;
    c.beginPath(); c.roundRect(s * 0.2, s * 0.06, s * 0.6, s * 0.88, r); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(s / 2, s * 0.2, s * 0.07, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'source-over';
  } },
};

export function shapePixels(id, makeCanvas, size = 320) {
  const canvas = makeCanvas(size, size);
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, size, size);
  c.fillStyle = '#000';
  (SHAPES[id] || SHAPES.triad).draw(c, size);
  return c.getImageData(0, 0, size, size);
}

export const pendant = {
  id: 'pendant',
  label: 'Pendant',
  params: [
    { key: 'shape', type: 'source', label: 'Your shape', help: 'Upload a sketch or photo, or start from a shape. Dark lines on light paper work best.', default: 'triad' },
    { key: 'height', type: 'range', label: 'Height', help: 'How tall the charm is, without the loop.', min: 8, max: 70, step: 0.5, unit: 'mm', default: 24 },
    { key: 'thick', type: 'range', label: 'Thickness', help: 'How thick the metal is. 1.5–2.5 mm is typical.', min: 0.6, max: 6, step: 0.1, unit: 'mm', default: 2 },
    { key: 'threshold', type: 'range', label: 'Outline detection', help: 'Move until the preview shows your shape cleanly. Higher picks up lighter lines.', min: 20, max: 240, step: 1, unit: '', default: 140, show: (p, s) => s.hasPixels },
    { key: 'fill', type: 'toggle', label: 'Fill inside', help: 'Turn on to make a solid charm from an outline drawing.', default: false, show: (p, s) => s.hasPixels },
    { key: 'bail', type: 'select', label: 'Loop for the chain', help: 'The small ring (“bail”) your chain goes through, added at the top automatically.', default: 'loop',
      options: [['loop', 'Loop on top'], ['none', 'No loop']] },
    // more
    { key: 'bold', type: 'range', more: true, label: 'Line boldness', help: 'Makes thin lines thicker so they can be cast.', min: 0, max: 8, step: 1, unit: 'px', default: 0, show: (p, s) => s.hasPixels },
    { key: 'invert', type: 'toggle', more: true, label: 'Light shape on dark background', help: 'Turn on if your drawing is white on black.', default: false, show: (p, s) => s.hasPixels },
    { key: 'edge', type: 'range', more: true, label: 'Rounded edges', help: 'Softens the edges a little. Keep it small on pointed shapes.', min: 0, max: 0.6, step: 0.05, unit: 'mm', default: 0 },
    { key: 'bailD', type: 'range', more: true, show: (p) => p.bail === 'loop', label: 'Loop opening', help: 'Inside width of the loop. Your chain must fit through.', min: 2, max: 8, step: 0.1, unit: 'mm', default: 3.5 },
    { key: 'bailW', type: 'range', more: true, show: (p) => p.bail === 'loop', label: 'Loop wire', help: 'Thickness of the loop’s wire.', min: 0.6, max: 2.5, step: 0.1, unit: 'mm', default: 1.2 },
  ],
  templates: Object.entries(SHAPES).map(([id, s]) => ({ label: s.label, p: { shape: id, fill: false, threshold: 140, invert: false, bold: 0 } })),

  build(p, { makeCanvas, pixels }) {
    // 1. outline
    let src = pixels;
    if (!src && SHAPES[p.shape]) src = shapePixels(p.shape, makeCanvas);
    let res = null;
    if (src) res = outlineFromPixels(src, { threshold: p.threshold, invert: p.invert, bold: p.bold, fillHoles: p.fill });
    else if (typeof p.shape === 'string' && p.shape.startsWith('o:')) res = decodeShapes(p.shape.slice(2));
    if (!res || !res.shapes.length) {
      return { parts: [], volume: 0, minWall: 0, empty: true, warnings: ['No shape found. Move “Outline detection”, or try a darker drawing on white paper.'], dims: [], title: 'Pendant' };
    }
    const { shapes, box } = res;
    const scale = p.height / Math.max(1e-6, box.maxY - box.minY);
    const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
    const toV = ([x, y]) => new THREE.Vector2((x - cx) * scale, -(y - cy) * scale);

    // 2. extrude
    const threeShapes = shapes.map((s) => {
      const shape = new THREE.Shape(s.outer.map(toV));
      shape.holes = s.holes.map((h) => new THREE.Path(h.map(toV)));
      return shape;
    });
    const bevel = Math.min(p.edge, p.thick / 3);
    const geometry = new THREE.ExtrudeGeometry(threeShapes, {
      depth: Math.max(0.05, p.thick - 2 * bevel), bevelEnabled: bevel > 0.01, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelOffset: 0, bevelSegments: 3, curveSegments: 4,
    });
    geometry.translate(0, 0, -(p.thick - 2 * bevel) / 2);
    // Extrude groups: 0 = faces (front/back) → accent, 1 = sides → metal
    for (const g of geometry.groups) g.materialIndex = g.materialIndex === 0 ? 1 : 0;
    geometry.userData.groups = true;
    geometry.computeVertexNormals();
    const parts = [{ geometry }];
    let volume = geometryVolume(geometry);

    // 3. bail at the highest point
    let top = null;
    if (p.bail === 'loop') {
      let maxY = -Infinity;
      const pts = shapes.flatMap((s) => s.outer.map(toV));
      for (const v of pts) maxY = Math.max(maxY, v.y);
      const near = pts.filter((v) => v.y > maxY - 0.4);
      const x = near.reduce((s, v) => s + v.x, 0) / near.length;
      const R = p.bailD / 2 + p.bailW / 2;
      const torus = new THREE.TorusGeometry(R, p.bailW / 2, 16, 48);
      torus.rotateY(Math.PI / 2);
      torus.translate(x, maxY + R - p.bailW * 0.9, 0);
      parts.push({ geometry: torus });
      volume += geometryVolume(torus) * 0.92; // part of the loop overlaps the charm
      top = maxY + 2 * R;
    }

    // 4. checks
    const w = (box.maxX - box.minX) * scale;
    const warnings = [];
    let minWall = Math.min(p.thick, p.bail === 'loop' ? p.bailW : Infinity);
    if (res.mask) {
      const thin = thinParts(res.mask, MIN_WALL / 2 / scale);
      if (thin > 0.01) {
        minWall = Math.min(minWall, 0.79);
        warnings.push(`About ${Math.max(1, Math.round(thin * 100))} % of the shape is thinner than ${MIN_WALL} mm. Raise “Line boldness” (under More) or make the charm bigger.`);
      }
    }
    if (p.thick < MIN_WALL) warnings.push(`Thickness ${p.thick} mm is below ${MIN_WALL} mm: too thin to cast.`);
    if (p.bail === 'loop' && p.bailW < MIN_WALL) warnings.push(`Loop wire ${p.bailW} mm is below ${MIN_WALL} mm and may break.`);
    if (shapes.length > 1) warnings.push(`Your picture has ${shapes.length} separate parts. They will be loose pieces unless they touch. Try “Line boldness” or “Fill inside”.`);

    const dims = [
      ['Charm', `${w.toFixed(1)} × ${p.height} mm`],
      ['Thickness', `${p.thick} mm`],
    ];
    if (top !== null) dims.push(['With loop', `${(top + p.height / 2).toFixed(1)} mm tall · loop opening ${p.bailD} mm`]);
    return { parts, volume, minWall, warnings, dims, title: 'Pendant', shapes, box, mask: res.mask || null };
  },
};
