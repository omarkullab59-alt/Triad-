// ETHER — modular wardrobe: tops, bottoms, shoes and accessories, all built on the character skeleton.
// Every item is real geometry (exports with the character as GLB) and uses a material slot the editor can change.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { tube, shell, sphere, mesh, torsoProfile } from './character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Height the shoes add (the body stands on the soles). */
export const SHOE_LIFT = { none: 0, sneaker: 0.035, boot: 0.025, platform: 0.075, spike: 0.085 };

function graphicTexture(text) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 1024);
  // original mark: four-point star inside an orbit, small type underneath
  x.translate(512, 430); x.strokeStyle = '#0b0b0c'; x.fillStyle = '#0b0b0c';
  x.lineWidth = 10; x.beginPath(); x.ellipse(0, 0, 250, 90, -0.35, 0, Math.PI * 2); x.stroke();
  x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 34 : 190; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.font = '500 64px "JetBrains Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.letterSpacing = '18px';
  x.fillText(String(text || '').toUpperCase().slice(0, 16), 512, 760);
  x.font = '400 28px "JetBrains Mono", ui-monospace, monospace';
  x.fillText('— 00:00 / NO SIGNAL —', 512, 820);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Sleeves along the arm (t from shoulder 0 → wrist 1). */
function sleeves(sk, add, m, { off, to = 1, flare = 0, bulge = 0.1, gather = 0 }) {
  for (const a of sk.arm) {
    add(sphere(a.S, sk.R.upper * 1.35 + off * 1.2, 1, 1, 1), m);
    const L1 = a.S.distanceTo(a.E), L2 = a.E.distanceTo(a.W), tot = L1 + L2, need = to * tot;
    add(tube(a.S, a.E, sk.R.upper * 1.15, sk.R.elbow, { off, bulge, t1: Math.min(1, need / L1), caps: false, flare: need <= L1 ? flare : 0 }), m);
    if (need > L1) { add(sphere(a.E, sk.R.elbow + off, 1, 1, 1, 16), m); add(tube(a.E, a.W, sk.R.fore, sk.R.wrist, { off, bulge, t1: Math.min(1, (need - L1) / L2), caps: false, flare, gather }), m); }
  }
}
/** Trouser legs: t from hip 0 → ankle 1, plus the seat. */
function legs(sk, add, m, { off, flare = 0, bulge = 0.08, gather = 0, to = 1, seatTop }) {
  add(shell(torsoProfile(sk, { off: off * 1.1, bottom: sk.T.hipY - sk.H * 0.075, top: seatTop ?? sk.T.waistY - sk.H * 0.02, close: false }), { depth: sk.T.depth, cx: sk.T.shift }), m);
  add(sphere(V(sk.T.shift, sk.T.hipY - sk.H * 0.025, 0), sk.T.rHip * 0.99 + off, 1, 0.64, 0.68), m);
  for (const l of sk.leg) {
    const L1 = l.H.distanceTo(l.K), L2 = l.K.distanceTo(l.A), need = to * (L1 + L2);
    add(tube(l.H, l.K, sk.R.thigh * 1.08, sk.R.knee, { off, bulge, caps: false, t1: Math.min(1, need / L1) }), m);
    if (need > L1) {
      add(sphere(l.K, sk.R.knee + off * 1.05, 1, 1, 1, 16), m);
      const end = l.A.clone().add(V(0, -sk.H * 0.03 * (flare > 0 ? 1 : 0), 0));
      add(tube(l.K, end, sk.R.calf, sk.R.ankle, { off, bulge, flare, gather, caps: false, t1: Math.min(1, (need - L1) / L2) }), m);
    }
  }
}

