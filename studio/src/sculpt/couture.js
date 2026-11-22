// COUTURE MASKS & HEADPIECES: a shell that follows a real head (brow, nose, cheeks, chin), cut to a face, veil,
// eye mask, mouthpiece or head band — then covered in crystals, pearls, studs, spikes, scales, ribs,
// turned into a cage or openwork lattice, with optional horns or a crown of rays. Everything in millimetres.
import * as THREE from 'three';
import { polygonize, capsule, sphere } from './sdf.js';
import { geometryVolume } from '../jewellery/revolve.js';

const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
const len = Math.hypot;
function ell(x, y, z, cx, cy, cz, rx, ry, rz) { const k = len((x - cx) / rx, (y - cy) / ry, (z - cz) / rz); return (k - 1) * Math.min(rx, ry, rz); }
function cap(x, y, z, a, b, r) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  return len(px - bx * t, py - by * t, pz - bz * t) - r;
}

/** Signed distance to a human head (face towards +z), in mm, scaled by s. */
export function headSDF(s = 1) {
  return (X, Y, Z) => {
    const x = X / s, y = Y / s, z = Z / s;
    let d = ell(x, y, z, 0, 0, 0, 74, 108, 95);
    d = smin(d, ell(x, y, z, 0, -78, 52, 40, 34, 34), 14); // jaw
    d = smin(d, ell(x, y, z, 0, -96, 62, 26, 18, 22), 10); // chin
    d = smin(d, cap(x, y, z, [0, 8, 86], [0, -22, 104], 9), 9); // nose bridge
    d = smin(d, ell(x, y, z, 0, -24, 100, 14, 9, 10), 6); // nose tip
    d = smin(d, cap(x, y, z, [-34, 24, 80], [34, 24, 80], 8), 9); // brow
    for (const sx of [-1, 1]) d = smin(d, ell(x, y, z, sx * 44, -6, 70, 18, 14, 16), 12); // cheekbones
    d = smin(d, cap(x, y, z, [-15, -55, 90], [15, -55, 90], 6), 6); // lips
    for (const sx of [-1, 1]) d = smax(d, -ell(x, y, z, sx * 31, 12, 88, 17, 11, 12), 8); // eye sockets
    return d * s;
  };
}

const FORMS = {
  //       [yBottom, yTop, zFront cut]   (unscaled mm)
  face: { label: 'Full face', y: [-118, 72], z: -12 },
  veil: { label: 'Veil (whole head front)', y: [-120, 112], z: -38 },
  half: { label: 'Eye mask', y: [-8, 52], z: 6 },
  mouth: { label: 'Mouthpiece / jaw', y: [-112, -34], z: 8 },
  crown: { label: 'Head band', y: [34, 62], z: -200 },
};

export const COUTURE_STYLES = {
  blank: { label: 'Blank veil', tags: 'blank faceless anonymous stocking deconstructed deconstruction minimal avant-garde avantgarde', p: { form: 'veil', surface: 'smooth', eyes: 'closed', horns: 'none' } },
  crystal: { label: 'Crystal veil', tags: 'crystal kristall strass sequins pailletten beaded embellished couture glitter rhinestone', p: { form: 'veil', surface: 'crystals', eyes: 'closed', density: 5.5, horns: 'none' } },
  pearl: { label: 'Pearl face', tags: 'pearl perlen baroque barock couture bridal', p: { form: 'face', surface: 'pearls', eyes: 'open', density: 6, horns: 'none' } },
  spiked: { label: 'Spiked face', tags: 'spikes stacheln punk armor rüstung dark', p: { form: 'face', surface: 'spikes', eyes: 'slits', density: 10, horns: 'none' } },
  horned: { label: 'Horned eye mask', tags: 'ram horns hörner widder dark romantic gothic gotisch armor', p: { form: 'half', surface: 'smooth', eyes: 'open', horns: 'ram' } },
  jaw: { label: 'Bone mouthpiece', tags: 'jaw kiefer bone knochen skeleton skelett teeth zähne dark romantic', p: { form: 'mouth', surface: 'ribs', density: 5, horns: 'none' } },
  cage: { label: 'Cage mask', tags: 'cage käfig wire draht armor grid gitter', p: { form: 'face', surface: 'cage', density: 12, eyes: 'open', horns: 'none' } },
  lattice: { label: 'Openwork lattice', tags: 'openwork durchbrochen lattice 3d print parametric organic fluid futuristic', p: { form: 'face', surface: 'lattice', eyes: 'open', horns: 'none' } },
  scales: { label: 'Scaled mask', tags: 'scales schuppen reptile reptil dragon drache snake schlange armor', p: { form: 'face', surface: 'scales', eyes: 'slits', density: 7, horns: 'pointed' } },
  rays: { label: 'Crown of rays', tags: 'crown krone spikes stacheln rays strahlen headpiece kopfschmuck sun sonne', p: { form: 'crown', surface: 'studs', density: 7, horns: 'rays' } },
};

