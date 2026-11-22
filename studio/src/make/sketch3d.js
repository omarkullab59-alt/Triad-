// Sketch / picture → 3D object: flat cut-out, relief (height from darkness) or turned (vase from a silhouette).
import * as THREE from 'three';
import { outlineFromPixels, decodeShapes, toMask } from '../jewellery/outline.js';
import { geometryVolume, finish } from '../jewellery/revolve.js';
import { extrude, pixelShapesToThree, turn } from '../jewellery/solid.js';
import { SHAPES, shapePixels } from '../jewellery/types/pendant.js';

function relief(pixels, p) {
  const { data, width, height } = pixels;
  const n = 140;
  const k = Math.min(1, n / Math.max(width, height));
  const W = Math.max(2, Math.round(width * k)), H = Math.max(2, Math.round(height * k));
  const hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(width - 1, Math.floor(x / k)), sy = Math.min(height - 1, Math.floor(y / k));
    const i = (sy * width + sx) * 4;
    let v = 1 - (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    if (p.invert) v = 1 - v;
    hgt[y * W + x] = v;
  }
  // soften
  for (let pass = 0; pass < p.smooth; pass++) {
    const c = hgt.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) hgt[y * W + x] = (c[y * W + x] * 4 + c[y * W + x - 1] + c[y * W + x + 1] + c[(y - 1) * W + x] + c[(y + 1) * W + x]) / 8;
  }
  const size = p.size / Math.max(W, H);
  const base = p.base;
  const pos = [];
  const top = (x, y) => { pos.push((x - W / 2) * size, -(y - H / 2) * size, base + hgt[y * W + x] * p.depth); return pos.length / 3 - 1; };
  const bot = (x, y) => { pos.push((x - W / 2) * size, -(y - H / 2) * size, 0); return pos.length / 3 - 1; };
  const T = [], B = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { T.push(top(x, y)); B.push(bot(x, y)); }
  const idx = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = y * W + x, b = a + 1, c = a + W, d = c + 1;
    idx.push(T[a], T[c], T[b], T[b], T[c], T[d]);
    idx.push(B[a], B[b], B[c], B[b], B[d], B[c]);
  }
  const ring = [];
  for (let x = 0; x < W; x++) ring.push(x);
  for (let y = 1; y < H; y++) ring.push(y * W + W - 1);
  for (let x = W - 2; x >= 0; x--) ring.push((H - 1) * W + x);
  for (let y = H - 2; y > 0; y--) ring.push(y * W);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    idx.push(T[a], T[b], B[a], T[b], B[b], B[a]);
  }
  return finish(new Float32Array(pos), idx);
}

function turned(mask, p) {
  const { mask: m, width: w, height: h } = mask;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (maxY <= minY) return null;
  const cx = (minX + maxX) / 2;
  const rows = 60;
  const prof = [];
  for (let i = 0; i <= rows; i++) {
    const y = Math.round(maxY - ((maxY - minY) * i) / rows);
    let r = 0;
    for (let x = 0; x < w; x++) if (m[y * w + x]) r = Math.max(r, Math.abs(x + 0.5 - cx));
    prof.push(r);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < rows; i++) prof[i] = (prof[i - 1] + prof[i] * 2 + prof[i + 1]) / 4;
  const scale = p.size / (maxY - minY);
  const outer = prof.map((r, i) => [Math.max(0.5, r * scale), (p.size * i) / rows]);
  let loop;
  if (p.hollow) {
    const t = p.depth, base = Math.max(t, 2);
    loop = [[0, 0], ...outer, [Math.max(0.3, outer[rows][0] - t), p.size]];
    for (let i = rows; i >= 0; i--) { if (outer[i][1] < base) break; loop.push([Math.max(0.3, outer[i][0] - t), outer[i][1]]); }
    loop.push([0, base]);
  } else loop = [[0, 0], ...outer, [0, p.size]];
  return turn(loop.reverse(), 128);
}

