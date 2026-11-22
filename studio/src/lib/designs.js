// MY DESIGNS: your own artwork (PNG, JPG, WebP, SVG), uploaded once and used everywhere —
// print, engraving, patch, pendant, crown, tape. Stored on this device only (IndexedDB).
//
// Sharpness: SVGs are kept as vectors and re-drawn at whatever size is needed. Pixel images keep their
// original resolution (up to 4096 px). Two built-in helpers, both running in the browser, free:
//   • vectorize() — ImageTracer (public domain) turns a pixel image into a sharp, endlessly scalable SVG
//   • upscale()   — UpscalerJS + ESRGAN model (MIT, TensorFlow.js) enlarges small images 2× or 4× with AI
import * as db from './db.js';
import { esc, toast, loadImage } from './dom.js';

const MAX = 4096; // px, longest side for pixel images
let cache = null;
const canvases = new Map();

export async function listDesigns() {
  if (!cache) cache = (await db.all('designs')).map((r) => r.value).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return cache;
}
export async function getDesign(id) { return (await listDesigns()).find((d) => d.id === id) || null; }
export async function deleteDesign(id) { await db.del('designs', id); for (const k of [...canvases.keys()]) if (k.startsWith(`${id}@`)) canvases.delete(k); cache = null; }

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function thumbOf(c) {
  const t = document.createElement('canvas'); const tk = 120 / Math.max(c.width, c.height);
  t.width = Math.max(1, Math.round(c.width * tk)); t.height = Math.max(1, Math.round(c.height * tk));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/png');
}
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Make sure an SVG has a size so it can be drawn (many exports only have a viewBox). */
function sizedSvg(text) {
  const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const hasSize = /<svg[^>]*\swidth\s*=\s*["'][\d.]+(px)?["'][^>]*\sheight\s*=/i.test(text) || /<svg[^>]*\sheight\s*=\s*["'][\d.]+(px)?["'][^>]*\swidth\s*=/i.test(text);
  if (hasSize || !vb) return { text, w: vb ? Number(vb[1]) : 1000, h: vb ? Number(vb[2]) : 1000 };
  return { text: text.replace(/<svg\b/i, `<svg width="${vb[1]}" height="${vb[2]}"`), w: Number(vb[1]), h: Number(vb[2]) };
}

async function store(d, canvas) {
  d.thumb = thumbOf(canvas);
  d.date = new Date().toISOString();
  await db.put('designs', d.id, d);
  cache = null;
  return d;
}

/** Upload a picture or SVG file into the library. Returns the stored design. */
export async function addDesignFile(file) {
  if (!file) throw new Error('No file.');
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  if (!/^image\//.test(file.type) && !isSvg) throw new Error('Please choose a PNG, JPG, WebP or SVG file.');
  if (file.size > 40e6) throw new Error('Files up to 40 MB, please.');
  const name = file.name.replace(/\.\w+$/, '').slice(0, 40);
  if (isSvg) {
    const { text, w, h } = sizedSvg(await file.text());
    const d = { id: newId(), name, svg: text, w: Math.round(w), h: Math.round(h), vector: true };
    const c = await renderSvg(text, 600, w / h);
    return store(d, c);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const d = { id: newId(), name, src: c.toDataURL('image/png'), w: c.width, h: c.height };
    canvases.set(`${d.id}@0`, c);
    if (Math.max(c.width, c.height) < 900) toast(`“${name}” is small (${c.width} × ${c.height} px). Use “Make sharp” or “AI upscale” in My designs for crisp results.`, 6500);
    return store(d, c);
  } finally { URL.revokeObjectURL(url); }
}

async function renderSvg(svg, longSide, aspect) {
  const img = await loadImage(svgUrl(svg));
  const a = aspect || (img.width / img.height) || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(a >= 1 ? longSide : longSide * a); c.height = Math.round(a >= 1 ? longSide / a : longSide);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** The design as a full-colour canvas. Vectors are drawn at least `minSide` px on the long side (sharp at any size). */
export async function designCanvas(id, minSide = 2048) {
  const d = await getDesign(id);
  if (!d) return null;
  if (d.svg) {
    const size = Math.min(MAX, Math.max(1024, 2 ** Math.ceil(Math.log2(minSide))));
    const key = `${id}@${size}`;
    if (!canvases.has(key)) canvases.set(key, await renderSvg(d.svg, size, d.w / d.h));
    return canvases.get(key);
  }
  const key = `${id}@0`;
  if (!canvases.has(key)) { const img = await loadImage(d.src); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); canvases.set(key, c); }
  return canvases.get(key);
}

/** Black-on-white pixels for the outline tools (pendant, sketch → 3D, crown). High resolution = smooth outlines. */
export async function designPixels(id, max = 1000) {
  const c = await designCanvas(id, max);
  if (!c) return null;
  const k = Math.min(1, max / Math.max(c.width, c.height));
  const o = document.createElement('canvas'); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  const x = o.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0, o.width, o.height);
  return x.getImageData(0, 0, o.width, o.height);
}

/** Dark parts of the design as an alpha shape (for engraving / emboss). */
export async function designShape(id, threshold = 150) {
  const c = await designCanvas(id, 2048);
  if (!c) return null;
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  const x = o.getContext('2d', { willReadFrequently: true });
  x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, o.width, o.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i + 3] / 255;
    const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) * a + 255 * (1 - a);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = lum < threshold ? 255 : 0;
  }
  x.putImageData(d, 0, 0);
  return o;
}

