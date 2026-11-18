// Your own symbols: stored on this device (IndexedDB), drawn to a canvas wherever they are used
// (pendant, studs, ring top, sketch → 3D).
//
// doc = { id, name, symmetry, elements: [...], thumb }
// element types (all in a 1000 × 1000 space, centre 500/500):
//   { type: 'path', pts: [[x,y],…], w, op }                      freehand line
//   { type: 'shape', shape, x, y, s, rot, op, outline, w }      circle, square, triangle, star, heart, ring, diamond, cross, peaks, line
//   { type: 'text', text, font, x, y, s, rot, op }
//   { type: 'image', src (dataURL), threshold, x, y, s, rot, op }
// op: 'add' | 'cut'   symmetry: none | x | xy | r3 | r4 | r6
import * as db from './db.js';
import { fontStack, ensureFont, isRTL } from './fonts.js';

export const SIZE = 1000;
export const SHAPE_KINDS = [
  ['circle', 'Circle'], ['square', 'Square'], ['triangle', 'Triangle'], ['star', 'Star'], ['heart', 'Heart'],
  ['ring', 'Ring'], ['diamond', 'Diamond'], ['cross', 'Cross'], ['peaks', 'TRIAD peaks'], ['line', 'Line'],
];
export const SYMMETRY = [['none', 'None'], ['x', 'Mirror'], ['xy', 'Mirror 4×'], ['r3', 'Turn 3× (TRIAD)'], ['r4', 'Turn 4×'], ['r6', 'Turn 6×']];

const images = new Map();
function image(src) {
  if (images.has(src)) return images.get(src);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  images.set(src, p);
  return p;
}

export function shapePath(ctx, kind, s) {
  const h = s / 2;
  ctx.beginPath();
  switch (kind) {
    case 'circle': ctx.arc(0, 0, h, 0, Math.PI * 2); break;
    case 'ring': ctx.arc(0, 0, h, 0, Math.PI * 2); ctx.arc(0, 0, h * 0.62, 0, Math.PI * 2, true); break;
    case 'square': ctx.rect(-h, -h, s, s); break;
    case 'diamond': ctx.moveTo(0, -h); ctx.lineTo(h * 0.7, 0); ctx.lineTo(0, h); ctx.lineTo(-h * 0.7, 0); ctx.closePath(); break;
    case 'triangle': ctx.moveTo(0, -h); ctx.lineTo(h, h * 0.75); ctx.lineTo(-h, h * 0.75); ctx.closePath(); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? h * 0.42 : h; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); break;
    case 'heart': ctx.moveTo(0, h * 0.85); ctx.bezierCurveTo(-h * 1.3, -h * 0.1, -h * 0.5, -h * 1.05, 0, -h * 0.4); ctx.bezierCurveTo(h * 0.5, -h * 1.05, h * 1.3, -h * 0.1, 0, h * 0.85); break;
    case 'cross': { const t = h * 0.3; ctx.rect(-t, -h, 2 * t, s); ctx.rect(-h, -t, s, 2 * t); break; }
    case 'peaks': ctx.moveTo(-h, h * 0.6); ctx.lineTo(-h * 0.6, -h * 0.4); ctx.lineTo(-h * 0.3, h * 0.15); ctx.lineTo(0, -h); ctx.lineTo(h * 0.3, h * 0.15); ctx.lineTo(h * 0.6, -h * 0.4); ctx.lineTo(h, h * 0.6); ctx.closePath(); break;
    case 'line': ctx.moveTo(-h, 0); ctx.lineTo(h, 0); break;
    default: ctx.rect(-h, -h, s, s);
  }
}