export const sketch3d = {
  id: 'sketch3d',
  label: 'Sketch to 3D',
  category: 'make',
  materials: ['silver', 'gold', 'black', 'chrome', 'ceramic', 'stoneware', 'oak', 'walnut', 'steel', 'brass', 'concrete'],
  defaultMaterial: 'ceramic',
  minWall: 0.8,
  params: [
    { key: 'shape', type: 'source', label: 'Your sketch or picture', help: 'Upload a drawing, photo or design. Dark = shape, light = background.', default: 'triad' },
    { key: 'mode', type: 'select', label: 'Make it', help: 'Flat cut-out, a relief (dark parts stand up), or a turned object like a vase from its side view.', default: 'flat', options: [['flat', 'Flat cut-out'], ['relief', 'Relief'], ['turned', 'Turned (vase, cup)']] },
    { key: 'size', type: 'range', label: 'Size', help: 'Height of the object (relief: the longest side).', min: 5, max: 600, step: 1, unit: 'mm', default: 60 },
    { key: 'depth', type: 'range', label: 'Thickness', help: 'Cut-out: thickness. Relief: how high it stands. Turned: wall thickness.', min: 0.5, max: 40, step: 0.5, unit: 'mm', default: 4 },
    { key: 'threshold', type: 'range', label: 'Outline detection', help: 'Move until the preview shows your shape cleanly.', min: 20, max: 240, step: 1, unit: '', default: 140, show: (p, s) => s.hasPixels && p.mode !== 'relief' },
    // more
    { key: 'fill', type: 'toggle', more: true, show: (p) => p.mode === 'flat', label: 'Fill inside', help: 'Turn on to make a solid shape from an outline drawing.', default: false },
    { key: 'hollow', type: 'toggle', more: true, show: (p) => p.mode === 'turned', label: 'Hollow (vessel)', help: 'Off makes a solid object, on makes a vase or cup you can fill.', default: true },
    { key: 'base', type: 'range', more: true, show: (p) => p.mode === 'relief', label: 'Base plate', help: 'Thickness of the plate under the relief.', min: 0.5, max: 20, step: 0.5, unit: 'mm', default: 2 },
    { key: 'smooth', type: 'range', more: true, show: (p) => p.mode === 'relief', label: 'Smoothing', help: 'Softens the relief.', min: 0, max: 6, step: 1, unit: '', default: 2 },
    { key: 'bold', type: 'range', more: true, show: (p, s) => s.hasPixels && p.mode !== 'relief', label: 'Line boldness', help: 'Makes thin lines thicker.', min: 0, max: 10, step: 1, unit: 'px', default: 2 },
    { key: 'invert', type: 'toggle', more: true, show: (p, s) => s.hasPixels, label: 'Light shape on dark background', help: 'Turn on if your picture is white on black.', default: false },
  ],
  templates: [
    { label: 'Vase from silhouette', p: { shape: 'drop', mode: 'turned', size: 220, depth: 5, hollow: true } },
    { label: 'Relief tile', p: { shape: 'star', mode: 'relief', size: 120, depth: 6, base: 4 } },
    { label: 'Flat cut-out', p: { shape: 'moon', mode: 'flat', size: 80, depth: 6 } },
  ],
  build(p, ctx) {
    let src = ctx.pixels;
    if (!src && SHAPES[p.shape]) src = shapePixels(p.shape, ctx.makeCanvas);
    const empty = (msg) => ({ parts: [], volume: 0, minWall: 0, empty: true, warnings: [msg], dims: [], title: 'Sketch to 3D' });
    let geometry, mask = null, shapes = null, box = null;
    if (p.mode === 'relief') {
      if (!src) return empty('Relief needs a picture: upload one or draw it.');
      geometry = relief(src, p);
    } else if (p.mode === 'turned') {
      if (!src) return empty('Upload a side view (silhouette) to turn it.');
      mask = toMask(src, { threshold: p.threshold, invert: p.invert, bold: p.bold });
      geometry = turned(mask, p);
      if (!geometry) return empty('No shape found. Move “Outline detection”.');
    } else {
      const res = src ? outlineFromPixels(src, { threshold: p.threshold, invert: p.invert, bold: p.bold, fillHoles: p.fill })
        : String(p.shape).startsWith('o:') ? decodeShapes(p.shape.slice(2)) : null;
      if (!res?.shapes.length) return empty('No shape found. Move “Outline detection”, or try a darker drawing.');
      ({ shapes, box } = res); mask = res.mask;
      geometry = extrude(pixelShapesToThree(shapes, box, p.size).shapes, p.depth, { accentFaces: true });
    }
    const volume = geometryVolume(geometry);
    const bb = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position).getSize(new THREE.Vector3());
    const wall = p.mode === 'relief' ? p.base : p.depth;
    return {
      parts: [{ geometry }], volume, minWall: wall, shapes, box, mask,
      warnings: wall < 0.8 ? ['Thinner than 0.8 mm: too fragile for most materials.'] : [],
      dims: [['Size', `${bb.x.toFixed(1)} × ${bb.y.toFixed(1)} × ${bb.z.toFixed(1)} mm`], ['Made as', { flat: 'Flat cut-out', relief: 'Relief', turned: p.hollow ? 'Turned, hollow' : 'Turned, solid' }[p.mode]]],
      title: { flat: 'Cut-out', relief: 'Relief', turned: p.hollow ? 'Vessel' : 'Turned object' }[p.mode],
    };
  },
};
