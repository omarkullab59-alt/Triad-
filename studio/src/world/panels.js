// WORLD — left section panels and the right properties panel.
import { slider, choice, toggle } from '../ui/controls.js';
import { $, $$, esc, toast } from '../lib/dom.js';
import { PRESET_OPTIONS, PRESETS } from '../ether/materials.js';
import { WORLD_OPTIONS, WORLDS, SKY_PRESETS, planet } from './worlds.js';
import { TOOLS, FALLOFFS, SHAPES } from './terrain.js';
import { OBJECTS, PLACEABLE, SCATTER } from './objects.js';

export const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// [key, label, icon, next phase?]
export const SECTIONS = [
  ['world', 'World', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'],
  ['terrain', 'Terrain', '<path d="m2 19 6-10 4 6 3-4 7 8z"/>'],
  ['sculpting', 'Sculpt', '<path d="M4 20c4 0 5-3 5-6l7-7 3 3-7 7c-3 0-6 1-6 5"/><path d="m14 5 5 5"/>'],
  ['characters', 'Characters', '<circle cx="12" cy="6" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>'],
  ['objects', 'Objects', '<path d="M12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>'],
  ['drawing', 'Drawing', '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="m14 6 3 3"/>', true],
  ['text', 'Text', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', true],
  ['materials', 'Materials', '<circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/>'],
  ['textures', 'Textures', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 3v18M3 15h18"/>', true],
  ['sky', 'Sky', '<circle cx="8" cy="8" r="3"/><path d="M17 18H7a4 4 0 1 1 1-7.9A5 5 0 0 1 18 11a3.5 3.5 0 0 1-1 7z"/>'],
  ['water', 'Water', '<path d="M3 15c3-3 6-3 9 0s6 3 9 0M3 20c3-3 6-3 9 0s6 3 9 0"/><path d="M12 3s-4 4.5-4 7a4 4 0 0 0 8 0c0-2.5-4-7-4-7z"/>'],
  ['render', 'Camera & light', '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'],
  ['export', 'Project', '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/>'],
];
const COLOURS = [['#ffffff', 'White'], ['#c9ccd1', 'Silver'], ['#bfe0f0', 'Ice'], ['#8e9399', 'Graphite'], ['#0b0b0c', 'Black'], ['#c4ef2f', 'TRIAD lime']];

const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const group = (title, ...kids) => { const g = document.createElement('div'); g.className = 'group'; if (title) g.innerHTML = `<span class="label">${esc(title)}</span>`; g.append(...kids.filter(Boolean)); return g; };
const note = (html) => el(`<p class="ctl-help">${html}</p>`);
function colour(label, value, onPick, list = COLOURS) {
  const e = document.createElement('div'); e.className = 'ctl ctl--colour';
  e.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(label)}</span><label class="colour-well"><input type="color" value="${esc(value)}" aria-label="${esc(label)}"><span>${esc(value)}</span></label></div><div class="chips chips--sw" role="radiogroup" aria-label="${esc(label)} presets"></div>`;
  const input = $('input', e), txt = $('span', e);
  input.addEventListener('input', () => { txt.textContent = input.value; onPick(input.value); });
  for (const [c, l] of list) { const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch-btn'; b.style.background = c; b.title = l; b.setAttribute('aria-label', l); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(c === value)); b.onclick = () => { input.value = c; txt.textContent = c; onPick(c); }; $('.chips', e).append(b); }
  return e;
}
const S = (ctx, label, help, get, key, min, max, step, unit = '', label2 = 'Edit', opts = {}) => slider({ name: key, label, help, min, max, step, unit, value: get()[key], onInput: (v) => ctx.change(() => { get()[key] = v; }, label2 || label, opts) });
function buttons(list) { const r = document.createElement('div'); r.className = 'btn-row'; for (const [l, fn, cls = ''] of list) { const b = document.createElement('button'); b.type = 'button'; b.className = `btn ${cls}`; b.textContent = l; b.onclick = fn; r.append(b); } return r; }
function fileButton(label, accept, onFile, cls = '') { const w = document.createElement('div'); w.className = 'btn-row'; w.innerHTML = `<button type="button" class="btn ${cls}">${esc(label)}</button><input type="file" accept="${esc(accept)}" hidden>`; const i = $('input', w); $('button', w).onclick = () => i.click(); i.onchange = () => { onFile(i.files[0]); i.value = ''; }; return w; }

export function renderSection(name, ctx, root) {
  const st = ctx.state;
  const add = (...k) => root.append(...k.filter(Boolean));
  if (name === 'world') {
    add(el(`<div class="field"><label class="label" for="w-name">World name</label><input id="w-name" class="input" type="text" maxlength="60" value="${esc(st.name || '')}"></div>`));
    $('#w-name', root).onchange = (e) => ctx.change((s) => { s.name = e.target.value.trim() || 'World'; }, 'Rename world');
    const grid = el('<div class="world-grid" role="list"></div>');
    for (const [k, l] of WORLD_OPTIONS) { const b = el(`<button type="button" class="world-card${k === st.world ? ' is-on' : ''}" role="listitem"><span class="world-swatch" style="background:linear-gradient(180deg, ${WORLDS[k].sky.top}, ${WORLDS[k].sky.horizon} 55%, ${WORLDS[k].pal.mid} 56%, ${WORLDS[k].pal.low})"></span>${esc(l)}</button>`); b.onclick = () => { if (confirm(`Create a new “${l}” world? The current world is replaced (undo and saved projects still have it).`)) ctx.newWorld(k); }; grid.append(b); }
    add(group('New world', grid, note('Every part of a new world stays editable: terrain, layers, sky, water, objects.')));
    add(group('Variation', buttons([['New random seed', () => ctx.change((s) => { s.gen.seed = Math.floor(Math.random() * 99999); s.scatterSeed = s.gen.seed; }, 'New seed', { regen: true })], ['Same type, new world', () => ctx.newWorld(st.world)]])));
  }
  if (name === 'terrain') {
    const G = () => ctx.state.gen, o = { regen: true };
    add(group('Shape', S(ctx, 'Height', 'Highest mountains.', G, 'height', 2, 400, 1, 'm', 'Terrain height', o), S(ctx, 'Scale', 'Size of the landforms.', G, 'scale', 0.3, 4, 0.01, '×', 'Terrain scale', o), S(ctx, 'Mountains (ridges)', 'Sharp ridges and peaks.', G, 'ridged', 0, 1, 0.01, '', 'Ridges', o), S(ctx, 'Roughness', 'Small bumps and detail.', G, 'roughness', 0.2, 0.8, 0.01, '', 'Roughness', o), S(ctx, 'Warp', 'Twists the landscape into organic, surreal shapes.', G, 'warp', 0, 1.5, 0.01, '', 'Warp', o), S(ctx, 'Depth offset', 'Lower or raise everything (below water = sea).', G, 'offset', -0.8, 0.6, 0.01, '', 'Offset', o)));
    const more = document.createElement('details'); more.className = 'more'; more.open = true; more.innerHTML = '<summary>Landforms</summary>';
    more.append(S(ctx, 'Island', 'Sinks the edges into the sea.', G, 'island', 0, 1, 0.01, '', 'Island', o), S(ctx, 'Terraces', 'Stepped, mesa-like slopes.', G, 'terraces', 0, 1, 0.01, '', 'Terraces', o), S(ctx, 'Plateaus', 'Flat tops.', G, 'plateau', 0, 1, 0.01, '', 'Plateaus', o), S(ctx, 'Canyons', 'Winding cut valleys.', G, 'canyon', 0, 1, 0.01, '', 'Canyons', o), S(ctx, 'Dunes', 'Wind-shaped sand ridges.', G, 'dunes', 0, 1, 0.01, '', 'Dunes', o), S(ctx, 'Craters', 'Impact craters.', G, 'craters', 0, 1, 0.01, '', 'Craters', o), S(ctx, 'Spires', 'Alien needles and towers.', G, 'spikes', 0, 1, 0.01, '', 'Spires', o), S(ctx, 'Detail octaves', 'More = finer detail.', G, 'octaves', 2, 8, 1, '', 'Octaves', o), slider({ name: 'seed', label: 'Seed', help: 'Each number is a different landscape.', min: 0, max: 99999, step: 1, value: G().seed, onInput: (v) => ctx.change((s) => { s.gen.seed = v; }, 'Seed', o) }));
    add(more);
    add(group('Erosion', S(ctx, 'Erosion when generating', 'Rain-carved gullies on the generated layer.', () => ctx.state, 'erosion', 0, 2, 0.05, '', 'Erosion', o), buttons([['Rain erosion', () => ctx.erodeAll('hydraulic')], ['Rock slide (thermal)', () => ctx.erodeAll('thermal')]]), note('The buttons erode the whole surface into the active layer.')));
    const P = () => ctx.state.pal;
    const surf = document.createElement('details'); surf.className = 'more'; surf.innerHTML = '<summary>Surface colours</summary>';
    for (const [k, l] of [['low', 'Lowland'], ['mid', 'Hills'], ['high', 'Mountains'], ['peak', 'Peaks / snow'], ['rock', 'Steep rock'], ['shore', 'Shore'], ['deep', 'Under water']]) surf.append(colour(l, P()[k], (v) => ctx.change((s) => { s.pal[k] = v; }, 'Surface colour')));
    surf.append(S(ctx, 'Snow line', 'Height where peaks turn white.', P, 'snowLine', 0.3, 1.2, 0.01, '', 'Snow line'), S(ctx, 'Rock on slopes', 'How steep before rock shows.', P, 'rockSlope', 0, 0.9, 0.01, '', 'Rock slope'), S(ctx, 'Surface detail', 'Colour variation.', P, 'detail', 0, 1, 0.01, '', 'Detail'), toggle({ name: 'flat', label: 'Faceted (low-poly)', help: 'Classic hard-edged look.', value: P().flat, onInput: (v) => ctx.change((s) => { s.pal.flat = v; }, 'Faceted') }), toggle({ name: 'checker', label: 'Checkerboard ground', help: 'The classic surreal floor.', value: !!P().checker, onInput: (v) => ctx.change((s) => { s.pal.checker = v; }, 'Checker') }));
    add(surf);
    add(group('Whole layer', buttons([['Smooth all', () => ctx.terrainOp('smooth')], ['Invert', () => ctx.terrainOp('invert')], ['Clear active layer', () => ctx.terrainOp('clear')]]), fileButton('Import heightmap (image)…', 'image/*', ctx.importHeightmap), note('Layers: see the “Terrain layers” tab at the bottom.')));
  }
  if (name === 'sculpting') {
    const B = () => ctx.state.brush;
    const grid = el('<div class="tool-grid" role="radiogroup" aria-label="Sculpt tool"></div>');
    for (const [k, l] of TOOLS) { const b = el(`<button type="button" role="radio" aria-checked="${B().tool === k}" class="tool-cell">${esc(l)}</button>`); b.onclick = () => { ctx.change((s) => { s.brush.tool = k; }, 'Brush tool'); $$('[role=radio]', grid).forEach((x) => x.setAttribute('aria-checked', String(x === b))); }; grid.append(b); }
    add(group('Tool', grid, note('Drag on the terrain. <b>Shift</b> inverts (raise ↔ lower). Right-drag orbits, middle-drag pans, <b>[ ]</b> change the size. A drawing tablet’s pressure is used.')));
    add(group('Brush', S(ctx, 'Size', 'Radius in metres.', B, 'size', 1, 200, 1, 'm', 'Brush size'), S(ctx, 'Strength', 'How much each stroke changes.', B, 'strength', 0.02, 1, 0.01, '', 'Brush strength'), S(ctx, 'Softness', 'Soft edge (inner ring = full strength).', B, 'softness', 0, 1, 0.01, '', 'Brush softness'),
      choice({ name: 'shape', label: 'Shape', help: 'Footprint of the brush.', options: SHAPES, value: B().shape, onInput: (v) => ctx.change((s) => { s.brush.shape = v; }, 'Brush shape') }),
      choice({ name: 'falloff', label: 'Falloff', help: 'How strength fades to the edge.', options: FALLOFFS, value: B().falloff, onInput: (v) => ctx.change((s) => { s.brush.falloff = v; }, 'Brush falloff') }),
      toggle({ name: 'pressure', label: 'Pen pressure', help: 'Use the pressure of a drawing tablet.', value: B().pressure, onInput: (v) => ctx.change((s) => { s.brush.pressure = v; }, 'Pen pressure') })));
    const L = ctx.state.layers.find((l) => l.id === ctx.state.active);
    add(group('Sculpting into', note(`Layer <b>${esc(L?.name || '')}</b>${L?.locked ? ' (locked)' : ''}. Change it in “Terrain layers” below.`)));
  }
  if (name === 'characters') {
    const CH = ['Ether', 'Seraph', 'Frost', 'Void', 'Drift'];
    add(group('Add a character', buttons(CH.map((l, i) => [l, () => ctx.addNode('figure', { name: l, p: { height: 1.78, preset: i } })])), note('Placed at the centre of the view, 6× life size so it reads in the landscape (change Scale in Properties). Design every detail — body, hair, wardrobe, accessories — in <a href="#/ether">Ether World</a>.')));
    add(group('Import', fileButton('Import a character (GLB, glTF, FBX, OBJ…)', '.glb,.gltf,.fbx,.obj,.stl,.ply,.3mf,.dae', (f) => ctx.importFile(f, 'model'), 'btn--lime'), note('Rigged GLB characters keep their materials and hierarchy.')));
    add(group('Next phase', note('Face and body sculpting directly on the character, and a bone rig for posing, come with phase 3. Until then: proportions, poses and outfits in Ether World; transforms here.')));
  }
  if (name === 'objects') {
    const grid = el('<div class="obj-grid"></div>');
    for (const [k, l] of PLACEABLE) { const b = el(`<button type="button" class="chip">${esc(l)}</button>`); b.onclick = () => ctx.addNode(k); grid.append(b); }
    add(group('Add object', grid, note('Placed where the camera looks. Edit size and shape in Properties on the right.')));
    add(group('Import', fileButton('3D model (GLB, glTF, OBJ, FBX, STL, PLY, 3MF, DAE)…', '.glb,.gltf,.obj,.fbx,.stl,.ply,.3mf,.dae', (f) => ctx.importFile(f, 'model')), fileButton('Image / reference sketch as a plane…', 'image/*', (f) => ctx.importFile(f, 'image'))));
    const sc = document.createElement('div');
    for (const [k, v] of Object.entries(SCATTER)) sc.append(slider({ name: `sc-${k}`, label: v.label, help: k === 'floating' ? 'Islands in the sky.' : k === 'city' ? 'Towers on a grid.' : 'Placed by height and slope, re-placed after sculpting.', min: 0, max: k === 'trees' ? 5000 : k === 'floating' || k === 'arches' ? 40 : 600, step: 1, value: ctx.state.scatter[k] || 0, onInput: (n) => ctx.change((s) => { s.scatter[k] = n; }, `Scatter ${v.label}`) }));
    add(group('Scatter', sc, buttons([['Shuffle placement', () => ctx.change((s) => { s.scatterSeed = Math.floor(Math.random() * 99999); }, 'Shuffle scatter')]])));
  }
  if (name === 'drawing' || name === 'text' || name === 'textures') {
    const txt = {
      drawing: ['Phase 4 — painting on 3D surfaces', 'Brush, pencil, eraser, colour picker, paint layers and opacity, painting straight onto terrain, characters and objects (projected onto the real surface), with undo.', 'For now: paint flat artwork in <a href="#/draw">Draw</a> or <a href="#/designs">My designs</a> and import it here as an image plane, or print it on objects in the other Studio tools.'],
      text: ['Phase 5 — typography on objects', 'Editable text on surfaces (follows the shape), floating 3D text with extrusion, outlines, shadows, metal and glass, bend, spacing, and replacing lettering inside imported textures.', 'For now: 3D lettering in <a href="#/lettering">Lettering</a> (export GLB → import here), text prints on objects in the 3D tools.'],
      textures: ['Phase 6 — texture studio', 'Bump and normal maps, texture scale, procedural stone / wood / concrete surfaces, importing and editing image textures.', 'For now: 16 material presets with colour, roughness, metal, transparency and holographic shimmer in Materials.'],
    }[name];
    add(group(txt[0], note(txt[1]), note(`<b>Not built yet</b> — nothing here pretends to work. ${txt[2]}`)));
  }
  if (name === 'materials') {
    const n = ctx.nodeById(ctx.sel[0]);
    if (!n || n.type === 'group' || n.type === 'image') { add(note('Select an object (click it in the viewport or the scene list) to edit its material. Terrain colours: Terrain → Surface colours. Water: Water.')); }
    else materialControls(ctx, n, root);
  }
  if (name === 'sky') {
    const K = () => ctx.state.sky;
    const pre = el('<div class="chips"></div>');
    for (const [k, v] of Object.entries(SKY_PRESETS)) { const b = el(`<button type="button" class="chip"><span class="swatch" style="background:linear-gradient(${v.top}, ${v.horizon})"></span>${k[0].toUpperCase() + k.slice(1)}</button>`); b.onclick = () => { ctx.change((s) => Object.assign(s.sky, v, { preset: k }), `Sky: ${k}`); setTimeout(() => ctx.renderLeft(), 30); }; pre.append(b); }
    add(group('Presets', pre));
    add(group('Colours', colour('Zenith', K().top, (v) => ctx.change((s) => { s.sky.top = v; }, 'Sky colour')), colour('Horizon & haze', K().horizon, (v) => ctx.change((s) => { s.sky.horizon = v; }, 'Horizon colour')), colour('Below horizon', K().ground, (v) => ctx.change((s) => { s.sky.ground = v; }, 'Ground colour')), colour('Sun', K().sunColor, (v) => ctx.change((s) => { s.sky.sunColor = v; }, 'Sun colour'))));
    add(group('Sun', S(ctx, 'Direction', 'Compass direction.', K, 'sunAz', -180, 180, 1, '°', 'Sun direction'), S(ctx, 'Height', 'Below 8° = sunrise / sunset light.', K, 'sunEl', -10, 90, 1, '°', 'Sun height'), S(ctx, 'Sun size', 'Disc and glow.', K, 'sunSize', 0.2, 6, 0.1, '×', 'Sun size')));
    add(group('Atmosphere', S(ctx, 'Haze', 'Glow around the sun and the horizon.', K, 'haze', 0, 1, 0.01, '', 'Haze'), S(ctx, 'Fog', 'Distance fog.', K, 'fog', 0, 0.01, 0.0001, '', 'Fog'), S(ctx, 'Stars', '', K, 'stars', 0, 1, 0.01, '', 'Stars'), S(ctx, 'Nebula', '', K, 'nebula', 0, 1, 0.01, '', 'Nebula'), S(ctx, 'Aurora', 'Animated light curtains.', K, 'aurora', 0, 1, 0.01, '', 'Aurora')));
    add(group('Clouds', S(ctx, 'Cover', '', K, 'clouds', 0, 1, 0.01, '', 'Clouds'), S(ctx, 'Altitude', 'Metres.', K, 'cloudHeight', 20, 600, 1, 'm', 'Cloud height'), colour('Cloud colour', K().cloudColor, (v) => ctx.change((s) => { s.sky.cloudColor = v; }, 'Cloud colour'))));
    const pl = document.createElement('div');
    K().planets.forEach((p, i) => {
      const box = el(`<details class="more" ${i === 0 ? 'open' : ''}><summary>Planet ${i + 1}</summary></details>`); const P = () => ctx.state.sky.planets[i];
      box.append(colour('Colour', p.color, (v) => ctx.change(() => { P().color = v; }, 'Planet colour')), colour('Second colour', p.color2, (v) => ctx.change(() => { P().color2 = v; }, 'Planet colour')), S(ctx, 'Size', '', P, 'size', 2, 120, 1, '', 'Planet size'), S(ctx, 'Direction', '', P, 'az', -180, 180, 1, '°', 'Planet direction'), S(ctx, 'Height in sky', '', P, 'el', -5, 85, 1, '°', 'Planet height'), S(ctx, 'Glow', '', P, 'glow', 0, 1, 0.01, '', 'Planet glow'), toggle({ name: `ring${i}`, label: 'Ring', help: '', value: p.ring, onInput: (v) => ctx.change(() => { P().ring = v; }, 'Planet ring') }), buttons([['Remove', () => { ctx.change((s) => { s.sky.planets.splice(i, 1); }, 'Remove planet'); setTimeout(() => ctx.renderLeft(), 30); }]]));
      pl.append(box);
    });
    add(group('Planets & moons', pl, buttons([['+ Planet', () => { ctx.change((s) => { s.sky.planets.push(planet({ az: Math.round(Math.random() * 300 - 150), el: 15 + Math.round(Math.random() * 40), ring: Math.random() > 0.5 })); }, 'Add planet'); setTimeout(() => ctx.renderLeft(), 30); }], ['+ Moon', () => { ctx.change((s) => { s.sky.planets.push(planet({ color: '#e9e9e4', color2: '#9a9a94', size: 9, az: Math.round(Math.random() * 300 - 150), el: 30 })); }, 'Add moon'); setTimeout(() => ctx.renderLeft(), 30); }]])));
  }
  if (name === 'water') {
    const W = () => ctx.state.water;
    add(toggle({ name: 'won', label: 'Water', help: 'Sea level fills every valley below it — oceans, lakes, rivers you carve.', value: W().on, onInput: (v) => ctx.change((s) => { s.water.on = v; s.hidden.water = false; }, 'Water on/off') }));
    add(group('Level & look', S(ctx, 'Sea level', 'Metres.', W, 'level', -50, 300, 0.5, 'm', 'Sea level'), colour('Colour', W().color, (v) => ctx.change((s) => { s.water.color = v; }, 'Water colour'), [['#1f5f7a', 'Ocean'], ['#1aa3b8', 'Lagoon'], ['#2fb59a', 'Alien'], ['#3f7f7a', 'River'], ['#bfa8ff', 'Dream'], ['#0b0b0c', 'Black']]), colour('Deep water (seabed tint)', W().deep, (v) => ctx.change((s) => { s.water.deep = v; s.pal.deep = v; }, 'Deep colour')), S(ctx, 'Transparency', '1 = opaque.', W, 'opacity', 0.2, 1, 0.01, '', 'Water opacity')));
    add(group('Motion', S(ctx, 'Waves', 'Wave height and surface distortion.', W, 'waves', 0, 2, 0.01, '', 'Waves'), S(ctx, 'Speed', '', W, 'speed', 0, 4, 0.05, '×', 'Wave speed'), toggle({ name: 'mirror', label: 'Mirror reflections', help: 'Real reflections of the world (renders twice, slower).', value: W().mirror, onInput: (v) => ctx.change((s) => { s.water.mirror = v; }, 'Reflections') }), note('Rivers: carve a channel with the <b>Carve</b> brush below sea level. Waterfalls as moving water are not built yet.')));
  }
  if (name === 'render') {
    const C = () => ctx.state.camera, R = () => ctx.state.render, L = () => ctx.state.light;
    add(group('Camera', buttons(['hero', 'bird', 'ground', 'top', 'front', 'side', 'wide'].map((k) => [k, () => ctx.setCam(k)])), toggle({ name: 'ortho', label: 'Orthographic', help: 'No perspective — for plans and maps (O).', value: C().mode === 'ortho', onInput: (v) => ctx.setOrtho(v) }), S(ctx, 'Lens (field of view)', '', C, 'fov', 10, 100, 1, '°', 'Field of view'), buttons([['Fly mode (Q)', () => ctx.setMode('fly')]])));
    add(group('Light', S(ctx, 'Sun strength', '', L, 'sun', 0, 8, 0.05, '', 'Sun strength'), S(ctx, 'Ambient', 'Sky light.', L, 'ambient', 0, 3, 0.05, '', 'Ambient'), S(ctx, 'Exposure', '', L, 'exposure', 0.3, 2.5, 0.01, '', 'Exposure'), toggle({ name: 'shadows', label: 'Shadows', help: '4K sun shadow map.', value: L().shadows, onInput: (v) => ctx.change((s) => { s.light.shadows = v; }, 'Shadows') })));
    add(group('Effects', toggle({ name: 'ao', label: 'Ambient occlusion', help: 'Contact shadows (GTAO). Slower.', value: R().ao, onInput: (v) => ctx.change((s) => { s.render.ao = v; }, 'AO') }), toggle({ name: 'dof', label: 'Depth of field', help: 'Blur what is out of focus.', value: R().dof, onInput: (v) => { ctx.change((s) => { s.render.dof = v; }, 'DOF'); setTimeout(() => ctx.renderLeft(), 30); } }), ...(R().dof ? [S(ctx, 'Focus distance', 'Metres from the camera.', R, 'focus', 1, 2000, 1, 'm', 'Focus'), S(ctx, 'Blur', '', R, 'aperture', 0, 3, 0.01, '', 'Blur')] : [])));
    const res = choice({ name: 'res', label: 'Resolution', help: 'Size of the rendered image.', options: [['1280x720', '720p'], ['1920x1080', '1080p (Full HD)'], ['2560x1440', '1440p'], ['3840x2160', '4K UHD'], ['2048x2048', 'Square 2048'], ['1080x1350', 'Instagram 4:5'], ['1080x1920', 'Story 9:16']], value: R().res || '1920x1080', onInput: (v) => ctx.change((s) => { s.render.res = v; }, 'Resolution') });
    add(group('Render', res, buttons([['Render PNG', () => ctx.render(ctx.state.render.res || '1920x1080'), 'btn--lime']]), note('Animated camera flights: the Timeline tab below.')));
  }
  if (name === 'export') {
    add(group('Project', buttons([['Save (Ctrl S)', () => ctx.saveProject(), 'btn--lime'], ['Save as new', () => ctx.saveProject(true)]]), note('Autosave runs every 20 seconds and when you leave; the last session opens automatically.')));
    const list = el('<ul class="scene-list"><li class="muted">Loading…</li></ul>');
    add(group('Saved worlds', list));
    ctx.projects.then((rows) => {
      const recs = rows.map((r) => r.value).filter((r) => r && !r.autosave).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      list.innerHTML = recs.length ? recs.map((r) => `<li><img src="${esc(r.thumb || '')}" alt=""><span><b>${esc(r.name)}</b><br><small class="muted">${esc((r.date || '').slice(0, 16).replace('T', ' '))}</small></span><button type="button" class="btn" data-open="${esc(r.id)}">Open</button><button type="button" class="icon-btn" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">×</button></li>`).join('') : '<li class="muted">No saved worlds yet.</li>';
      $$('[data-open]', list).forEach((b) => { b.onclick = async () => { if (await ctx.loadProject(recs.find((r) => r.id === b.dataset.open))) toast('World opened.'); }; });
      $$('[data-del]', list).forEach((b) => { b.onclick = async () => { if (!confirm('Delete this saved world?')) return; await ctx.deleteProject(b.dataset.del); ctx.renderLeft(); }; });
    });
    add(group('Export', buttons([['World (GLB)', () => ctx.exportFile('glb')], ['World (glTF)', () => ctx.exportFile('gltf')], ['Terrain (OBJ)', () => ctx.exportFile('obj')], ['Heightmap (PNG)', () => ctx.exportFile('heightmap')], ['Terrain colours (PNG)', () => ctx.exportFile('texture')], ['Project file', () => ctx.exportFile('project')]]), note('GLB / glTF keep the hierarchy, materials and the instanced vegetation. Renders: Camera & light.')));
    add(group('Import', fileButton('Open project file (.triadworld.json)…', '.json,application/json', (f) => ctx.importProject(f)), fileButton('3D model…', '.glb,.gltf,.obj,.fbx,.stl,.ply,.3mf,.dae', (f) => ctx.importFile(f, 'model')), fileButton('Image / reference…', 'image/*', (f) => ctx.importFile(f, 'image')), fileButton('Heightmap…', 'image/*', ctx.importHeightmap)));
  }
}