/* ── built-in helpers ───────────────────────────────────────────── */
export const VECTOR_PRESETS = {
  logo: { label: 'Logo (4 colours)', opts: { numberofcolors: 4, colorquantcycles: 3, ltres: 0.5, qtres: 0.5, pathomit: 6, blurradius: 1, rightangleenhance: true } },
  art: { label: 'Artwork (8 colours)', opts: { numberofcolors: 8, ltres: 0.8, qtres: 0.8, pathomit: 8, blurradius: 1 } },
  detail: { label: 'Detailed (24 colours)', opts: { numberofcolors: 24, ltres: 0.5, qtres: 0.5, pathomit: 4 } },
};

/** Pixel image → SVG (new design, vector). */
export async function vectorize(id, preset = 'logo') {
  const d = await getDesign(id);
  if (!d) throw new Error('Design not found.');
  const src = await designCanvas(id);
  const { default: ImageTracer } = await import('imagetracerjs');
  // trace at a sensible size (big enough for detail, small enough to be quick)
  const m = Math.max(src.width, src.height);
  const k = Math.min(1400 / m, Math.max(1, 900 / m)); // small images are enlarged first so thin lines survive
  const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const x = c.getContext('2d', { willReadFrequently: true });
  const transparent = hasTransparency(src);
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); // transparent areas must not mix with black
  x.drawImage(src, 0, 0, c.width, c.height);
  const opts = { ...VECTOR_PRESETS[preset].opts, viewbox: true, strokewidth: 0, linefilter: true, roundcoords: 2 };
  let svg = ImageTracer.imagedataToSVG(x.getImageData(0, 0, c.width, c.height), opts);
  // drop fully transparent paths and give the SVG a size
  svg = svg.replace(/<path[^>]*opacity="0"[^>]*\/>/g, '');
  // the white we put behind a transparent picture becomes transparent again
  if (transparent) svg = svg.replace(/<path[^>]*fill="rgb\((2(?:4[0-9]|5[0-5])),(2(?:4[0-9]|5[0-5])),(2(?:4[0-9]|5[0-5]))\)"[^>]*\/>/g, '');
  if (!/viewBox=/i.test(svg)) svg = svg.replace(/<svg\b/i, `<svg viewBox="0 0 ${c.width} ${c.height}"`);
  const sized = sizedSvg(svg);
  const out = { id: newId(), name: `${d.name} (vector)`.slice(0, 48), svg: sized.text, w: c.width, h: c.height, vector: true };
  canvases.delete(`${out.id}@0`);
  return store(out, await renderSvg(sized.text, 600, c.width / c.height));
}

