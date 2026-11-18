export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uid = 0;
export const id = (p = 'x') => `${p}${++uid}`;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let toastTimer;
export function toast(msg, ms = 3200) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function download(blobOrUrl, name) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const canvasBlob = (canvas, type = 'image/png', q) => new Promise((res) => canvas.toBlob(res, type, q));
export const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function loadImage(src) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
}
/** File/Blob → ImageData scaled so the longest side is `max` px (and EXIF orientation applied by the browser). */
export async function fileToPixels(file, max = 360) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return imageToPixels(img, max);
  } finally { URL.revokeObjectURL(url); }
}
export function imageToPixels(img, max = 360) {
  const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
