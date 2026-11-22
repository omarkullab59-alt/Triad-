// Name / word pendant in any script and font (Japanese, Arabic, Cyrillic, your own fonts …).
import { pendant } from './pendant.js';
import { fontOptions, fontStack, isRTL } from '../../lib/fonts.js';

function textPixels(p, makeCanvas) {
  const px = 150;
  const c = makeCanvas(16, 16);
  let ctx = c.getContext('2d');
  const font = fontStack(p.font, px, p.text);
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(p.text || ' ').width) + 60;
  const h = Math.round(px * 1.7);
  c.width = w; c.height = h;
  ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000'; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.direction = isRTL(p.text) ? 'rtl' : 'ltr';
  const base = h * 0.66;
  if (p.outline) { ctx.lineWidth = px * 0.06; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(p.text, w / 2, base); }
  else ctx.fillText(p.text, w / 2, base);
  if (p.bar) { // connect all letters
    const m = ctx.measureText(p.text);
    ctx.fillRect(w / 2 - m.width / 2 - 6, base - px * 0.02, m.width + 12, px * 0.12);
  }
  return ctx.getImageData(0, 0, w, h);
}

export const lettering = {
  id: 'lettering',
  label: 'Lettering',
  params: [
    { key: 'text', type: 'text', label: 'Your word', help: 'A name or word in any language: 東京, حب, Москва, TRIAD …', default: 'TRIAD', max: 24 },
    { key: 'font', type: 'font', label: 'Font', help: 'Pick a style or a script. You can also upload your own font file.', default: 'Pirata One' },
    { key: 'height', type: 'range', label: 'Height', help: 'Height of the whole word in mm.', min: 6, max: 60, step: 0.5, unit: 'mm', default: 14 },
    { key: 'thick', type: 'range', label: 'Thickness', help: 'Metal thickness. 1.2–2 mm is typical.', min: 0.8, max: 5, step: 0.1, unit: 'mm', default: 1.6 },
    { key: 'bar', type: 'toggle', label: 'Connect the letters', help: 'Adds a thin bar underneath so all letters hold together.', default: true },
    // more
    { key: 'bail', type: 'select', more: true, label: 'Loop for the chain', help: 'A loop on top for a chain, or none.', default: 'loop', options: [['loop', 'Loop on top'], ['none', 'No loop']] },
    { key: 'outline', type: 'toggle', more: true, label: 'Outline letters', help: 'Only the outline of the letters, like a wire.', default: false },
    { key: 'bold', type: 'range', more: true, label: 'Line boldness', help: 'Makes thin strokes thicker so they can be cast.', min: 0, max: 8, step: 1, unit: 'px', default: 2 },
    { key: 'edge', type: 'range', more: true, label: 'Rounded edges', help: 'Softens the edges a little.', min: 0, max: 0.5, step: 0.05, unit: 'mm', default: 0 },
    { key: 'bailD', type: 'range', more: true, show: (p) => p.bail === 'loop', label: 'Loop opening', help: 'Inside width of the loop.', min: 2, max: 8, step: 0.1, unit: 'mm', default: 3 },
    { key: 'bailW', type: 'range', more: true, show: (p) => p.bail === 'loop', label: 'Loop wire', help: 'Thickness of the loop wire.', min: 0.6, max: 2.5, step: 0.1, unit: 'mm', default: 1.1 },
  ],
  templates: [
    { label: 'Gothic name', p: { text: 'TRIAD', font: 'Pirata One', bar: true } },
    { label: '東京 Japanese', p: { text: '東京', font: 'Noto Sans JP', bar: true, height: 18 } },
    { label: 'حب Arabic', p: { text: 'حب', font: 'Reem Kufi', bar: false, height: 18 } },
    { label: 'Москва Russian', p: { text: 'Москва', font: 'Ruslan Display', bar: true } },
    { label: 'Glitch', p: { text: 'NOISE', font: 'Rubik Glitch', bar: true } },
  ],
  fontsFor: (p) => [[p.font, p.text]],
  build(p, ctx) {
    if (!p.text.trim()) return { parts: [], volume: 0, minWall: 0, empty: true, warnings: ['Type a word first.'], dims: [], title: 'Lettering' };
    const pixels = textPixels(p, ctx.makeCanvas);
    const r = pendant.build({ ...p, shape: 'custom', threshold: 128, invert: false, fill: false }, { ...ctx, pixels });
    r.title = `“${p.text}”`;
    r.dims.unshift(['Text', `${p.text} · ${fontOptions().find(([f]) => f === p.font)?.[1] || p.font}`]);
    return r;
  },
};