function hasTransparency(c) {
  const k = Math.min(1, 200 / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * k)); t.height = Math.max(1, Math.round(c.height * k));
  const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, t.width, t.height);
  const d = x.getImageData(0, 0, t.width, t.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) n++;
  return n > (d.length / 4) * 0.01;
}

let upscalers = {};
/** AI enlargement (2× or 4×) with ESRGAN, in the browser. onProgress(0..1). */
export async function upscale(id, factor = 4, onProgress = () => {}) {
  const d = await getDesign(id);
  if (!d) throw new Error('Design not found.');
  const src = await designCanvas(id);
  const limit = factor === 4 ? 900 : 1600; // keeps memory and time reasonable on phones
  const k = Math.min(1, limit / Math.max(src.width, src.height));
  const c = document.createElement('canvas'); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  const transparent = hasTransparency(src);
  const cx = c.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); // the AI model works on colour only
  cx.drawImage(src, 0, 0, c.width, c.height);
  if (!upscalers[factor]) {
    const [{ default: Upscaler }, mod] = await Promise.all([import('upscaler'), factor === 4 ? import('@upscalerjs/esrgan-slim/4x') : import('@upscalerjs/esrgan-slim/2x')]);
    const def = await mod.default;
    upscalers[factor] = new Upscaler({ model: { ...def, path: new URL(`models/esrgan-slim/x${factor}/model.json`, document.baseURI).href } });
  }
  const out = await upscalers[factor].upscale(c.toDataURL('image/png'), { output: 'base64', patchSize: 64, padding: 4, progress: (p) => onProgress(p) });
  const img = await loadImage(out.startsWith('data:') ? out : `data:image/png;base64,${out}`);
  const big = document.createElement('canvas'); big.width = img.width; big.height = img.height;
  const bx = big.getContext('2d');
  bx.drawImage(img, 0, 0);
  if (transparent) { // put the transparency back, smoothly enlarged
    bx.globalCompositeOperation = 'destination-in';
    bx.imageSmoothingQuality = 'high';
    bx.drawImage(src, 0, 0, big.width, big.height);
    bx.globalCompositeOperation = 'source-over';
  }
  const nd = { id: newId(), name: `${d.name} ×${factor}`.slice(0, 48), src: big.toDataURL('image/png'), w: big.width, h: big.height };
  canvases.set(`${nd.id}@0`, big);
  return store(nd, big);
}

/**
 * A picker: your designs as tiles + an upload button. onPick(id) is called with the chosen design.
 * Returns an element (class .ctl).
 */
export function designPicker({ label = 'My designs', help = 'Upload a PNG, JPG, WebP or SVG once and use it everywhere. It stays on this device.', value = '', onPick }) {
  const el = document.createElement('div');
  el.className = 'ctl';
  el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(label)}</span></div><p class="ctl-help">${esc(help)}</p>
    <div class="motif-grid" role="radiogroup" aria-label="${esc(label)}"></div>
    <p class="btn-row" style="margin-top:8px"><button type="button" class="btn btn--lime" data-up>Upload design</button><a class="btn" href="#/designs">Make sharp / upscale</a><input type="file" accept="image/*,.svg" multiple hidden></p>`;
  const grid = el.querySelector('.motif-grid');
  const draw = async () => {
    const list = await listDesigns();
    grid.innerHTML = list.length ? '' : '<p class="muted" style="font-size:14px;grid-column:1/-1">No designs yet.</p>';
    for (const d of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(d.id === value)); b.title = `${d.name}${d.vector ? ' (vector)' : ` (${d.w} × ${d.h} px)`}`; b.setAttribute('aria-label', d.name);
      b.innerHTML = `<img src="${d.thumb}" alt="">`;
      b.addEventListener('click', () => { value = d.id; grid.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); onPick(d.id); });
      grid.append(b);
    }
  };
  const input = el.querySelector('input');
  el.querySelector('[data-up]').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    let last = null;
    for (const f of input.files) { try { last = await addDesignFile(f); } catch (e) { toast(e.message || 'This file could not be opened.'); } }
    input.value = '';
    await draw();
    if (last) { value = last.id; onPick(last.id); toast(`“${last.name}” added to your designs.`); draw(); }
  });
  draw();
  return el;
}
