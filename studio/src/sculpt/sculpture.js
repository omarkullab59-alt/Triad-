// SCULPTURE: figures in poses, snakes, dragons, busts, hands and abstract forms — on a base you can engrave.
// Everything is modelled in units of the sculpture's height (1.0), then scaled to millimetres.
import * as THREE from 'three';
import { sphere, ellipsoid, capsule, roundBox, torus, triPlate, tube, gyroid, polygonize } from './sdf.js';
import { geometryVolume } from '../jewellery/revolve.js';
import { box as boxGeo, cylinder } from '../jewellery/solid.js';

const D = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/* ── human figure (forward kinematics) ───────────────────────────── */
// angles in degrees. arm: abd = out to the side (180 = straight up), flex = forward, elbow = bend.
// leg: flex = forward, abd = out, knee = bend backwards. lean = upper body forward, twist = turn of shoulders.
export const POSES = {
  stand: { label: 'Standing', lean: 0, twist: 0, head: [0, 0], arms: [[8, 0, 8], [8, 0, 8]], legs: [[0, 4, 0], [0, 4, 0]] },
  contrapposto: { label: 'Contrapposto', lean: 0, twist: 10, head: [12, 8], arms: [[45, -25, 115], [6, 5, 10]], legs: [[12, 9, 22], [-3, 2, 0]] },
  victory: { label: 'Arms up', lean: -6, twist: 0, head: [0, -18], arms: [[155, 15, 15], [155, 15, 15]], legs: [[0, 9, 0], [0, 9, 0]] },
  thinker: { label: 'Thinker (sitting)', seat: true, lean: 32, twist: 0, head: [0, 15], arms: [[12, 70, 145], [15, 55, 60]], legs: [[88, 6, 92], [80, 10, 95]] },
  kneel: { label: 'Kneeling', lean: 4, twist: 0, head: [0, 8], arms: [[10, 30, 40], [12, 45, 70]], legs: [[90, 6, 90], [-12, 5, 105]] },
  dance: { label: 'Dancing', lean: -8, twist: 22, head: [-15, -12], arms: [[125, 10, 25], [70, -25, 35]], legs: [[45, 18, 70], [-6, 6, 0]] },
  walk: { label: 'Walking', lean: 4, twist: 8, head: [0, 0], arms: [[8, -25, 20], [8, 30, 25]], legs: [[26, 3, 10], [-18, 3, 26]] },
  guard: { label: 'Fighter', lean: 12, twist: 18, head: [0, 10], arms: [[25, 70, 110], [20, 55, 120]], legs: [[18, 16, 22], [-12, 14, 18]] },
  crosslegged: { label: 'Sitting cross-legged', seat: 'floor', lean: 0, twist: 0, head: [0, 5], arms: [[14, 30, 40], [14, 30, 40]], legs: [[88, 48, 150], [88, 48, 150]] },
  reach: { label: 'Reaching', lean: 18, twist: -10, head: [8, -25], arms: [[100, 80, 5], [20, -30, 20]], legs: [[-15, 5, 5], [25, 5, 15]] },
};

