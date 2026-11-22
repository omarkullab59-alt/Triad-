// TAPE: caution-tape style band with your text (any script) or your own design, repeating endlessly.
// Shown as a strip, a roll or a loop; downloads a print file (one repeat, 300 dpi) for real tape.
import * as THREE from 'three';
import { geometryVolume } from '../jewellery/revolve.js';
import { fontStack, isRTL } from '../lib/fonts.js';

const LIME = '#c4ef2f', BLACK = '#0a0a0a';

/** One repeat of the tape artwork, height = px. */
export function tapeArt(p, makeCanvas, px = 200, design = null) {
  const H = px;
  const c0 = makeCanvas(8, 8); const x0 = c0.getContext('2d');
  const font = fontStack(p.font, H * 0.5, p.text);
  x0.font = font;
  const textW = p.text.trim() ? x0.measureText(p.text).width : 0;
  const unit = Math.max(H * 2, textW + H * 1.2 + (design ? H * 1.2 : 0));
  const c = makeCanvas(Math.ceil(unit), H);
  const x = c.getContext('2d');
  const [bg, fg] = p.style === 'black' ? [BLACK, LIME] : p.style === 'stripes' ? [LIME, BLACK] : p.style === 'white' ? ['#ffffff', BLACK] : [LIME, BLACK];
  x.fillStyle = bg; x.fillRect(0, 0, c.width, H);
  if (p.style === 'stripes') { // diagonal hazard stripes at the edges
    x.save(); x.beginPath(); x.rect(0, 0, c.width, H * 0.16); x.rect(0, H * 0.84, c.width, H * 0.16); x.clip();
    x.fillStyle = BLACK; for (let i = -H; i < c.width + H; i += H * 0.36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H * 0.18, 0); x.lineTo(i + H * 0.18 - H, H); x.lineTo(i - H, H); x.fill(); }
    x.restore();
  } else { x.fillStyle = fg; x.fillRect(0, H * 0.07, c.width, H * 0.035); x.fillRect(0, H * 0.895, c.width, H * 0.035); }
  let cx = H * 0.6;
  if (design) { const k = (H * 0.62) / design.height; x.drawImage(design, cx, H * 0.19, design.width * k, design.height * k); cx += design.width * k + H * 0.5; }
  if (textW) { x.fillStyle = p.style === 'stripes' ? BLACK : fg; x.font = font; x.textBaseline = 'middle'; x.textAlign = 'left'; x.direction = isRTL(p.text) ? 'rtl' : 'ltr'; x.fillText(p.text, x.direction === 'rtl' ? cx + textW : cx, H * 0.53); }
  return c;
}

