import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, makeNoise, erodeHydraulic, erodeThermal, combine, heightAt, dab, brushWeight, toGrey, fromGrey, TOOLS } from '../src/world/terrain.js';

const N = 65, SIZE = 200;
const range = (h) => { let lo = Infinity, hi = -Infinity; for (const v of h) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };

test('noise is deterministic and bounded', () => {
  const a = makeNoise(5), b = makeNoise(5);
  for (let i = 0; i < 200; i++) { const x = i * 0.37, y = i * 0.11; assert.equal(a(x, y), b(x, y)); assert.ok(Math.abs(a(x, y)) <= 1.6); }
});

test('generate: same seed = same world, finite heights, island sinks the edges', () => {
  const h1 = generate(N, SIZE, { seed: 3 }), h2 = generate(N, SIZE, { seed: 3 }), h3 = generate(N, SIZE, { seed: 4 });
  assert.deepEqual(h1, h2);
  assert.notDeepEqual(h1, h3);
  assert.ok(h1.every(Number.isFinite));
  const isl = generate(N, SIZE, { seed: 3, island: 1 });
  assert.ok(isl[0] < isl[Math.floor(N / 2) * N + Math.floor(N / 2)]);
});

test('erosion changes the surface but keeps it finite', () => {
  const h = generate(N, SIZE, { seed: 9, height: 40 });
  const before = h.slice();
  erodeHydraulic(h, N, { drops: 3000, cell: SIZE / (N - 1) });
  erodeThermal(h, N, { iterations: 5, cell: SIZE / (N - 1) });
  assert.ok(h.every(Number.isFinite));
  assert.ok(h.some((v, i) => Math.abs(v - before[i]) > 1e-4));
});

test('layers combine with visibility and opacity', () => {
  const a = new Float32Array(N * N).fill(2), b = new Float32Array(N * N).fill(10);
  assert.equal(combine([{ data: a }, { data: b, opacity: 0.5 }], N)[0], 7);
  assert.equal(combine([{ data: a }, { data: b, visible: false }], N)[0], 2);
});

test('brush weight: 1 in the centre, 0 outside, softer edge with softness', () => {
  assert.equal(brushWeight(0, 0, {}), 1);
  assert.equal(brushWeight(1.1, 0, {}), 0);
  assert.ok(brushWeight(0.8, 0, { softness: 0.9 }) < brushWeight(0.8, 0, { softness: 0.1 }));
  assert.equal(brushWeight(0.7, 0.7, { shape: 'square', falloff: 'constant' }), 1);
});

test('every tool runs; raise lifts, lower sinks, flatten approaches the target, smooth reduces spread', () => {
  const noise = makeNoise(1);
  for (const [tool] of TOOLS) {
    const layer = new Float32Array(N * N), full = generate(N, SIZE, { seed: 2, height: 30 });
    const r = dab(layer, full, N, SIZE, 0, 0, { tool, size: 30, strength: 0.8, dir: [1, 0], target: 5 }, noise);
    assert.ok(r, tool);
    assert.ok(layer.every(Number.isFinite), tool);
  }
  const c = Math.floor(N / 2) * N + Math.floor(N / 2);
  const run = (tool, extra = {}) => { const layer = new Float32Array(N * N), full = generate(N, SIZE, { seed: 2, height: 30 }); const b = full[c]; dab(layer, full, N, SIZE, 0, 0, { tool, size: 30, strength: 1, ...extra }, noise); return [b, full[c], layer[c]]; };
  const [b1, a1] = run('raise'); assert.ok(a1 > b1);
  const [b2, a2] = run('lower'); assert.ok(a2 < b2);
  const [b3, a3] = run('flatten', { target: 100 }); assert.ok(Math.abs(100 - a3) < Math.abs(100 - b3));
  const full = generate(N, SIZE, { seed: 8, height: 40, roughness: 0.8 }); const spread = (h) => { const [lo, hi] = range(h.slice(c - 3 * N - 3, c + 3 * N + 3)); return hi - lo; };
  const s0 = spread(full); for (let i = 0; i < 6; i++) dab(new Float32Array(N * N), full, N, SIZE, 0, 0, { tool: 'smooth', size: 40, strength: 1 }, noise);
  assert.ok(spread(full) <= s0);
});

test('heightAt interpolates, heightmap image round-trips', () => {
  const h = generate(N, SIZE, { seed: 4 });
  const v = heightAt(h, N, SIZE, 0, 0);
  assert.ok(Number.isFinite(v));
  const { grey } = toGrey(h);
  const back = fromGrey(grey, N, N, N, 100);
  const [lo, hi] = range(back);
  assert.ok(lo >= 0 && hi <= 100 && hi > 90);
});
