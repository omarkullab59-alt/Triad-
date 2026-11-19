// CLOTHING: tops (tee, longsleeve, hoodie, sweatshirt, jacket, coat, vest) and bottoms (trousers, shorts, skirt).
// Built as a technical flat (front + back) from measurements — shoulder shape, slope, drop, armhole, sleeve type,
// crotch depth and drop, rise, leg shape … — and every point of the silhouette can be dragged freely
// (symmetric or asymmetric). Outputs: flats, a puffed 3D preview, a size chart (XS–XXL) and a tech pack (SVG).
import * as THREE from 'three';
import { polygonize } from '../sculpt/sdf.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const TOPS = ['tee', 'long', 'hoodie', 'sweat', 'jacket', 'coat', 'vest'];
const FIT = { slim: -40, regular: 0, relaxed: 60, oversized: 130, extreme: 230 }; // mm added to the flat chest
const D = Math.PI / 180;

/* ── points & edits ─────────────────────────────────────────── */
/** "S:12,-4;A_R:3,0" → { S: [12,-4], A_R: [3,0] } */
export function parseEdits(s) {
  const out = {};
  for (const part of String(s || '').split(';')) { const m = part.match(/^([A-Z0-9]+(?:_[LR])?):(-?[\d.]+),(-?[\d.]+)$/); if (m) out[m[1]] = [Number(m[2]), Number(m[3])]; }
  return out;
}
export const stringifyEdits = (o) => Object.entries(o).filter(([, v]) => v[0] || v[1]).map(([k, [x, y]]) => `${k}:${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(';');

/** Apply edits to named right-half points and mirror them to the left. pts: [[name, x, y], …] for the right side (x ≥ 0). */
function mirrorWithEdits(right, edits, asym) {
  const R = [], L = [];
  for (const [n, x, y] of right) {
    const e = asym ? edits[`${n}_R`] : edits[n];
    const el = asym ? edits[`${n}_L`] : edits[n] && [-edits[n][0], edits[n][1]];
    R.push({ n: `${n}_R`, base: n, x: x + (e?.[0] || 0), y: y + (e?.[1] || 0) });
    L.push({ n: `${n}_L`, base: n, x: -x + (el?.[0] || 0), y: y + (el?.[1] || 0) });
  }
  return { R, L };
}

/* ── tops ───────────────────────────────────────────────────── */
const hasHood = (p) => p.garment === 'hoodie' || (['jacket', 'coat'].includes(p.garment) && p.hood > 0);
function topPoints(p, g) {
  const chest = (p.chest * 10 / 2 + FIT[p.fit] + g.chest / 2) / 2; // half of the flat chest width, mm
  const shoulderHalf = (p.shoulder * 10) / 2 + g.shoulder / 2 + (p.fit === 'oversized' ? 40 : p.fit === 'extreme' ? 80 : 0);
  const neck = (p.neckW * 10) / 2;
  const slope = p.slope * D;
  let S = [shoulderHalf, -Math.tan(slope) * (shoulderHalf - neck)];
  const sh = p.shoulderShape;
  if (sh === 'dropped') S = [S[0] + p.drop, S[1] - p.drop * 0.55];
  if (sh === 'extended') S = [S[0] + 35, S[1] + 6];
  if (sh === 'padded') S = [S[0] + 18, S[1] + p.pad];
  if (sh === 'raglan') S = [neck + 30, -12];
  const L = p.length * 10 + g.length;
  const armY = -(p.armhole * 10 + g.armhole * 0.4) + (sh === 'dropped' ? -p.drop * 0.6 : 0);
  const A = [chest, armY];
  const waistY = -L * 0.62;
  const W = [chest - p.waist, waistY];
  const H = [chest + p.flare, -L];
  const pts = [['N', neck, 0], ['S', S[0], S[1]]];
  if (sh === 'puff' && p.garment !== 'vest') pts.push(['P', S[0] + 6, S[1] + 22]);
  if (p.garment !== 'vest') {
    const len = p.sleeve * 10 + g.sleeve;
    const a = p.sleeveAngle * D;
    const dir = [Math.cos(a), -Math.sin(a)], inward = [-Math.sin(a), -Math.cos(a)]; // along the sleeve / towards the underarm
    const bicep = p.bicep * 10 + g.chest * 0.3 + (p.fit === 'oversized' ? 50 : p.fit === 'extreme' ? 100 : 0);
    const cuff = p.cuffW * 10;
    const widthAt = (t) => {
      let w = bicep + (cuff - bicep) * (p.sleeveShape === 'tapered' ? t ** 0.7 : t);
      if (p.sleeveShape === 'bell') w += Math.max(0, t - 0.45) * 2 * cuff * 1.4;
      if (p.sleeveShape === 'puff') w += Math.sin(Math.PI * Math.min(1, t * 1.5)) * bicep * 0.5;
      if (p.sleeveShape === 'bishop') w += Math.sin(Math.PI * Math.min(1, t * 1.15)) * bicep * 0.45;
      return Math.max(30, w);
    };
    const top = (t) => [S[0] + dir[0] * len * t, S[1] + dir[1] * len * t];
    const inner = (t) => { const q = top(t), w = widthAt(t); return [q[0] + inward[0] * w, q[1] + inward[1] * w]; };
    pts.push(['O3', ...top(0.35)], ['O7', ...top(0.7)], ['CO', ...top(1)], ['CI', ...inner(1)], ['I7', ...inner(0.7)], ['I3', ...inner(0.35)]);
  }
  pts.push(['A', A[0], A[1]], ['W', W[0], W[1]], ['H', H[0], H[1]]);
  return { pts, L, chest, neck, S, A };
}

function topFlat(p, g, edits, back) {
  const { pts, L, neck } = topPoints(p, g);
  const { R, L: Lf } = mirrorWithEdits(pts, edits, p.asym);
  const hemCurve = p.hem === 'curved' ? 40 : 0;
  const hiLo = back && p.hem === 'hilo' ? 60 : 0;
  const asym = p.hem === 'asym' ? 70 : 0;
  // hem: centre point, hi-lo / asymmetric hems move the side points
  const hR = R.find((q) => q.base === 'H'), hL = Lf.find((q) => q.base === 'H');
  hR.y -= hiLo + asym; hL.y -= hiLo;
  const H0 = { n: 'H0', x: (hR.x + hL.x) / 2 + (edits.H0?.[0] || 0), y: -L - hemCurve - hiLo - asym / 2 + (edits.H0?.[1] || 0) };
  // top edge: back neck (slightly higher) and hood
  const top = [];
  if (hasHood(p)) {
    const hw = (p.hood * 10) / 2, hh = p.hood * 10 * 1.45;
    top.push({ n: 'HD_L', x: -hw * 0.95 + (edits.HD?.[0] ? -edits.HD[0] : 0), y: hh * 0.55 }, { n: 'HT', x: 0 + (edits.HT?.[0] || 0), y: hh + (edits.HT?.[1] || 0) }, { n: 'HD_R', x: hw * 0.95 + (edits.HD?.[0] || 0), y: hh * 0.55 + (edits.HD?.[1] || 0) });
  } else if (p.neckline === 'turtle' || p.neckline === 'mock') {
    const h = p.neckline === 'turtle' ? 70 : 35;
    top.push({ n: 'TN_L', x: -neck * 0.95, y: h }, { n: 'TN_R', x: neck * 0.95, y: h });
  } else top.push({ n: 'BN', x: 0, y: back ? 8 : 15 });
  const outline = [...top, ...R, H0, ...Lf.reverse()];
  // details (lines)
  const lines = [];
  const nR = R.find((q) => q.base === 'N'), nL = Lf.find((q) => q.base === 'N');
  const sR = R.find((q) => q.base === 'S'), sL = Lf.find((q) => q.base === 'S');
  const aR = R.find((q) => q.base === 'A'), aL = Lf.find((q) => q.base === 'A');
  if (!back && !(hasHood(p))) {
    const nd = p.neckline === 'v' ? p.neckD * 10 * 2.2 : p.neckline === 'square' ? p.neckD * 10 : p.neckline === 'boat' ? 15 : p.neckD * 10;
    if (p.neckline === 'v') lines.push({ d: `M${nL.x} ${nL.y} L0 ${-nd} L${nR.x} ${nR.y}`, k: 'seam' });
    else if (p.neckline === 'square') lines.push({ d: `M${nL.x} ${nL.y} L${nL.x} ${-nd} L${nR.x} ${-nd} L${nR.x} ${nR.y}`, k: 'seam' });
    else lines.push({ d: `M${nL.x} ${nL.y} Q0 ${-nd * 2} ${nR.x} ${nR.y}`, k: 'seam' });
    if (p.neckline === 'collar' || ['jacket', 'coat'].includes(p.garment)) lines.push({ d: `M${nL.x} ${nL.y} L${nL.x - 25} ${-nd * 0.9 - 30} L-6 ${-nd * 1.2} M${nR.x} ${nR.y} L${nR.x + 25} ${-nd * 0.9 - 30} L6 ${-nd * 1.2}`, k: 'seam' });
    if (p.neckline === 'crew' || p.neckline === 'mock') lines.push({ d: `M${nL.x - 6} ${nL.y} Q0 ${-nd * 2 - 26} ${nR.x + 6} ${nR.y}`, k: 'stitch' });
  }
  if (hasHood(p)) lines.push(back ? { d: `M0 ${p.hood * 14.5} L0 0`, k: 'seam' } : { d: `M${-neck * 0.7} ${p.hood * 6} Q0 ${p.hood * 14} ${neck * 0.7} ${p.hood * 6} Q${neck * 0.9} -10 0 ${-p.neckD * 10} Q${-neck * 0.9} -10 ${-neck * 0.7} ${p.hood * 6}`, k: 'seam' });
  if (p.garment === 'hoodie' && !back) lines.push({ d: `M-22 ${-p.neckD * 10} l-6 -70 M22 ${-p.neckD * 10} l6 -70`, k: 'cord' });
  // shoulder & armhole seams
  if (p.shoulderShape === 'raglan') { lines.push({ d: `M${nR.x} ${nR.y} L${aR.x} ${aR.y} M${nL.x} ${nL.y} L${aL.x} ${aL.y}`, k: 'seam' }); }
  else if (p.garment !== 'vest') {
    lines.push({ d: `M${nR.x} ${nR.y} L${sR.x} ${sR.y} M${nL.x} ${nL.y} L${sL.x} ${sL.y}`, k: 'seam' });
    lines.push({ d: `M${sR.x} ${sR.y} Q${(sR.x + aR.x) / 2 - 15} ${(sR.y + aR.y) / 2} ${aR.x} ${aR.y} M${sL.x} ${sL.y} Q${(sL.x + aL.x) / 2 + 15} ${(sL.y + aL.y) / 2} ${aL.x} ${aL.y}`, k: 'seam' });
  }
  // rib bands
  if (p.rib && p.garment !== 'vest') {
    for (const side of [R, Lf]) { const co = side.find((q) => q.base === 'CO'), ci = side.find((q) => q.base === 'CI'), o7 = side.find((q) => q.base === 'O7'), i7 = side.find((q) => q.base === 'I7'); const k = 0.18; lines.push({ d: `M${co.x + (o7.x - co.x) * k} ${co.y + (o7.y - co.y) * k} L${ci.x + (i7.x - ci.x) * k} ${ci.y + (i7.y - ci.y) * k}`, k: 'seam' }); }
    lines.push({ d: `M${hL.x} ${hL.y + 70} L${H0.x} ${H0.y + 70} L${hR.x} ${hR.y + 70}`, k: 'seam' });
  } else lines.push({ d: `M${hL.x} ${hL.y + 22} L${H0.x} ${H0.y + 22} L${hR.x} ${hR.y + 22}`, k: 'stitch' });
  if (p.hem === 'split') lines.push({ d: `M${hR.x - 4} ${hR.y} l-2 90 M${hL.x + 4} ${hL.y} l2 90`, k: 'seam' });
  // front details
  if (!back) {
    const z = p.closure;
    if (z === 'full' || ['jacket', 'coat'].includes(p.garment) && z !== 'none') lines.push({ d: `M0 ${-p.neckD * 10} L${H0.x} ${H0.y}`, k: 'zip' });
    if (z === 'half') lines.push({ d: `M0 ${-p.neckD * 10} L0 ${-p.neckD * 10 - 220}`, k: 'zip' });
    if (z === 'buttons') for (let i = 0; i < 6; i++) lines.push({ d: `M0 ${-p.neckD * 10 - 40 - i * ((L - 120) / 6)} m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0`, k: 'button' });
    const py = -L * 0.66;
    if (p.pocket === 'kangaroo') lines.push({ d: `M-150 ${py} L-110 ${py + 150} L110 ${py + 150} L150 ${py} M-150 ${py} L150 ${py}`, k: 'seam' });
    if (p.pocket === 'patch') for (const sx of [-1, 1]) lines.push({ d: `M${sx * 70} ${py + 10} h${sx * 130} v-150 h${-sx * 130} z`, k: 'seam' });
    if (p.pocket === 'chest') lines.push({ d: `M60 ${-L * 0.22} h110 v-120 h-110 z`, k: 'seam' });
    if (p.pocket === 'flap') for (const sx of [-1, 1]) lines.push({ d: `M${sx * 60} ${-L * 0.25} h${sx * 120} v-130 h${-sx * 120} z M${sx * 56} ${-L * 0.25} h${sx * 128} v-40 h${-sx * 128} z`, k: 'seam' });
    if (p.panels === 'yoke') lines.push({ d: `M${aL.x} ${aL.y + 60} L${aR.x} ${aR.y + 60}`, k: 'seam' });
    if (p.panels === 'princess') for (const sx of [-1, 1]) lines.push({ d: `M${sx * (neck + 60)} ${-8} C${sx * 120} ${-L * 0.3} ${sx * 90} ${-L * 0.6} ${sx * 110} ${-L}`, k: 'seam' });
  } else if (p.panels === 'yoke') lines.push({ d: `M${aL.x} ${aL.y + 90} L${aR.x} ${aR.y + 90}`, k: 'seam' });
  return { outline, lines };
}

/* ── bottoms ─────────────────────────────────────────────────── */
function bottomFlat(p, g, edits, back) {
  const ease = FIT[p.fit] * 0.5;
  const waist = (p.waistW * 10 + g.waist) / 4 + (p.waistband === 'paperbag' ? 25 : 0);
  const hip = (p.hip * 10 + g.hip) / 4 + ease / 2;
  const riseExtra = { low: -40, mid: 0, high: 45 }[p.rise] || 0;
  const crotchY = -(p.crotch * 10 + g.rise + riseExtra + p.crotchDrop * 10);
  const hipY = -(p.crotch * 10 + riseExtra) * 0.62;
  const L = (p.bottom === 'shorts' ? Math.min(p.outseam, 62) : p.outseam) * 10 + g.length + riseExtra;
  const pts = [];
  if (p.bottom === 'skirt') {
    const hem = hip + p.flare;
    pts.push(['WT', waist, 0], ['HP', hip, hipY], ['SH', hem, -L]);
    const { R, L: Lf } = mirrorWithEdits(pts, edits, p.asym);
    const hemR = R.find((q) => q.base === 'SH'); if (p.hem === 'asym') hemR.y -= 120;
    const lines = [{ d: `M${-waist} -40 L${waist} -40`, k: 'seam' }];
    if (p.slit) lines.push({ d: `M${hemR.x * 0.4} ${hemR.y} l0 ${p.slit * 10}`, k: 'seam' });
    if (p.pleats) for (let i = 1; i <= p.pleats * 3; i++) { const t = i / (p.pleats * 3 + 1); lines.push({ d: `M${-waist + 2 * waist * t} -40 L${-hem + 2 * hem * t} ${-L}`, k: 'stitch' }); }
    return { outline: [...R, ...Lf.reverse()], lines };
  }
  const legGap = 4;
  const thigh = (p.thigh * 10 + g.thigh + ease * 0.6) / 2; // flat half thigh … full flat thigh = 2*thigh per leg? (flat leg width)
  const kneeY = crotchY - (L + crotchY) * 0.48;
  let legC = Math.max(legGap + thigh, hip * 0.55); // centre of each leg
  let knee = p.knee * 10 / 2 + g.knee / 2, hem = p.opening * 10 / 2 + g.opening / 2;
  const shape = p.leg;
  if (shape === 'wide') { knee += 40; hem += 70; }
  if (shape === 'flare') { hem += 80; }
  if (shape === 'tapered') { hem -= 25; }
  if (shape === 'barrel') { knee += 70; hem -= 15; }
  if (shape === 'balloon') { knee += 90; hem -= 30; }
  legC = Math.max(legC, legGap + 10 + Math.max(knee, hem)); // legs never overlap: wide legs move apart
  const outerKneeX = legC + knee + (shape === 'barrel' || shape === 'balloon' ? 35 : 0);
  pts.push(['WT', waist, 0], ['HP', hip, hipY], ['KO', outerKneeX, kneeY], ['HO', legC + hem, -L], ['HI', legC - hem, -L], ['KI', legC - knee, kneeY], ['CR', legGap, crotchY]);
  const { R, L: Lf } = mirrorWithEdits(pts, edits, p.asym);
  const C = { n: 'C', x: edits.C?.[0] || 0, y: crotchY + 18 + (edits.C?.[1] || 0) };
  const outline = [...R, C, ...Lf.reverse()];
  const lines = [];
  const wb = p.waistband === 'elastic' || p.waistband === 'drawcord' ? 45 : 38;
  const wtR = R[0], wtL = Lf[Lf.length - 1];
  lines.push({ d: `M${wtL.x} ${wtL.y - wb} L${wtR.x} ${wtR.y - wb}`, k: 'seam' });
  if (p.waistband === 'paperbag') lines.push({ d: `M${wtL.x} ${wtL.y - wb - 30} L${wtR.x} ${wtR.y - wb - 30}`, k: 'stitch' });
  if (p.waistband === 'drawcord' || p.waistband === 'elastic') lines.push({ d: `M-20 ${-wb} l-8 -90 M20 ${-wb} l8 -90`, k: 'cord' });
  if (!back) {
    if (p.waistband !== 'elastic' && p.waistband !== 'drawcord') lines.push({ d: `M18 ${-wb} L18 ${crotchY * 0.62} Q18 ${crotchY * 0.72} 4 ${crotchY * 0.75}`, k: 'stitch' });
    if (p.pockets !== 'none') for (const sx of [-1, 1]) lines.push({ d: `M${sx * (waist - 90)} ${-wb} Q${sx * (waist - 30)} ${-wb - 60} ${sx * (hip - 5)} ${hipY - 30}`, k: 'seam' });
    if (p.pockets === 'cargo') for (const sx of [-1, 1]) { const x = sx * (legC + knee * 0.2), y = kneeY + 140; lines.push({ d: `M${x - 80} ${y} h160 v-190 h-160 z M${x - 84} ${y + 4} h168 v-50 h-168 z`, k: 'seam' }); }
    for (let i = 0; i < p.pleats; i++) for (const sx of [-1, 1]) lines.push({ d: `M${sx * (60 + i * 35)} ${-wb} l${sx * 4} -130`, k: 'stitch' });
    if (p.crease) for (const sx of [-1, 1]) lines.push({ d: `M${sx * legC} ${-wb - 120} L${sx * legC} ${-L}`, k: 'stitch' });
    if (p.kneePanels) for (const sx of [-1, 1]) lines.push({ d: `M${sx * (legC - knee)} ${kneeY + 60} Q${sx * legC} ${kneeY + 30} ${sx * outerKneeX} ${kneeY + 60} M${sx * (legC - knee)} ${kneeY - 60} Q${sx * legC} ${kneeY - 90} ${sx * outerKneeX} ${kneeY - 60}`, k: 'seam' });
  } else {
    lines.push({ d: `M${wtL.x} ${-wb - 80} L0 ${-wb - 120} L${wtR.x} ${-wb - 80}`, k: 'seam' });
    for (const sx of [-1, 1]) lines.push({ d: `M${sx * 50} ${-wb - 130} h${sx * 130} v-150 l${-sx * 65} -20 l${-sx * 65} 20 z`, k: 'seam' });
  }
  const hoR = R.find((q) => q.base === 'HO'), hiR = R.find((q) => q.base === 'HI'), hoL = Lf.find((q) => q.base === 'HO'), hiL = Lf.find((q) => q.base === 'HI');
  if (p.hem === 'cuff') lines.push({ d: `M${hiR.x} ${hiR.y + 50} L${hoR.x} ${hoR.y + 50} M${hiL.x} ${hiL.y + 50} L${hoL.x} ${hoL.y + 50}`, k: 'seam' });
  else if (p.hem === 'split') lines.push({ d: `M${hoR.x - 3} ${hoR.y} l-4 80 M${hoL.x + 3} ${hoL.y} l4 80`, k: 'seam' });
  else if (p.hem === 'elastic') lines.push({ d: `M${hiR.x} ${hiR.y + 30} L${hoR.x} ${hoR.y + 30} M${hiL.x} ${hiL.y + 30} L${hoL.x} ${hoL.y + 30}`, k: 'stitch' });
  else lines.push({ d: `M${hiR.x} ${hiR.y + 25} L${hoR.x} ${hoR.y + 25} M${hiL.x} ${hiL.y + 25} L${hoL.x} ${hoL.y + 25}`, k: 'stitch' });
  return { outline, lines };
}

/* ── grading & measurements (points of measure) ─────────────── */
function grading(sizeIndex) {
  const k = sizeIndex - 2; // M = 0
  return { chest: k * 50, shoulder: k * 15, length: k * 20, sleeve: k * 10, armhole: k * 10, waist: k * 40, hip: k * 40, rise: k * 6, thigh: k * 24, knee: k * 16, opening: k * 10 };
}
export function sizeChart(p) {
  const top = p.kind === 'top';
  const rows = top
    ? [['A', 'Chest (pit to pit, flat)', (g) => (p.chest * 10 / 2 + FIT[p.fit] + g.chest / 2) / 10],
       ['B', 'Body length (HPS to hem)', (g) => (p.length * 10 + g.length) / 10],
       ['C', 'Shoulder width', (g) => (p.shoulder * 10 + g.shoulder) / 10],
       ...(p.garment !== 'vest' ? [['D', 'Sleeve length', (g) => (p.sleeve * 10 + g.sleeve) / 10], ['E', 'Bicep (flat)', (g) => (p.bicep * 10 + g.chest * 0.3) / 10], ['F', 'Cuff opening (flat)', () => p.cuffW]] : []),
       ['G', 'Hem width (flat)', (g) => (p.chest * 10 / 2 + FIT[p.fit] + g.chest / 2 + 2 * p.flare) / 10],
       ['H', 'Neck width', () => p.neckW], ['I', 'Front neck drop', () => p.neckD], ['J', 'Armhole depth', (g) => (p.armhole * 10 + g.armhole * 0.4) / 10]]
    : [['A', 'Waist (flat)', (g) => (p.waistW * 10 + g.waist) / 2 / 10], ['B', 'Hip (flat)', (g) => ((p.hip * 10 + g.hip) / 2 + FIT[p.fit]) / 10],
       ...(p.bottom !== 'skirt' ? [['C', 'Front rise (crotch depth)', (g) => (p.crotch * 10 + g.rise + p.crotchDrop * 10) / 10], ['D', 'Back rise', (g) => (p.crotch * 10 + g.rise + p.crotchDrop * 10) / 10 + 9],
         ['E', 'Thigh (flat)', (g) => (p.thigh * 10 + g.thigh) / 10], ['F', 'Knee (flat)', (g) => (p.knee * 10 + g.knee) / 10], ['G', 'Leg opening (flat)', (g) => (p.opening * 10 + g.opening) / 10],
         ['H', 'Inseam', (g) => (p.outseam * 10 + g.length - p.crotch * 10 - p.crotchDrop * 10) / 10]] : [['C', 'Hem width (flat)', (g) => ((p.hip * 10 + g.hip) / 2 + 2 * p.flare) / 10]]),
       ['I', 'Outseam / length', (g) => (p.outseam * 10 + g.length) / 10]];
  return { sizes: SIZES, rows: rows.map(([k, label, f]) => [k, label, SIZES.map((_, i) => Math.round(f(grading(i)) * 2) / 2)]) };
}

/* ── flats as SVG ───────────────────────────────────────────── */
const STYLE = { seam: 'stroke:#0a0a0a;stroke-width:2.2;fill:none', stitch: 'stroke:#0a0a0a;stroke-width:1.4;fill:none;stroke-dasharray:7 5', zip: 'stroke:#0a0a0a;stroke-width:4;fill:none;stroke-dasharray:3 3', cord: 'stroke:#0a0a0a;stroke-width:3;fill:none;stroke-linecap:round', button: 'stroke:#0a0a0a;stroke-width:1.6;fill:#fff' };
export function flatSVG(view, { fill = '#ecebe5', handles = false, labels = false, w = 1 } = {}) {
  const all = view.outline;
  const xs = all.map((q) => q.x), ys = all.map((q) => q.y);
  const box = [Math.min(...xs) - 60, -Math.max(...ys) - 60, Math.max(...xs) - Math.min(...xs) + 120, Math.max(...ys) - Math.min(...ys) + 120];
  const path = `M${all.map((q) => `${q.x.toFixed(1)} ${(-q.y).toFixed(1)}`).join(' L')} Z`;
  const lines = view.lines.map((l) => `<path d="${flipPath(l.d)}" style="${STYLE[l.k] || STYLE.seam}" vector-effect="non-scaling-stroke"/>`).join('');
  const hs = handles ? all.map((q) => `<circle class="flat-handle" data-pt="${q.n}" cx="${q.x.toFixed(1)}" cy="${(-q.y).toFixed(1)}" r="${9 * w}"><title>${q.n}</title></circle>`).join('') : '';
  return { box, svg: `<path d="${path}" fill="${fill}" stroke="#0a0a0a" stroke-width="2.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${lines}${hs}` };
}
/** flip y of an SVG path written in garment coordinates (y up) — handles M/L/Q/C/l/h/v/m/a/z */
function flipPath(d) {
  return d.replace(/([MLQCTmlhvaAzZ])([^MLQCTmlhvaAzZ]*)/g, (m, cmd, args) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'h' || cmd === 'z' || cmd === 'Z') return cmd + args;
    if (cmd === 'v') return `v${n.map((v) => -v).join(' ')}`;
    if (cmd === 'a' || cmd === 'A') return `${cmd}${n.map((v, i) => (i % 7 === 6 ? -v : i % 7 === 4 ? 1 - v : v)).join(' ')}`;
    return cmd + n.map((v, i) => (i % 2 ? -v : v)).join(' ');
  });
}

