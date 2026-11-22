// ETHER — procedural full-body character: skeleton from proportions + pose, smooth body, hair.
// Units: metres. The character faces +Z, feet on y = 0. Clothing (wardrobe.js) is built on the same skeleton.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const deg = THREE.MathUtils.degToRad;
const UP = V(0, 1, 0);

/* ── geometry helpers (shared with the wardrobe) ── */

/** A smooth tube between a and b (lathe profile), optionally only part of it (t0..t1) and with rounded caps. */
export function tube(a, b, ra, rb, { t0 = 0, t1 = 1, off = 0, bulge = 0.08, flare = 0, caps = true, seg = 20, rows = 14, gather = 0 } = {}) {
  const dir = V().subVectors(b, a), L = dir.length();
  const pts = [];
  const r = (t) => {
    let v = ra + (rb - ra) * t;
    v *= 1 + bulge * Math.sin(Math.PI * t);
    if (flare) v += flare * Math.max(0, (t - t0) / Math.max(1e-3, t1 - t0)) ** 2.2;
    if (gather) v -= gather * Math.max(0, (t - (t1 - 0.06)) / 0.06) * v * 0.45;
    return Math.max(0.002, v + off);
  };
  if (caps && t0 === 0) for (let i = 0; i < 5; i++) { const q = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(r(0) * Math.sin(q), -r(0) * Math.cos(q) * 0.75)); }
  for (let i = 0; i <= rows; i++) { const t = t0 + ((t1 - t0) * i) / rows; pts.push(new THREE.Vector2(r(t), t * L)); }
  if (caps && t1 === 1) for (let i = 1; i <= 5; i++) { const q = (i / 5) * Math.PI / 2; pts.push(new THREE.Vector2(r(1) * Math.cos(q), L + r(1) * Math.sin(q) * 0.75)); }
  const g = new THREE.LatheGeometry(pts, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
/** Elliptic shell around the body axis (torso, skirts, hoods): profile [[y, rx], …], depth = z/x ratio. */
export function shell(profile, { depth = 0.68, cx = 0, cz = 0, phiStart = -Math.PI, phiLength = Math.PI * 2, seg = 40, zFront = 1 } = {}) {
  const pts = profile.map(([y, rx]) => new THREE.Vector2(Math.max(0.002, rx), y));
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLength);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setZ(i, z * depth * (z > 0 ? zFront : 1)); }
  g.translate(cx, 0, cz);
  g.computeVertexNormals();
  return g;
}
export const sphere = (c, r, sx = 1, sy = 1, sz = 1, seg = 24) => { const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)); g.scale(sx, sy, sz); g.translate(c.x, c.y, c.z); return g; };
export const mesh = (g, m, shadow = true) => { const x = new THREE.Mesh(g, m); x.castShadow = shadow; x.receiveShadow = true; return x; };

/* ── skeleton ── */

const POSE = {
  //        arm abduct L/R, arm swing L/R, elbow L/R, leg swing L/R, knee L/R, leg spread, hip shift, shoulder tilt
  stand: { ab: [9, 9], sw: [0, 0], el: [8, 8], lg: [0, 0], kn: [0, 0], spread: 1, shift: 0, tilt: 0 },
  contra: { ab: [13, 7], sw: [4, -2], el: [22, 6], lg: [7, -2], kn: [16, 0], spread: 1.25, shift: 0.022, tilt: -3 },
  walk: { ab: [8, 8], sw: [-20, 18], el: [14, 20], lg: [16, -14], kn: [6, 20], spread: 0.8, shift: 0, tilt: 0 },
  open: { ab: [58, 58], sw: [12, 12], el: [10, 10], lg: [0, 0], kn: [0, 0], spread: 1.5, shift: 0, tilt: 0 },
};

