import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, changedKeys } from '../src/lib/history.js';

test('undo and redo walk through snapshots', () => {
  let t = 0;
  const h = createHistory({ now: () => (t += 1000) });
  h.push('a'); h.push('b'); h.push('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b');
  assert.equal(h.redo(), 'c');
  assert.equal(h.redo(), null);
});

test('a new change clears redo', () => {
  let t = 0;
  const h = createHistory({ now: () => (t += 1000) });
  h.push('a'); h.push('b'); h.undo(); h.push('x');
  assert.equal(h.canRedo, false);
  assert.equal(h.undo(), 'a');
});

test('quick changes to the same control merge into one step', () => {
  let t = 0;
  const h = createHistory({ now: () => (t += 50) });
  h.push('a', '');
  h.push('w1', 'p.width'); h.push('w2', 'p.width'); h.push('w3', 'p.width');
  assert.equal(h.size, 2);
  assert.equal(h.undo(), 'a');
  h.redo();
  h.push('d1', 'p.depth');
  assert.equal(h.size, 3);
});

test('duplicates are ignored and the limit holds', () => {
  let t = 0;
  const h = createHistory({ limit: 3, now: () => (t += 1000) });
  h.push('a'); h.push('a'); h.push('b'); h.push('c'); h.push('d');
  assert.equal(h.size, 3);
  assert.equal(h.undo(), 'c');
});

test('changedKeys names nested differences', () => {
  assert.equal(changedKeys({ p: { a: 1, b: 2 }, m: 'x' }, { p: { a: 1, b: 3 }, m: 'x' }), 'p.b');
  assert.equal(changedKeys({ m: 'x' }, { m: 'y' }), 'm');
  assert.equal(changedKeys({ m: 'x' }, { m: 'x' }), '');
});