export const tape = {
  id: 'tape',
  label: 'Tape',
  category: 'wear',
  materials: ['film', 'nylon', 'cotton', 'leather_black'],
  defaultMaterial: 'film',
  minWall: 0.05,
  noEngrave: true,
  noDestroy: true,
  view: 'front',
  params: [
    { key: 'text', type: 'text', label: 'Text', help: 'Repeats along the tape. Any language.', default: 'TRIAD — DO NOT ENTER — ', max: 60 },
    { key: 'style', type: 'select', label: 'Look', help: 'Lime with black text, black with lime, hazard stripes, or white.', default: 'lime', options: [['lime', 'Lime'], ['black', 'Black'], ['stripes', 'Hazard stripes'], ['white', 'White']] },
    { key: 'font', type: 'font', label: 'Font', help: 'Style or script.', default: 'Anton' },
    { key: 'width', type: 'range', label: 'Width', help: 'Barrier tape is 75 mm; for clothing trims 20–40 mm.', min: 10, max: 150, step: 1, unit: 'mm', default: 75 },
    { key: 'form', type: 'select', label: 'Show as', help: 'Lying strip, a roll, or a closed loop (bracelet, belt, wrap).', default: 'strip', options: [['strip', 'Strip'], ['roll', 'Roll'], ['loop', 'Loop']] },
    // more
    { key: 'design', type: 'design', more: true, label: 'Your design on the tape', help: 'Adds one of your uploaded designs (logo) to every repeat.', default: '' },
    { key: 'length', type: 'range', more: true, label: 'Length shown', help: 'How much tape is shown (strip and loop).', min: 150, max: 2000, step: 10, unit: 'mm', default: 700 },
  ],
  templates: [
    { label: 'TRIAD barrier', p: { text: 'TRIAD — DO NOT ENTER — ', style: 'lime', width: 75, form: 'strip' } },
    { label: 'Hazard', p: { text: 'TRIAD ', style: 'stripes', width: 75, form: 'roll' } },
    { label: 'Black trim', p: { text: 'TRIAD · TRIAD · ', style: 'black', width: 30, form: 'strip' } },
    { label: 'Wristband', p: { text: 'TRIAD ', style: 'lime', width: 20, form: 'loop', length: 190 } },
    { label: '立入禁止', p: { text: '立入禁止 · ', style: 'lime', font: 'Noto Sans JP', width: 75 } },
  ],
  fontsFor: (p) => [[p.font, p.text]],

  build(p, ctx) {
    const W = p.width, th = 0.15 * Math.max(1, W / 75) + (p.form === 'loop' ? 0.4 : 0);
    const art = tapeArt(p, ctx.makeCanvas, 240, ctx.designCanvas?.(p.design) || null);
    const unitMm = (art.width / art.height) * W;
    const L = p.form === 'roll' ? Math.max(p.length, unitMm * 6) : p.length;
    const seg = Math.min(800, Math.ceil(L / 3));
    const g = new THREE.BoxGeometry(L, th, W, seg, 1, 1);
    // top face (+y, group 2) carries the print; texture repeats along the tape
    const reps = L / unitMm;
    const uv = g.attributes.uv;
    for (const gr of g.groups) {
      if (gr.materialIndex === 2 || gr.materialIndex === 3) {
        const idx = g.index.array;
        const verts = new Set(); for (let i = gr.start; i < gr.start + gr.count; i++) verts.add(idx[i]);
        for (const v of verts) uv.setX(v, uv.getX(v) * reps);
      }
      gr.materialIndex = gr.materialIndex === 2 ? 3 : 0;
    }
    g.userData.groups = true;
    // bend into its form
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + L / 2, y = pos.getY(i), z = pos.getZ(i);
      let X, Y, Z;
      if (p.form === 'loop') { const R = L / (2 * Math.PI), a = (x / L) * Math.PI * 2; X = (R + y) * Math.sin(a); Y = -z; Z = (R + y) * Math.cos(a); }
      else if (p.form === 'roll') {
        const core = 38, k = th + 0.12; let a = 0, r = core; // unroll: radius grows by one thickness per turn
        const turns = Math.max(0, L - Math.min(unitMm * 0.6, 160));
        const xr = Math.min(x, turns);
        a = xr / (core + (xr / (2 * Math.PI * core)) * k * 0.5); r = core + (a / (2 * Math.PI)) * k;
        if (x <= turns) { X = (r + y) * Math.sin(a); Y = -z; Z = (r + y) * Math.cos(a); }
        else { const ex = x - turns; X = (r + y) * Math.sin(a) + ex * Math.cos(a); Y = -z - ex * 0.05; Z = (r + y) * Math.cos(a) - ex * Math.sin(a); }
      } else { X = x - L / 2; Y = y + Math.sin((x / L) * Math.PI * 3) * W * 0.12; Z = z + Math.sin((x / L) * Math.PI * 2.2) * W * 0.25; }
      pos.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals();
    const repeatCanvas = art;
    return {
      parts: [{ geometry: g }], volume: geometryVolume(g), minWall: th,
      texture: { canvas: repeatCanvas, repeat: true },
      warnings: [],
      dims: [['Tape', `${W} mm wide · one repeat ${unitMm.toFixed(0)} mm`], ['Text', `“${p.text.trim()}”`], ['Look', { lime: 'Lime / black', black: 'Black / lime', stripes: 'Hazard stripes', white: 'White / black' }[p.style]]],
      title: 'Tape',
      downloads: [{
        label: 'Print file (PNG, 300 dpi)', small: 'one repeat — your printer tiles it', filename: 'triad-tape-repeat.png',
        make: () => new Promise((res) => { const px = Math.round((W / 25.4) * 300); tapeArt(p, ctx.makeCanvas, px, ctx.designCanvas?.(p.design) || null).toBlob(res, 'image/png'); }),
      }],
    };
  },
};
