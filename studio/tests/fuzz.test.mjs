// Random parameters for every builder that runs without a browser: nothing may crash, every mesh must be usable.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ring } from '../src/jewellery/types/ring.js';
import { earrings } from '../src/jewellery/types/earrings.js';
import { bangle } from '../src/jewellery/types/bangle.js';
import { chain } from '../src/jewellery/types/chain.js';
import { plate } from '../src/home/plate.js';
import { vessel } from '../src/home/vessel.js';
import { cutlery } from '../src/home/cutlery.js';
import { cabinet } from '../src/home/cabinet.js';
import { sculpture, SUBJECTS } from '../src/sculpt/sculpture.js';
import { engrave, SIDES } from '../src/jewellery/engrave.js';
import { destroy, weld } from '../src/jewellery/destroy.js';
import { partsToSTL } from '../src/jewellery/stl.js';

let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ctx = { makeCanvas: () => { throw new Error('no canvas'); } };
function randomParams(t) {
  const p = {};
  for (const d of t.params) {
    if (d.type === 'range') p[d.key] = Math.round((d.min + rnd() * (d.max - d.min)) / d.step) * d.step;
    else if (d.type === 'ringsize') p[d.key] = 14 + rnd() * 9;
    else if (d.type === 'select') { const o = typeof d.options === 'function' ? d.options(p) : d.options; p[d.key] = pick(o)[0]; }
    else if (d.type === 'toggle') p[d.key] = rnd() > 0.5;
    else p[d.key] = d.type === 'text' ? '' : d.default;
  }
  return p;
}
function check(r, label) {
  assert.ok(Number.isFinite(r.volume) && r.volume > 0, `${label}: volume ${r.volume}`);
  for (const part of r.parts) {
    const a = part.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) assert.fail(`${label}: NaN vertex`);
  }
  assert.ok(partsToSTL(r.parts).byteLength > 84, label);
}

test('random settings never break a builder', () => {
  for (const t of [ring, earrings, bangle, chain, plate, vessel, cutlery, cabinet]) {
    for (let i = 0; i < 25; i++) {
      const p = randomParams(t);
      if (t === ring && p.style === 'signet' && p.width > 10) p.width = 6;
      check(t.build(p, ctx), `${t.id} ${JSON.stringify(p)}`);
    }
  }
});

test('every sculpture subject and pose builds', () => {
  for (const [subject, s] of Object.entries(SUBJECTS)) for (const [pose] of s.poses) {
    const p = { ...randomParams(sculpture), subject, pose, detail: 'draft' };
    check(sculpture.build(p, ctx), `sculpture ${subject}/${pose}`);
  }
});

test('engraving on every side keeps the mesh closed and finite', () => {
  const mask = { sample: (u, v) => (Math.abs(u) < 3 && Math.abs(v) < 3 && (Math.floor(u) + Math.floor(v)) % 2 ? 1 : 0), lengthMm: 8 };
  const r = vessel.build(Object.fromEntries(vessel.params.map((d) => [d.key, d.default])), ctx);
  const g = r.parts[0].geometry;
  g.computeBoundingBox();
  for (const [side] of SIDES) {
    for (const mode of ['engrave', 'emboss']) {
      const e = engrave(g, { mask, box: g.boundingBox, side, depth: 1, mode, fill: true, height: 8 });
      const { tris } = weld(e);
      const edges = new Map();
      for (let i = 0; i < tris.length; i += 4) for (const [a, b] of [[tris[i], tris[i + 1]], [tris[i + 1], tris[i + 2]], [tris[i + 2], tris[i]]]) { const k = a < b ? `${a}_${b}` : `${b}_${a}`; edges.set(k, (edges.get(k) || 0) + 1); }
      assert.ok([...edges.values()].every((n) => n === 2), `${side} ${mode} closed`);
      if (side === 'around' || side === 'front') assert.ok(e.groups.some((gr) => gr.materialIndex === 2), `${side} has a filled engraving`);
      const d = destroy(e, { amount: 0.3, dirt: 0.2, wall: 3 });
      assert.ok(d.geometry.groups.some((gr) => gr.materialIndex === 2) || side !== 'front', 'fill survives destroy mode');
    }
  }
});
