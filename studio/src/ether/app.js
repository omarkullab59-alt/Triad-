// ETHER WORLD — interactive 3D fashion universe: character creator, modular wardrobe, accessories,
// material editor, editable showroom, lighting, camera / render and export. Route: #/ether
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { sharedRenderer } from '../jewellery/viewer.js';
import { slider, choice, toggle, textField } from '../ui/controls.js';
import { showMenu, closeMenu, showShortcuts } from '../ui/menu.js';
import { ICON } from '../ui/icons.js';
import { createHistory, changedKeys } from '../lib/history.js';
import { $, $$, esc, toast, download, reducedMotion } from '../lib/dom.js';
import * as db from '../lib/db.js';
import { PALETTE, PRESET_OPTIONS, PRESETS, makeMaterial, applySpec } from './materials.js';
import {
  defaultState, sanitize, applyCharacterPreset, CHARACTER_OPTIONS, TOPS, BOTTOMS, SHOES, ACCESSORIES, HAIR, POSES, SKIN, HAIR_COLORS,
  ENV_OBJECTS, ENV_PRESETS, LIGHT_PRESETS, ENV_LOOKS, LIGHT_LOOKS, obj, newId,
} from './state.js';
import { skeleton, buildBody } from './character.js';
import { buildTop, buildBottom, buildShoes, buildAccessories, SHOE_LIFT } from './wardrobe.js';
import { createShowroom } from './showroom.js';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
const SECTIONS = [
  ['character', 'Character', '<circle cx="12" cy="6" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>'],
  ['wardrobe', 'Wardrobe', '<path d="M9 3 4 6l2 4 2-1v12h8V9l2 1 2-4-5-3c-.5 1.5-1.7 2.5-3 2.5S9.5 4.5 9 3z"/>'],
  ['accessories', 'Accessories', '<circle cx="12" cy="14" r="6"/><path d="m9 4 3 4 3-4"/>'],
  ['materials', 'Materials', '<circle cx="12" cy="12" r="8"/><path d="M5 9c4 2 10 2 14 0M5 15c4-2 10-2 14 0"/>'],
  ['environment', 'Environment', '<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M10 20v-5h4v5"/>'],
  ['lighting', 'Lighting', '<circle cx="12" cy="10" r="4"/><path d="M12 2v2M4 10H2M22 10h-2M5.6 3.6 7 5M18.4 3.6 17 5M9 18h6M10 21h4"/>'],
  ['camera', 'Camera', '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'],
  ['export', 'Export', '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/>'],
];
const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SLOTS = [['top', 'Top'], ['under', 'Under layer & skirts'], ['bottom', 'Bottom'], ['shoes', 'Shoes & gloves'], ['metal', 'Chrome parts'], ['glass', 'Glasses'], ['hair', 'Hair']];
const CLOTH = new Set(['top', 'under', 'bottom']);
const CAMS = {
  front: [[0, 1.25, 6], [0, 1.2, 0]], back: [[0, 1.3, -6], [0, 1.2, 0]], side: [[6, 1.25, 0], [0, 1.2, 0]],
  face: [[0.45, 1.95, 1.35], [0, 1.88, 0]], hero: [[2.3, 1.35, 5.0], [0, 1.2, 0]], top: [[0.01, 7.5, 0.6], [0, 0.8, 0]], wide: [[7, 3.2, 9], [0, 1.2, 0]],
};

