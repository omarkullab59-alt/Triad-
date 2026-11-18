// CROWN · TIARA · MASK: a flat drawing (template, motif, or your own sketch) is cut out and bent around the head.
import * as THREE from 'three';
import { outlineFromPixels, thinParts } from '../outline.js';
import { geometryVolume } from '../revolve.js';
import { extrude, deform } from '../solid.js';
import { MOTIFS, trimCanvas } from '../../lib/motifs.js';
import { MIN_WALL } from '../../lib/sizes.js';

const TAU = Math.PI * 2;
const cut = (c, fn) => { c.save(); c.globalCompositeOperation = 'destination-out'; fn(); c.restore(); };

// Built-in patterns: draw(ctx, w, h) in black. Crowns draw ONE segment (repeated around the head).
const PATTERNS = {
  crown: {
    classic: ['Classic points', (c, w, h) => { c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.5, h * 0.12); c.lineTo(w, h); c.fill(); c.beginPath(); c.arc(w / 2, h * 0.1, w * 0.09, 0, TAU); c.fill(); cut(c, () => { c.beginPath(); c.arc(w / 2, h * 0.62, w * 0.1, 0, TAU); c.fill(); }); }],
    peaks: ['TRIAD peaks', (c, w, h) => { c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.17, h * 0.35); c.lineTo(w * 0.33, h * 0.7); c.lineTo(w * 0.5, h * 0.02); c.lineTo(w * 0.67, h * 0.7); c.lineTo(w * 0.83, h * 0.35); c.lineTo(w, h); c.fill(); }],
    gothic: ['Gothic arches', (c, w, h) => { c.beginPath(); c.moveTo(w * 0.02, h); c.lineTo(w * 0.02, h * 0.55); c.quadraticCurveTo(w * 0.05, h * 0.15, w * 0.5, h * 0.02); c.quadraticCurveTo(w * 0.95, h * 0.15, w * 0.98, h * 0.55); c.lineTo(w * 0.98, h); c.fill(); cut(c, () => { c.beginPath(); c.moveTo(w * 0.2, h * 0.92); c.lineTo(w * 0.2, h * 0.58); c.quadraticCurveTo(w * 0.22, h * 0.32, w * 0.5, h * 0.2); c.quadraticCurveTo(w * 0.78, h * 0.32, w * 0.8, h * 0.58); c.lineTo(w * 0.8, h * 0.92); c.fill(); }); c.beginPath(); c.moveTo(w * 0.5, h * 0.2); c.lineTo(w * 0.5, h * 0.92); c.lineWidth = w * 0.08; c.stroke(); }],
    spikes: ['Spikes', (c, w, h) => { for (const [x, t] of [[0.25, 0.3], [0.75, 0.0]]) { c.beginPath(); c.moveTo(w * (x - 0.13), h); c.lineTo(w * x, h * t); c.lineTo(w * (x + 0.13), h); c.fill(); } }],
  },
  tiara: {
    classic: ['Classic', (c, w, h) => { const n = 9; for (let i = 0; i < n; i++) { const t = i / (n - 1), x = w * (0.06 + 0.88 * t), top = h * (0.05 + 0.75 * Math.abs(t - 0.5) * 1.6); c.beginPath(); c.moveTo(x - w * 0.045, h); c.lineTo(x, top); c.lineTo(x + w * 0.045, h); c.fill(); c.beginPath(); c.arc(x, top, w * 0.014 + (1 - Math.abs(t - 0.5)) * w * 0.012, 0, TAU); c.fill(); } cut(c, () => { for (let i = 0; i < 9; i++) { const t = i / 8; c.beginPath(); c.arc(w * (0.06 + 0.88 * t), h * 0.85, w * 0.012, 0, TAU); c.fill(); } }); }],
    peaks: ['TRIAD peaks', (c, w, h) => { c.beginPath(); c.moveTo(0, h); c.lineTo(w * 0.3, h * 0.5); c.lineTo(w * 0.4, h * 0.72); c.lineTo(w * 0.5, h * 0.02); c.lineTo(w * 0.6, h * 0.72); c.lineTo(w * 0.7, h * 0.5); c.lineTo(w, h); c.fill(); cut(c, () => { c.beginPath(); c.moveTo(w * 0.5, h * 0.3); c.lineTo(w * 0.54, h * 0.75); c.lineTo(w * 0.46, h * 0.75); c.fill(); }); }],
    sun: ['Sunburst', (c, w, h) => { for (let i = 0; i < 15; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 15); const l = h * (i % 2 ? 0.65 : 0.95); c.beginPath(); c.moveTo(w / 2 + Math.cos(a - 0.05) * h * 0.2, h + Math.sin(a - 0.05) * h * 0.2); c.lineTo(w / 2 + Math.cos(a) * l, h + Math.sin(a) * l); c.lineTo(w / 2 + Math.cos(a + 0.05) * h * 0.2, h + Math.sin(a + 0.05) * h * 0.2); c.fill(); } c.beginPath(); c.arc(w / 2, h, h * 0.25, Math.PI, TAU); c.fill(); }],
  },
  mask: {
    masquerade: ['Masquerade', (c, w, h) => { c.beginPath(); c.moveTo(w * 0.5, h * 0.62); c.bezierCurveTo(w * 0.3, h * 0.85, w * 0.05, h * 0.75, w * 0.02, h * 0.2); c.bezierCurveTo(w * 0.2, h * 0.38, w * 0.38, h * 0.3, w * 0.5, h * 0.36); c.bezierCurveTo(w * 0.62, h * 0.3, w * 0.8, h * 0.38, w * 0.98, h * 0.2); c.bezierCurveTo(w * 0.95, h * 0.75, w * 0.7, h * 0.85, w * 0.5, h * 0.62); c.fill(); cut(c, () => { for (const x of [0.32, 0.68]) { c.beginPath(); c.ellipse(w * x, h * 0.55, w * 0.1, h * 0.08, x < 0.5 ? 0.15 : -0.15, 0, TAU); c.fill(); } }); }],
    face: ['Full face', (c, w, h) => { c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.4, h * 0.48, 0, 0, TAU); c.fill(); cut(c, () => { for (const x of [0.36, 0.64]) { c.beginPath(); c.ellipse(w * x, h * 0.4, w * 0.07, h * 0.04, 0, 0, TAU); c.fill(); } c.beginPath(); c.moveTo(w * 0.47, h * 0.62); c.lineTo(w * 0.53, h * 0.62); c.lineTo(w * 0.5, h * 0.5); c.fill(); c.beginPath(); c.ellipse(w / 2, h * 0.76, w * 0.1, h * 0.022, 0, 0, TAU); c.fill(); }); }],
    half: ['Half face', (c, w, h) => { c.beginPath(); c.moveTo(w / 2, h * 0.04); c.bezierCurveTo(w * 0.85, h * 0.04, w * 0.92, h * 0.4, w * 0.88, h * 0.62); c.bezierCurveTo(w * 0.82, h * 0.85, w * 0.62, h * 0.92, w * 0.5, h * 0.9); c.lineTo(w / 2, h * 0.04); c.fill(); cut(c, () => { c.beginPath(); c.ellipse(w * 0.66, h * 0.4, w * 0.07, h * 0.04, 0, 0, TAU); c.fill(); }); }],
    warrior: ['Warrior', (c, w, h) => { c.beginPath(); c.moveTo(w * 0.1, h * 0.1); c.lineTo(w * 0.5, h * 0.22); c.lineTo(w * 0.9, h * 0.1); c.lineTo(w * 0.85, h * 0.62); c.lineTo(w * 0.62, h * 0.95); c.lineTo(w * 0.38, h * 0.95); c.lineTo(w * 0.15, h * 0.62); c.fill(); cut(c, () => { for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w * (0.5 + k * 0.06), h * 0.42); c.lineTo(w * (0.5 + k * 0.3), h * 0.33); c.lineTo(w * (0.5 + k * 0.24), h * 0.47); c.fill(); } c.beginPath(); c.rect(w * 0.44, h * 0.72, w * 0.12, h * 0.04); c.fill(); }); }],
  },
};
const MOTIF_KEYS = Object.keys(MOTIFS).filter((k) => !MOTIFS[k].pattern || ['meander', 'stepfret'].includes(k));
export const patternOptions = (kind) => [...Object.entries(PATTERNS[kind] || PATTERNS.crown).map(([k, [l]]) => [k, l]), ...MOTIF_KEYS.map((m) => [`m:${m}`, `Motif: ${MOTIFS[m].label}`])];