/* ── 3D: the flat, puffed up (like a garment lying flat, filled) ── */
function inflate(outline, depth, cell) {
  const xs = outline.map((q) => q.x), ys = outline.map((q) => q.y);
  const x0 = Math.min(...xs) - 10, x1 = Math.max(...xs) + 10, y0 = Math.min(...ys) - 10, y1 = Math.max(...ys) + 10;
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1;
  const D2 = new Float32Array(nx * ny);
  const segs = outline.map((a, i) => [a, outline[(i + 1) % outline.length]]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell;
    let best = Infinity, inside = false;
    for (const [a, b] of segs) {
      const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(x - a.x - dx * t, y - a.y - dy * t));
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    D2[j * nx + i] = inside ? best : -best;
  }
  const D = (x, y) => {
    const fx = (x - x0) / cell, fy = (y - y0) / cell;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
    const u = fx - i, v = fy - j, at = (a, b) => D2[b * nx + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
  const R = depth;
  const prim = {
    d: (x, y, z) => { const d2 = D(x, y); if (d2 <= 0) return Math.hypot(-d2, Math.max(0, Math.abs(z) - 1)) + 0.5; const k = Math.min(1, d2 / R); const th = R * Math.sqrt(1 - (1 - k) ** 2) + 1; return Math.abs(z) - th; },
    box: [x0, y0, -R - 4, x1, y1, R + 4], k: 0,
  };
  return polygonize([prim], Math.min(260, Math.ceil(Math.max(x1 - x0, y1 - y0) / cell)));
}

/* ── the tool ───────────────────────────────────────────────── */
export const garment = {
  id: 'garment',
  label: 'Clothing',
  category: 'wear',
  materials: ['cotton', 'knit_black', 'knit_grey', 'knit_cream', 'denim', 'nylon', 'leather_black'],
  defaultMaterial: 'cotton',
  minWall: 0.3,
  view: 'front',
  flatEditor: true,
  engraveDefault: { side: 'front', y: 25, size: 35, depth: 1.5 },
  params: [
    { key: 'kind', type: 'select', label: 'Top or bottom', help: 'Upper body (tees, hoodies, jackets …) or lower body (trousers, shorts, skirts).', default: 'top', options: [['top', 'Top'], ['bottom', 'Bottom']], resets: ['garment', 'bottom'] },
    { key: 'garment', type: 'select', show: (p) => p.kind === 'top', label: 'Garment', help: 'Starting type. Every measurement below can still be changed.', default: 'hoodie', options: [['tee', 'T-shirt'], ['long', 'Longsleeve'], ['hoodie', 'Hoodie'], ['sweat', 'Sweatshirt'], ['jacket', 'Jacket'], ['coat', 'Coat'], ['vest', 'Vest / tank']] },
    { key: 'bottom', type: 'select', show: (p) => p.kind === 'bottom', label: 'Garment', help: 'Starting type. Every measurement below can still be changed.', default: 'trousers', options: [['trousers', 'Trousers'], ['shorts', 'Shorts'], ['skirt', 'Skirt']] },
    { key: 'fit', type: 'select', label: 'Fit', help: 'How much room around the body (ease).', default: 'oversized', options: [['slim', 'Slim'], ['regular', 'Regular'], ['relaxed', 'Relaxed'], ['oversized', 'Oversized'], ['extreme', 'Extreme']] },
    { key: 'size', type: 'select', label: 'Size shown', help: 'The size drawn here. The size chart covers XS–XXL.', default: 'M', options: SIZES.map((s) => [s, s]) },
    { key: 'shoulderShape', type: 'select', show: (p) => p.kind === 'top', label: 'Shoulder', help: 'Natural, dropped (seam on the upper arm), extended, padded (raised, strong), raglan (diagonal seam to the neck) or puff.', default: 'dropped', options: [['natural', 'Natural'], ['dropped', 'Dropped'], ['extended', 'Extended'], ['padded', 'Padded'], ['raglan', 'Raglan'], ['puff', 'Puff']] },
    { key: 'crotch', type: 'range', show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Crotch depth (rise)', help: 'From the waistband to the crotch seam. Longer = lower crotch.', min: 18, max: 45, step: 0.5, unit: 'cm', default: 28 },
    // more: tops
    { key: 'length', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Body length', help: 'From the highest shoulder point to the hem. Cropped ≈ 45, long ≈ 80+.', min: 30, max: 130, step: 0.5, unit: 'cm', default: 72 },
    { key: 'chest', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Chest (flat, before fit)', help: 'Pit-to-pit width ×2 of the base body. The fit adds room on top.', min: 80, max: 140, step: 0.5, unit: 'cm', default: 104 },
    { key: 'shoulder', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Shoulder width', help: 'From shoulder point to shoulder point.', min: 30, max: 75, step: 0.5, unit: 'cm', default: 46 },
    { key: 'slope', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Shoulder slope', help: 'How steeply the shoulder falls from the neck.', min: 0, max: 35, step: 1, unit: '°', default: 16 },
    { key: 'drop', type: 'range', more: true, show: (p) => p.kind === 'top' && p.shoulderShape === 'dropped', label: 'Shoulder drop', help: 'How far the shoulder seam sits down the arm.', min: 10, max: 160, step: 1, unit: 'mm', default: 70 },
    { key: 'pad', type: 'range', more: true, show: (p) => p.kind === 'top' && p.shoulderShape === 'padded', label: 'Shoulder height', help: 'How much the padded shoulder stands up.', min: 0, max: 60, step: 1, unit: 'mm', default: 22 },
    { key: 'armhole', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Armhole depth', help: 'From shoulder down to the underarm. Deeper = roomier sleeve.', min: 16, max: 40, step: 0.5, unit: 'cm', default: 26 },
    { key: 'sleeve', type: 'range', more: true, show: (p) => p.kind === 'top' && p.garment !== 'vest', label: 'Sleeve length', help: 'From the shoulder point to the cuff.', min: 8, max: 95, step: 0.5, unit: 'cm', default: 58 },
    { key: 'sleeveShape', type: 'select', more: true, show: (p) => p.kind === 'top' && p.garment !== 'vest', label: 'Sleeve shape', help: 'Straight, tapered, bell (wide at the end), puff or bishop (full, gathered at the cuff).', default: 'straight', options: [['straight', 'Straight'], ['tapered', 'Tapered'], ['bell', 'Bell'], ['puff', 'Puff'], ['bishop', 'Bishop']] },
    { key: 'bicep', type: 'range', more: true, show: (p) => p.kind === 'top' && p.garment !== 'vest', label: 'Sleeve width (bicep)', help: 'Width of the upper sleeve, flat.', min: 14, max: 45, step: 0.5, unit: 'cm', default: 24 },
    { key: 'cuffW', type: 'range', more: true, show: (p) => p.kind === 'top' && p.garment !== 'vest', label: 'Cuff width', help: 'Width of the sleeve end, flat.', min: 6, max: 45, step: 0.5, unit: 'cm', default: 11 },
    { key: 'sleeveAngle', type: 'range', more: true, show: (p) => p.kind === 'top' && p.garment !== 'vest', label: 'Sleeve angle (drawing)', help: 'How the sleeves are drawn: out to the side or hanging down.', min: 15, max: 80, step: 1, unit: '°', default: 52 },
    { key: 'neckline', type: 'select', more: true, show: (p) => p.kind === 'top' && p.garment !== 'hoodie', label: 'Neckline', help: 'Shape of the neck opening.', default: 'crew', options: [['crew', 'Crew'], ['v', 'V-neck'], ['mock', 'Mock neck'], ['turtle', 'Turtleneck'], ['boat', 'Boat'], ['square', 'Square'], ['collar', 'Collar']] },
    { key: 'neckW', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Neck width', help: 'Width of the neck opening.', min: 12, max: 35, step: 0.5, unit: 'cm', default: 19 },
    { key: 'neckD', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Front neck drop', help: 'How low the neckline goes at the front.', min: 2, max: 30, step: 0.5, unit: 'cm', default: 9 },
    { key: 'hood', type: 'range', more: true, show: (p) => p.kind === 'top' && (p.garment === 'hoodie' || p.garment === 'jacket' || p.garment === 'coat'), label: 'Hood size', help: 'Width of the hood (0 = no hood on jackets and coats).', min: 0, max: 40, step: 0.5, unit: 'cm', default: 26 },
    { key: 'waist', type: 'range', more: true, show: (p) => p.kind === 'top', label: 'Waist shaping', help: 'Pulls the side seam in at the waist.', min: 0, max: 120, step: 1, unit: 'mm', default: 0 },
    { key: 'flare', type: 'range', more: true, show: (p) => p.kind === 'top' || p.bottom === 'skirt', label: 'Hem flare', help: 'Wider (positive) or narrower (negative) at the hem. Skirts: how much the A-line opens.', min: -80, max: 200, step: 1, unit: 'mm', default: 0 },
    { key: 'hem', type: 'select', more: true, label: 'Hem', help: 'Straight, curved, high-low (back longer), asymmetric, side splits — trousers: cuffed, split, elastic.', default: 'straight', options: [['straight', 'Straight'], ['curved', 'Curved'], ['hilo', 'High-low'], ['asym', 'Asymmetric'], ['split', 'Side splits'], ['cuff', 'Cuffed'], ['elastic', 'Elastic']] },
    { key: 'rib', type: 'toggle', more: true, show: (p) => p.kind === 'top', label: 'Rib cuffs & hem band', help: 'Knitted bands at sleeve ends and hem.', default: true },
    { key: 'closure', type: 'select', more: true, show: (p) => p.kind === 'top', label: 'Closure', help: 'Zip or buttons at the front.', default: 'none', options: [['none', 'None'], ['half', 'Half zip'], ['full', 'Full zip'], ['buttons', 'Buttons']] },
    { key: 'pocket', type: 'select', more: true, show: (p) => p.kind === 'top', label: 'Pockets', help: 'Kangaroo, patch, chest or flap pockets.', default: 'kangaroo', options: [['none', 'None'], ['kangaroo', 'Kangaroo'], ['patch', 'Patch'], ['chest', 'Chest'], ['flap', 'Flap']] },
    { key: 'panels', type: 'select', more: true, show: (p) => p.kind === 'top', label: 'Panels', help: 'Extra seam lines: yoke across the chest or curved princess seams.', default: 'none', options: [['none', 'None'], ['yoke', 'Yoke'], ['princess', 'Princess seams']] },
    // more: bottoms
    { key: 'crotchDrop', type: 'range', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Crotch drop', help: 'Drop-crotch: lowers the crotch further for a loose, avant-garde silhouette.', min: 0, max: 40, step: 0.5, unit: 'cm', default: 0 },
    { key: 'rise', type: 'select', more: true, show: (p) => p.kind === 'bottom', label: 'Waist height', help: 'Where the waistband sits.', default: 'mid', options: [['low', 'Low'], ['mid', 'Mid'], ['high', 'High']] },
    { key: 'leg', type: 'select', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Leg shape', help: 'Straight, tapered, wide, flare, barrel (curved) or balloon.', default: 'wide', options: [['straight', 'Straight'], ['tapered', 'Tapered'], ['wide', 'Wide'], ['flare', 'Flare'], ['barrel', 'Barrel'], ['balloon', 'Balloon']] },
    { key: 'outseam', type: 'range', more: true, show: (p) => p.kind === 'bottom', label: 'Length (outseam)', help: 'From the waistband to the hem. Shorts ≈ 45, skirts any.', min: 25, max: 125, step: 0.5, unit: 'cm', default: 106 },
    { key: 'waistW', type: 'range', more: true, show: (p) => p.kind === 'bottom', label: 'Waist', help: 'Waist circumference.', min: 56, max: 130, step: 0.5, unit: 'cm', default: 82 },
    { key: 'hip', type: 'range', more: true, show: (p) => p.kind === 'bottom', label: 'Hip', help: 'Hip circumference (the fit adds room).', min: 80, max: 150, step: 0.5, unit: 'cm', default: 104 },
    { key: 'thigh', type: 'range', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Thigh (flat)', help: 'Width of one leg at the crotch, flat.', min: 22, max: 50, step: 0.5, unit: 'cm', default: 34 },
    { key: 'knee', type: 'range', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Knee (flat)', help: 'Width at the knee, flat.', min: 15, max: 50, step: 0.5, unit: 'cm', default: 26 },
    { key: 'opening', type: 'range', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Leg opening (flat)', help: 'Width at the hem, flat.', min: 12, max: 50, step: 0.5, unit: 'cm', default: 24 },
    { key: 'waistband', type: 'select', more: true, show: (p) => p.kind === 'bottom', label: 'Waistband', help: 'Plain, elastic, drawcord or paperbag.', default: 'plain', options: [['plain', 'Plain'], ['elastic', 'Elastic'], ['drawcord', 'Drawcord'], ['paperbag', 'Paperbag']] },
    { key: 'pockets', type: 'select', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Pockets', help: 'Slant pockets, with cargo pockets, or none.', default: 'slant', options: [['none', 'None'], ['slant', 'Slant'], ['cargo', 'Slant + cargo']] },
    { key: 'pleats', type: 'range', more: true, show: (p) => p.kind === 'bottom', label: 'Pleats', help: 'Pleats at the waist (skirts: pleated panels).', min: 0, max: 3, step: 1, unit: '', default: 0 },
    { key: 'crease', type: 'toggle', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Front crease', help: 'Pressed line down the front of each leg.', default: false },
    { key: 'kneePanels', type: 'toggle', more: true, show: (p) => p.kind === 'bottom' && p.bottom !== 'skirt', label: 'Articulated knees', help: 'Shaped panels at the knee.', default: false },
    { key: 'slit', type: 'range', more: true, show: (p) => p.kind === 'bottom' && p.bottom === 'skirt', label: 'Slit', help: 'Length of the slit.', min: 0, max: 60, step: 1, unit: 'cm', default: 0 },
    // free editing
    { key: 'asym', type: 'toggle', more: true, label: 'Asymmetric editing', help: 'Edit left and right side separately when dragging points.', default: false },
    { key: 'edits', type: 'hidden', default: '', max: 3000 },
  ],
  templates: [
    { label: 'Oversized hoodie', p: { kind: 'top', garment: 'hoodie', fit: 'oversized', shoulderShape: 'dropped', drop: 80, length: 72, pocket: 'kangaroo', rib: true } },
    { label: 'Boxy tee', p: { kind: 'top', garment: 'tee', fit: 'oversized', shoulderShape: 'dropped', drop: 60, length: 68, sleeve: 26, bicep: 26, cuffW: 22, rib: false, pocket: 'none', neckline: 'crew' } },
    { label: 'Power-shoulder jacket', p: { kind: 'top', garment: 'jacket', fit: 'regular', shoulderShape: 'padded', pad: 30, length: 66, closure: 'full', neckline: 'collar', pocket: 'flap', hood: 0, rib: false } },
    { label: 'Cropped zip', p: { kind: 'top', garment: 'sweat', fit: 'relaxed', shoulderShape: 'raglan', length: 46, closure: 'half', neckline: 'mock', pocket: 'none' } },
    { label: 'Long coat', p: { kind: 'top', garment: 'coat', fit: 'oversized', shoulderShape: 'extended', length: 118, closure: 'buttons', neckline: 'collar', hood: 0, pocket: 'flap', rib: false, sleeveShape: 'bell' } },
    { label: 'Drop-crotch trousers', p: { kind: 'bottom', bottom: 'trousers', fit: 'oversized', crotch: 30, crotchDrop: 22, leg: 'tapered', waistband: 'drawcord', pockets: 'slant' } },
    { label: 'Wide cargo', p: { kind: 'bottom', bottom: 'trousers', fit: 'relaxed', crotch: 29, leg: 'wide', pockets: 'cargo', kneePanels: true } },
    { label: 'Barrel jeans', p: { kind: 'bottom', bottom: 'trousers', fit: 'relaxed', crotch: 28, leg: 'barrel', crease: false, pockets: 'slant', mat: 'denim' } },
    { label: 'Asymmetric skirt', p: { kind: 'bottom', bottom: 'skirt', outseam: 80, hip: 100, flare: 180, hem: 'asym', pleats: 2 } },
    { label: 'Wide shorts', p: { kind: 'bottom', bottom: 'shorts', fit: 'relaxed', outseam: 52, leg: 'wide', pockets: 'cargo', hem: 'cuff' } },
  ],

  /** both flats (front & back) — used by the flat editor and the tech pack */
  flats(p) {
    const g = grading(Math.max(0, SIZES.indexOf(p.size)));
    const edits = parseEdits(p.edits);
    const q = p;
    return p.kind === 'top' ? { front: topFlat(q, g, edits, false), back: topFlat(q, g, edits, true) } : { front: bottomFlat(q, g, edits, false), back: bottomFlat(q, g, edits, true) };
  },

  build(p, ctx = {}) {
    const flats = garment.flats(p);
    const out = flats.front.outline;
    const xs = out.map((q) => q.x), ys = out.map((q) => q.y);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const depth = p.kind === 'top' ? 70 + (FIT[p.fit] || 0) * 0.08 : 45;
    const geometry = inflate(out, depth, Math.max(4, size / 180));
    geometry.computeBoundingBox();
    // fabric area (front + back) × fabric thickness → weight
    let area = 0; for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a.x * b.y - b.x * a.y; }
    area = Math.abs(area) / 2;
    // weight = fabric area (front + back, + 25 % for sleeves' hidden sides, hood lining, bands) × fabric weight (g/m²)
    const mat = ctx.material || 'cotton';
    const gsm = { cotton: 300, denim: 400, knit_black: 420, knit_grey: 420, knit_cream: 420, nylon: 110, leather_black: 900 }[mat] || 300;
    const density = { cotton: 0.6, denim: 0.7, knit_black: 0.35, knit_grey: 0.35, knit_cream: 0.35, nylon: 1.1, leather_black: 0.9 }[mat] || 0.6;
    const grams = (area * 2 * 1.25 / 1e6) * gsm;
    const chart = sizeChart(p);
    const name = p.kind === 'top' ? { tee: 'T-shirt', long: 'Longsleeve', hoodie: 'Hoodie', sweat: 'Sweatshirt', jacket: 'Jacket', coat: 'Coat', vest: 'Vest' }[p.garment] : { trousers: 'Trousers', shorts: 'Shorts', skirt: 'Skirt' }[p.bottom];
    const sz = geometry.boundingBox.getSize(new THREE.Vector3());
    return {
      parts: [{ geometry }], volume: (grams * 1000) / density, minWall: 1,
      warnings: [],
      dims: [['Garment', `${name} · ${p.fit} · size ${p.size}`], ['Flat size', `${(sz.x / 10).toFixed(0)} × ${(sz.y / 10).toFixed(0)} cm`], ...chart.rows.slice(0, 4).map(([k, l, v]) => [`${k} ${l}`, `${v[SIZES.indexOf(p.size)]} cm`])],
      title: name,
      flats, chart,
      downloads: [
        { label: 'Tech pack (SVG)', small: 'flats, sizes XS–XXL, notes, concept art', filename: `triad-${name.toLowerCase()}-techpack.svg`, make: async (ctx = {}) => new Blob([techPackSVG(p, { name: ctx.name || name, ...ctx })], { type: 'image/svg+xml' }) },
        { label: 'Flats (SVG)', small: 'front & back line drawing', filename: `triad-${name.toLowerCase()}-flats.svg`, make: async (ctx = {}) => {
          const a = flatSVG(flats.front, { fill: ctx.fill || '#ffffff' }), b = flatSVG(flats.back, { fill: ctx.fill || '#ffffff' });
          const w = a.box[2] + b.box[2] + 80, h = Math.max(a.box[3], b.box[3]);
          return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${(w / 10).toFixed(1)}cm" height="${(h / 10).toFixed(1)}cm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><g transform="translate(${-a.box[0]} ${-a.box[1]})">${a.svg}</g><g transform="translate(${a.box[2] + 80 - b.box[0]} ${-b.box[1]})">${b.svg}</g></svg>`], { type: 'image/svg+xml' });
        } },
      ],
    };
  },
};

/* ── tech pack ──────────────────────────────────────────────── */
/** Dimension lines (points of measure) for the front flat, labelled like the size chart. */
function measureLines(view, p) {
  const by = (n) => view.outline.find((q) => q.n === n);
  const out = [];
  const add = (k, a, b, off = [0, 0]) => { if (a && b) out.push({ k, t: Math.abs(a.x - b.x) < Math.abs(a.y - b.y) ? 0.22 : 0.5, a: { x: a.x + off[0], y: a.y + off[1] }, b: { x: b.x + off[0], y: b.y + off[1] } }); };
  if (p.kind === 'top') {
    const aL = by('A_L'), aR = by('A_R');
    add('A', aL, aR, [0, -15]);
    const top = by('N_R'), hem = by('H0');
    if (top && hem) add('B', { x: 0, y: top.y }, { x: 0, y: hem.y }, [-25, 0]);
    add('C', by('S_L'), by('S_R'), [0, 25]);
    add('D', by('S_R'), by('CO_R'), [12, 12]);
    add('G', by('H_L'), by('H_R'), [0, -30]);
  } else {
    add('A', by('WT_L'), by('WT_R'), [0, 25]);
    add('B', by('HP_L'), by('HP_R'), [0, 0]);
    const wt = by('WT_R'), cr = by('CR_R');
    if (wt && cr) add('C', { x: 0, y: wt.y }, { x: 0, y: cr.y }, [0, 0]);
    add(p.bottom === 'skirt' ? 'C' : 'G', by(p.bottom === 'skirt' ? 'SH_L' : 'HI_R'), by(p.bottom === 'skirt' ? 'SH_R' : 'HO_R'), [0, -25]);
    add('H', by('CR_R'), by('HI_R'), [18, 0]);
    add('I', by('WT_R'), by(p.bottom === 'skirt' ? 'SH_R' : 'HO_R'), [35, 0]);
  }
  return out;
}

const escX = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function wrapText(text, n) { const out = []; for (const para of String(text || '').split('\n')) { let line = ''; for (const w of para.split(' ')) { if ((line + ' ' + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } out.push(line); } return out; }

/** One-page tech pack as SVG (A3 landscape proportions). */
export function techPackSVG(p, { name = 'Garment', notes = '', concepts = [], material = '', prints = [], fill = '#ecebe5' } = {}) {
  const flats = garment.flats(p);
  const chart = sizeChart(p);
  const W = 1600, H = 1130;
  const flatBox = (view, x, y, w, h, measures) => {
    const f = flatSVG(view, { fill });
    const [bx, byy, bw, bh] = f.box; const k = Math.min(w / bw, h / bh);
    const ml = (measures || []).map((m) => `<g class="pom"><line x1="${m.a.x}" y1="${-m.a.y}" x2="${m.b.x}" y2="${-m.b.y}" stroke="#4f6800" stroke-width="${1.6 / k}" marker-start="url(#ar)" marker-end="url(#ar)"/><circle cx="${m.a.x + (m.b.x - m.a.x) * m.t}" cy="${-(m.a.y + (m.b.y - m.a.y) * m.t)}" r="${13 / k}" fill="#c4ef2f" stroke="#0a0a0a" stroke-width="${1 / k}"/><text x="${m.a.x + (m.b.x - m.a.x) * m.t}" y="${-(m.a.y + (m.b.y - m.a.y) * m.t) + 5 / k}" font-size="${15 / k}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700">${m.k}</text></g>`).join('');
    return `<g transform="translate(${x + (w - bw * k) / 2} ${y + (h - bh * k) / 2}) scale(${k}) translate(${-bx} ${-byy})">${f.svg.replace(/vector-effect="non-scaling-stroke"/g, '').replace(/stroke-width="2.6"/, `stroke-width="${2.6 / k}"`)}${ml}</g>`;
  };
  const rows = chart.rows;
  const tx = 1000, ty = 150, cw = 72, rh = 30;
  const table = `<g font-family="Inter Tight, Arial, sans-serif" font-size="15">
    <text x="${tx}" y="${ty - 20}" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="1.5">POINTS OF MEASURE (CM)</text>
    <rect x="${tx}" y="${ty}" width="${560}" height="${rh}" fill="#0a0a0a"/>
    <text x="${tx + 10}" y="${ty + 20}" fill="#ece9e2" font-family="JetBrains Mono, monospace" font-size="12">POM</text>
    ${chart.sizes.map((sz, i) => `<text x="${tx + 152 + 32 + i * cw}" y="${ty + 20}" fill="${sz === p.size ? '#c4ef2f' : '#ece9e2'}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12">${sz}</text>`).join('')}
    ${rows.map(([k, label, v], r) => `<rect x="${tx}" y="${ty + rh * (r + 1)}" width="560" height="${rh}" fill="${r % 2 ? '#f3f2ee' : '#fff'}"/>
      <text x="${tx + 10}" y="${ty + rh * (r + 1) + 20}" font-weight="700">${k}</text><text x="${tx + 30}" y="${ty + rh * (r + 1) + 20}" font-size="13">${escX(label.length > 22 ? label.slice(0, 21) + '…' : label)}</text>
      ${v.map((x, i) => `<text x="${tx + 184 + i * cw}" y="${ty + rh * (r + 1) + 20}" text-anchor="middle"${chart.sizes[i] === p.size ? ' font-weight="700"' : ''}>${x}</text>`).join('')}`).join('')}
  </g>`;
  const specY = ty + rh * (rows.length + 1) + 50;
  const spec = [['Fit', p.fit], ['Base size', p.size], ['Material', material], ...(p.kind === 'top' ? [['Shoulder', p.shoulderShape], ['Sleeve', p.garment === 'vest' ? 'none' : p.sleeveShape], ['Neckline', p.garment === 'hoodie' ? 'hood' : p.neckline], ['Closure', p.closure], ['Pockets', p.pocket], ['Hem', p.hem + (p.rib ? ' + rib' : '')]] : [['Waist height', p.rise], ['Crotch drop', `${p.crotchDrop} cm`], ['Leg', p.leg], ['Waistband', p.waistband], ['Pockets', p.pockets], ['Hem', p.hem]]), ...prints.map((x, i) => [`Artwork ${i + 1}`, x]), ...(p.edits ? [['Free edits', 'yes (see flats)']] : [])];
  const specs = spec.map(([k, v], i) => `<text x="${tx}" y="${specY + i * 24}" font-family="JetBrains Mono, monospace" font-size="12" fill="#5f6064">${escX(k.toUpperCase())}</text><text x="${tx + 150}" y="${specY + i * 24}" font-size="15">${escX(v)}</text>`).join('');
  const notesY = 860;
  const noteLines = wrapText(notes, 92).slice(0, 7);
  const conceptImgs = concepts.slice(0, 4).map((src, i) => `<image href="${src}" x="${1000 + i * 142}" y="${notesY - 10}" width="130" height="130" preserveAspectRatio="xMidYMid meet"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#4f6800"/></marker></defs>
  <rect width="${W}" height="${H}" fill="#fbfaf8"/>
  <rect width="${W}" height="80" fill="#0a0a0a"/>
  <text x="40" y="52" font-family="Anton, Impact, sans-serif" font-size="38" fill="#ece9e2">TRIAD</text>
  <text x="170" y="52" font-family="JetBrains Mono, monospace" font-size="15" fill="#c4ef2f" letter-spacing="2">TECH PACK</text>
  <text x="${W - 40}" y="52" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="14" fill="#ece9e2">${escX(name.toUpperCase())} · ${new Date().toISOString().slice(0, 10)}</text>
  <text x="40" y="125" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="1.5">FRONT</text><text x="500" y="125" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="1.5">BACK</text>
  ${flatBox(flats.front, 30, 140, 440, 660, measureLines(flats.front, p))}
  ${flatBox(flats.back, 490, 140, 440, 660, [])}
  ${table}
  ${specs}
  <line x1="40" y1="${notesY - 40}" x2="${W - 40}" y2="${notesY - 40}" stroke="#0a0a0a"/>
  <text x="40" y="${notesY - 14}" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="1.5">NOTES</text>
  ${noteLines.map((l, i) => `<text x="40" y="${notesY + 16 + i * 26}" font-family="Inter Tight, Arial, sans-serif" font-size="17">${escX(l)}</text>`).join('')}
  ${concepts.length ? `<text x="1000" y="${notesY - 14}" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="1.5">CONCEPT ART</text>${conceptImgs}` : ''}
  <text x="40" y="${H - 24}" font-family="JetBrains Mono, monospace" font-size="12" fill="#5f6064">Measurements in cm, garment laid flat. Grading: chest ±2.5 · length ±2 · shoulder ±1.5 per size. Made with TRIAD Studio.</text>
</svg>`;
}