/** Joint positions and radii for given proportions (state.character) and pose. */
export function skeleton(c) {
  const H = c.height, b = c.build, P = POSE[c.pose] || POSE.stand;
  const headH = H * 0.125 * c.head;
  const hipY = H * 0.505 * Math.min(1.12, Math.max(0.9, c.legs)) - (c.legs - 1) * 0.02;
  const shoulderY = H - headH - H * 0.06;
  const neckBase = V(0, shoulderY + H * 0.012, 0);
  const headC = V(0, H - headH * 0.52, H * 0.004);
  const shift = P.shift * H;
  const sw = H * 0.112 * c.shoulders * (0.85 + 0.15 * b);
  const hw = H * 0.052 * c.hips;
  const R = {
    thigh: H * 0.037 * b * Math.sqrt(c.hips), knee: H * 0.023 * b, calf: H * 0.025 * b, ankle: H * 0.0125,
    upper: H * 0.02 * b, elbow: H * 0.0145, fore: H * 0.016 * b, wrist: H * 0.0105, neck: H * 0.026, head: headH * 0.47,
  };
  const side = [-1, 1]; // index 0 = left (−x), 1 = right (+x)
  const arm = [], leg = [];
  const tilt = deg(P.tilt);
  const ankleY = H * 0.045;
  for (let i = 0; i < 2; i++) {
    const s = side[i];
    const S = V(s * sw, shoulderY + s * Math.sin(tilt) * sw * 0.6, 0).add(V(shift * 0.4, 0, 0));
    const upperL = H * 0.172, foreL = H * 0.148;
    const d1 = V(0, -1, 0).applyAxisAngle(V(0, 0, 1), s * deg(P.ab[i])).applyAxisAngle(V(1, 0, 0), -deg(P.sw[i]));
    const E = S.clone().addScaledVector(d1, upperL);
    const d2 = d1.clone().applyAxisAngle(V(1, 0, 0), -deg(P.el[i])).applyAxisAngle(V(0, 0, 1), -s * deg(P.el[i]) * 0.15);
    const W = E.clone().addScaledVector(d2, foreL);
    const hand = W.clone().addScaledVector(d2, H * 0.055);
    arm.push({ S, E, W, hand, d2 });
    const Hp = V(s * hw * P.spread + shift, hipY, 0);
    const legL = hipY - ankleY;
    const thighL = legL * 0.52, shinL = legL * 0.5;
    const dl = V(0, -1, 0).applyAxisAngle(V(1, 0, 0), -deg(P.lg[i])).applyAxisAngle(V(0, 0, 1), s * deg(2 + (P.spread - 1) * 4));
    const K = Hp.clone().addScaledVector(dl, thighL);
    const ds = dl.clone().applyAxisAngle(V(1, 0, 0), deg(P.kn[i]));
    const A = K.clone().addScaledVector(ds, shinL);
    leg.push({ H: Hp, K, A });
  }
  // feet stand on the floor: lift the whole body so the lower ankle sits at ankleY
  const lift = ankleY - Math.min(leg[0].A.y, leg[1].A.y);
  for (const l of leg) for (const k of ['H', 'K', 'A']) l[k].y += lift;
  for (const a of arm) for (const k of ['S', 'E', 'W', 'hand']) a[k].y += lift;
  neckBase.y += lift; headC.y += lift;
  const hip = hipY + lift;
  const T = {
    hipY: hip, waistY: hip + H * 0.1, chestY: shoulderY + lift - H * 0.1, shoulderY: shoulderY + lift,
    rHip: H * 0.094 * c.hips * (0.8 + 0.2 * b), rWaist: H * 0.072 * c.waist * (0.75 + 0.25 * b), rChest: H * 0.088 * (0.8 + 0.2 * b), rShoulder: H * 0.098 * c.shoulders,
    depth: 0.64, shift,
  };
  const ears = side.map((s) => V(s * R.head * 0.86, headC.y - R.head * 0.05, headC.z - R.head * 0.05));
  return { H, R, T, arm, leg, neckBase, headC, ears, eyes: V(0, headC.y + R.head * 0.08, headC.z + R.head * 0.8), back: V(shift, T.chestY, -T.rChest * T.depth) };
}

