import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, sanitize, applyCharacterPreset, CHARACTERS, ACCESSORIES } from '../src/ether/state.js';

test('default state survives sanitize unchanged', () => {
  const d = defaultState();
  const s = sanitize(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(s.character, d.character);
  assert.deepEqual(s.wardrobe, d.wardrobe);
  assert.equal(s.env.objects.length, d.env.objects.length);
});

test('sanitize clamps numbers, rejects bad colours, unknown items and junk objects', () => {
  const s = sanitize({
    character: { height: 9, skin: 'red', hair: 'unknown', pose: 'walk' },
    wardrobe: { top: '<script>', graphic: 'x'.repeat(100) },
    materials: { top: { preset: 'chrome', color: '#ABCDEF', roughness: 5 } },
    env: { fogDensity: -1, objects: [{ type: 'cube', pos: [1, 2, 3e9], scale: [0, 1, 1] }, { type: 'nuke' }, null] },
    camera: { fov: 500 },
  });
  assert.equal(s.character.height, 2.1);
  assert.equal(s.character.skin, defaultState().character.skin);
  assert.equal(s.character.hair, defaultState().character.hair);
  assert.equal(s.character.pose, 'walk');
  assert.equal(s.wardrobe.top, defaultState().wardrobe.top);
  assert.equal(s.wardrobe.graphic.length, 16);
  assert.equal(s.materials.top.color, '#abcdef');
  assert.equal(s.materials.top.roughness, 1);
  assert.equal(s.env.fogDensity, 0);
  assert.equal(s.env.objects.length, 1);
  assert.equal(s.env.objects[0].pos[2], 100);
  assert.equal(s.env.objects[0].scale[0], 0.02);
  assert.equal(s.camera.fov, 75);
});

test('sanitize of nothing gives a full default scene', () => {
  const s = sanitize(null);
  assert.equal(s.v, 1);
  assert.ok(s.env.objects.length > 0);
});

test('character presets change the look, not the room', () => {
  const d = defaultState();
  for (const k of Object.keys(CHARACTERS)) {
    const s = applyCharacterPreset(d, k);
    assert.deepEqual(s.env, d.env);
    assert.deepEqual(Object.keys(s.accessories).sort(), ACCESSORIES.map(([a]) => a).sort());
  }
  assert.notEqual(d.character.hair, 'long'); // input not mutated
});