function dirOf(abd, flex, side) {
  const a = abd * D, f = flex * D;
  return [side * Math.sin(a) * Math.cos(f * 0.6), -Math.cos(a) * Math.cos(f), Math.sin(f) * (Math.abs(Math.cos(a)) * 0.6 + 0.4)];
}
function norm(v) { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

export function figure(poseKey, { build = 1, twist = 0, lean = 0 } = {}) {
  const P = POSES[poseKey] || POSES.stand;
  const T = (P.twist + twist) * D, L = (P.lean + lean) * D;
  const b = build;
  const pelvis = [0, 0.53, 0];
  // upper body around the pelvis: lean (about X), then twist (about Y)
  const upper = (p) => {
    let [x, y, z] = [p[0], p[1] - pelvis[1], p[2]];
    [y, z] = [y * Math.cos(L) - z * Math.sin(-L), y * Math.sin(-L) + z * Math.cos(L)];
    [x, z] = [x * Math.cos(T) + z * Math.sin(T), -x * Math.sin(T) + z * Math.cos(T)];
    return [x, y + pelvis[1], z];
  };
  const chest = upper([0, 0.71, 0]), neck = upper([0, 0.835, 0.005]);
  const headC = upper([Math.sin(P.head[0] * D) * 0.02, 0.925, 0.01 + Math.sin(P.head[1] * D) * 0.03]);
  const prims = [];
  const k = 0.035;
  prims.push(ellipsoid(pelvis, [0.1 * b, 0.075, 0.07 * b], { k }));
  prims.push(capsule(pelvis, chest, 0.075 * b, 0.1 * b, { k }));
  prims.push(ellipsoid(chest, [0.125 * b, 0.1, 0.075 * b], { k }));
  prims.push(capsule(chest, neck, 0.06 * b, 0.04, { k: 0.03 }));
  prims.push(ellipsoid(headC, [0.052, 0.068, 0.06], { k: 0.025 }));
  prims.push(capsule(add(headC, [0, -0.03, 0.035]), add(headC, [0, -0.055, 0.05]), 0.022, 0.026, { k: 0.02 })); // jaw
  // arms
  [-1, 1].forEach((side, i) => {
    const [abd, flex, elbow] = P.arms[i];
    const sh = upper([side * 0.16 * b, 0.795, 0]);
    const d1 = norm(dirOf(abd, flex, side));
    const rot = (v) => { let [x, y, z] = v; [y, z] = [y * Math.cos(L) - z * Math.sin(-L), y * Math.sin(-L) + z * Math.cos(L)]; [x, z] = [x * Math.cos(T) + z * Math.sin(T), -x * Math.sin(T) + z * Math.cos(T)]; return [x, y, z]; };
    const el = add(sh, scale(rot(d1), 0.17));
    const d2 = norm(dirOf(abd, flex + elbow, side));
    const wr = add(el, scale(rot(d2), 0.155));
    prims.push(sphere(sh, 0.05 * b, { k: 0.03 }));
    prims.push(capsule(sh, el, 0.042 * b, 0.032 * b, { k: 0.02 }));
    prims.push(capsule(el, wr, 0.032 * b, 0.024 * b, { k: 0.015 }));
    prims.push(ellipsoid(add(wr, scale(rot(d2), 0.04)), [0.026, 0.045, 0.02], { k: 0.012 }));
  });
  // legs
  const feet = [];
  [-1, 1].forEach((side, i) => {
    const [flex, abd, knee] = P.legs[i];
    const hip = [side * 0.07 * b, 0.5, 0];
    const d1 = norm(dirOf(abd, flex, side));
    const kn = add(hip, scale(d1, 0.255));
    const d2 = norm(dirOf(abd * 0.5, flex - knee, side));
    const an = add(kn, scale(d2, 0.245));
    const toe = add(an, [side * 0.01, -0.02, 0.1]);
    feet.push(an, toe);
    prims.push(capsule(hip, kn, 0.065 * b, 0.045 * b, { k: 0.03 }));
    prims.push(capsule(kn, an, 0.045 * b, 0.03 * b, { k: 0.02 }));
    prims.push(capsule(an, toe, 0.03, 0.022, { k: 0.015 }));
  });
  // stand on the ground (or on a rock when sitting)
  let minY = Math.min(...feet.map((p) => p[1]));
  if (P.seat === true) prims.push(ellipsoid([0, 0.43, -0.03], [0.17, 0.11, 0.15], { k: 0.02 }));
  if (P.seat === 'floor') minY = Math.min(minY, 0.43);
  return { prims, lift: -minY + 0.02 };
}

/* ── animals ─────────────────────────────────────────────────────── */
function snakePath(pose) {
  switch (pose) {
    case 'rising': return (t) => (t < 0.6 ? [0.32 * (1 - t) * Math.cos(t / 0.6 * Math.PI * 3), 0.05 + 0.06 * t, 0.32 * (1 - t) * Math.sin(t / 0.6 * Math.PI * 3)] : [0.03 * Math.sin((t - 0.6) * 8), 0.086 + Math.min(t - 0.6, 0.3) * 1.9 + Math.max(0, t - 0.9) * 0.4, 0.05 * (t - 0.6) + Math.max(0, t - 0.88) * 1.6]);
    case 'crawl': return (t) => [(t - 0.5) * 1.3, 0.05, 0.18 * Math.sin(t * Math.PI * 3)];
    case 'ouroboros': return (t) => { const a = t * Math.PI * 2 * 0.93; return [0.38 * Math.cos(a), 0.4 + 0.38 * Math.sin(a), 0.04 * Math.sin(a * 3)]; };
    default: return (t) => { const a = t * Math.PI * 2 * 3.2; const r = 0.36 - t * 0.2; return [r * Math.cos(a), 0.05 + t * 0.55, r * Math.sin(a)]; }; // coiled
  }
}
function snake(pose, { build = 1 } = {}) {
  const f = snakePath(pose);
  const r = (t) => (0.012 + 0.05 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.55)) * build;
  const prims = tube(f, r, 60, { k: 0.02 });
  const end = f(1), before = f(0.985);
  const dir = norm([end[0] - before[0], end[1] - before[1], end[2] - before[2]]);
  const hc = add(end, scale(dir, 0.04));
  prims.push(ellipsoid(hc, [0.055, 0.035, 0.055], { k: 0.02 }));
  prims.push(capsule(hc, add(hc, scale(dir, 0.06)), 0.035, 0.018, { k: 0.02 }));
  const side = norm([dir[2], 0, -dir[0]]);
  for (const s of [-1, 1]) prims.push(sphere(add(add(hc, scale(side, 0.034 * s)), [0, 0.015, 0]), 0.009, { sub: true, k: 0.004 }));
  if (pose === 'rising') prims.push(ellipsoid(add(f(0.86), [0, 0.01, -0.01]), [0.1 * build, 0.12, 0.022], { k: 0.03 })); // cobra hood
  return { prims, lift: 0 };
}
function dragon(pose, { build = 1 } = {}) {
  const paths = {
    rearing: (t) => [0.25 * Math.sin(t * Math.PI * 2.2) * (1 - t), 0.06 + t * 0.62 * (t > 0.4 ? 1 : 0.4) + (t > 0.4 ? 0 : 0), -0.3 + t * 0.55],
    flying: (t) => [(t - 0.5) * 1.2, 0.45 + 0.08 * Math.sin(t * Math.PI * 2.5), 0.12 * Math.sin(t * Math.PI * 2)],
    sleeping: (t) => { const a = t * Math.PI * 1.75; const r = 0.34 - t * 0.05; return [r * Math.cos(a), 0.09 + 0.02 * Math.sin(a * 2), r * Math.sin(a)]; },
    coiled: (t) => { const a = t * Math.PI * 2 * 2.2; const r = 0.3 - t * 0.12; return [r * Math.cos(a), 0.06 + t * 0.6, r * Math.sin(a)]; },
  };
  const f = paths[pose] || paths.coiled;
  const r = (t) => (0.016 + 0.06 * Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.6)) * build;
  const prims = tube(f, r, 64, { k: 0.025 });
  // spikes along the back
  for (let t = 0.08; t < 0.95; t += 0.05) {
    const p = f(t), q = f(t + 0.01);
    const dir = norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
    const upv = norm([-dir[0] * dir[1], 1 - dir[1] * dir[1], -dir[2] * dir[1]]);
    prims.push(capsule(add(p, scale(upv, r(t) * 0.6)), add(add(p, scale(upv, r(t) + 0.045)), scale(dir, -0.02)), r(t) * 0.35, 0.003, { k: 0.01 }));
  }
  // legs
  for (const t of [0.42, 0.7]) {
    const p = f(t);
    for (const s of [-1, 1]) {
      const q = f(t + 0.01); const dir = norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
      const side = norm([dir[2], 0, -dir[0]]);
      const knee = add(add(p, scale(side, s * 0.08)), [0, -0.04, 0]);
      const foot = [knee[0] + side[0] * s * 0.02, Math.max(0.01, p[1] - 0.12), knee[2] + side[2] * s * 0.02];
      prims.push(capsule(p, knee, 0.03 * build, 0.022, { k: 0.02 }), capsule(knee, foot, 0.02, 0.016, { k: 0.01 }));
      for (const c of [-1, 0, 1]) prims.push(capsule(foot, add(foot, add(scale(dir, 0.035), scale(side, c * 0.02))), 0.009, 0.003, { k: 0.005 }));
    }
  }
  // wings
  if (pose !== 'sleeping') {
    const p = f(0.6), q = f(0.62); const dir = norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]); const side = norm([dir[2], 0, -dir[0]]);
    for (const s of [-1, 1]) {
      const root = add(p, [0, 0.04, 0]);
      const tip = add(root, add(scale(side, s * 0.38), [0, 0.3, 0])), mid = add(root, add(scale(side, s * 0.3), add([0, 0.06, 0], scale(dir, -0.18))));
      const back = add(root, scale(dir, -0.2));
      prims.push(capsule(root, tip, 0.016, 0.006, { k: 0.01 }), capsule(tip, mid, 0.008, 0.005, { k: 0.008 }));
      prims.push(triPlate(root, tip, mid, 0.006, { k: 0.008 }), triPlate(root, mid, back, 0.006, { k: 0.008 }));
    }
  }
  // head with horns
  const end = f(1), before = f(0.985);
  const dir = norm([end[0] - before[0], end[1] - before[1], end[2] - before[2]]);
  const side = norm([dir[2], 0, -dir[0]]);
  const hc = add(end, scale(dir, 0.04));
  prims.push(ellipsoid(hc, [0.06, 0.045, 0.06], { k: 0.02 }));
  prims.push(capsule(hc, add(hc, scale(dir, 0.1)), 0.04, 0.022, { k: 0.02 }));
  for (const s of [-1, 1]) {
    const base = add(hc, add(scale(side, s * 0.03), [0, 0.03, 0]));
    prims.push(capsule(base, add(base, add(scale(dir, -0.11), [s * side[0] * 0.03, 0.06, s * side[2] * 0.03])), 0.014, 0.002, { k: 0.008 }));
    prims.push(sphere(add(add(hc, scale(side, s * 0.045)), add([0, 0.018, 0], scale(dir, 0.02))), 0.01, { sub: true, k: 0.004 }));
  }
  return { prims, lift: 0 };
}