function project(head, P, target, iters = 8) {
  const e = 0.4;
  let [x, y, z] = P;
  for (let i = 0; i < iters; i++) {
    const d = head(x, y, z) - target;
    const gx = (head(x + e, y, z) - head(x - e, y, z)) / (2 * e), gy = (head(x, y + e, z) - head(x, y - e, z)) / (2 * e), gz = (head(x, y, z + e) - head(x, y, z - e)) / (2 * e);
    const g2 = gx * gx + gy * gy + gz * gz || 1;
    x -= (d * gx) / g2; y -= (d * gy) / g2; z -= (d * gz) / g2;
  }
  const gx = head(x + e, y, z) - head(x - e, y, z), gy = head(x, y + e, z) - head(x, y - e, z), gz = head(x, y, z + e) - head(x, y, z - e);
  const gl = len(gx, gy, gz) || 1;
  return { p: [x, y, z], n: [gx / gl, gy / gl, gz / gl] };
}

export const couture = {
  id: 'couture',
  label: 'Couture mask & headpiece',
  category: 'jewel',
  materials: ['chrome', 'silver', 'gold', 'black', 'resin', 'plaster', 'brass'],
  defaultMaterial: 'chrome',
  minWall: 0.8,
  view: 'front',
  slow: true,
  params: [
    { key: 'form', type: 'select', label: 'Form', help: 'Covers the whole face, the whole head front, only the eyes, the jaw — or sits on the head as a band.', default: 'face', options: Object.entries(FORMS).map(([k, f]) => [k, f.label]) },
    { key: 'surface', type: 'select', label: 'Surface', help: 'Smooth, covered in crystals, pearls, studs, spikes or scales, ribbed, an open cage, or an openwork lattice.', default: 'crystals',
      options: [['smooth', 'Smooth'], ['crystals', 'Crystals'], ['pearls', 'Pearls'], ['studs', 'Studs'], ['spikes', 'Spikes'], ['scales', 'Scales'], ['ribs', 'Ribs'], ['cage', 'Cage (open)'], ['lattice', 'Lattice (openwork)']] },
    { key: 'eyes', type: 'select', label: 'Eyes', help: 'Open, narrow slits, or closed (you see through fine mesh or not at all — a statement piece).', default: 'open', options: [['open', 'Open'], ['slits', 'Slits'], ['closed', 'Closed']] },
    { key: 'horns', type: 'select', label: 'Horns / rays', help: 'Add curled ram horns, two pointed horns or a crown of spike rays.', default: 'none', options: [['none', 'None'], ['ram', 'Ram horns'], ['pointed', 'Pointed horns'], ['rays', 'Crown of rays']] },
    { key: 'density', type: 'range', label: 'Pattern size', help: 'Distance between crystals, studs, spikes, ribs or cage bars.', min: 3, max: 18, step: 0.5, unit: 'mm', default: 6 },
    // more
    { key: 'grain', type: 'range', more: true, label: 'Embellishment size', help: 'How big each crystal, pearl, stud or spike is.', min: 0.4, max: 1.6, step: 0.05, unit: '×', default: 1 },
    { key: 'thick', type: 'range', more: true, label: 'Shell thickness', help: 'Thickness of the mask itself. 1.5–2.5 mm for metal, 2–3 mm for resin.', min: 0.8, max: 5, step: 0.1, unit: 'mm', default: 1.8 },
    { key: 'mouth', type: 'toggle', more: true, show: (p) => p.form === 'face' || p.form === 'veil', label: 'Open mouth', help: 'A slit at the mouth.', default: false },
    { key: 'head', type: 'range', more: true, label: 'Head size', help: 'Around the head at the forehead. Most adults: 54–60 cm.', min: 480, max: 640, step: 5, unit: 'mm', default: 570 },
    { key: 'detail', type: 'select', more: true, label: 'Detail', help: 'Fine is smoother but takes a few seconds.', default: 'normal', options: [['draft', 'Draft'], ['normal', 'Normal'], ['fine', 'Fine']] },
  ],
  templates: Object.values(COUTURE_STYLES).map((s) => ({ label: s.label, p: s.p })),

  build(p) {
    const s = p.head / 570;
    const head = headSDF(s);
    const F = FORMS[p.form] || FORMS.face;
    const t = p.thick;
    const sp = p.density, g = p.grain;
    const yb = F.y[0] * s, yt = F.y[1] * s, zf = F.z * s;
    const holes = [];
    if (p.form !== 'mouth' && p.form !== 'crown' && p.eyes !== 'closed') for (const sx of [-1, 1]) holes.push([sx * 31 * s, 13 * s, 88 * s, 16 * s, (p.eyes === 'slits' ? 3.2 : 9.5) * s]);
    const mouthOpen = p.mouth && (p.form === 'face' || p.form === 'veil');
    const inHole = (x, y, z, m = 0) => holes.some(([hx, hy, hz, rx, ry]) => ((x - hx) / (rx + m)) ** 2 + ((y - hy) / (ry + m)) ** 2 < 1 && z > hz - 30 * s)
      || (mouthOpen && Math.abs(x) < 18 * s + m && Math.abs(y + 55 * s) < 3.5 * s + m && z > 60 * s);
    const region = (x, y, z) => Math.max(zf - z, y - yt, yb - y);

    // the shell: from the skin outwards, t thick, cut to the region
    const lattice = p.surface === 'lattice';
    const gs = 0.55 / s;
    // the region cut belongs to the shell only (so horns, rays and spikes can reach beyond it)
    const shellD = (x, y, z) => {
      const reg = region(x, y, z);
      let d = Math.max(Math.abs(head(x, y, z) - t / 2 - 0.6) - t / 2, reg);
      if (lattice) {
        const f = gs * 0.16;
        const gyr = (Math.abs(Math.sin(x * f) * Math.cos(y * f) + Math.sin(y * f) * Math.cos(z * f) + Math.sin(z * f) * Math.cos(x * f)) - 0.55) / f;
        const rim = -(reg + 4 * s); // a frame along the edge holds the openwork together
        const eyeRim = holes.reduce((m, [hx, hy, , rx, ry]) => Math.min(m, Math.abs(len((x - hx) / (rx + 3), (y - hy) / (ry + 3)) - 0.9) * Math.min(rx, ry) - 1.5), Infinity);
        d = Math.max(d, Math.min(gyr, rim, eyeRim));
      }
      return d;
    };
    const box = [-80 * s - 10, yb - 10, Math.max(zf, -100 * s) - 10, 80 * s + 10, yt + 10, 115 * s + 10];
    const prims = [];
    if (p.surface !== 'cage') prims.push({ d: shellD, box, k: 0, narrow: true });

    // points on the outer surface (rows of equal spacing, every other row shifted)
    const pts = [];
    const outer = t + 0.6;
    for (let y = yb + sp * 0.6, row = 0; y < yt - sp * 0.4; y += sp * 0.87, row++) {
      const k = Math.sqrt(Math.max(0, 1 - (y / s / 110) ** 2));
      const rmean = ((74 + 95) / 2) * s * k + 10;
      const dTh = sp / Math.max(rmean, 1);
      for (let th = -Math.PI + (row % 2 ? dTh / 2 : 0); th < Math.PI; th += dTh) {
        const P0 = [Math.sin(th) * 80 * s * k, y, Math.cos(th) * 100 * s * k];
        if (P0[2] < zf + sp * 0.4) continue;
        const { p: P, n } = project(head, P0, outer);
        if (region(...P) > -sp * 0.35 || inHole(...P, sp * 0.4)) continue;
        pts.push({ P, n, row, th });
      }
    }
    const at = (P, n, d) => [P[0] + n[0] * d, P[1] + n[1] * d, P[2] + n[2] * d];
    const surf = p.surface;
    if (surf === 'crystals') for (const { P, n } of pts) { const r = sp * 0.42 * g, c = at(P, n, r * 0.25); prims.push({ d: (x, y, z) => (Math.abs(x - c[0]) + Math.abs(y - c[1]) + Math.abs(z - c[2]) - r) * 0.577, box: [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r], k: 0 }); }
    if (surf === 'pearls') for (const { P, n } of pts) prims.push(sphere(at(P, n, sp * 0.12), sp * 0.4 * g, { k: 0.4 }));
    if (surf === 'studs') for (const { P, n } of pts) prims.push(capsule(at(P, n, -0.4), at(P, n, sp * 0.45 * g), sp * 0.32 * g, 0.25, { k: 0.3 }));
    if (surf === 'spikes') for (const { P, n } of pts) prims.push(capsule(at(P, n, -0.4), at(P, n, sp * 1.6 * g), sp * 0.26 * g, 0.2, { k: 0.4 }));
    if (surf === 'scales') for (const { P, n } of pts) prims.push(sphere(at(P, [n[0], n[1] - 0.6, n[2]], -sp * 0.2), sp * 0.62 * g, { k: 0 }));
    if (surf === 'ribs' || surf === 'cage') {
      const r = Math.max(t * 0.6, sp * 0.16 * g);
      const rows = new Map();
      for (const q of pts) (rows.get(q.row) || rows.set(q.row, []).get(q.row)).push(q);
      for (const list of rows.values()) {
        list.sort((a, b) => a.th - b.th);
        for (let i = 1; i < list.length; i++) if (len(...list[i].P.map((v, j) => v - list[i - 1].P[j])) < sp * 1.6) prims.push(capsule(at(list[i - 1].P, list[i - 1].n, r * 0.3), at(list[i].P, list[i].n, r * 0.3), r, r, { k: 0.5 }));
      }
      if (surf === 'cage') { // vertical bars through every other point column
        const cols = [];
        for (let th = -Math.PI; th < Math.PI; th += sp / 90) cols.push(th);
        for (const th of cols) {
          let prev = null;
          for (let y = yb + 2; y < yt - 2; y += sp * 0.5) {
            const k = Math.sqrt(Math.max(0, 1 - (y / s / 110) ** 2));
            const P0 = [Math.sin(th) * 80 * s * k, y, Math.cos(th) * 100 * s * k];
            if (P0[2] < zf + 2) { prev = null; continue; }
            const { p: P, n } = project(head, P0, t * 0.5, 5);
            if (region(...P) > -1 || inHole(...P, 1)) { prev = null; continue; }
            const c = at(P, n, 0);
            if (prev) prims.push(capsule(prev, c, r, r, { k: 0.5 }));
            prev = c;
          }
        }
        // frame along the edge so the cage holds together
        for (const list of rows.values()) if (list.length > 1) { const a = list[0], b = list[list.length - 1]; prims.push(sphere(a.P, r * 1.3, { k: 0.5 }), sphere(b.P, r * 1.3, { k: 0.5 })); }
      }
      if (p.form === 'mouth' && surf === 'ribs') for (let x = -26; x <= 26; x += 6.5) { const { p: P, n } = project(head, [x * s, -58 * s, 95 * s], outer); prims.push(capsule(at(P, n, 0), at(P, [n[0], n[1] - 0.8, n[2]], sp * 0.9), sp * 0.22, sp * 0.12, { k: 0.4 })); } // teeth
    }
    // horns & rays
    const H = (pts3, r0, r1) => { for (let i = 0; i < pts3.length - 1; i++) prims.push(capsule(pts3[i], pts3[i + 1], r0 + ((r1 - r0) * i) / (pts3.length - 1), r0 + ((r1 - r0) * (i + 1)) / (pts3.length - 1), { k: 2 })); };
    if (p.horns === 'ram') for (const sx of [-1, 1]) {
      const c0 = [sx * 62 * s, 58 * s, 30 * s];
      H(Array.from({ length: 28 }, (_, i) => { const a = (i / 27) * Math.PI * 1.7, r = 40 * s * (1 - i / 40); return [c0[0] + sx * (Math.sin(a) * r * 0.35 + i * 0.9 * s), c0[1] + Math.cos(a) * r - r, c0[2] + Math.sin(a) * r]; }), 16 * s, 4 * s);
    }
    if (p.horns === 'pointed') for (const sx of [-1, 1]) H(Array.from({ length: 10 }, (_, i) => { const u = i / 9; return [sx * (36 + 18 * u) * s, (78 + 70 * u) * s, (40 - 20 * u * u) * s]; }), 11 * s, 1.2 * s);
    if (p.horns === 'rays') for (let i = 0; i < 17; i++) {
      const a = -Math.PI * 0.8 + (i / 16) * Math.PI * 1.6;
      const base = project(head, [Math.sin(a) * 76 * s, 58 * s, Math.cos(a) * 92 * s], t, 5).p;
      const L = (i % 2 ? 45 : 75) * s;
      prims.push(capsule(base, [base[0] * 1.1 + Math.sin(a) * L * 0.25, base[1] + L, base[2] * 1.05 + Math.cos(a) * L * 0.25], 4 * s, 0.8, { k: 2 }));
    }
    if ((p.horns !== 'none') && (p.form === 'half' || p.form === 'mouth' || p.form === 'face')) {
      // a band over the forehead so horns attach to the mask
      prims.push({ d: (x, y, z) => Math.max(Math.abs(head(x, y, z) - t / 2 - 0.6) - t / 2, Math.abs(y - 50 * s) - 9 * s, -z - 10 * s), box: [-80 * s, 35 * s, -20 * s, 80 * s, 65 * s, 110 * s], k: 1, narrow: true });
    }
    // holes (eyes, mouth, strap slots)
    for (const [hx, hy, hz, rx, ry] of holes) prims.push({ sub: true, k: 1.5, d: (x, y, z) => (len((x - hx) / rx, (y - hy) / ry) - 1) * Math.min(rx, ry) + Math.max(0, hz - 40 * s - z) * 0, box: [hx - rx - 3, hy - ry - 3, hz - 45 * s, hx + rx + 3, hy + ry + 3, hz + 50 * s] });
    if (mouthOpen) prims.push(capsule([-18 * s, -55 * s, 70 * s], [18 * s, -55 * s, 70 * s], 3.5 * s, 3.5 * s, { sub: true, k: 1 }), capsule([-18 * s, -55 * s, 120 * s], [18 * s, -55 * s, 120 * s], 3.5 * s, 3.5 * s, { sub: true, k: 1 }));
    if (p.form !== 'crown') for (const sx of [-1, 1]) { const { p: P } = project(head, [sx * 70 * s, 10 * s, Math.max(zf, 0) + 14 * s], t / 2, 5); prims.push(capsule([P[0] - sx * 4, P[1] - 5, P[2] - 6], [P[0] + sx * 6, P[1] + 5, P[2] + 6], 2.4, 2.4, { sub: true, k: 0.5 })); }

    const cell = { draft: 0.95, normal: 0.7, fine: 0.5 }[p.detail] * Math.max(t, 1.4);
    const ext = Math.max(box[3] - box[0], box[4] - box[1], box[5] - box[2]) + (p.horns === 'none' ? 0 : 80 * s);
    const geometry = polygonize(prims, Math.min(340, Math.ceil(ext / cell)));
    geometry.computeBoundingBox();
    const sz = geometry.boundingBox.getSize(new THREE.Vector3());
    const volume = geometryVolume(geometry);
    const warnings = [];
    if (t < 1.2) warnings.push('A shell under 1.2 mm is fragile for a face piece.');
    if (volume > 60000 && p.form !== 'crown') warnings.push('Heavy to wear in metal. For a wearable piece choose resin (or a thinner shell); metal suits a show piece or a smaller scale.');
    if (p.eyes === 'closed' && p.form !== 'mouth' && p.form !== 'crown') warnings.push('Closed eyes: a show piece. You cannot see through it.');
    return {
      parts: [{ geometry }], volume, minWall: t,
      warnings,
      dims: [['Form', `${F.label} · ${couture.params[1].options.find(([k]) => k === p.surface)[1]}`], ['Size', `${sz.x.toFixed(0)} × ${sz.y.toFixed(0)} × ${sz.z.toFixed(0)} mm`], ['Head', `${(p.head / 10).toFixed(1)} cm`], ['Shell', `${t} mm`]],
      title: Object.values(COUTURE_STYLES).find((st) => Object.entries(st.p).every(([k, v]) => p[k] === v))?.label || `${F.label} mask`,
    };
  },
};