function materialControls(ctx, n, root) {
  const M = () => ctx.nodeById(n.id).mat;
  const base = PRESETS[M().preset] || {};
  const val = (k) => M()[k] ?? base[k] ?? (k === 'opacity' ? 1 : 0);
  const set = (k) => (v) => ctx.change(() => { M()[k] = v; }, 'Material');
  root.append(
    choice({ name: 'mpreset', label: 'Material', help: 'Start from a surface, then fine-tune.', options: PRESET_OPTIONS, value: M().preset, onInput: (v) => { ctx.change(() => { const m = M(); for (const k of ['roughness', 'metalness', 'transmission', 'iridescence', 'opacity']) delete m[k]; m.preset = v; m.color = PRESETS[v].color; }, 'Material preset'); setTimeout(() => ctx.renderLeft(), 30); } }),
    colour('Colour', M().color, set('color'), [['#f2f4f6', 'Chrome'], ['#d4d7db', 'Silver'], ['#e2bb63', 'Gold'], ['#bfe0f0', 'Ice'], ['#8a837a', 'Stone'], ['#c49a62', 'Wood'], ['#0b0b0c', 'Black'], ['#c4ef2f', 'Lime']]),
    slider({ name: 'mr', label: 'Roughness', help: '0 = mirror, 1 = matte.', min: 0, max: 1, step: 0.01, value: val('roughness'), onInput: set('roughness') }),
    slider({ name: 'mm', label: 'Metallic', help: '', min: 0, max: 1, step: 0.01, value: val('metalness'), onInput: set('metalness') }),
    slider({ name: 'mt', label: 'Transparency (glass)', help: '', min: 0, max: 1, step: 0.01, value: val('transmission'), onInput: set('transmission') }),
    slider({ name: 'mi', label: 'Holographic', help: '', min: 0, max: 1, step: 0.01, value: val('iridescence'), onInput: set('iridescence') }),
    slider({ name: 'mo', label: 'Opacity', help: '', min: 0.05, max: 1, step: 0.01, value: val('opacity'), onInput: set('opacity') }),
  );
}