/* ── bust, hand, abstract ─────────────────────────────────────────── */
function bust(pose, { build = 1 } = {}) {
  const turn = { front: 0, left: 25, right: -25, up: 0 }[pose] ?? 0;
  const tilt = pose === 'up' ? -14 : 0;
  const c = Math.cos(turn * D), s = Math.sin(turn * D);
  const R = (p, h = [0, 0.62, 0]) => { const x = p[0] - h[0], y = p[1] - h[1], z = p[2] - h[2]; const y2 = y * Math.cos(tilt * D) - z * Math.sin(tilt * D), z2 = y * Math.sin(tilt * D) + z * Math.cos(tilt * D); return [h[0] + x * c + z2 * s, h[1] + y2, h[2] - x * s + z2 * c]; };
  const prims = [
    ellipsoid([0, 0.2, 0], [0.42 * build, 0.2, 0.2], { k: 0.06 }),
    capsule([0, 0.3, 0], [0, 0.55, 0.01], 0.1 * build, 0.08, { k: 0.06 }),
    ellipsoid(R([0, 0.73, 0.01]), [0.13, 0.17, 0.155], { k: 0.04 }),
    capsule(R([0, 0.66, 0.08]), R([0, 0.6, 0.11]), 0.075, 0.06, { k: 0.04 }), // jaw
    capsule(R([0, 0.73, 0.14]), R([0, 0.67, 0.175]), 0.014, 0.026, { k: 0.015 }), // nose
    capsule(R([-0.06, 0.765, 0.12]), R([0.06, 0.765, 0.12]), 0.022, 0.022, { k: 0.02 }), // brow
    ellipsoid(R([-0.135, 0.72, 0]), [0.018, 0.045, 0.03], { k: 0.015 }), ellipsoid(R([0.135, 0.72, 0]), [0.018, 0.045, 0.03], { k: 0.015 }),
    capsule(R([-0.03, 0.62, 0.15]), R([0.03, 0.62, 0.15]), 0.012, 0.012, { k: 0.012 }), // lips
    sphere(R([-0.05, 0.725, 0.135]), 0.022, { sub: true, k: 0.02 }), sphere(R([0.05, 0.725, 0.135]), 0.022, { sub: true, k: 0.02 }),
    roundBox([0, -0.15, 0], [0.6, 0.15, 0.4], 0, { sub: true }),
  ];
  return { prims, lift: 0 };
}
function hand(pose) {
  const fingers = { open: [0, 0, 0, 0, 0], fist: [80, 95, 95, 95, 95], peace: [70, 0, 0, 95, 95], point: [60, 0, 95, 95, 95], horns: [30, 0, 95, 95, 0], heart: [20, 50, 60, 60, 60] }[pose] || [0, 0, 0, 0, 0];
  const prims = [roundBox([0, 0.32, 0], [0.13, 0.15, 0.045], 0.04, { k: 0.04 }), capsule([0, 0.05, 0], [0, 0.2, 0], 0.085, 0.1, { k: 0.05 })];
  const bases = [[-0.16, 0.3, 0.02], [-0.085, 0.47, 0], [-0.025, 0.48, 0], [0.04, 0.47, 0], [0.1, 0.44, 0]];
  const lens = [0.18, 0.24, 0.26, 0.24, 0.19];
  bases.forEach((b, i) => {
    const bend = fingers[i] * D;
    const dir0 = i === 0 ? norm([-0.6, 0.8, 0.25]) : [0, 1, 0];
    let p = b, dir = dir0;
    for (let s = 0; s < 3; s++) {
      const a = bend * (s ? 1 : 0.6);
      dir = norm([dir[0], dir[1] * Math.cos(a) - dir[2] * Math.sin(a) * -1, dir[1] * Math.sin(a) + dir[2] * Math.cos(a)]);
      const q = add(p, scale(dir, lens[i] / 3));
      prims.push(capsule(p, q, 0.032 - s * 0.003, 0.029 - s * 0.003, { k: 0.015 }));
      p = q;
    }
  });
  return { prims, lift: 0 };
}
function abstract(pose) {
  switch (pose) {
    case 'stones': return { prims: [ellipsoid([0, 0.1, 0], [0.32, 0.1, 0.26], { k: 0.01 }), ellipsoid([0.04, 0.29, 0.02], [0.24, 0.09, 0.2], { k: 0.01 }), ellipsoid([-0.02, 0.45, 0], [0.17, 0.075, 0.14], { k: 0.01 }), ellipsoid([0.01, 0.58, 0.01], [0.1, 0.06, 0.09], { k: 0.01 })], lift: 0 };
    case 'triad': return { prims: [0, 1, 2].map((i) => { const a = (i * 2 * Math.PI) / 3; return torus([0.13 * Math.cos(a + Math.PI / 2), 0.5 + 0.13 * Math.sin(a + Math.PI / 2), 0], 0.24, 0.035, norm([Math.cos(a) * 0.5, Math.sin(a) * 0.5, 1]), { k: 0.01 }); }), lift: 0 };
    case 'gyroid': return { prims: [sphere([0, 0.5, 0], 0.42, { k: 0 }), { ...gyroid(14, 0.012, [-0.5, 0, -0.5, 0.5, 1, 0.5]), inter: true, k: 0.004 }], lift: 0 };
    case 'twist': return { prims: tube((t) => { const a = t * Math.PI * 4; return [0.25 * Math.cos(a) * (1 - t * 0.5), t * 0.95, 0.25 * Math.sin(a) * (1 - t * 0.5)]; }, (t) => 0.07 * (1 - t * 0.6), 60, { k: 0.03 }), lift: 0 };
    case 'arch': return { prims: tube((t) => [Math.cos(t * Math.PI) * 0.4, Math.sin(t * Math.PI) * 0.8, 0], (t) => 0.05 + 0.04 * Math.abs(Math.cos(t * Math.PI)), 40, { k: 0.02 }), lift: 0 };
    default: return { prims: [torus([0, 0.5, 0], 0.32, 0.12, [0, 0, 1], { k: 0 }), sphere([0, 0.5, 0], 0.16, { k: 0.06 })], lift: 0 }; // ring
  }
}