export async function mount(main) {
  let state = defaultState();
  const hist = createHistory();
  let lastState = null;
  let section = 'character', matSlot = 'top', selected = null;

  main.innerHTML = `
  <div class="tool ether">
    <nav class="ether-rail" role="tablist" aria-label="Ether sections">
      ${SECTIONS.map(([k, l, d], i) => `<button type="button" role="tab" id="et-${k}" data-sec="${k}" aria-selected="${!i}" aria-controls="ether-panel" data-tip="${l}">${svg(d)}<span>${l}</span></button>`).join('')}
    </nav>
    <section class="stage" aria-label="Ether showroom viewport">
      <div class="vp-bar" role="toolbar" aria-label="Viewport tools">
        <div class="seg-group" role="group" aria-label="Camera">
          ${[['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['face', 'Face'], ['hero', 'Hero'], ['wide', 'Wide']].map(([k, l]) => `<button type="button" data-cam="${k}" aria-pressed="false">${l}</button>`).join('')}
        </div>
        <div class="seg-group" role="group" aria-label="Transform" data-tmodes hidden>
          <button type="button" data-tm="translate" aria-pressed="true" data-tip="Move (W)">Move</button><button type="button" data-tm="rotate" aria-pressed="false" data-tip="Rotate (E)">Rotate</button><button type="button" data-tm="scale" aria-pressed="false" data-tip="Scale (R)">Scale</button>
        </div>
        <span class="vp-spacer"></span>
        <div class="tb-group" role="group" aria-label="History">
          <button type="button" class="tb" data-act="undo" data-tip="Undo (${MOD} Z)" aria-label="Undo" disabled>${ICON.undo}</button>
          <button type="button" class="tb" data-act="redo" data-tip="Redo (${MOD} Shift Z)" aria-label="Redo" disabled>${ICON.redo}</button>
        </div>
        <div class="tb-group" role="group" aria-label="View">
          <button type="button" class="tb" data-act="turn" data-tip="Turntable (T)" aria-label="Turntable" aria-pressed="false">${ICON.turnR}</button>
          <button type="button" class="tb" data-act="walk" data-tip="Walk mode (Q) — WASD / arrows" aria-label="Walk mode" aria-pressed="false">${svg('<circle cx="13" cy="4" r="2"/><path d="m9 21 3-7 3 3v4M7 12l3-4h4l3 4M12 14l-1-6"/>')}</button>
          <button type="button" class="tb" data-act="shot" data-tip="Screenshot PNG (P)" aria-label="Screenshot">${ICON.camera}</button>
        </div>
        <button type="button" class="tb" data-act="menu" data-tip="More" aria-label="More viewport actions" aria-haspopup="menu">${ICON.more}</button>
      </div>
      <div class="walkpad" data-walkpad hidden aria-label="Walk">
        <button type="button" data-walk="f" aria-label="Walk forward">▲</button><button type="button" data-walk="l" aria-label="Walk left">◀</button><button type="button" data-walk="b" aria-label="Walk back">▼</button><button type="button" data-walk="r" aria-label="Walk right">▶</button>
      </div>
      <div class="vp-busy" data-busy hidden><span class="spinner spinner--sm" aria-hidden="true"></span><span data-busy-text>Building</span></div>
      <div class="statusbar">
        <span class="sb-state" data-sb-state data-state="busy" role="status" aria-live="polite"><i aria-hidden="true"></i><span>Loading…</span></span>
        <span class="sb-item" data-sb-sel></span>
        <span class="sb-item sb-wide" data-sb-tris></span>
        <span class="sb-item sb-wide" data-sb-fx></span>
        <span class="vp-spacer"></span>
        <button type="button" class="tb tb--sm" data-act="keys" data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">${ICON.keyboard}</button>
      </div>
    </section>
    <section class="panel" aria-label="Properties">
      <header class="panel-head">
        <a class="tb panel-back" href="#/" data-tip="All tools" aria-label="All tools">${ICON.back}</a>
        <div class="panel-name"><span class="label muted">Ether world</span><h1 data-sec-title>Character</h1></div>
        <button type="button" class="tb" data-act="save" data-tip="Save scene (${MOD} S)" aria-label="Save scene">${ICON.save}</button>
      </header>
      <div id="ether-panel" role="tabpanel" data-body></div>
    </section>
  </div>`;

  /* ── renderer, scene, camera ── */
  const stage = $('.stage', main);
  const { renderer } = sharedRenderer();
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  renderer.domElement.style.visibility = '';
  stage.prepend(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Ether showroom, 3D. Drag to orbit, scroll to zoom, click an object to edit it.');
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMappingExposure = 0.72;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(etherEnvironment(), 0.06).texture;
  pmrem.dispose();
  scene.environment = envTex;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
  camera.position.set(2.6, 1.6, 5.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = !reducedMotion();
  controls.minDistance = 0.4; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI * 0.495;
  controls.autoRotateSpeed = 1.2;
  const showroom = createShowroom(scene, renderer);
  const tc = new TransformControls(camera, renderer.domElement);
  tc.setSize(0.8);
  scene.add(tc.getHelper());
  tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; if (!e.value) commit(); });
  tc.addEventListener('objectChange', () => {
    const o = state.env.objects.find((x) => x.id === selected);
    const m = showroom.objects.get(selected);
    if (!o || !m) return;
    o.pos = m.position.toArray().map((v) => +v.toFixed(3)); o.rot = [m.rotation.x, m.rotation.y, m.rotation.z].map((v) => +v.toFixed(4)); o.scale = m.scale.toArray().map((v) => +Math.max(0.02, v).toFixed(3));
    dirty = true;
    if (section === 'environment') updateObjectFields();
  });

  /* ── materials (one per slot, updated in place) ── */
  const M = { skin: makeMaterial({ preset: 'skin' }) };
  for (const [k] of SLOTS) M[k] = makeMaterial(state.materials[k]);
  function updateMaterials() {
    for (const [k] of SLOTS) {
      const s = k === 'hair' ? { ...state.materials.hair, color: state.character.hairColor } : state.materials[k];
      applySpec(M[k], s);
      if (CLOTH.has(k) && !PRESETS[s.preset]?.mesh) M[k].side = THREE.DoubleSide;
    }
    applySpec(M.skin, { preset: 'skin', color: state.character.skin });
    dirty = true;
  }

  /* ── character ── */
  let character = null, charKey = '';
  function rebuildCharacter() {
    const key = JSON.stringify([state.character, state.wardrobe, state.accessories]);
    if (key === charKey) return;
    charKey = key;
    const t0 = performance.now();
    if (character) { scene.remove(character); character.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); if (!Object.values(M).includes(x.material)) { x.material.map?.dispose(); x.material.dispose(); } } }); }
    try {
      const sk = skeleton(state.character);
      character = new THREE.Group(); character.name = 'character';
      character.add(buildBody(sk, M, state.character));
      if (state.wardrobe.top !== 'none') character.add(buildTop(sk, M, state.wardrobe.top, state.wardrobe.graphic));
      if (state.wardrobe.bottom !== 'none') character.add(buildBottom(sk, M, state.wardrobe.bottom));
      character.add(buildShoes(sk, M, state.wardrobe.shoes));
      character.add(buildAccessories(sk, M, state.accessories));
      character.position.y = 0.26 + (SHOE_LIFT[state.wardrobe.shoes] || 0); // on the platform
      scene.add(character);
      buildMs = performance.now() - t0;
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error', 'This look could not be built — try other values');
    }
    dirty = true;
  }
  let buildMs = 0;

  /* ── apply state to the scene ── */
  let lastEnvKey = '', lastObjKey = '';
  function applyAll() {
    updateMaterials();
    rebuildCharacter();
    const ek = JSON.stringify([state.env.bg, state.env.fog, state.env.fogDensity, state.env.floor, state.env.reflect, state.env.cones]);
    if (ek !== lastEnvKey) { showroom.setEnv(state.env); lastEnvKey = ek; }
    const ok = JSON.stringify(state.env.objects);
    if (ok !== lastObjKey) {
      showroom.setObjects(state.env.objects); lastObjKey = ok;
      if (selected && !showroom.objects.has(selected)) select(null);
      else if (selected) tc.attach(showroom.objects.get(selected));
    }
    showroom.setLight(state.light, state.env);
    camera.fov = state.camera.fov; camera.updateProjectionMatrix();
    controls.autoRotate = state.camera.auto;
    press('turn', state.camera.auto);
    setupEffects();
    updateStatus();
    dirty = true;
  }
  let raf1 = 0;
  /** Change → apply on the next frame (slider drags stay smooth) → record for undo. */
  function change(fn) { fn?.(state); cancelAnimationFrame(raf1); raf1 = requestAnimationFrame(() => { applyAll(); commit(); }); }
  function commit() {
    const o = JSON.parse(JSON.stringify(state));
    if (hist.push(JSON.stringify(o), changedKeys(lastState, o))) lastState = o;
    $('[data-act=undo]', main).disabled = !hist.canUndo; $('[data-act=redo]', main).disabled = !hist.canRedo;
  }
  function restore(snap) {
    if (!snap) return;
    state = JSON.parse(snap); lastState = JSON.parse(snap);
    applyAll(); renderPanel();
    $('[data-act=undo]', main).disabled = !hist.canUndo; $('[data-act=redo]', main).disabled = !hist.canRedo;
  }

  /* ── post effects (ambient occlusion, depth of field), loaded only when switched on ── */
  let composer = null, fx = { ao: false, dof: false }, gtao = null, bokeh = null;
  async function setupEffects() {
    const want = { ao: state.camera.ao, dof: state.camera.dof };
    if (want.ao === fx.ao && want.dof === fx.dof) {
      if (bokeh) { bokeh.uniforms.focus.value = state.camera.focus; bokeh.uniforms.aperture.value = state.camera.aperture * 0.0025; }
      return;
    }
    fx = want;
    composer?.dispose(); composer = null; gtao = null; bokeh = null;
    if (!want.ao && !want.dof) { dirty = true; updateStatus(); return; }
    try {
      setBusy(true, 'Loading effects');
      const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'), import('three/examples/jsm/postprocessing/RenderPass.js'), import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);
      const size = renderer.getSize(new THREE.Vector2());
      const c = new EffectComposer(renderer);
      c.addPass(new RenderPass(scene, camera));
      if (want.ao) { const { GTAOPass } = await import('three/examples/jsm/postprocessing/GTAOPass.js'); gtao = new GTAOPass(scene, camera, size.x, size.y); gtao.updateGtaoMaterial({ radius: 0.35, distanceFallOff: 1, thickness: 1 }); c.addPass(gtao); }
      if (want.dof) { const { BokehPass } = await import('three/examples/jsm/postprocessing/BokehPass.js'); bokeh = new BokehPass(scene, camera, { focus: state.camera.focus, aperture: state.camera.aperture * 0.0025, maxblur: 0.012 }); c.addPass(bokeh); }
      c.addPass(new OutputPass());
      c.setPixelRatio(renderer.getPixelRatio()); c.setSize(size.x, size.y);
      if (fx.ao !== want.ao || fx.dof !== want.dof) { c.dispose(); return; } // changed meanwhile
      composer = c;
    } catch (e) { console.error(e); toast('Effects are not supported on this device.'); state.camera.ao = false; state.camera.dof = false; fx = { ao: false, dof: false }; }
    setBusy(false); updateStatus(); dirty = true;
  }

  /* ── render loop (renders only when something changed or moves) ── */
  let dirty = true, raf = 0, last = performance.now();
  const walkKeys = new Set();
  let walking = false;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let moved = controls.update(dt);
    if (walking && walkKeys.size) {
      const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
      const r = new THREE.Vector3().crossVectors(f, camera.up).normalize();
      const v = new THREE.Vector3();
      if (walkKeys.has('f')) v.add(f); if (walkKeys.has('b')) v.sub(f); if (walkKeys.has('r')) v.add(r); if (walkKeys.has('l')) v.sub(r);
      v.normalize().multiplyScalar(2.6 * dt);
      const next = camera.position.clone().add(v);
      if (Math.hypot(next.x, next.z) < 21) { camera.position.add(v); controls.target.add(v); moved = true; }
    }
    if (!moved && !dirty) return;
    dirty = false;
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer?.setSize(w, h);
    dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  controls.addEventListener('change', () => { dirty = true; });

  /* ── selection (click an object in the viewport) ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; }, sig);
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.dragging || e.button !== 0) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...showroom.objects.values(), ...(character ? [character] : [])], true);
    const hit = hits[0]?.object;
    if (!hit) { select(null); return; }
    let o = hit; while (o && !o.userData.editable && o.name !== 'character') o = o.parent;
    if (o?.name === 'character') { select(null); openSection('character'); return; }
    if (o?.userData.editable) { select(o.userData.id); if (section !== 'environment' && section !== 'materials') openSection('environment'); }
  }, sig);
  renderer.domElement.addEventListener('contextmenu', (e) => { e.preventDefault(); viewportMenu(e.clientX, e.clientY); }, sig);
  function select(id) {
    selected = id;
    const m = id ? showroom.objects.get(id) : null;
    if (m) tc.attach(m); else tc.detach();
    $('[data-tmodes]', main).hidden = !m;
    updateStatus(); dirty = true;
    if (section === 'environment' || (section === 'materials' && matSlot === 'object')) renderPanel();
  }

  /* ── camera ── */
  function setCam(name, animate = true) {
    const [p, t] = CAMS[name] || CAMS.front;
    $$('[data-cam]', main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === name)));
    const from = camera.position.clone(), ft = controls.target.clone(), to = new THREE.Vector3(...p), tt = new THREE.Vector3(...t);
    if (!animate || reducedMotion()) { camera.position.copy(to); controls.target.copy(tt); dirty = true; return; }
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 650), e = 1 - (1 - k) ** 3; camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(ft, tt, e); dirty = true; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  $$('[data-cam]', main).forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
  controls.addEventListener('start', () => $$('[data-cam]', main).forEach((b) => b.setAttribute('aria-pressed', 'false')));

  /* ── toolbar & shortcuts ── */
  const press = (act, on) => $(`[data-act="${act}"]`, main)?.setAttribute('aria-pressed', String(!!on));
  const setWalk = (on) => {
    walking = on; walkKeys.clear(); press('walk', on); $('[data-walkpad]', main).hidden = !on;
    controls.minDistance = on ? 0.05 : 0.4;
    if (on) { // eye height, looking at the character
      const dir = camera.position.clone().sub(controls.target); dir.y = 0; if (dir.length() < 2.5) dir.setLength(4);
      camera.position.set(controls.target.x + dir.x, 1.65, controls.target.z + dir.z); controls.target.set(controls.target.x, 1.5, controls.target.z);
      toast('Walk mode: W A S D or arrow keys to walk, drag to look around.');
    }
    updateStatus(); dirty = true;
  };
  const actions = {
    undo: () => restore(hist.undo()), redo: () => restore(hist.redo()),
    turn: () => change((s) => { s.camera.auto = !s.camera.auto; }),
    walk: () => setWalk(!walking),
    shot: () => screenshot(2),
    menu: () => { const r = $('[data-act=menu]', main).getBoundingClientRect(); viewportMenu(r.right - 230, r.bottom + 6); },
    keys: () => showShortcuts([
      [`${MOD} · Z`, 'Undo'], [`${MOD} · Shift · Z`, 'Redo'], [`${MOD} · S`, 'Save scene'], ['1 – 6', 'Camera: front, side, back, face, hero, wide'],
      ['T', 'Turntable'], ['Q', 'Walk mode (then W A S D / arrows)'], ['W · E · R', 'Move · rotate · scale the selected object'], ['Delete', 'Delete selected object'],
      [`${MOD} · D`, 'Duplicate selected object'], ['Esc', 'Deselect'], ['P', 'Screenshot'], ['Right-click', 'Viewport menu'], ['?', 'This list'],
    ]),
    save: () => { openSection('export'); setTimeout(() => $('#et-scene-name', main)?.focus(), 50); },
  };
  $$('[data-act]', main).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]?.()));
  $$('[data-tm]', main).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.tm)));
  function setMode(m) { tc.setMode(m); $$('[data-tm]', main).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tm === m))); }
  for (const b of $$('[data-walk]', main)) {
    const k = b.dataset.walk;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); walkKeys.add(k); }, sig);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => walkKeys.delete(k), sig);
  }
  const WALK = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.closest?.('input[type=text], input[type=search], input:not([type]), textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? actions.redo() : actions.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); actions.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); actions.save(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod || e.altKey) return;
    if (t.closest?.('input[type=range]') && (k.startsWith('arrow') || /^\d$/.test(k))) return;
    if (walking && WALK[k]) { e.preventDefault(); walkKeys.add(WALK[k]); return; }
    if (t.closest?.('.panel') && !['?', 'escape'].includes(k)) return;
    const cams = ['front', 'side', 'back', 'face', 'hero', 'wide'];
    if (/^[1-6]$/.test(k)) { e.preventDefault(); setCam(cams[Number(k) - 1]); }
    else if (k === 't') actions.turn();
    else if (k === 'q') actions.walk();
    else if (k === 'p') screenshot(2);
    else if (k === '?') actions.keys();
    else if (k === 'escape') { if (walking) setWalk(false); else select(null); }
    else if (selected && (k === 'w' || k === 'e' || k === 'r')) setMode({ w: 'translate', e: 'rotate', r: 'scale' }[k]);
    else if (selected && (k === 'delete' || k === 'backspace')) { e.preventDefault(); removeSelected(); }
  }, sig);
  document.addEventListener('keyup', (e) => { const w = WALK[e.key.toLowerCase()]; if (w) walkKeys.delete(w); }, sig);

  function viewportMenu(x, y) {
    showMenu([
      { label: 'Undo', hint: `${MOD} Z`, action: actions.undo, disabled: !hist.canUndo },
      { label: 'Redo', hint: `${MOD} ⇧ Z`, action: actions.redo, disabled: !hist.canRedo },
      '-',
      ...Object.keys(CAMS).filter((k) => k !== 'top').map((k, i) => ({ label: `Camera: ${k[0].toUpperCase()}${k.slice(1)}`, hint: i < 6 ? String(i + 1) : '', action: () => setCam(k) })),
      { label: 'Camera: Top', action: () => setCam('top') },
      { label: 'Turntable', hint: 'T', checked: state.camera.auto, action: actions.turn },
      { label: 'Walk mode', hint: 'Q', checked: walking, action: actions.walk },
      '-',
      { label: 'Duplicate object', hint: `${MOD} D`, action: duplicate, disabled: !selected },
      { label: 'Delete object', hint: 'Del', action: removeSelected, disabled: !selected },
      '-',
      { label: 'Screenshot PNG', hint: 'P', action: () => screenshot(2) },
      { label: 'Keyboard shortcuts', hint: '?', action: actions.keys },
    ], { x, y, label: 'Viewport' });
  }

  /* ── status ── */
  function setBusy(on, text = 'Building') { $('[data-busy]', main).hidden = !on; $('[data-busy-text]', main).textContent = text; }
  function setStatus(s, text) { const el = $('[data-sb-state]', main); el.dataset.state = s; $('span', el).textContent = text || (s === 'ready' ? 'Ready' : s === 'busy' ? 'Building…' : 'Error'); }
  function updateStatus() {
    let tris = 0;
    scene.traverse((x) => { if (x.isMesh && x.visible && x.geometry?.attributes.position) tris += (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3; });
    $('[data-sb-tris]', main).textContent = `${Math.round(tris).toLocaleString('en')} tris · ${Math.round(buildMs)} ms`;
    const o = state.env.objects.find((x) => x.id === selected);
    $('[data-sb-sel]', main).textContent = walking ? 'Walk mode' : o ? `Selected: ${o.name || o.type}` : 'Click an object to edit it';
    $('[data-sb-fx]', main).textContent = [state.camera.ao && 'AO', state.camera.dof && 'DOF', state.env.reflect && 'Mirror floor', state.light.shadows !== 'off' && `Shadows ${state.light.shadows}`].filter(Boolean).join(' · ');
  }

  /* ── objects ── */
  function addObject(type) {
    const ang = Math.random() * Math.PI * 2, r = 3 + Math.random() * 3;
    const o = obj(type, [+(Math.cos(ang) * r).toFixed(2), type === 'torus' ? 1.6 : type === 'panel' ? 3.5 : 0, +(Math.sin(ang) * r).toFixed(2)], { name: ENV_OBJECTS.find(([k]) => k === type)[1] });
    if (type === 'panel') { o.scale = [2, 0.06, 0.4]; o.mat = { preset: 'emissive', color: '#ffffff' }; }
    change((s) => s.env.objects.push(o));
    requestAnimationFrame(() => requestAnimationFrame(() => select(o.id)));
  }
  function duplicate() {
    const o = state.env.objects.find((x) => x.id === selected);
    if (!o) return;
    const c = { ...JSON.parse(JSON.stringify(o)), id: newId(), pos: [o.pos[0] + 0.8, o.pos[1], o.pos[2] + 0.8] };
    change((s) => s.env.objects.push(c));
    requestAnimationFrame(() => requestAnimationFrame(() => select(c.id)));
  }
  function removeSelected() {
    if (!selected) return;
    const id = selected; select(null);
    change((s) => { s.env.objects = s.env.objects.filter((x) => x.id !== id); });
    toast(`Object deleted. ${MOD} Z brings it back.`);
  }

  /* ── panels ── */
  const body = $('[data-body]', main);
  function openSection(k) {
    section = k;
    $$('[data-sec]', main).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sec === k)));
    $('[data-sec-title]', main).textContent = SECTIONS.find(([x]) => x === k)[1];
    renderPanel();
  }
  $$('[data-sec]', main).forEach((b, i, all) => {
    b.addEventListener('click', () => openSection(b.dataset.sec));
    b.addEventListener('keydown', (e) => { const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); const n = all[(i + d + all.length) % all.length]; n.focus(); openSection(n.dataset.sec); } });
  });
  const group = (title, ...els) => { const g = document.createElement('div'); g.className = 'group'; if (title) g.innerHTML = `<span class="label">${esc(title)}</span>`; g.append(...els.filter(Boolean)); return g; };
  function chips(label, list, value, onPick, { custom = false, swatch = false } = {}) {
    const el = document.createElement('div'); el.className = 'ctl';
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(label)}</span></div><div class="chips" role="radiogroup" aria-label="${esc(label)}"></div>`;
    const box = $('.chips', el);
    for (const [v, l] of list) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === value));
      b.innerHTML = `${swatch ? `<span class="swatch" style="background:${v}"></span>` : ''}${esc(l)}`;
      b.addEventListener('click', () => { $$('[role=radio]', box).forEach((x) => x.setAttribute('aria-checked', String(x === b))); onPick(v); });
      box.append(b);
    }
    if (custom) {
      const lab = document.createElement('label'); lab.className = 'chip chip--color';
      lab.innerHTML = `<input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff')}" aria-label="${esc(label)}: custom colour"> Custom`;
      $('input', lab).addEventListener('input', (e) => { $$('[role=radio]', box).forEach((x) => x.setAttribute('aria-checked', 'false')); onPick(e.target.value); });
      box.append(lab);
    }
    return el;
  }
  const S = (label, help, key, obj, min, max, step, unit = '', scale = 1) => slider({ name: key, label, help, min, max, step, unit, value: +(obj()[key] * scale).toFixed(4), onInput: (v) => change(() => { obj()[key] = v / scale; }) });

  function renderPanel() {
    const scrollTop = $('.panel', main).scrollTop;
    body.innerHTML = '';
    const C = () => state.character, W = () => state.wardrobe;
    if (section === 'character') {
      body.append(
        group('Presets', chips('Start from', CHARACTER_OPTIONS, '', (k) => { state = applyCharacterPreset(state, k); change(); renderPanel(); })),
        choice({ name: 'pose', label: 'Pose', help: 'How the character stands.', options: POSES, value: C().pose, onInput: (v) => change(() => { C().pose = v; }) }),
        S('Height', 'Body height.', 'height', C, 150, 210, 1, 'cm', 100),
        S('Build', 'Slim to strong.', 'build', C, 0.6, 1.4, 0.01, '×'),
        chips('Skin', SKIN, C().skin, (v) => change(() => { C().skin = v; }), { swatch: true, custom: true }),
        choice({ name: 'hair', label: 'Hair', help: 'Experimental cuts and styles.', options: HAIR, value: C().hair, onInput: (v) => change(() => { C().hair = v; }) }),
        chips('Hair colour', HAIR_COLORS, C().hairColor, (v) => change(() => { C().hairColor = v; }), { swatch: true, custom: true }),
      );
      const more = document.createElement('details'); more.className = 'more'; more.innerHTML = '<summary>Proportions</summary>';
      more.append(S('Shoulders', 'Shoulder width.', 'shoulders', C, 0.75, 1.35, 0.01, '×'), S('Waist', 'Waist width.', 'waist', C, 0.7, 1.3, 0.01, '×'), S('Hips', 'Hip width.', 'hips', C, 0.75, 1.35, 0.01, '×'), S('Legs', 'Leg length.', 'legs', C, 0.85, 1.2, 0.01, '×'), S('Head', 'Head size.', 'head', C, 0.85, 1.2, 0.01, '×'));
      more.open = true;
      body.append(more);
    }
    if (section === 'wardrobe') {
      body.append(
        choice({ name: 'top', label: 'Top', help: 'Every piece is modelled in 3D and takes its own material.', options: TOPS, value: W().top, onInput: (v) => { const re = (v === 'graphic') !== (W().top === 'graphic'); change(() => { W().top = v; }); if (re) renderPanel(); } }),
        ...(W().top === 'graphic' ? [textField({ name: 'graphic', label: 'Graphic text', help: 'Printed under the mark on the chest.', value: W().graphic, max: 16, onInput: (v) => change(() => { W().graphic = v; }) })] : []),
        choice({ name: 'bottom', label: 'Bottom', help: 'Trousers, jeans, cargos and layered silhouettes.', options: BOTTOMS, value: W().bottom, onInput: (v) => change(() => { W().bottom = v; }) }),
        choice({ name: 'shoes', label: 'Shoes', help: 'Platforms and blades lift the character.', options: SHOES, value: W().shoes, onInput: (v) => change(() => { W().shoes = v; }) }),
        group('', Object.assign(document.createElement('p'), { className: 'ctl-help', textContent: 'Colours and surfaces of each piece: Materials.' })),
      );
    }
    if (section === 'accessories') {
      for (const [k, l] of ACCESSORIES) body.append(toggle({ name: k, label: l, help: { wings: 'Sculpted chrome feathers on the back.', orbit: 'A thin chrome ring circling the head.', gloves: 'Use the shoes & gloves material.', glasses: 'Lenses use the glasses material.' }[k] || 'Chrome parts use the chrome material.', value: state.accessories[k], onInput: (v) => change(() => { state.accessories[k] = v; }) }));
    }
    if (section === 'materials') renderMaterials();
    if (section === 'environment') renderEnvironment();
    if (section === 'lighting') {
      const L = () => state.light;
      body.append(
        chips('Preset', LIGHT_PRESETS, L().preset, (v) => { change(() => Object.assign(L(), LIGHT_LOOKS[v], { preset: v })); renderPanel(); }),
        S('Key light', 'Main light with shadows.', 'key', L, 0, 10, 0.1), S('Key direction', 'Where the key light comes from.', 'angle', L, -180, 180, 1, '°'),
        chips('Key colour', [['#ffffff', 'White'], ['#fff4ea', 'Warm'], ['#dcefff', 'Cold'], ['#cfe6f2', 'Ice']], L().keyColor, (v) => change(() => { L().keyColor = v; }), { swatch: true, custom: true }),
        S('Fill', 'Soft light that opens the shadows.', 'fill', L, 0, 5, 0.05), S('Rim', 'Back light that outlines the silhouette.', 'rim', L, 0, 12, 0.1),
        chips('Rim colour', [['#ffffff', 'White'], ['#cfe6f2', 'Ice'], ['#8fd0ff', 'Blue']], L().rimColor, (v) => change(() => { L().rimColor = v; }), { swatch: true, custom: true }),
        S('Ambient', 'Overall brightness of the room.', 'ambient', L, 0, 3, 0.05),
        choice({ name: 'shadows', label: 'Shadows', help: 'High uses a 4K shadow map (slower).', options: [['off', 'Off'], ['soft', 'Soft'], ['high', 'High']], value: L().shadows, onInput: (v) => change(() => { L().shadows = v; }) }),
      );
    }
    if (section === 'camera') {
      const K = () => state.camera;
      const views = document.createElement('div'); views.className = 'btn-row';
      views.innerHTML = Object.keys(CAMS).map((k) => `<button type="button" class="btn" data-pcam="${k}">${k}</button>`).join('');
      $$('[data-pcam]', views).forEach((b) => b.addEventListener('click', () => setCam(b.dataset.pcam)));
      body.append(
        group('Angles', views),
        S('Lens (field of view)', 'Small = telephoto, large = wide angle.', 'fov', K, 15, 75, 1, '°'),
        toggle({ name: 'auto', label: 'Turntable', help: 'Slowly orbit the character (T).', value: K().auto, onInput: (v) => change(() => { K().auto = v; }) }),
        toggle({ name: 'walk', label: 'Walk mode', help: 'Walk around the showroom with W A S D or the arrows (Q).', value: walking, onInput: (v) => setWalk(v) }),
        toggle({ name: 'ao', label: 'Ambient occlusion', help: 'Soft contact shadows in creases (GTAO). Slower on phones.', value: K().ao, onInput: (v) => change(() => { K().ao = v; }) }),
        toggle({ name: 'dof', label: 'Depth of field', help: 'Blurs what is out of focus.', value: K().dof, onInput: (v) => { change(() => { K().dof = v; }); renderPanel(); } }),
        ...(K().dof ? [S('Focus distance', 'Distance from the camera that is sharp.', 'focus', K, 0.5, 30, 0.1, 'm'), S('Blur', 'Strength of the blur.', 'aperture', K, 0, 3, 0.05, '×')] : []),
      );
      const af = document.createElement('p'); af.innerHTML = '<button type="button" class="btn">Focus on character</button>';
      $('button', af).addEventListener('click', () => change(() => { K().focus = +camera.position.distanceTo(new THREE.Vector3(0, 1.2, 0)).toFixed(2); }));
      if (K().dof) body.append(af);
    }
    if (section === 'export') renderExport();
    $('.panel', main).scrollTop = scrollTop;
  }

  function renderMaterials() {
    const opts = [...SLOTS, ...(selected ? [['object', 'Selected object']] : [])];
    if (matSlot === 'object' && !selected) matSlot = 'top';
    const get = () => (matSlot === 'object' ? state.env.objects.find((o) => o.id === selected).mat : state.materials[matSlot]);
    const m = get();
    const base = PRESETS[m.preset] || {};
    const val = (k) => (m[k] ?? base[k] ?? (k === 'opacity' ? 1 : 0));
    const setM = (k) => (v) => change(() => { get()[k] = v; if (matSlot === 'hair' && k === 'color') state.character.hairColor = v; });
    body.append(
      choice({ name: 'slot', label: 'Edit', help: 'Which part of the look or the room.', options: opts, value: matSlot, onInput: (v) => { matSlot = v; renderPanel(); } }),
      choice({ name: 'preset', label: 'Material', help: 'Start from a realistic surface, then fine-tune it.', options: PRESET_OPTIONS, value: m.preset, onInput: (v) => { change(() => { const t = get(); for (const k of ['roughness', 'metalness', 'transmission', 'iridescence', 'opacity']) delete t[k]; t.preset = v; t.color = PRESETS[v].color; if (matSlot === 'hair') state.character.hairColor = t.color; }); renderPanel(); } }),
      chips('Colour', PALETTE, matSlot === 'hair' ? state.character.hairColor : m.color, (v) => setM('color')(v), { swatch: true, custom: true }),
      slider({ name: 'roughness', label: 'Roughness', help: '0 = mirror-smooth, 1 = matte.', min: 0, max: 1, step: 0.01, value: val('roughness'), onInput: setM('roughness') }),
      slider({ name: 'metalness', label: 'Metalness', help: 'How metallic the surface is.', min: 0, max: 1, step: 0.01, value: val('metalness'), onInput: setM('metalness') }),
      slider({ name: 'transmission', label: 'Transparency (glass)', help: 'Light passing through, like glass or PVC.', min: 0, max: 1, step: 0.01, value: val('transmission'), onInput: setM('transmission') }),
      slider({ name: 'iridescence', label: 'Holographic shimmer', help: 'Rainbow film like a soap bubble.', min: 0, max: 1, step: 0.01, value: val('iridescence'), onInput: setM('iridescence') }),
      slider({ name: 'opacity', label: 'Opacity', help: 'Fade the surface out.', min: 0.05, max: 1, step: 0.01, value: val('opacity'), onInput: setM('opacity') }),
    );
  }
  function updateObjectFields() {
    const o = state.env.objects.find((x) => x.id === selected);
    if (!o) return;
    for (const [i, a] of ['x', 'y', 'z'].entries()) $(`[data-key="p${a}"]`, body)?.setValue?.(o.pos[i]);
    $('[data-key="ry"]', body)?.setValue?.(+(o.rot[1] * 180 / Math.PI).toFixed(0));
    $('[data-key="sc"]', body)?.setValue?.(o.scale[0]);
  }
  function renderEnvironment() {
    const E = () => state.env;
    body.append(
      chips('Preset', ENV_PRESETS, E().preset, (v) => { change(() => Object.assign(E(), ENV_LOOKS[v], { preset: v })); renderPanel(); }),
      chips('Room colour', PALETTE, E().bg, (v) => change(() => { E().bg = v; }), { swatch: true, custom: true }),
      chips('Fog colour', PALETTE, E().fog, (v) => change(() => { E().fog = v; }), { swatch: true, custom: true }),
      S('Fog', 'Atmospheric haze.', 'fogDensity', E, 0, 0.2, 0.001),
      chips('Floor', PALETTE, E().floor, (v) => change(() => { E().floor = v; }), { swatch: true, custom: true }),
      toggle({ name: 'reflect', label: 'Mirror floor', help: 'Real reflections (renders the scene twice).', value: E().reflect, onInput: (v) => change(() => { E().reflect = v; }) }),
      toggle({ name: 'cones', label: 'Light shafts', help: 'Soft beams under the ceiling lights.', value: E().cones, onInput: (v) => change(() => { E().cones = v; }) }),
    );
    // add objects
    const add = document.createElement('div'); add.className = 'ctl';
    add.innerHTML = `<div class="ctl-head"><span class="ctl-name">Add object</span></div><div class="obj-grid">${ENV_OBJECTS.map(([k, l]) => `<button type="button" class="chip" data-add="${k}">${esc(l)}</button>`).join('')}</div>`;
    $$('[data-add]', add).forEach((b) => b.addEventListener('click', () => addObject(b.dataset.add)));
    body.append(add);
    // outliner
    const list = document.createElement('div'); list.className = 'ctl';
    list.innerHTML = `<div class="ctl-head"><span class="ctl-name">Objects (${E().objects.length})</span></div><ul class="outliner" role="listbox" aria-label="Objects">${E().objects.map((o) => `<li role="option" aria-selected="${o.id === selected}" data-oid="${esc(o.id)}" tabindex="0"><span class="swatch" style="background:${esc(o.mat.color)}"></span>${esc(o.name || o.type)}<small>${esc(PRESETS[o.mat.preset]?.label || '')}</small></li>`).join('')}</ul>`;
    $$('[data-oid]', list).forEach((li) => { const go = () => select(li.dataset.oid); li.addEventListener('click', go); li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
    body.append(list);
    const o = E().objects.find((x) => x.id === selected);
    if (o) {
      const sel = () => E().objects.find((x) => x.id === selected);
      const box = document.createElement('div'); box.className = 'group sel-box';
      box.innerHTML = `<span class="label">Selected · ${esc(o.name || o.type)}</span>`;
      const pos = (i, a) => slider({ name: `p${a}`, label: `Position ${a.toUpperCase()}`, help: 'Metres.', min: i === 1 ? -2 : -20, max: i === 1 ? 15 : 20, step: 0.01, unit: 'm', value: o.pos[i], onInput: (v) => change(() => { sel().pos[i] = v; }) });
      box.append(pos(0, 'x'), pos(1, 'y'), pos(2, 'z'),
        slider({ name: 'ry', label: 'Rotation', help: 'Turn around the vertical axis (use the gizmo for all axes).', min: -180, max: 180, step: 1, unit: '°', value: +(o.rot[1] * 180 / Math.PI).toFixed(0), onInput: (v) => change(() => { sel().rot[1] = (v * Math.PI) / 180; }) }),
        slider({ name: 'sc', label: 'Scale', help: 'Uniform size (the gizmo scales single axes).', min: 0.05, max: 10, step: 0.01, unit: '×', value: o.scale[0], onInput: (v) => change(() => { const s = sel(); const k = v / (s.scale[0] || 1); s.scale = s.scale.map((x) => +(x * k).toFixed(3)); }) }));
      const row = document.createElement('div'); row.className = 'btn-row'; row.style.marginTop = '10px';
      row.innerHTML = '<button type="button" class="btn" data-o="mat">Material…</button><button type="button" class="btn" data-o="dup">Duplicate</button><button type="button" class="btn" data-o="del">Delete</button>';
      $('[data-o=mat]', row).addEventListener('click', () => { matSlot = 'object'; openSection('materials'); });
      $('[data-o=dup]', row).addEventListener('click', duplicate);
      $('[data-o=del]', row).addEventListener('click', removeSelected);
      box.append(row);
      body.append(box);
    }
    const reset = document.createElement('p'); reset.style.marginTop = '14px';
    reset.innerHTML = '<button type="button" class="btn">Reset room objects</button>';
    $('button', reset).addEventListener('click', () => { select(null); change((s) => { s.env.objects = defaultState().env.objects; }); renderPanel(); });
    body.append(reset);
  }

  /* ── save / load / export ── */
  async function listScenes() { return (await db.all('scenes')).map((r) => r.value).sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
  function thumb() {
    const c = shotCanvas(320, 400, 1);
    return c.toDataURL('image/jpeg', 0.82);
  }
  async function renderExport() {
    const box = document.createElement('div');
    box.innerHTML = `
      <div class="field"><label class="label" for="et-scene-name">Scene name</label><input id="et-scene-name" class="input" type="text" maxlength="60" value="Ether look"></div>
      <div class="save-actions">
        <button type="button" class="btn btn--lime" data-x="save">Save scene <small>on this device</small></button>
        <button type="button" class="btn" data-x="png2">Screenshot PNG <small>2× viewport</small></button>
        <button type="button" class="btn" data-x="png4">High-res render <small>4K, with AO &amp; depth of field if on</small></button>
        <button type="button" class="btn" data-x="glbc">Character (GLB) <small>Blender, C4D, Maya, AR</small></button>
        <button type="button" class="btn" data-x="glbs">Whole scene (GLB) <small>character + room objects</small></button>
        <button type="button" class="btn" data-x="json">Scene file (JSON) <small>back up or share a look</small></button>
        <button type="button" class="btn" data-x="open">Open scene file… <small>.json</small></button><input type="file" accept=".json,application/json" hidden data-file>
        <button type="button" class="btn" data-x="reset">New scene <small>start over</small></button>
      </div>
      <h2 class="label" style="margin-top:22px">Saved scenes</h2><ul class="scene-list" data-scenes><li class="muted">Loading…</li></ul>
      <p class="muted" style="font-size:13px;margin-top:12px">Scenes stay in this browser. Use the scene file to move them to another device.</p>`;
    body.append(box);
    const nameOf = () => $('#et-scene-name', box).value.trim() || 'Ether look';
    const X = {
      save: async () => {
        const rec = { id: newId(), name: nameOf(), date: new Date().toISOString(), thumb: thumb(), state: JSON.parse(JSON.stringify(state)) };
        const ok = await db.put('scenes', rec.id, rec);
        toast(ok ? `“${rec.name}” saved.` : 'Saved for this visit only (storage is blocked in this browser).');
        drawList();
      },
      png2: () => screenshot(2), png4: () => screenshot(4, true),
      glbc: () => exportGLB(false), glbs: () => exportGLB(true),
      json: () => download(new Blob([JSON.stringify({ app: 'triad-ether', ...state }, null, 1)], { type: 'application/json' }), `ether-${nameOf().replace(/\W+/g, '-').toLowerCase()}.json`),
      open: () => $('[data-file]', box).click(),
      reset: () => { if (confirm('Start a new scene? Unsaved changes are lost (undo still works).')) { select(null); state = defaultState(); change(); renderPanel(); } },
    };
    $$('[data-x]', box).forEach((b) => b.addEventListener('click', () => X[b.dataset.x]()));
    $('[data-file]', box).addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        if (f.size > 2e6) throw new Error('too big');
        const data = JSON.parse(await f.text());
        select(null); state = sanitize(data); change(); renderPanel(); toast('Scene loaded.');
      } catch { toast('This file is not an Ether scene.'); }
    });
    async function drawList() {
      const ul = $('[data-scenes]', box); if (!ul) return;
      const list = await listScenes();
      ul.innerHTML = list.length ? list.map((s) => `<li><img src="${esc(s.thumb)}" alt=""><span><b>${esc(s.name)}</b><br><small class="muted">${esc((s.date || '').slice(0, 16).replace('T', ' '))}</small></span><button type="button" class="btn" data-load="${esc(s.id)}">Load</button><button type="button" class="icon-btn" data-del="${esc(s.id)}" aria-label="Delete ${esc(s.name)}">×</button></li>`).join('') : '<li class="muted">No saved scenes yet.</li>';
      $$('[data-load]', ul).forEach((b) => b.addEventListener('click', () => { const s = list.find((x) => x.id === b.dataset.load); select(null); state = sanitize(s.state); change(); toast(`“${s.name}” loaded.`); }));
      $$('[data-del]', ul).forEach((b) => b.addEventListener('click', async () => { await db.del('scenes', b.dataset.del); drawList(); toast('Scene deleted.'); }));
    }
    drawList();
  }
  function shotCanvas(w, h, pr = 1) {
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = camera.aspect;
    tc.getHelper().visible = false;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    composer?.setPixelRatio(pr); composer?.setSize(w, h);
    if (composer) composer.render(); else renderer.render(scene, camera);
    const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h);
    renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); camera.aspect = aspect; camera.updateProjectionMatrix();
    composer?.setPixelRatio(ratio); composer?.setSize(size.x, size.y);
    tc.getHelper().visible = true; dirty = true;
    return out;
  }
  function screenshot(k, hi = false) {
    const r = stage.getBoundingClientRect();
    let w = Math.round(r.width * k), h = Math.round(r.height * k);
    if (hi) { const s = 3840 / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
    const max = renderer.capabilities.maxTextureSize || 4096; const f = Math.min(1, max / Math.max(w, h)); w = Math.round(w * f); h = Math.round(h * f);
    setBusy(true, 'Rendering');
    requestAnimationFrame(() => {
      try { shotCanvas(w, h).toBlob((b) => { setBusy(false); if (b) { download(b, `ether-${Date.now()}.png`); toast(`Saved ${w} × ${h} PNG.`); } }, 'image/png'); }
      catch (e) { console.error(e); setBusy(false); toast('The image could not be rendered.'); }
    });
  }
  async function exportGLB(all) {
    setBusy(true, 'Exporting');
    try {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const g = new THREE.Group();
      if (character) g.add(character.clone());
      if (all) for (const m of showroom.objects.values()) g.add(m.clone());
      const buf = await new GLTFExporter().parseAsync(g, { binary: true });
      download(new Blob([buf], { type: 'model/gltf-binary' }), `ether-${all ? 'scene' : 'character'}.glb`);
      toast('GLB saved (metres). Open it in Blender, Cinema 4D, Maya or any AR viewer.');
    } catch (e) { console.error(e); toast('The GLB could not be exported.'); }
    setBusy(false);
  }

  /* ── go ── */
  try {
    applyAll();
    commit();
    renderPanel();
    resize();
    setCam('hero', false);
    raf = requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    setStatus('error', 'The showroom could not start');
  }

  return {
    destroy() {
      cancelAnimationFrame(raf); cancelAnimationFrame(raf1);
      closeMenu();
      ac.abort(); ro.disconnect();
      tc.detach(); tc.dispose(); controls.dispose();
      composer?.dispose();
      if (character) character.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); x.material.map?.dispose(); } });
      Object.values(M).forEach((m) => m.dispose());
      showroom.dispose();
      envTex.dispose();
      renderer.shadowMap.enabled = prevShadow;
      renderer.toneMappingExposure = 1.05;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.remove();
      renderer.domElement.removeAttribute('aria-label');
    },
  };
}

/** Bright, soft reflection environment (white studio with light panels and a grey horizon band),
    so chrome and glass read silver-white instead of mirroring a dark room. */
function etherEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: '#e4e8ec', side: THREE.BackSide }));
  env.add(room);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#7d848b', side: THREE.BackSide }));
  band.position.y = -0.4; env.add(band);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 48), new THREE.MeshBasicMaterial({ color: '#b9bfc5' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2; env.add(floor);
  const panel = (x, y, z, w, h, k = 4) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(0, 8, 0, 6, 6, 3); panel(-7, 3, 4, 2, 5); panel(7, 3, -3, 2, 5); panel(0, 2.5, -8, 6, 1.2, 2.5); panel(3, 1, 8, 3, 1, 2);
  return env;
}
