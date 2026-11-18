import test from 'node:test';
import assert from 'node:assert/strict';
import { ring } from '../src/jewellery/types/ring.js';
import { earrings } from '../src/jewellery/types/earrings.js';
import { bangle } from '../src/jewellery/types/bangle.js';
import { chain } from '../src/jewellery/types/chain.js';
import { partsToSTL } from '../src/jewellery/stl.js';
import { euFromDiameter, diameterFromUs, usFromDiameter, sizeSummary, grams, METALS } from '../src/lib/sizes.js';

const defaults = (t) => Object.fromEntries(t.params.map((p) => [p.key, p.default]));
const ctx = { makeCanvas: () => { throw new Error('no canvas in tests'); } };

test('ring sizes convert both ways', () => {
  assert.equal(Math.round(euFromDiameter(17.2)), 54);
  assert.ok(Math.abs(usFromDiameter(diameterFromUs(7)) - 7) < 1e-9);
  assert.match(sizeSummary(17.2), /^EU 54 · US 6\.75 · Ø 17\.2 mm$/);
});

test('plain band volume matches the formula (rounded corners take a little)', () => {
  const p = { ...defaults(ring), size: 17.2, width: 4, thick: 1.8 };
  const r = ring.build(p, ctx);
  const exact = Math.PI * ((8.6 + 1.8) ** 2 - 8.6 ** 2) * 4;
  assert.ok(r.volume < exact && r.volume > exact * 0.95, `${r.volume} vs ${exact}`);
  assert.ok(grams(r.volume, METALS.silver.density) > 4 && grams(r.volume, METALS.silver.density) < 4.6);
});

test('every template of every type builds a closed, positive mesh', () => {
  for (const t of [ring, earrings, bangle, chain]) {
    for (const tpl of t.templates) {
      const r = t.build({ ...defaults(t), ...tpl.p, textIn: '', textOut: '' }, ctx);
      assert.ok(r.volume > 0, `${t.id} ${tpl.label}`);
      assert.ok(r.parts.length > 0);
      const stl = partsToSTL(r.parts);
      assert.equal(new DataView(stl).getUint32(80, true), (stl.byteLength - 84) / 50);
    }
  }
});

test('walls under 0.8 mm are flagged', () => {
  assert.ok(ring.build({ ...defaults(ring), thick: 1, profile: 'hammered', hammer: 0.3 }, ctx).warnings.some((w) => /0\.8/.test(w)));
  assert.ok(chain.build({ ...defaults(chain), wire: 0.6 }, ctx).warnings.length > 0);
  assert.equal(ring.build(defaults(ring), ctx).warnings.length, 0);
});

test('chain links interlock with clearance', () => {
  const r = chain.build({ ...defaults(chain), size: 8, wire: 1.4, length: 45 }, ctx);
  assert.match(r.dims[1][1], /cm · \d+ links/);
});
