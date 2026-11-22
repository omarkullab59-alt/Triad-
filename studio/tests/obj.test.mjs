import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { partsToOBJ } from '../src/lib/obj.js';

test('OBJ has vertices, normals, faces and one material per group', () => {
  const g = new THREE.BoxGeometry(10, 10, 10);
  g.clearGroups(); g.addGroup(0, 18, 0); g.addGroup(18, Infinity, 1);
  const { obj, mtl, base } = partsToOBJ([{ geometry: g }], { name: 'my ring!', looks: [{ color: '#f1efea', metalness: 1, roughness: 0.2 }, { color: '#c4ef2f', metalness: 0, roughness: 0.3 }] });
  assert.equal(base, 'my_ring_');
  assert.equal((obj.match(/^v /gm) || []).length, 24);
  assert.equal((obj.match(/^vn /gm) || []).length, 24);
  assert.equal((obj.match(/^f /gm) || []).length, 12);
  assert.match(obj, /usemtl triad_main[\s\S]*usemtl triad_accent/);
  assert.match(mtl, /newmtl triad_main\nKd 0\.\d+ /);
  assert.match(mtl, /newmtl triad_accent/);
  // all indices point to existing vertices
  const max = Math.max(...obj.match(/^f .*$/gm).flatMap((l) => l.slice(2).split(' ').map((x) => Number(x.split('/')[0]))));
  assert.equal(max, 24);
});

test('instances are written as separate objects with the matrix applied', () => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const inst = [new THREE.Matrix4(), new THREE.Matrix4().makeTranslation(100, 0, 0)];
  const { obj } = partsToOBJ([{ geometry: g, instances: inst }]);
  assert.equal((obj.match(/^o /gm) || []).length, 2);
  assert.match(obj, /^v 100\.5 /m);
  assert.equal((obj.match(/^v /gm) || []).length, 48);
});
