// MY DESIGNS: your own artwork (PNG, JPG, WebP, SVG), uploaded once and used everywhere —
// print, engraving, patch, pendant, crown, tape. Stored on this device only (IndexedDB).
import * as db from './db.js';
import { esc, toast, loadImage } from './dom.js';

const MAX = 2000; // px, longest side
let cache = null;
const canvases = new Map();

export async function listDesigns() {
  if (!cache) cache = (await db.all('designs')).map((r) => r.value).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return cache;
}
export async function getDesign(id) { return (await listDesigns()).find((d) => d.id === id) || null; }
export async function deleteDesign(id) { await db.del('designs', id); canvases.delete(id); cache = null; }

/** Upload a picture or SVG file into the library. Returns the stored design. */
export async function addDesignFile(file) {
  if (!file) throw new Error('No file.');
  const svg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  if (!/^image\//.test(file.type) && !svg) throw new Error('Please choose a PNG, JPG, WebP or SVG file.');
  if (file.size > 25e6) throw new Error('Files up to 25 MB, please.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let w = img.naturalWidth || img.width || 1200, h = img.naturalHeight || img.height || 1200;
    if (svg && (!img.naturalWidth || w < 1200)) { const k = 1600 / Math.max(w, h); w *= k; h *= k; } // vectors: render big and sharp
    const k = Math.min(1, MAX / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const t = document.createElement('canvas'); const tk = 120 / Math.max(c.width, c.height); t.width = Math.max(1, Math.round(c.width * tk)); t.height = Math.max(1, Math.round(c.height * tk));
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    const d = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: file.name.replace(/\.\w+$/, '').slice(0, 40), src: c.toDataURL('image/png'), w: c.width, h: c.height, thumb: t.toDataURL('image/png'), date: new Date().toISOString() };
    await db.put('designs', d.id, d);
    cache = null;
    canvases.set(d.id, c);
    return d;
  } finally { URL.revokeObjectURL(url); }
}

/** The design as a full-colour canvas. */
export async function designCanvas(id) {
  if (canvases.has(id)) return canvases.get(id);
  const d = await getDesign(id);
  if (!d) return null;
  const img = await loadImage(d.src);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  canvases.set(id, c);
  return c;
}

/** Black-on-white pixels for the outline tools (pendant, sketch → 3D, crown). */
export async function designPixels(id, max = 420) {
  const c = await designCanvas(id);
  if (!c) return null;
  const k = Math.min(1, max / Math.max(c.width, c.height));
  const o = document.createElement('canvas'); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  const x = o.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0, o.width, o.height);
  return x.getImageData(0, 0, o.width, o.height);
}

/** Dark parts of the design as an alpha shape (for engraving / emboss). */
export async function designShape(id, threshold = 150) {
  const c = await designCanvas(id);
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

/**
 * A picker: your designs as tiles + an upload button. onPick(id) is called with the chosen design.
 * Returns an element (class .ctl).
 */
export function designPicker({ label = 'My designs', help = 'Upload a PNG, JPG, WebP or SVG once and use it everywhere. It stays on this device.', value = '', onPick }) {
  const el = document.createElement('div');
  el.className = 'ctl';
  el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(label)}</span></div><p class="ctl-help">${esc(help)}</p>
    <div class="motif-grid" role="radiogroup" aria-label="${esc(label)}"></div>
    <p style="margin-top:8px"><button type="button" class="btn btn--lime">Upload design</button><input type="file" accept="image/*,.svg" multiple hidden></p>`;
  const grid = el.querySelector('.motif-grid');
  const draw = async () => {
    const list = await listDesigns();
    grid.innerHTML = list.length ? '' : '<p class="muted" style="font-size:14px;grid-column:1/-1">No designs yet.</p>';
    for (const d of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(d.id === value)); b.title = d.name; b.setAttribute('aria-label', d.name);
      b.innerHTML = `<img src="${d.thumb}" alt="">`;
      b.addEventListener('click', () => { value = d.id; grid.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); onPick(d.id); });
      grid.append(b);
    }
  };
  const input = el.querySelector('input');
  el.querySelector('button').addEventListener('click', () => input.click());
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
