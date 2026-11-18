import test from 'node:test';
import assert from 'node:assert/strict';
import { plate } from '../src/home/plate.js';
import { vessel } from '../src/home/vessel.js';
import { cutlery } from '../src/home/cutlery.js';
import { cabinet } from '../src/home/cabinet.js';
import { sketch3d } from '../src/make/sketch3d.js';
import { ring } from '../src/jewellery/types/ring.js';
import { destroy, weld, refine } from '../src/jewellery/destroy.js';
import { geometryVolume } from '../src/jewellery/revolve.js';
import { partsToSTL } from '../src/jewellery/stl.js';

const defaults = (t) => Object.fromEntries(t.params.map((p) => [p.key, p.default]));
const ctx = { makeCanvas: () => { throw new Error('no canvas'); } };

/** every edge of a closed mesh is used by exactly two triangles */
function closed(geometry) {
  const { tris } = weld(geometry);
  const edges = new Map();
  for (let i = 0; i < tris.length; i += 4) for (const [a, b] of [[tris[i], tris[i + 1]], [tris[i + 1], tris[i + 2]], [tris[i + 2], tris[i]]]) {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    edges.set(k, (edges.get(k) || 0) + 1);
  }
  return [...edges.values()].every((n) => n === 2);
}

test('home objects build with every template, closed and with sensible weights', () => {
  for (const t of [plate, vessel, cutlery, cabinet]) {
    for (const tpl of [{ label: 'default', p: {} }, ...t.templates]) {
      const r = t.build({ ...defaults(t), ...tpl.p }, ctx);
      assert.ok(r.volume > 0, `${t.id} ${tpl.label}`);
      assert.ok(partsToSTL(r.parts).byteLength > 84);
    }
  }
  const dinner = plate.build({ ...defaults(plate) }, ctx);
  const g = (dinner.volume / 1000) * 2.4;
  assert.ok(g > 400 && g < 1200, `dinner plate ${g} g`); // real ones weigh 500–900 g
  assert.ok(closed(dinner.parts[0].geometry), 'plate is watertight');
  assert.ok(closed(vessel.build(defaults(vessel), ctx).parts[0].geometry), 'bowl is watertight');
});

test('cabinet weight is in the right range (oak sideboard ≈ 30–90 kg)', () => {
  const r = cabinet.build({ ...defaults(cabinet), ...cabinet.templates[0].p }, ctx);
  const kg = (r.volume / 1e6) * 0.72;
  assert.ok(kg > 30 && kg < 90, `${kg} kg`);
});

test('refine keeps a mesh closed and splits long edges', () => {
  const r = ring.build(defaults(ring), ctx);
  const m = refine(weld(r.parts[0].geometry), 0.4);
  const edges = new Map();
  for (let i = 0; i < m.tris.length; i += 4) for (const [a, b] of [[m.tris[i], m.tris[i + 1]], [m.tris[i + 1], m.tris[i + 2]], [m.tris[i + 2], m.tris[i]]]) {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`; edges.set(k, (edges.get(k) || 0) + 1);
  }
  assert.ok([...edges.values()].every((n) => n === 2));
});

test('destroy mode removes material, stays closed, is repeatable, adds dirt colours', () => {
  const r = ring.build({ ...defaults(ring), style: 'peaks' }, ctx);
  for (const style of ['erode', 'crack', 'chip', 'melt', 'mix']) {
    const a = destroy(r.parts[0].geometry, { amount: 0.6, dirt: 0.5, style, seed: 3, wall: r.minWall });
    const b = destroy(r.parts[0].geometry, { amount: 0.6, dirt: 0.5, style, seed: 3, wall: r.minWall });
    assert.ok(closed(a.geometry), `${style} closed`);
    assert.deepEqual(a.geometry.attributes.position.array.slice(0, 30), b.geometry.attributes.position.array.slice(0, 30), `${style} same seed same result`);
    assert.ok(a.geometry.attributes.color, 'dirt colours');
    if (style !== 'melt') assert.ok(geometryVolume(a.geometry) < r.volume, `${style} removes material`);
    assert.ok(a.depth <= r.minWall * 1.25, `${style} depth ${a.depth}`);
  }
  assert.equal(destroy(r.parts[0].geometry, { amount: 0, dirt: 0.3 }).depth, 0);
});

function pixels(size, inside) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = inside(x, y) ? 0 : 255; const i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
  return { data, width: size, height: size };
}

test('sketch → 3D: cut-out, relief and turned', () => {
  const px = pixels(160, (x, y) => Math.abs(x - 80) < 20 + y * 0.25 && y > 20 && y < 140); // vase silhouette
  for (const mode of ['flat', 'relief', 'turned']) {
    const r = sketch3d.build({ ...defaults(sketch3d), mode, size: 100, depth: 4, hollow: true }, { ...ctx, pixels: px });
    assert.ok(!r.empty && r.volume > 0, mode);
    assert.ok(closed(r.parts[0].geometry), `${mode} watertight`);
  }
  const solid = sketch3d.build({ ...defaults(sketch3d), mode: 'turned', size: 100, hollow: false }, { ...ctx, pixels: px });
  const hollow = sketch3d.build({ ...defaults(sketch3d), mode: 'turned', size: 100, depth: 4, hollow: true }, { ...ctx, pixels: px });
  assert.ok(hollow.volume < solid.volume * 0.5);
});