export function buildTop(sk, M, kind, graphic) {
  const g = new THREE.Group();
  const add = (geo, m = M.top) => g.add(mesh(geo, m));
  const H = sk.H, o = H * 0.004;
  const torso = (off, bottom, opts = {}) => add(shell(torsoProfile(sk, { off, bottom, top: sk.neckBase.y + (opts.neck ?? H * 0.012), flare: opts.flare || 0 }), { depth: sk.T.depth, cx: sk.T.shift, zFront: 1.05 }), opts.m || M.top);
  if (kind === 'longsleeve' || kind === 'mesh') {
    if (kind === 'mesh') torso(o * 0.5, sk.T.waistY + H * 0.02, { m: M.under, neck: -H * 0.02 }); // tank under the net
    torso(o * (kind === 'mesh' ? 1.6 : 1), sk.T.hipY - H * 0.02, { neck: H * 0.03 });
    sleeves(sk, add, M.top, { off: o * (kind === 'mesh' ? 1.6 : 1), to: 1.04 });
  }
  if (kind === 'graphic') {
    torso(H * 0.012, sk.T.hipY - H * 0.04, { flare: H * 0.01 });
    sleeves(sk, add, M.top, { off: H * 0.012, to: 0.32, flare: H * 0.012 });
    // print panel on the chest
    const prof = torsoProfile(sk, { off: H * 0.0135, bottom: sk.T.waistY - H * 0.02, top: sk.T.chestY + H * 0.03 });
    const geo = shell(prof, { depth: sk.T.depth, cx: sk.T.shift, phiStart: -0.75, phiLength: 1.5, seg: 24, zFront: 1.05 });
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i));
    const pm = new THREE.MeshPhysicalMaterial({ map: graphicTexture(graphic), transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 });
    g.add(mesh(geo, pm, false));
  }
  if (kind === 'layered') {
    torso(o, sk.T.hipY - H * 0.02, { m: M.under, neck: H * 0.035 });
    sleeves(sk, add, M.under, { off: o, to: 1.1, gather: 1 });
    // cropped outer layer with an open back panel and a long tail
    add(shell(torsoProfile(sk, { off: H * 0.016, bottom: sk.T.chestY - H * 0.07, top: sk.neckBase.y - H * 0.005 }), { depth: sk.T.depth, cx: sk.T.shift, phiStart: -Math.PI * 0.85, phiLength: Math.PI * 1.7 }));
    sleeves(sk, add, M.top, { off: H * 0.016, to: 0.45, flare: H * 0.02 });
    const tail = shell([[sk.T.hipY - H * 0.25, sk.T.rHip * 1.25], [sk.T.waistY, sk.T.rWaist + H * 0.02], [sk.T.chestY - H * 0.06, sk.T.rChest + H * 0.016]], { depth: sk.T.depth * 1.05, cx: sk.T.shift, phiStart: Math.PI * 0.62, phiLength: Math.PI * 0.76, seg: 16 });
    add(tail);
  }
  if (kind === 'jacket') {
    torso(H * 0.02, sk.T.hipY - H * 0.045, { flare: H * 0.012, neck: H * 0.06 });
    sleeves(sk, add, M.top, { off: H * 0.02, to: 1.02, flare: H * 0.02, bulge: 0.05 });
    // funnel collar, sculpted shoulders, zip line
    add(tube(sk.neckBase.clone().setY(sk.neckBase.y - H * 0.01), sk.neckBase.clone().setY(sk.neckBase.y + H * 0.07), sk.R.neck * 1.9, sk.R.neck * 1.7, { caps: false, bulge: 0 }));
    for (const a of sk.arm) add(sphere(a.S.clone().add(V(0, H * 0.012, 0)), sk.R.upper * 2.2, 1.35, 0.7, 1.05));
    const zip = new THREE.BoxGeometry(H * 0.006, sk.neckBase.y + H * 0.05 - (sk.T.hipY - H * 0.04), H * 0.006);
    zip.translate(sk.T.shift, (sk.neckBase.y + H * 0.05 + sk.T.hipY - H * 0.04) / 2, sk.T.rChest * sk.T.depth * 1.05 + H * 0.022);
    add(zip, M.metal);
  }
  if (kind === 'hoodie') {
    torso(H * 0.04, sk.T.hipY - H * 0.06, { flare: H * 0.005, neck: H * 0.01 });
    sleeves(sk, add, M.top, { off: H * 0.03, to: 1.08, bulge: 0.18, gather: 1 });
    const hood = new THREE.SphereGeometry(sk.R.head * 1.55, 32, 18, Math.PI * 0.62, Math.PI * 1.76, 0.25, 2.3);
    hood.scale(0.92, 1.05, 1.12); hood.translate(sk.headC.x, sk.headC.y - sk.R.head * 0.15, sk.headC.z - sk.R.head * 0.55);
    add(hood);
    const pocket = new THREE.BoxGeometry(sk.T.rWaist * 1.4, H * 0.07, H * 0.012);
    pocket.translate(sk.T.shift, sk.T.waistY - H * 0.04, sk.T.rWaist * sk.T.depth + H * 0.05);
    add(pocket);
    for (const s of [-1, 1]) add(tube(V(sk.T.shift + s * H * 0.02, sk.neckBase.y - H * 0.01, sk.T.rChest * 0.55), V(sk.T.shift + s * H * 0.024, sk.T.chestY - H * 0.06, sk.T.rChest * sk.T.depth + H * 0.05), H * 0.0025, H * 0.0025, { bulge: 0 }), M.metal);
  }
  return g;
}