/** Torso profile for the body or a garment (off = extra radius; yBottom / yTop limit it). */
export function torsoProfile(sk, { off = 0, bottom = sk.T.hipY - sk.H * 0.035, top = sk.neckBase.y + sk.H * 0.01, flare = 0, close = false } = {}) {
  const { T, R } = sk;
  const keys = [
    [sk.T.hipY - sk.H * 0.06, T.rHip * 0.55], [sk.T.hipY - sk.H * 0.035, T.rHip * 0.92], [T.hipY, T.rHip], [T.hipY + sk.H * 0.05, (T.rHip + T.rWaist) / 2],
    [T.waistY, T.rWaist], [T.chestY - sk.H * 0.035, T.rChest * 0.97], [T.chestY, T.rChest], [T.shoulderY - sk.H * 0.025, T.rShoulder],
    [T.shoulderY + sk.H * 0.008, T.rShoulder * 0.62], [sk.neckBase.y, R.neck * 1.25], [sk.neckBase.y + sk.H * 0.02, R.neck],
  ];
  const at = (y) => { for (let i = 1; i < keys.length; i++) if (y <= keys[i][0]) { const [y0, r0] = keys[i - 1], [y1, r1] = keys[i]; const t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); } return keys[keys.length - 1][1]; };
  const out = [];
  const n = 26;
  if (close) out.push([bottom - sk.H * 0.004, 0.003]);
  for (let i = 0; i <= n; i++) {
    const y = bottom + ((top - bottom) * i) / n;
    const below = Math.max(0, (Math.min(T.hipY, top) - y) / Math.max(0.01, Math.min(T.hipY, top) - bottom));
    out.push([y, Math.max(at(Math.max(y, keys[0][0])), y < T.hipY ? T.rHip * 0.9 : 0) + off + flare * below ** 1.6]);
  }
  if (close) out.push([top + sk.H * 0.004, 0.003]);
  return out;
}

/** The body (skin) and the hair. Returns a group with the meshes. */
export function buildBody(sk, mats, c) {
  const g = new THREE.Group();
  const add = (geo, m = mats.skin) => g.add(mesh(geo, m));
  // torso + pelvis
  add(shell(torsoProfile(sk, { close: true }), { depth: sk.T.depth, cx: sk.T.shift, zFront: 1.05 }));
  add(sphere(V(sk.T.shift, sk.T.hipY - sk.H * 0.02, 0), sk.T.rHip * 0.98, 1, 0.62, 0.66));
  // neck + head
  add(tube(sk.neckBase.clone().setY(sk.neckBase.y - sk.H * 0.02), sk.headC.clone().setY(sk.headC.y - sk.R.head * 0.4), sk.R.neck, sk.R.neck * 0.92, { bulge: 0 }));
  add(sphere(sk.headC, sk.R.head, 0.84, 1.02, 0.96, 32));
  add(sphere(sk.headC.clone().add(V(0, -sk.R.head * 0.48, sk.R.head * 0.28)), sk.R.head * 0.55, 0.95, 0.75, 0.9)); // jaw
  add(sphere(sk.headC.clone().add(V(0, -sk.R.head * 0.02, sk.R.head * 0.86)), sk.R.head * 0.12, 0.7, 1.3, 0.8, 12)); // nose
  for (const e of sk.ears) add(sphere(e, sk.R.head * 0.17, 0.45, 1, 0.8, 12));
  // arms, hands
  for (const a of sk.arm) {
    add(sphere(a.S, sk.R.upper * 1.35, 1, 1, 1));
    add(tube(a.S, a.E, sk.R.upper * 1.15, sk.R.elbow, { bulge: 0.12 }));
    add(tube(a.E, a.W, sk.R.fore, sk.R.wrist, { bulge: 0.1 }));
    const hg = tube(a.W, a.hand, sk.R.wrist * 1.15, sk.R.wrist * 0.8, { bulge: 0.35 });
    add(hg);
  }
  // legs, feet
  for (const l of sk.leg) {
    add(tube(l.H, l.K, sk.R.thigh, sk.R.knee, { bulge: 0.1 }));
    add(tube(l.K, l.A, sk.R.calf, sk.R.ankle, { bulge: 0.18 }));
    add(sphere(V(l.A.x, sk.H * 0.022, l.A.z + sk.H * 0.04), sk.H * 0.024, 0.85, 0.75, 2.4));
  }
  const hair = buildHair(sk, mats.hair, c.hair);
  if (hair) g.add(hair);
  return g;
}