/** Right side: properties of the selection. */
export function renderProperties(ctx, root) {
  const sel = ctx.sel;
  if (!sel.length) { root.innerHTML = '<p class="ctl-help props-empty">Nothing selected. Click an object or a scene entry. Ctrl / Shift-click selects several.</p>'; return; }
  if (sel[0].startsWith('sys:')) {
    const k = sel[0].slice(4);
    const go = { terrain: 'terrain', water: 'water', sky: 'sky', clouds: 'sky', planets: 'sky', scatter: 'objects', lighting: 'render' }[k];
    root.innerHTML = `<span class="label">${esc(k)}</span><p class="ctl-help">Edit in the <b>${esc(SECTIONS.find(([x]) => x === go)?.[1] || '')}</b> panel on the left.</p>`;
    return;
  }
  const ids = ctx.userSel();
  if (ids.length > 1) { root.append(el(`<div><span class="label">${ids.length} objects</span></div>`), buttons([['Group', ctx.groupSel], ['Duplicate', ctx.duplicateSel], ['Delete', ctx.deleteSel], ['Drop to ground', ctx.dropToGround]]), note('Move / rotate / scale works on the first selected object; group them to transform together.')); return; }
  const n = ctx.nodeById(ids[0]); if (!n) return;
  const N0 = () => ctx.nodeById(n.id);
  const head = el(`<div class="props-head"><input class="input" type="text" maxlength="60" value="${esc(n.name)}" aria-label="Name"><span class="label muted">${esc(OBJECTS[n.type]?.label || n.type)}</span></div>`);
  $('input', head).onchange = (e) => ctx.change(() => { N0().name = e.target.value.trim() || n.name; }, 'Rename');
  root.append(head);
  const vec = (label, key, step, unit, conv = 1) => {
    const row = el(`<div class="vec"><span class="ctl-name">${label}</span>${['x', 'y', 'z'].map((a, i) => `<label><span>${a.toUpperCase()}</span><input type="number" step="${step}" value="${+(n[key][i] * conv).toFixed(3)}" data-i="${i}" aria-label="${label} ${a}"></label>`).join('')}${unit ? `<small>${unit}</small>` : ''}</div>`);
    $$('input', row).forEach((inp) => { inp.onchange = () => { const v = Number(inp.value); if (Number.isFinite(v)) ctx.change(() => { N0()[key][+inp.dataset.i] = key === 'scale' ? Math.max(0.001, v) : v / conv; }, `${label}`); }; });
    return row;
  };
  root.append(group('Transform', vec('Position', 'pos', 0.1, 'm'), vec('Rotation', 'rot', 1, '°', 180 / Math.PI), vec('Scale', 'scale', 0.05, '×'),
    buttons([['Drop to ground', ctx.dropToGround], ['Frame', ctx.frameSel], ['Uniform scale ×2', () => ctx.change(() => { N0().scale = N0().scale.map((v) => v * 2); }, 'Scale')], ['÷2', () => ctx.change(() => { N0().scale = N0().scale.map((v) => v / 2); }, 'Scale')]])));
  const P = OBJECTS[n.type]?.p || {};
  const keys = Object.keys(P);
  if (keys.length && n.type !== 'group') {
    const g = group('Geometry');
    const range = { radius: [0.2, 120], width: [0.2, 150], height: [0.2, 200], depth: [0.2, 150], size: [0.3, 60], detail: [6, 96], sides: [3, 128], tube: [0.05, 20], bevel: [0, 5], roughness: [0, 1.2], seed: [0, 999], crown: [0.5, 30], kind: [0, 1], floors: [1, 120], floorHeight: [2, 8], taper: [0, 0.4], ring: [0, 1], span: [2, 200], thickness: [0.5, 30], count: [1, 20], twist: [-12, 12], p: [1, 8], q: [1, 9], preset: [0, 4], scale: [0.1, 10] };
    const labels = { kind: 'Shape (cone ↔ round)', ring: 'Ring', preset: 'Look (Ether preset)', floorHeight: 'Floor height', p: 'Winding p', q: 'Winding q' };
    for (const k of keys) { const [lo, hi] = range[k] || [0, 100]; const step = ['detail', 'sides', 'seed', 'floors', 'count', 'p', 'q', 'preset', 'ring'].includes(k) ? 1 : (hi - lo) / 400; g.append(slider({ name: `gp-${k}`, label: labels[k] || k[0].toUpperCase() + k.slice(1), help: '', min: lo, max: hi, step: +step.toPrecision(2), value: n.p[k], onInput: (v) => ctx.change(() => { N0().p[k] = v; }, `Edit ${k}`) })); }
    root.append(g);
  }
  if (!['group', 'image', 'figure'].includes(n.type) && !(n.type === 'model' && /gl(b|tf)$/i.test(ctx.assets.get(n.asset)?.name || ''))) { const g = group('Material'); materialControls(ctx, n, g); root.append(g); }
  if (n.type === 'image') root.append(group('Image', slider({ name: 'iop', label: 'Opacity', help: 'See-through reference.', min: 0.05, max: 1, step: 0.01, value: n.mat.opacity ?? 0.85, onInput: (v) => ctx.change(() => { N0().mat.opacity = v; }, 'Opacity') })));
  const parents = [['', '— none (world) —'], ...ctx.state.nodes.filter((x) => x.id !== n.id && !isDesc(ctx.state.nodes, n.id, x.id)).map((x) => [x.id, x.name])];
  root.append(group('Hierarchy', choice({ name: 'parent', label: 'Parent', help: 'Children move with their parent. Or drag in the scene list.', options: parents, value: n.parent || '', onInput: (v) => ctx.reparent([n.id], v || null) }),
    toggle({ name: 'vis', label: 'Visible', help: '', value: n.visible, onInput: (v) => ctx.change(() => { N0().visible = v; }, 'Visibility') }),
    toggle({ name: 'lock', label: 'Locked', help: 'Cannot be moved in the viewport.', value: n.locked, onInput: (v) => ctx.change(() => { N0().locked = v; }, 'Lock') }),
    buttons([['Duplicate', ctx.duplicateSel], ['Delete', ctx.deleteSel], ...(n.type === 'group' ? [['Ungroup', () => ctx.ungroup()]] : [])])));
}
function isDesc(nodes, ancestor, id) { let n = nodes.find((x) => x.id === id); while (n?.parent) { if (n.parent === ancestor) return true; n = nodes.find((x) => x.id === n.parent); } return false; }