export function buildBottom(sk, M, kind) {
  const g = new THREE.Group();
  const add = (geo, m = M.bottom) => g.add(mesh(geo, m));
  const H = sk.H;
  if (kind === 'slim') legs(sk, add, M.bottom, { off: H * 0.004 });
  if (kind === 'flared') legs(sk, add, M.bottom, { off: H * 0.006, flare: H * 0.045 });
  if (kind === 'cargo') {
    legs(sk, add, M.bottom, { off: H * 0.02, bulge: 0.15, gather: 1 });
    for (const [i, l] of sk.leg.entries()) {
      const s = i ? 1 : -1;
      const mid = l.H.clone().lerp(l.K, 0.55);
      const p = new THREE.BoxGeometry(H * 0.016, H * 0.075, H * 0.06); p.translate(mid.x + s * (sk.R.thigh + H * 0.026), mid.y, mid.z); add(p);
      add(tube(mid.clone().add(V(s * sk.R.thigh * 0.6, H * 0.06, sk.R.thigh)), mid.clone().add(V(s * sk.R.thigh * 1.4, -H * 0.08, -sk.R.thigh * 0.3)), H * 0.003, H * 0.003, { bulge: 0 }), M.metal);
    }
  }
  if (kind === 'layered' || kind === 'wrap') {
    legs(sk, add, kind === 'wrap' ? M.under : M.bottom, { off: H * (kind === 'wrap' ? 0.002 : 0.005) });
    const len = kind === 'wrap' ? 0.36 : 0.2;
    const y0 = sk.T.waistY - H * 0.01;
    add(shell([[y0 - H * len, sk.T.rHip * (kind === 'wrap' ? 1.5 : 1.6) + H * 0.02], [sk.T.hipY, sk.T.rHip + H * 0.022], [y0, sk.T.rWaist + H * 0.014]], { depth: sk.T.depth * 1.08, cx: sk.T.shift, phiStart: kind === 'wrap' ? -Math.PI * 0.82 : -Math.PI, phiLength: kind === 'wrap' ? Math.PI * 1.88 : Math.PI * 2, seg: 48 }), kind === 'wrap' ? M.bottom : M.under);
  }
  if (kind === 'balloon') legs(sk, add, M.bottom, { off: H * 0.012, bulge: 0.9, gather: 1 });
  if (kind !== 'none' && kind !== 'wrap') {
    const band = shell([[sk.T.waistY - H * 0.035, sk.T.rWaist + H * 0.01], [sk.T.waistY - H * 0.005, sk.T.rWaist + H * 0.012]], { depth: sk.T.depth, cx: sk.T.shift });
    add(band);
  }
  return g;
}

