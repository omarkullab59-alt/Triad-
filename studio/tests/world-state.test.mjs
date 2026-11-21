import test from 'node:test';
import assert from 'node:assert/strict';
import { worldState, sanitize, newNode, descendants, f32ToB64, b64ToF32 } from '../src/world/state.js';
import { WORLDS } from '../src/world/worlds.js';

test('every world type gives a complete state that survives sanitize', () => {
  for (const k of Object.keys(WORLDS)) {
    const s = worldState(k, 5);
    const t = sanitize(JSON.parse(JSON.stringify(s)));
    assert.equal(t.world, k);
    assert.deepEqual(t.gen, s.gen);
    assert.deepEqual(t.sky, s.sky);
    assert.deepEqual(t.layers, s.layers);
  }
});

test('sanitize drops junk and repairs broken references', () => {
  const a = newNode('sphere'), b = newNode('cube', { parent: a.id }), c = newNode('tree', { parent: 'missing' });
  const s = sanitize({ world: 'nope', water: { color: 'blue', level: 'x' }, nodes: [a, b, c, { type: 'virus' }, null], active: 'zzz', brush: { tool: 'hack' } });
  assert.equal(s.world, 'mountains');
  assert.equal(s.water.color, worldState().water.color);
  assert.equal(s.nodes.length, 3);
  assert.equal(s.nodes[1].parent, a.id);
  assert.equal(s.nodes[2].parent, null);
  assert.equal(s.brush.tool, 'raise');
  assert.ok(s.layers.some((l) => l.id === s.active));
});

test('descendants walk the hierarchy', () => {
  const a = newNode('sphere'), b = newNode('cube', { parent: a.id }), c = newNode('cube', { parent: b.id });
  assert.deepEqual(descendants([a, b, c], a.id).map((n) => n.id), [b.id, c.id]);
});

test('layer data round-trips through base64', () => {
  const a = new Float32Array(16).map((_, i) => i * 0.5 - 3);
  assert.deepEqual(b64ToF32(f32ToB64(a), 16), a);
  assert.throws(() => b64ToF32(f32ToB64(a), 15));
});