/** Draw one element in black (alpha = shape). */
export async function drawElement(ctx, el) {
  ctx.save();
  ctx.globalCompositeOperation = el.op === 'cut' ? 'destination-out' : 'source-over';
  ctx.fillStyle = ctx.strokeStyle = '#000';
  ctx.lineCap = ctx.lineJoin = 'round';
  if (el.type === 'path') {
    ctx.lineWidth = el.w;
    ctx.beginPath();
    el.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (el.pts.length === 1) { ctx.arc(el.pts[0][0], el.pts[0][1], el.w / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.stroke();
  } else {
    ctx.translate(el.x, el.y);
    ctx.rotate(((el.rot || 0) * Math.PI) / 180);
    if (el.type === 'shape') {
      shapePath(ctx, el.shape, el.s);
      if (el.outline || el.shape === 'line') { ctx.lineWidth = el.w || 30; ctx.stroke(); } else ctx.fill('nonzero');
    } else if (el.type === 'text') {
      await ensureFont(el.font, el.text);
      ctx.font = fontStack(el.font, el.s, el.text);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.direction = isRTL(el.text) ? 'rtl' : 'ltr';
      if (el.outline) { ctx.lineWidth = el.w || 20; ctx.strokeText(el.text, 0, 0); } else ctx.fillText(el.text, 0, 0);
    } else if (el.type === 'image') {
      const img = await image(el.src);
      if (img) {
        const k = el.s / Math.max(img.width, img.height);
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const t = document.createElement('canvas'); t.width = Math.max(1, w); t.height = Math.max(1, h);
        const c = t.getContext('2d', { willReadFrequently: true });
        c.drawImage(img, 0, 0, w, h);
        const d = c.getImageData(0, 0, t.width, t.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) * (d.data[i + 3] / 255) + 255 * (1 - d.data[i + 3] / 255);
          const on = el.invert ? lum >= el.threshold : lum < el.threshold;
          d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = on ? 255 : 0;
        }
        c.putImageData(d, 0, 0);
        ctx.drawImage(t, -w / 2, -h / 2);
      }
    }
  }
  ctx.restore();
}

/** Render a whole symbol: black shape on transparent, `size` px square. */
export async function renderSymbol(doc, size = 600) {
  const layer = document.createElement('canvas');
  layer.width = layer.height = SIZE;
  const lc = layer.getContext('2d');
  for (const el of doc.elements) await drawElement(lc, el);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const oc = out.getContext('2d');
  const k = size / SIZE;
  const copies = { none: [[0, 1]], x: [[0, 1], [0, -1]], xy: [[0, 1], [0, -1], [180, 1], [180, -1]], r3: [[0, 1], [120, 1], [240, 1]], r4: [[0, 1], [90, 1], [180, 1], [270, 1]], r6: [0, 60, 120, 180, 240, 300].map((a) => [a, 1]) }[doc.symmetry || 'none'];
  for (const [a, sx] of copies) {
    oc.save();
    oc.translate(size / 2, size / 2);
    oc.rotate((a * Math.PI) / 180);
    oc.scale(sx * k, k);
    oc.drawImage(layer, -SIZE / 2, -SIZE / 2);
    oc.restore();
  }
  return out;
}

/** Symbol as pixels for the outline pipeline: black on white. */
export async function symbolPixels(doc, size = 360) {
  const c = await renderSymbol(doc, size);
  const o = document.createElement('canvas'); o.width = o.height = size;
  const x = o.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.drawImage(c, 0, 0);
  return x.getImageData(0, 0, size, size);
}

let cache = null;
export async function listSymbols() {
  if (!cache) cache = (await db.all('symbols')).map((r) => r.value).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return cache;
}
export async function saveSymbol(doc) {
  const thumb = (await renderSymbol(doc, 120)).toDataURL('image/png');
  const full = { ...doc, id: doc.id || Date.now().toString(36), date: new Date().toISOString(), thumb };
  await db.put('symbols', full.id, full);
  cache = null;
  return full;
}
export async function deleteSymbol(id) { await db.del('symbols', id); cache = null; }
export async function getSymbol(id) { return (await listSymbols()).find((s) => s.id === id) || null; }
export async function symbolOptions() { return (await listSymbols()).map((s) => [s.id, s.name]); }