function rand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function buildHair(sk, m, style) {
  if (!style || style === 'bald') return null;
  const g = new THREE.Group();
  const C = sk.headC, R = sk.R.head;
  const add = (geo) => g.add(mesh(geo, m));
  const cap = (k = 1.04, thetaLength = 1.75) => { const geo = new THREE.SphereGeometry(R * k, 32, 20, 0, Math.PI * 2, 0, thetaLength); geo.scale(0.86, 1.02, 0.98); geo.translate(C.x, C.y + R * 0.02, C.z - R * 0.03); return geo; };
  if (style === 'buzz') add(cap(1.025, 1.6));
  if (style === 'bob' || style === 'long') {
    // a shell open at the face
    const geo = new THREE.SphereGeometry(R * 1.12, 40, 24, Math.PI * 0.62, Math.PI * 1.76, 0, 2.15);
    geo.scale(0.9, 1.04, 1.02); geo.translate(C.x, C.y + R * 0.03, C.z - R * 0.04);
    add(geo); add(cap(1.06, 1.25));
    // straight fringe
    const f = new THREE.CylinderGeometry(R * 0.98, R * 1.0, R * 0.42, 24, 1, true, -0.95, 1.9); f.scale(0.9, 1, 1.02); f.translate(C.x, C.y + R * 0.52, C.z - R * 0.02); add(f);
    if (style === 'long') {
      const curtain = new THREE.CylinderGeometry(R * 1.02, R * 1.2, sk.H * 0.3, 32, 6, true, Math.PI * 0.55, Math.PI * 0.9);
      curtain.scale(0.95, 1, 0.75); curtain.translate(C.x, C.y - sk.H * 0.15 - R * 0.2, C.z - R * 0.15); add(curtain);
      for (const s of [-1, 1]) { const strand = tube(V(C.x + s * R * 0.78, C.y, C.z + R * 0.1), V(C.x + s * R * 1.05, C.y - sk.H * 0.24, C.z + R * 0.35), R * 0.16, R * 0.1, { bulge: 0 }); strand.scale(1, 1, 0.5); add(strand); }
    }
  }
  if (style === 'spikes' || style === 'mohawk') {
    add(cap(1.03, style === 'mohawk' ? 1.5 : 1.7));
    const r = rand(style === 'spikes' ? 7 : 11);
    const n = style === 'spikes' ? 26 : 9;
    for (let i = 0; i < n; i++) {
      let dir;
      if (style === 'spikes') { const th = r() * Math.PI * 2, ph = 0.15 + r() * 1.05; dir = V(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th) * 0.9 - 0.15).normalize(); }
      else { const a = -0.6 + (i / (n - 1)) * 2.3; dir = V(0, Math.cos(a), -Math.sin(a)).normalize(); }
      const base = C.clone().addScaledVector(dir, R * 0.95);
      const len = R * (style === 'spikes' ? 0.5 + r() * 0.7 : 0.9 + Math.sin((i / (n - 1)) * Math.PI) * 0.7);
      const cone = new THREE.ConeGeometry(R * (style === 'spikes' ? 0.16 : 0.22), len, 8);
      cone.translate(0, len / 2, 0);
      if (style === 'mohawk') cone.scale(0.35, 1, 1);
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
      cone.translate(base.x, base.y, base.z);
      add(cone);
    }
  }
  if (style === 'buns' || style === 'tails' || style === 'braids') {
    add(cap(1.035, 1.7));
    for (const s of [-1, 1]) {
      if (style === 'buns') add(sphere(C.clone().add(V(s * R * 0.62, R * 0.82, -R * 0.1)), R * 0.36));
      if (style === 'tails') {
        const root = C.clone().add(V(s * R * 0.7, R * 0.75, -R * 0.2));
        const curve = new THREE.CatmullRomCurve3([root, root.clone().add(V(s * R * 0.9, R * 0.2, -R * 0.2)), root.clone().add(V(s * R * 1.5, -R * 0.8, -R * 0.3)), root.clone().add(V(s * R * 1.35, -sk.H * 0.18, -R * 0.2))]);
        const tg = new THREE.TubeGeometry(curve, 40, R * 0.2, 12);
        const p = tg.attributes.position; // taper towards the tips
        const pts = curve.getSpacedPoints(40);
        for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / 13); const t = ring / 40; const c0 = pts[Math.min(40, ring)]; const v = V(p.getX(i), p.getY(i), p.getZ(i)).sub(c0).multiplyScalar(1 - t * 0.85).add(c0); p.setXYZ(i, v.x, v.y, v.z); }
        tg.computeVertexNormals(); add(tg);
        add(sphere(root, R * 0.17));
      }
      if (style === 'braids') {
        let p = C.clone().add(V(s * R * 0.72, -R * 0.35, -R * 0.35));
        for (let i = 0; i < 12; i++) { const rr = R * (0.2 - i * 0.008); add(sphere(p, rr, 1, 1.2, 1, 12)); p = p.clone().add(V(s * R * 0.03, -rr * 1.9, R * 0.07)); }
      }
    }
  }
  return g;
}