export function buildShoes(sk, M, kind) {
  const g = new THREE.Group();
  if (kind === 'none') return g;
  const H = sk.H, lift = SHOE_LIFT[kind];
  const add = (geo, m = M.shoes) => g.add(mesh(geo, m));
  for (const l of sk.leg) {
    const fx = l.A.x, fz = l.A.z + H * 0.04, footY = lift + H * 0.022;
    const sole = (h, w = 1.15, len = 2.7, z = fz) => { const s = sphere(V(fx, h / 2, z), H * 0.026, w, h / (H * 0.052), len, 24); add(s, M.metal); };
    if (kind === 'sneaker') { sole(lift + H * 0.006, 1.25, 2.8); add(sphere(V(fx, footY + H * 0.004, fz), H * 0.027, 1.08, 0.85, 2.55)); add(tube(l.A.clone().setY(footY), l.A.clone().setY(footY + H * 0.04), sk.R.ankle * 1.6, sk.R.ankle * 1.5, { bulge: 0 })); }
    if (kind === 'boot') { sole(lift + H * 0.004, 1.05, 2.6); add(sphere(V(fx, footY + H * 0.002, fz + H * 0.005), H * 0.025, 0.95, 0.8, 2.75)); add(tube(l.A.clone().setY(footY), l.K.clone().lerp(l.A, 0.25), sk.R.ankle * 1.5, sk.R.calf * 1.15, { bulge: 0, caps: false })); }
    if (kind === 'platform') {
      const p = new RoundedBoxGeometry(H * 0.058, lift + H * 0.01, H * 0.15, 4, H * 0.012); p.translate(fx, (lift + H * 0.01) / 2, fz); add(p, M.metal);
      add(sphere(V(fx, footY + H * 0.006, fz - H * 0.008), H * 0.026, 1.05, 0.9, 2.3));
      // split toe: two rounded caps divided by a groove
      for (const s of [-1, 1]) add(sphere(V(fx + s * H * 0.0105, footY + H * 0.002, fz + H * 0.045), H * 0.0125, 1, 0.95, 1.9, 16));
    }
    if (kind === 'spike') {
      add(sphere(V(fx, footY + H * 0.002, fz + H * 0.01), H * 0.023, 0.9, 0.75, 3.2));
      const blade = new THREE.BoxGeometry(H * 0.004, lift, H * 0.03); blade.translate(fx, lift / 2, fz - H * 0.045); add(blade, M.metal);
      const tip = new RoundedBoxGeometry(H * 0.045, H * 0.014, H * 0.075, 3, H * 0.006); tip.translate(fx, H * 0.007, fz + H * 0.05); add(tip, M.metal);
    }
  }
  return g;
}

