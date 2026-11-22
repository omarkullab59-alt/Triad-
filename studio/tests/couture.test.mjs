import test from 'node:test';
import assert from 'node:assert/strict';
import { couture, COUTURE_STYLES } from '../src/sculpt/couture.js';
import { search, buildIndex } from '../src/find/index.js';
import { printOnto } from '../src/jewellery/print.js';
import { vessel } from '../src/home/vessel.js';
import { MOTIFS, MOTIF_TAGS } from '../src/lib/motifs.js';

const d = Object.fromEntries(couture.params.map((p) => [p.key, p.default]));

test('every couture style builds a solid piece of plausible size', () => {
  for (const [k, s] of Object.entries(COUTURE_STYLES)) {
    const r = couture.build({ ...d, ...s.p, detail: 'draft' });
    assert.ok(r.volume > 2000, `${k} volume ${r.volume}`);
    const g = r.parts[0].geometry; g.computeBoundingBox();
    const size = g.boundingBox.max.y - g.boundingBox.min.y;
    assert.ok(size > 20 && size < 400, `${k} height ${size}`);
  }
});

test('horns are not cut away by the face area', () => {
  const plain = couture.build({ ...d, form: 'half', surface: 'smooth', horns: 'none', detail: 'draft' });
  const horned = couture.build({ ...d, form: 'half', surface: 'smooth', horns: 'ram', detail: 'draft' });
  assert.ok(horned.volume > plain.volume * 1.5);
});

test('finder finds cultures in English and German', () => {
  const top = (q) => search(q).map((h) => h.label);
  assert.ok(top('japanese').some((l) => /Seigaiha/.test(l)));
  assert.ok(top('keltisch').some((l) => /Triquetra/.test(l)));
  assert.ok(top('gotisch').length >= 2);
  assert.ok(top('crystal mask')[0] === 'Crystal veil');
  assert.ok(top('arabisch').some((l) => /Arabic|Moorish/.test(l)));
  assert.equal(search('xqzv').length, 0);
  assert.ok(buildIndex().length > 120);
  for (const k of Object.keys(MOTIFS)) assert.ok(MOTIF_TAGS[k], `tags for motif ${k}`);
});

test('print adds uv coordinates and a print group without changing the shape', () => {
  const r = vessel.build(Object.fromEntries(vessel.params.map((p) => [p.key, p.default])), {});
  const g = r.parts[0].geometry; g.computeBoundingBox();
  const out = printOnto(g, { box: g.boundingBox, side: 'around', width: 60, height: 30 });
  assert.ok(out.attributes.uv);
  assert.ok(out.groups.some((gr) => gr.materialIndex === 3));
  out.computeBoundingBox();
  assert.ok(out.boundingBox.min.distanceTo(g.boundingBox.min) < 1e-3 && out.boundingBox.max.distanceTo(g.boundingBox.max) < 1e-3);
});
