import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineFromPixels, encodeShapes, decodeShapes, thinParts, toMask, area } from '../src/jewellery/outline.js';

function pixels(size, inside) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = inside(x, y) ? 0 : 255; const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: size, height: size };
}

test('a ring-shaped drawing gives one outline with one hole', () => {
  const px = pixels(200, (x, y) => { const d = Math.hypot(x - 100, y - 100); return d < 80 && d > 40; });
  const r = outlineFromPixels(px, { threshold: 128 });
  assert.equal(r.shapes.length, 1);
  assert.equal(r.shapes[0].holes.length, 1);
  const a = area(r.shapes[0].outer) + area(r.shapes[0].holes[0]);
  const exact = Math.PI * (80 ** 2 - 40 ** 2);
  assert.ok(Math.abs(a - exact) / exact < 0.05, `${a} vs ${exact}`);
});

test('“Fill inside” drops the hole; invert swaps ink and paper', () => {
  const px = pixels(200, (x, y) => { const d = Math.hypot(x - 100, y - 100); return d < 80 && d > 40; });
  assert.equal(outlineFromPixels(px, { fillHoles: true }).shapes[0].holes.length, 0);
  const inv = outlineFromPixels(px, { invert: true });
  assert.ok(inv.shapes.length >= 1);
});

test('dust is ignored, thin lines are detected', () => {
  const px = pixels(200, (x, y) => (x > 50 && x < 150 && y > 50 && y < 150) || (x === 10 && y === 10));
  assert.equal(outlineFromPixels(px).shapes.length, 1);
  const line = toMask(pixels(200, (x, y) => y >= 98 && y <= 101 && x > 20 && x < 180));
  assert.ok(thinParts(line, 4) > 0.5);
  const block = toMask(pixels(200, (x, y) => x > 50 && x < 150 && y > 50 && y < 150));
  assert.ok(thinParts(block, 4) < 0.05);
});

test('outlines survive the share link', () => {
  const r = outlineFromPixels(pixels(160, (x, y) => Math.hypot(x - 80, y - 80) < 60));
  const code = encodeShapes(r.shapes, r.box);
  assert.match(code, /^[A-Za-z0-9\-_~.]+$/);
  assert.ok(code.length < 4000);
  const back = decodeShapes(code);
  assert.equal(back.shapes.length, 1);
  assert.equal(decodeShapes('<script>'), null);
});