export function buildAccessories(sk, M, on) {
  const g = new THREE.Group();
  const add = (geo, m = M.metal) => g.add(mesh(geo, m));
  const H = sk.H, C = sk.headC, R = sk.R.head;
  const torus = (r, t, c, rot = [0, 0, 0], arc = Math.PI * 2, sx = 1, sz = 1) => { const geo = new THREE.TorusGeometry(r, t, 12, 64, arc); geo.scale(sx, 1, sz); geo.rotateX(rot[0]); geo.rotateY(rot[1]); geo.rotateZ(rot[2]); geo.translate(c.x, c.y, c.z); return geo; };
  if (on.necklace) {
    add(torus(sk.R.neck * 2.3, H * 0.0022, sk.neckBase.clone().add(V(0, -H * 0.012, H * 0.012)), [Math.PI / 2 + 0.35, 0, 0], Math.PI * 2, 1, sk.T.depth * 1.3));
    const pend = new THREE.OctahedronGeometry(H * 0.014); pend.scale(0.7, 1.4, 0.4); pend.translate(sk.T.shift, sk.neckBase.y - H * 0.07, sk.T.rChest * sk.T.depth + H * 0.006); add(pend);
  }
  if (on.choker) add(torus(sk.R.neck * 1.08, H * 0.004, sk.neckBase.clone().add(V(0, H * 0.025, 0)), [Math.PI / 2, 0, 0], Math.PI * 2, 1, 1));
  if (on.chains) {
    const s = 1, y = sk.T.waistY - H * 0.04, x = sk.T.shift + s * sk.T.rHip * 0.95;
    for (let k = 0; k < 2; k++) {
      const a = V(x, y, sk.T.rHip * 0.5), b = V(x - s * H * 0.04, y + H * 0.005, -sk.T.rHip * 0.45);
      const mid = a.clone().lerp(b, 0.5).add(V(s * H * 0.03, -H * (0.09 + k * 0.06), 0));
      add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 48, H * 0.0024, 8));
    }
  }
  if (on.belt) {
    add(torus(sk.T.rWaist + H * 0.018, H * 0.006, V(sk.T.shift, sk.T.waistY - H * 0.03, 0), [Math.PI / 2, 0, 0], Math.PI * 2, 1, sk.T.depth * 1.08));
    const bk = new THREE.TorusGeometry(H * 0.016, H * 0.004, 8, 6); bk.scale(1.3, 1, 1); bk.translate(sk.T.shift, sk.T.waistY - H * 0.03, (sk.T.rWaist + H * 0.018) * sk.T.depth * 1.08 + H * 0.004); add(bk);
  }
  if (on.rings) for (const a of sk.arm) for (let i = 0; i < 3; i++) { const p = a.W.clone().lerp(a.hand, 0.75 + i * 0.09); add(torus(sk.R.wrist * 0.75, H * 0.0018, p, [Math.PI / 2, 0, 0])); }
  if (on.cuffs) for (const a of sk.arm) add(tube(a.E, a.W, sk.R.fore, sk.R.wrist, { off: H * 0.006, t0: 0.58, t1: 0.78, caps: false, bulge: 0 }));
  if (on.earrings) for (const e of sk.ears) { add(torus(R * 0.11, H * 0.0012, e.clone().add(V(0, -R * 0.2, 0.002)), [0, Math.PI / 2, 0])); const d = new THREE.ConeGeometry(R * 0.035, R * 0.45, 6); d.rotateX(Math.PI); d.translate(e.x, e.y - R * 0.55, e.z); add(d); }
  if (on.glasses) {
    const lens = new THREE.CylinderGeometry(R * 1.0, R * 1.0, R * 0.3, 48, 1, true, -1.15, 2.3);
    lens.scale(0.9, 1, 1.02); lens.translate(C.x, sk.eyes.y - R * 0.12, C.z);
    add(lens, M.glass);
    const frame = torus(R * 0.99, R * 0.025, V(0, 0, 0), [Math.PI / 2, 0, 0], 2.3, 0.9, 1.02);
    frame.rotateY(Math.PI / 2 - 1.15); frame.translate(C.x, sk.eyes.y + R * 0.03, C.z);
    add(frame);
  }
  if (on.gloves) for (const a of sk.arm) { add(tube(a.W, a.hand, sk.R.wrist * 1.15, sk.R.wrist * 0.8, { off: H * 0.003, bulge: 0.35 }), M.shoes); add(tube(a.E, a.W, sk.R.fore, sk.R.wrist, { off: H * 0.004, t0: 0.55, t1: 1, caps: false, bulge: 0 }), M.shoes); }
  if (on.orbit) { // tilted like a planet ring, crossing the face — not above the head
    const ring = torus(R * 1.75, H * 0.0022, V(0, 0, 0), [Math.PI / 2, 0, 0]); ring.rotateZ(0.62); ring.rotateX(0.18); ring.translate(C.x, C.y - R * 0.1, C.z); add(ring);
    add(sphere(C.clone().add(V(-R * 1.42, R * 0.92, R * 0.3)), H * 0.006));
  }
  if (on.spine) for (let i = 0; i < 9; i++) {
    const y = sk.neckBase.y - H * 0.02 - i * ((sk.neckBase.y - sk.T.waistY) / 9);
    const z = -(i < 4 ? sk.T.rChest : sk.T.rWaist) * sk.T.depth - H * 0.012;
    const b = new THREE.BoxGeometry(H * (0.035 - i * 0.002), H * 0.012, H * 0.012); b.translate(sk.T.shift, y, z); add(b);
  }
  if (on.wings) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(0.11, 0.22, 0.01, 0.6); shape.quadraticCurveTo(-0.035, 0.3, 0, 0);
    const feather = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2, curveSegments: 16 });
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
      const f = feather.clone();
      const k = H / 1.78, len = (0.65 + Math.sin((i / 8) * Math.PI) * 0.55 - i * 0.03);
      f.scale(k * (0.9 + i * 0.05), k * len, k);
      f.rotateZ(s * (-0.25 - i * 0.17)); f.rotateY(s * 0.35);
      f.translate(sk.back.x + s * H * 0.04, sk.back.y - H * 0.02, sk.back.z - H * 0.03 - i * 0.004);
      add(f);
    }
  }
  return g;
}