export const SUBJECTS = {
  figure: { label: 'Figure', poses: Object.entries(POSES).map(([k, p]) => [k, p.label]), make: figure },
  snake: { label: 'Snake', poses: [['coiled', 'Coiled'], ['rising', 'Rising cobra'], ['crawl', 'Crawling'], ['ouroboros', 'Ouroboros']], make: snake },
  dragon: { label: 'Dragon', poses: [['coiled', 'Coiled'], ['rearing', 'Rearing'], ['flying', 'Flying'], ['sleeping', 'Sleeping']], make: dragon },
  bust: { label: 'Bust', poses: [['front', 'Looking ahead'], ['left', 'Turned left'], ['right', 'Turned right'], ['up', 'Looking up']], make: bust },
  hand: { label: 'Hand', poses: [['open', 'Open'], ['fist', 'Fist'], ['peace', 'Peace'], ['point', 'Pointing'], ['horns', 'Horns'], ['heart', 'Soft']], make: hand },
  abstract: { label: 'Abstract', poses: [['ring', 'Ring & sphere'], ['triad', 'Three rings (TRIAD)'], ['twist', 'Spiral'], ['stones', 'Balanced stones'], ['gyroid', 'Openwork sphere'], ['arch', 'Arch']], make: abstract },
};

const MATS = ['bronze', 'marble', 'plaster', 'terracotta', 'concrete', 'resin', 'silver', 'gold', 'steel', 'oak'];