const DEFAULTS = { crown: { height: 60 }, tiara: { height: 48 }, mask: { height: 110 } };

export const wearable = {
  id: 'wearable',
  label: 'Crown · Tiara · Mask',
  minWall: 0.8,
  view: 'front',
  params: [
    { key: 'kind', type: 'select', label: 'What', help: 'A crown goes all the way round, a tiara sits at the front, a mask covers the face.', default: 'crown', options: [['crown', 'Crown'], ['tiara', 'Tiara'], ['mask', 'Mask']], resets: ['pattern'] },
    { key: 'pattern', type: 'select', label: 'Pattern', help: 'Start from a pattern or a motif. Upload or draw below to use your own.', default: 'classic', options: (p) => patternOptions(p.kind) },
    { key: 'shape', type: 'source', label: 'Your own drawing', help: 'Draw the front view (crown: one repeat). Dark = metal. It replaces the pattern.', default: '' },
    { key: 'height', type: 'range', label: 'Height', help: 'How tall it is.', min: 10, max: 220, step: 1, unit: 'mm', default: 60 },
    { key: 'head', type: 'range', label: 'Head size', help: 'Measure around the head where it will sit (forehead). Most adults: 54–60 cm.', min: 440, max: 660, step: 5, unit: 'mm', default: 570 },
    // more
    { key: 'thick', type: 'range', more: true, label: 'Thickness', help: 'Metal thickness. 1.2–2 mm is sturdy.', min: 0.6, max: 5, step: 0.1, unit: 'mm', default: 1.5 },
    { key: 'repeat', type: 'range', more: true, show: (p) => p.kind === 'crown', label: 'Repeats', help: 'How many times the pattern goes around.', min: 3, max: 16, step: 1, unit: '×', default: 6 },
    { key: 'band', type: 'toggle', more: true, show: (p) => p.kind !== 'mask', label: 'Base band', help: 'A band along the bottom holds everything together.', default: true },
    { key: 'flare', type: 'range', more: true, show: (p) => p.kind === 'crown', label: 'Open to the top', help: 'Makes the crown wider at the top.', min: -10, max: 35, step: 1, unit: '%', default: 8 },
    { key: 'arc', type: 'range', more: true, show: (p) => p.kind === 'tiara', label: 'Width around the head', help: 'How far the tiara reaches around the head.', min: 90, max: 260, step: 5, unit: '°', default: 180 },
    { key: 'curve', type: 'range', more: true, show: (p) => p.kind === 'mask', label: 'Face curve', help: 'How much the mask curves around nose and chin.', min: 0, max: 40, step: 1, unit: '%', default: 16 },
  ],
  templates: [
    { label: 'Royal crown', p: { kind: 'crown', pattern: 'classic', height: 60, repeat: 6 } },
    { label: 'TRIAD crown', p: { kind: 'crown', pattern: 'peaks', height: 55, repeat: 7, accent: true } },
    { label: 'Flame crown', p: { kind: 'crown', pattern: 'm:flame', height: 50, repeat: 8 } },
    { label: 'Tiara', p: { kind: 'tiara', pattern: 'classic', height: 48 } },
    { label: 'Masquerade', p: { kind: 'mask', pattern: 'masquerade', height: 85 } },
    { label: 'Skull mask', p: { kind: 'mask', pattern: 'm:skull', height: 150 } },
  ],
  hasMotif: (p) => (String(p.pattern).startsWith('m:') ? [p.pattern.slice(2)] : []),

  build(p, ctx) {
    const C = p.head;
    const R = C / (2 * Math.PI);
    const H = p.height;
    const widthMm = p.kind === 'crown' ? C * 1.004 : p.kind === 'tiara' ? (C * p.arc) / 360 : Math.min(C * 0.33, 210);
    // canvas: px per mm chosen so the whole thing is ≤ 2400 px wide
    const ppm = Math.min(6, 2400 / widthMm, 900 / H);
    const W = Math.round(widthMm * ppm), Hp = Math.round(H * ppm);
    const canvas = ctx.makeCanvas(W + 8, Hp + 8);
    const c = canvas.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#fff'; c.fillRect(0, 0, W + 8, Hp + 8);
    const segs = p.kind === 'crown' ? Math.round(p.repeat) : 1;
    const segW = W / segs;
    const bandH = p.kind !== 'mask' && p.band ? Math.max(Hp * 0.14, 3 * ppm) : 0;
    const raw = ctx.pixels ? toCanvas(ctx.pixels, ctx.makeCanvas) : String(p.pattern).startsWith('m:') ? ctx.motifCanvas?.(p.pattern.slice(2)) : null;
    const art = raw ? trimCanvas(raw) : null; // no empty margins: the pattern sits right on the band
    const draw = (PATTERNS[p.kind] || PATTERNS.crown)[p.pattern]?.[1] || Object.values(PATTERNS[p.kind] || PATTERNS.crown)[0][1];
    for (let i = 0; i < segs; i++) {
      const seg = ctx.makeCanvas(Math.max(1, Math.round(segW)), Math.max(1, Math.round(art ? Hp - bandH * 0.3 : Hp - bandH * 0.5)));
      const sc = seg.getContext('2d');
      sc.fillStyle = sc.strokeStyle = '#000';
      if (art) sc.drawImage(art, 0, 0, seg.width, seg.height);
      else draw(sc, seg.width, seg.height);
      c.drawImage(seg, 4 + i * segW, 4);
    }
    // own drawings / motifs come as black on white: make white transparent was done in toCanvas
    if (bandH) { c.fillStyle = '#000'; c.fillRect(4, 4 + Hp - bandH, W, bandH); }
    if (p.kind === 'mask' && !ctx.pixels) { // strap slots
      c.fillStyle = '#000'; for (const x of [0.03, 0.97]) { c.beginPath(); c.ellipse(4 + W * x, 4 + Hp * 0.42, W * 0.04, Hp * 0.09, 0, 0, TAU); c.fill(); }
      c.fillStyle = '#fff'; for (const x of [0.03, 0.97]) { c.beginPath(); c.ellipse(4 + W * x, 4 + Hp * 0.42, W * 0.015, Hp * 0.05, 0, 0, TAU); c.fill(); }
    }
    const px = c.getImageData(0, 0, W + 8, Hp + 8);
    const res = outlineFromPixels(px, { threshold: 128 });
    if (!res.shapes.length) return { parts: [], volume: 0, minWall: 0, empty: true, warnings: ['Nothing to build: draw darker lines or pick a pattern.'], dims: [], title: 'Crown' };
    // pixel → mm (x centred, y from 0 at the bottom)
    const sx = widthMm / W, sy = H / Hp;
    const toV = ([x, y]) => new THREE.Vector2((x - 4 - W / 2) * sx, (Hp + 4 - y) * sy);
    const shapes = res.shapes.map((s) => { const sh = new THREE.Shape(s.outer.map(toV)); sh.holes = s.holes.map((hh) => new THREE.Path(hh.map(toV))); return sh; });
    let g = extrude(shapes, p.thick, { accentFaces: true, curveSegments: 4 });
    const curve = p.curve / 100;
    const Rf = 92;
    g = deform(g, Math.max(1.5, Math.min(widthMm, H) / 70), ([x, y, z]) => {
      if (p.kind === 'mask') {
        const a = x / Rf, yn = y / H - 0.5;
        const r = Rf + z;
        return [r * Math.sin(a), y, r * Math.cos(a) - curve * H * (yn * yn * 2) + curve * H * 0.25 * Math.exp(-((x / (widthMm * 0.08)) ** 2) - ((yn + 0.05) / 0.18) ** 2)];
      }
      const r = R * (1 + (p.kind === 'crown' ? (p.flare / 100) * (y / H) : 0)) + p.thick / 2 + z;
      const a = x / R;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    });
    const volume = geometryVolume(g);
    const thin = thinParts(res.mask, MIN_WALL / 2 / Math.min(sx, sy));
    const warnings = [];
    if (thin > 0.02) warnings.push(`About ${Math.round(thin * 100)} % of the shape is thinner than ${MIN_WALL} mm. Use bolder lines or make it bigger.`);
    if (res.shapes.length > 1) warnings.push(`There are ${res.shapes.length} separate parts. Turn on “Base band” or connect your drawing.`);
    if (p.thick < MIN_WALL) warnings.push(`Thickness under ${MIN_WALL} mm bends too easily.`);
    return {
      parts: [{ geometry: g }], volume, minWall: Math.min(p.thick, thin > 0.02 ? 0.79 : p.thick), warnings,
      dims: [['Head', `${(C / 10).toFixed(1)} cm around`], ['Size', `${(widthMm / 10).toFixed(1)} cm wide (flat) × ${H} mm high`], ['Metal', `${p.thick} mm`]],
      title: { crown: 'Crown', tiara: 'Tiara', mask: 'Mask' }[p.kind],
      mask: res.mask,
    };
  },
};
wearable.params.find((d) => d.key === 'height').defaultFor = (p) => DEFAULTS[p.kind]?.height;

function toCanvas(px, makeCanvas) {
  const c = makeCanvas(px.width, px.height);
  const x = c.getContext('2d');
  const d = new ImageData(new Uint8ClampedArray(px.data), px.width, px.height);
  for (let i = 0; i < d.data.length; i += 4) { const lum = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11; const on = lum < 140; d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = on ? 255 : 0; }
  x.putImageData(d, 0, 0);
  return c;
}
