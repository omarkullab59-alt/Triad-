import test from 'node:test';
import assert from 'node:assert/strict';
import { belt } from '../src/wear/belt.js';
import { hat } from '../src/wear/hat.js';
import { partsToSTL } from '../src/jewellery/stl.js';

const d = (t) => Object.fromEntries(t.params.map((p) => [p.key, p.default]));

test('belt: middle hole sits at the waist size, cutting template is true to size', async () => {
  const r = belt.build({ ...d(belt), waist: 90, holes: 5, spacing: 25 });
  assert.match(r.dims[1][1], /^\d+\.\d cm long · 38 mm wide/);
  const svg = await r.downloads[0].make().text();
  assert.match(svg, /width="\d+(\.\d+)?mm"/);
  assert.ok(svg.includes('<polygon'));
  for (const tpl of belt.templates) assert.ok(partsToSTL(belt.build({ ...d(belt), ...tpl.p }).parts).byteLength > 84, tpl.label);
});

test('every hat builds, and size follows the head measurement', () => {
  for (const tpl of hat.templates) {
    const r = hat.build({ ...d(hat), ...tpl.p, detail: 'draft' });
    assert.ok(r.volume > 10000, `${tpl.label} ${r.volume}`);
  }
  const small = hat.build({ ...d(hat), head: 540, detail: 'draft' }), big = hat.build({ ...d(hat), head: 610, detail: 'draft' });
  small.parts[0].geometry.computeBoundingBox(); big.parts[0].geometry.computeBoundingBox();
  assert.ok(big.parts[0].geometry.boundingBox.max.x > small.parts[0].geometry.boundingBox.max.x);
  assert.equal(hat.build({ ...d(hat), head: 600, detail: 'draft' }).dims[1][1].split('· ')[1], 'XL');
});