export const sculpture = {
  id: 'sculpture',
  label: 'Sculpture',
  category: 'home',
  materials: MATS,
  defaultMaterial: 'bronze',
  minWall: 1.5,
  engraveDefault: { side: 'front', y: -42, size: 30, depth: 0.8 },
  params: [
    { key: 'subject', type: 'select', label: 'What', help: 'A figure, an animal, a bust, a hand or an abstract form.', default: 'figure', options: Object.entries(SUBJECTS).map(([k, s]) => [k, s.label]), resets: ['pose'] },
    { key: 'pose', type: 'select', label: 'Pose', help: 'How it stands, sits or moves.', default: 'contrapposto', options: (p) => SUBJECTS[p.subject]?.poses || SUBJECTS.figure.poses },
    { key: 'size', type: 'range', label: 'Size', help: 'Largest side of the sculpture without the base (height for standing figures).', min: 20, max: 2000, step: 5, unit: 'mm', default: 220 },
    { key: 'base', type: 'select', label: 'Base', help: 'What it stands on. You can engrave the base below.', default: 'round', options: [['none', 'No base'], ['round', 'Round'], ['square', 'Square'], ['rock', 'Rock']] },
    { key: 'build', type: 'range', label: 'Build', help: 'Slim to strong.', min: 0.7, max: 1.4, step: 0.05, unit: '×', default: 1 },
    // more
    { key: 'twist', type: 'range', more: true, show: (p) => p.subject === 'figure', label: 'Turn upper body', help: 'Twists the shoulders against the hips.', min: -45, max: 45, step: 1, unit: '°', default: 0 },
    { key: 'lean', type: 'range', more: true, show: (p) => p.subject === 'figure', label: 'Lean', help: 'Leans the upper body forward or back.', min: -30, max: 40, step: 1, unit: '°', default: 0 },
    { key: 'detail', type: 'select', more: true, label: 'Detail', help: 'Draft is fast, fine is smoother (and slower). Faceted gives a low-poly look.', default: 'normal', options: [['draft', 'Draft'], ['normal', 'Normal'], ['fine', 'Fine'], ['facet', 'Faceted']] },
    { key: 'baseH', type: 'range', more: true, show: (p) => p.base !== 'none', label: 'Base height', help: 'Height of the base compared with the sculpture.', min: 4, max: 40, step: 1, unit: '%', default: 12 },
  ],
  templates: [
    { label: 'Contrapposto', p: { subject: 'figure', pose: 'contrapposto', base: 'round' } },
    { label: 'Thinker', p: { subject: 'figure', pose: 'thinker', base: 'rock' } },
    { label: 'Cobra', p: { subject: 'snake', pose: 'rising', base: 'round' } },
    { label: 'Dragon', p: { subject: 'dragon', pose: 'rearing', base: 'rock' } },
    { label: 'Bust', p: { subject: 'bust', pose: 'left', base: 'square' } },
    { label: 'Hand', p: { subject: 'hand', pose: 'horns', base: 'square' } },
    { label: 'Openwork sphere', p: { subject: 'abstract', pose: 'gyroid', base: 'none' } },
  ],
  build(p) {
    const S = SUBJECTS[p.subject] || SUBJECTS.figure;
    const pose = S.poses.some(([k]) => k === p.pose) ? p.pose : S.poses[0][0];
    const { prims, lift } = S.make(pose, { build: p.build, twist: p.twist, lean: p.lean });
    const res = { draft: 56, normal: 92, fine: 140, facet: 34 }[p.detail] || 92;
    const g = polygonize(prims, res);
    g.translate(0, lift, 0);
    g.computeBoundingBox();
    const ext = g.boundingBox.getSize(new THREE.Vector3());
    const k = p.size / Math.max(ext.y, ext.x, ext.z, 1e-6); // size = largest side (height for figures)
    g.translate(0, -g.boundingBox.min.y, 0);
    g.scale(k, k, k);
    if (p.detail === 'facet') { const ni = g.toNonIndexed(); ni.computeVertexNormals(); g.copy(ni); g.userData.groups = true; if (!g.groups.length) g.addGroup(0, Infinity, 0); }
    const parts = [{ geometry: g }];
    g.computeBoundingBox();
    const sz = g.boundingBox.getSize(new THREE.Vector3());
    const cx = (g.boundingBox.min.x + g.boundingBox.max.x) / 2, cz = (g.boundingBox.min.z + g.boundingBox.max.z) / 2;
    let volume = geometryVolume(g);
    if (p.base !== 'none') {
      const bh = (p.size * p.baseH) / 100, w = Math.max(sz.x, sz.z) * 0.75 + p.size * 0.1;
      const ov = Math.min(bh * 0.4, p.size * 0.02); // sculpture sinks a little into the base
      let bg;
      if (p.base === 'round') bg = cylinder(w / 2, bh, cx, -bh / 2 + ov, cz, false, 64);
      else if (p.base === 'square') bg = boxGeo(w, bh, w, cx, -bh / 2 + ov, cz);
      else bg = polygonize([ellipsoid([cx, -bh / 2 + ov, cz], [w * 0.55, bh * 0.6, w * 0.48], { k: 0 }), ellipsoid([cx + w * 0.2, -bh * 0.3 + ov, cz - w * 0.1], [w * 0.3, bh * 0.55, w * 0.3], { k: w * 0.08 }), roundBox([cx, -bh * 1.5 + ov - bh * 0.1, cz], [w, bh, w], 0, { sub: true })], 60);
      parts.push({ geometry: bg });
      volume += geometryVolume(bg);
    }
    const thin = { figure: 0.024, snake: 0.012, dragon: 0.006, hand: 0.026, bust: 0.05, abstract: 0.012 }[p.subject] * p.size;
    return {
      parts, volume, minWall: thin,
      warnings: [
        ...(thin < 1.5 ? [`The thinnest parts are about ${thin.toFixed(1)} mm. Make it bigger for casting (at least 1.5 mm).`] : []),
        ...(p.size > 600 ? ['Large sculptures are usually cast hollow. The weight shown is for solid material.'] : []),
      ],
      dims: [['Subject', `${S.label} · ${S.poses.find(([k]) => k === pose)[1]}`], ['Size', `${p.size} mm${p.base !== 'none' ? ` + base ${Math.round((p.size * p.baseH) / 100)} mm` : ''}`], ['Footprint', `${sz.x.toFixed(0)} × ${sz.z.toFixed(0)} mm`]],
      title: `${S.label}, ${S.poses.find(([k]) => k === pose)[1].toLowerCase()}`,
    };
  },
};
