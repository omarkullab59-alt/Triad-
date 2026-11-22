// WORLD — Bryce-style world builder: viewport, terrain + sculpting, scene hierarchy, objects, sky, water,
// timeline, undo history, autosave, import / export. Route: #/world. Panels live in panels.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sharedRenderer } from '../jewellery/viewer.js';
import { showMenu, closeMenu, showShortcuts } from '../ui/menu.js';
import { ICON } from '../ui/icons.js';
import { $, $$, esc, toast, download, reducedMotion } from '../lib/dom.js';
import * as db from '../lib/db.js';
import { makeMaterial, applySpec } from '../ether/materials.js';
import { generate, erodeHydraulic, erodeThermal, combine, heightAt, dab, makeNoise, toGrey, fromGrey } from './terrain.js';
import { WORLDS } from './worlds.js';
import { worldState, sanitize, newNode, childrenOf, descendants, uid, f32ToB64, b64ToF32, bytesToB64, b64ToBytes, N, SIZE } from './state.js';
import { objectGeometry, buildScatter, recolor, OBJECTS, SCATTER } from './objects.js';
import { createEnvironment } from './environment.js';
import { renderSection, renderProperties, SECTIONS, svg } from './panels.js';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
const CELL = SIZE / (N - 1);
const SYSTEM = [['terrain', 'Terrain'], ['water', 'Water'], ['sky', 'Sky'], ['clouds', 'Clouds'], ['planets', 'Planets'], ['scatter', 'Vegetation & props'], ['lighting', 'Lighting']];

export async function mount(main) {
  main.innerHTML = `
  <div class="tool world">
    <nav class="ether-rail world-rail" role="tablist" aria-label="World sections">
      ${SECTIONS.map(([k, l, d, next], i) => `<button type="button" role="tab" data-sec="${k}" aria-selected="${!i}" data-tip="${l}${next ? ' — next phase' : ''}">${svg(d)}<span>${l}</span>${next ? '<i class="next-dot" aria-label="next phase"></i>' : ''}</button>`).join('')}
    </nav>
    <section class="panel world-left" aria-label="Section settings">
      <header class="panel-head"><a class="tb panel-back" href="#/" data-tip="All tools" aria-label="All tools">${ICON.back}</a>
        <div class="panel-name"><span class="label muted" data-wname>World</span><h1 data-sec-title>World</h1></div>
        <button type="button" class="tb" data-act="save" data-tip="Save project (${MOD} S)" aria-label="Save project">${ICON.save}</button></header>
      <div data-left></div>
    </section>
    <section class="stage" aria-label="World viewport">
      <div class="vp-bar" role="toolbar" aria-label="Viewport tools">
        <div class="seg-group" role="group" aria-label="Mode">
          <button type="button" data-mode="select" aria-pressed="true" data-tip="Select & move (V)">Select</button>
          <button type="button" data-mode="sculpt" aria-pressed="false" data-tip="Sculpt terrain (B)">Sculpt</button>
          <button type="button" data-mode="fly" aria-pressed="false" data-tip="Fly camera (Q) — WASD, E / C up & down">Fly</button>
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
          <button type="button" class="tb" data-act="frame" data-tip="Frame selection (F)" aria-label="Frame selection">${ICON.fit}</button>
          <button type="button" class="tb" data-act="ortho" data-tip="Orthographic (O)" aria-label="Orthographic camera" aria-pressed="false">${svg('<rect x="4" y="4" width="16" height="16"/><path d="M4 12h16M12 4v16"/>')}</button>
          <button type="button" class="tb" data-act="anim" data-tip="Animate water, clouds & sky (Space)" aria-label="Animate" aria-pressed="true">${svg('<path d="M3 12c3-4 6-4 9 0s6 4 9 0"/><path d="M3 17c3-4 6-4 9 0s6 4 9 0"/>')}</button>
          <button type="button" class="tb" data-act="shot" data-tip="Render PNG (P)" aria-label="Render image">${ICON.camera}</button>
        </div>
        <button type="button" class="tb" data-act="menu" data-tip="More" aria-label="More actions" aria-haspopup="menu">${ICON.more}</button>
      </div>
      <div class="vp-busy" data-busy hidden><span class="spinner spinner--sm" aria-hidden="true"></span><span data-busy-text>Working</span></div>
      <div class="walkpad" data-walkpad hidden><button type="button" data-walk="f" aria-label="Fly forward">▲</button><button type="button" data-walk="l" aria-label="Fly left">◀</button><button type="button" data-walk="b" aria-label="Fly back">▼</button><button type="button" data-walk="r" aria-label="Fly right">▶</button></div>
      <div class="statusbar">
        <span class="sb-state" data-sb-state data-state="busy" role="status" aria-live="polite"><i aria-hidden="true"></i><span>Loading…</span></span>
        <span class="sb-item" data-sb-hint></span><span class="sb-item sb-wide" data-sb-pos></span><span class="sb-item sb-wide" data-sb-tris></span>
        <span class="vp-spacer"></span>
        <button type="button" class="tb tb--sm" data-act="keys" data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">${ICON.keyboard}</button>
      </div>
    </section>
    <aside class="panel world-right" aria-label="Scene and properties">
      <div class="outliner-head"><span class="label">Scene</span><span class="vp-spacer"></span>
        <button type="button" class="tb tb--sm" data-act="group" data-tip="Group selection (${MOD} G)" aria-label="Group">${svg('<rect x="3" y="3" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/><path d="M11 7h4v6"/>')}</button>
        <button type="button" class="tb tb--sm" data-act="dup" data-tip="Duplicate (${MOD} D)" aria-label="Duplicate">${svg('<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>')}</button>
        <button type="button" class="tb tb--sm" data-act="del" data-tip="Delete (Del)" aria-label="Delete">${svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')}</button></div>
      <ul class="tree" role="tree" aria-label="Scene hierarchy" aria-multiselectable="true" data-tree></ul>
      <div class="props" data-props></div>
    </aside>
    <section class="dock" aria-label="Timeline, layers and history">
      <div class="dock-tabs" role="tablist"><button type="button" role="tab" data-dock="timeline" aria-selected="true">Timeline</button><button type="button" role="tab" data-dock="layers" aria-selected="false">Terrain layers</button><button type="button" role="tab" data-dock="history" aria-selected="false">History</button></div>
      <div class="dock-body" data-dock-body></div>
    </section>
  </div>`;

  /* ── renderer & scene ── */
  const stage = $('.stage', main);
  const { renderer } = sharedRenderer();
  const ac = new AbortController(), sig = { signal: ac.signal };
  renderer.domElement.style.visibility = '';
  stage.prepend(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'World viewport. Drag to orbit, right-drag to pan, scroll to zoom.');
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environment = envTex; scene.environmentIntensity = 0.5;
  const persp = new THREE.PerspectiveCamera(40, 1, 0.3, SIZE * 12);
  const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -SIZE * 6, SIZE * 6);
  let camera = persp;
  persp.position.set(SIZE * 0.55, SIZE * 0.32, SIZE * 0.62);
  const controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = !reducedMotion(); controls.maxDistance = SIZE * 4; controls.minDistance = 0.5; controls.screenSpacePanning = true;
  const tc = new TransformControls(persp, renderer.domElement); tc.setSize(0.85); scene.add(tc.getHelper());

  const env = createEnvironment(scene, renderer, SIZE);
  const worldRoot = new THREE.Group(); worldRoot.name = 'World'; scene.add(worldRoot);

  /* ── state ── */
  let state = worldState('mountains');
  const live = new Map();    // layer id → Float32Array (mutable)
  const assets = new Map();  // asset id → { kind, name, data }
  let full = new Float32Array(N * N);
  let sel = [];              // selected node ids (or system keys like 'sys:water')
  let section = 'world', mode = 'select', dockTab = 'timeline';

  /* ── terrain mesh ── */
  const tGeo = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1); tGeo.rotateX(-Math.PI / 2);
  tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
  const tMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
  const terrain = new THREE.Mesh(tGeo, tMat); terrain.name = 'Terrain'; terrain.receiveShadow = true; terrain.castShadow = true;
  worldRoot.add(terrain);
  const detailNoise = makeNoise(77);
  function recombine() { full = combine(state.layers.map((l) => ({ ...l, data: live.get(l.id) })), N); }
  function updateTerrain(colorsToo = true) {
    const p = tGeo.attributes.position.array;
    for (let k = 0; k < N * N; k++) p[k * 3 + 1] = full[k];
    tGeo.attributes.position.needsUpdate = true;
    tGeo.computeVertexNormals();
    if (colorsToo) paintTerrain();
    tGeo.computeBoundingSphere(); tGeo.computeBoundingBox();
    env.sun.shadow.needsUpdate = true; dirty = true;
  }
  function paintTerrain() {
    const P = state.pal, c = tGeo.attributes.color.array, nrm = tGeo.attributes.normal.array;
    const col = Object.fromEntries(['deep', 'shore', 'low', 'mid', 'high', 'peak', 'rock'].map((k) => [k, new THREE.Color(P[k])]));
    let lo = Infinity, hi = -Infinity; for (const v of full) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const wl = state.water.on ? state.water.level : lo - 1, span = Math.max(1, hi - Math.max(lo, wl));
    const t = new THREE.Color();
    for (let k = 0; k < N * N; k++) {
      const h = full[k], rel = (h - Math.max(lo, wl)) / span, ny = nrm[k * 3 + 1];
      const i = k % N, j = Math.floor(k / N);
      const dn = detailNoise(i * 0.21, j * 0.21) * P.detail * 0.18;
      if (P.checker) { t.set(((Math.floor(i / 16) + Math.floor(j / 16)) & 1) ? '#1b1b1c' : P.low); }
      else if (h < wl - 0.3) t.copy(col.deep).lerp(col.shore, Math.max(0, 1 - (wl - h) / 8));
      else if (rel < 0.03) t.copy(col.shore);
      else if (rel < 0.35) t.copy(col.low).lerp(col.mid, (rel - 0.03) / 0.32 + dn);
      else if (rel < P.snowLine) t.copy(col.mid).lerp(col.high, Math.min(1, (rel - 0.35) / Math.max(0.05, P.snowLine - 0.35) + dn));
      else t.copy(col.high).lerp(col.peak, Math.min(1, (rel - P.snowLine) / 0.08));
      if (!P.checker && ny < P.rockSlope + 0.3 && rel > 0.02) t.lerp(col.rock, Math.min(1, (P.rockSlope + 0.3 - ny) * 3.5));
      if (!P.checker && rel >= P.snowLine && ny > 0.7) t.lerp(col.peak, 0.6);
      const sh = 1 + dn; c[k * 3] = t.r * sh; c[k * 3 + 1] = t.g * sh; c[k * 3 + 2] = t.b * sh;
    }
    tGeo.attributes.color.needsUpdate = true;
    tMat.flatShading = !!P.flat; tMat.needsUpdate = true;
  }
  function regenerateBase() {
    const t0 = performance.now();
    const h = generate(N, SIZE, state.gen);
    if (state.erosion > 0) erodeHydraulic(h, N, { drops: Math.round(state.erosion * 60000), seed: state.gen.seed, strength: 1, cell: CELL });
    live.set('base', h);
    if (!state.layers.some((l) => l.id === 'base')) state.layers.unshift({ id: 'base', name: 'Generated terrain', visible: true, opacity: 1, locked: false });
    recombine(); updateTerrain(); scheduleScatter();
    setStatus('ready', `Terrain generated in ${Math.round(performance.now() - t0)} ms`);
  }

  /* ── scatter (instanced) ── */
  const scatterGroup = new THREE.Group(); scatterGroup.name = 'Vegetation & props'; worldRoot.add(scatterGroup);
  let scatterTimer = 0, scatterKey = '';
  function scheduleScatter(force) { clearTimeout(scatterTimer); scatterTimer = setTimeout(() => rebuildScatter(force), 250); }
  function rebuildScatter(force) {
    const key = JSON.stringify([state.scatter, state.scatterSeed, state.water.level, state.water.on]);
    if (!force && key === scatterKey && scatterGroup.children.length) return;
    scatterKey = key;
    scatterGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); scatterGroup.clear();
    for (const k of Object.keys(SCATTER)) { const m = buildScatter(k, Math.round(state.scatter[k] || 0), full, N, SIZE, state.water.on ? state.water.level : -1e9, state.scatterSeed); if (m) scatterGroup.add(m); }
    env.sun.shadow.needsUpdate = true; dirty = true; updateStats();
  }

  /* ── nodes (objects) ── */
  const objects = new Map(); // id → Object3D
  let nodeKeys = new Map();
  async function nodeObject(n) {
    let o;
    if (n.type === 'group') o = new THREE.Group();
    else if (n.type === 'figure') {
      const [{ skeleton, buildBody }, { buildTop, buildBottom, buildShoes, buildAccessories, SHOE_LIFT }, st] = await Promise.all([import('../ether/character.js'), import('../ether/wardrobe.js'), import('../ether/state.js')]);
      const presetKey = Object.keys(st.CHARACTERS)[Math.round(n.p.preset) % Object.keys(st.CHARACTERS).length];
      const s = st.applyCharacterPreset(st.defaultState(), presetKey); s.character.height = n.p.height;
      const M = {}; for (const k of ['top', 'under', 'bottom', 'shoes', 'metal', 'glass', 'hair']) M[k] = makeMaterial(s.materials[k]);
      M.hair.color.set(s.character.hairColor); M.skin = makeMaterial({ preset: 'skin', color: n.mat.color || s.character.skin });
      for (const k of ['top', 'under', 'bottom']) M[k].side = THREE.DoubleSide;
      const sk = skeleton(s.character); o = new THREE.Group();
      o.add(buildBody(sk, M, s.character)); if (s.wardrobe.top !== 'none') o.add(buildTop(sk, M, s.wardrobe.top, s.wardrobe.graphic)); if (s.wardrobe.bottom !== 'none') o.add(buildBottom(sk, M, s.wardrobe.bottom)); o.add(buildShoes(sk, M, s.wardrobe.shoes)); o.add(buildAccessories(sk, M, s.accessories));
      for (const c of o.children) c.position.y += SHOE_LIFT[s.wardrobe.shoes] || 0;
      o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.userData.ownMat = true; } });
    } else if (n.type === 'image') {
      const a = assets.get(n.asset);
      const tex = a ? await new THREE.TextureLoader().loadAsync(a.data) : null;
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      const asp = tex ? tex.image.width / tex.image.height : 1;
      const g = new THREE.PlaneGeometry(n.p.width, n.p.width / asp); g.translate(0, n.p.width / asp / 2, 0);
      o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, opacity: n.mat.opacity ?? 0.85, fog: false }));
      o.userData.ownMat = true;
    } else if (n.type === 'model') {
      const a = assets.get(n.asset);
      o = new THREE.Group();
      if (a) {
        try {
          if (/\.(glb|gltf)$/i.test(a.name)) { const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js'); const gl = await new GLTFLoader().parseAsync(a.data, ''); o.add(gl.scene); o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.userData.ownMat = true; } }); }
          else { const { loadModelFile } = await import('../make/model.js'); const r = await loadModelFile(new File([a.data], a.name)); const m = new THREE.Mesh(r.geometry, makeMaterial(n.mat)); m.castShadow = true; o.add(m); }
          const box = new THREE.Box3().setFromObject(o); const sz = box.getSize(new THREE.Vector3()).length() || 1; const k = (20 / sz) * n.p.scale; o.children.forEach((c) => c.scale.multiplyScalar(k)); const b2 = new THREE.Box3().setFromObject(o); o.children.forEach((c) => c.position.y -= b2.min.y);
        } catch (e) { console.error(e); toast(`${a.name} could not be opened.`); }
      }
    } else {
      const geo = objectGeometry(n.type, n.p);
      const m = makeMaterial(n.mat); if (geo.attributes.color) m.vertexColors = true;
      o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true;
    }
    o.userData.node = n.id;
    return o;
  }
  function disposeObj(o) { o.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); const m = x.material; (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.map?.dispose(); mm.dispose(); }); } }); }
  let syncing = Promise.resolve();
  function syncNodes() { syncing = syncing.then(syncNow).catch((e) => console.error(e)); return syncing; }
  async function syncNow() {
    const ids = new Set(state.nodes.map((n) => n.id));
    for (const [id, o] of objects) if (!ids.has(id)) { o.removeFromParent(); disposeObj(o); objects.delete(id); nodeKeys.delete(id); }
    for (const n of state.nodes) {
      const key = JSON.stringify([n.type, n.p, n.type === 'figure' ? n.mat.color : '', n.asset]);
      let o = objects.get(n.id);
      if (!o || nodeKeys.get(n.id) !== key) {
        const fresh = await nodeObject(n);
        if (o) { for (const c of [...o.children]) if (c.userData.node) fresh.add(c); o.removeFromParent(); disposeObj(o); }
        objects.set(n.id, fresh); nodeKeys.set(n.id, key); o = fresh;
      }
      if (o.isMesh && !o.userData.ownMat) { applySpec(o.material, n.mat); if (recolor(o.geometry, n.mat.color)) { o.material.vertexColors = true; o.material.color.set('#ffffff'); } }
      if (n.type === 'image' && o.material) o.material.opacity = n.mat.opacity ?? 0.85;
    }
    for (const n of state.nodes) {
      const o = objects.get(n.id);
      const parent = n.parent ? objects.get(n.parent) : worldRoot;
      if (o.parent !== parent) parent.add(o);
      o.position.fromArray(n.pos); o.rotation.set(n.rot[0], n.rot[1], n.rot[2]); o.scale.fromArray(n.scale);
      o.visible = n.visible; o.name = n.name;
    }
    // keep sibling order as in the list
    for (const n of state.nodes) { const o = objects.get(n.id); o.parent?.remove(o); (n.parent ? objects.get(n.parent) : worldRoot).add(o); }
    const prim = objects.get(sel[0]);
    if (prim && sel.length && !nodeById(sel[0])?.locked && mode === 'select') tc.attach(prim); else tc.detach();
    env.sun.shadow.needsUpdate = true; dirty = true; updateStats();
  }
  const nodeById = (id) => state.nodes.find((n) => n.id === id);

  /* ── apply state ── */
  function applyAll({ terrainToo = false } = {}) {
    env.apply(state);
    renderer.toneMappingExposure = state.light.exposure;
    persp.fov = state.camera.fov; persp.updateProjectionMatrix();
    terrain.visible = !state.hidden.terrain; env.water.visible = state.water.on && !state.hidden.water; env.sky.visible = !state.hidden.sky; env.clouds.visible = env.clouds.visible && !state.hidden.clouds; env.planets.visible = !state.hidden.planets; scatterGroup.visible = !state.hidden.scatter;
    if (terrainToo) { recombine(); updateTerrain(); } else paintTerrain();
    scheduleScatter();
    syncNodes().then(() => { renderTree(); });
    setupEffects();
    $('[data-wname]', main).textContent = state.name || 'World';
    dirty = true;
  }

  /* ── history (state JSON + layer snapshots) ── */
  const hist = []; let hi = -1, lastMerge = 0;
  const snapLayers = (ids) => { const prev = hist[hi]?.layers || {}; const out = { ...prev }; for (const l of state.layers) if (ids === 'all' || ids.includes(l.id) || !out[l.id]) out[l.id] = live.get(l.id).slice(); for (const k of Object.keys(out)) if (!state.layers.some((l) => l.id === k)) delete out[k]; return out; };
  function commit(label, layerIds = []) {
    const json = JSON.stringify(state);
    const now = performance.now();
    if (hi >= 0 && hist[hi].json === json && !layerIds.length) return;
    const layers = snapLayers(layerIds);
    if (hi > 0 && !layerIds.length && hist[hi].label === label && now - lastMerge < 700) hist[hi] = { label, json, layers };
    else { hist.splice(hi + 1); hist.push({ label, json, layers }); if (hist.length > 60) hist.shift(); hi = hist.length - 1; }
    lastMerge = now; changedSince = true;
    updateHistoryUI();
  }
  function goTo(i) {
    if (i < 0 || i >= hist.length || i === hi) return;
    hi = i; const h = hist[i];
    state = JSON.parse(h.json);
    live.clear(); for (const [k, v] of Object.entries(h.layers)) live.set(k, v.slice());
    sel = sel.filter((id) => id.startsWith('sys:') || state.nodes.some((n) => n.id === id));
    applyAll({ terrainToo: true }); renderLeft(); renderProps(); updateHistoryUI(); changedSince = true;
  }
  function updateHistoryUI() {
    $('[data-act=undo]', main).disabled = hi <= 0; $('[data-act=redo]', main).disabled = hi >= hist.length - 1;
    // keep the dock in sync, but never while the user is dragging a slider or typing in it
    const f = document.activeElement;
    if (!(dockBody.contains(f) && f.matches('input'))) renderDock();
  }
  /** Change state → apply on next frame → record. */
  let raf1 = 0, pendingLabel = '', pendingTerrain = false;
  function change(fn, label = 'Edit', { terrain: terr = false, regen = false } = {}) {
    fn?.(state);
    pendingLabel = label; pendingTerrain = pendingTerrain || terr;
    cancelAnimationFrame(raf1);
    raf1 = requestAnimationFrame(() => {
      if (regen) regenerateBase();
      applyAll({ terrainToo: pendingTerrain });
      commit(pendingLabel, regen ? ['base'] : pendingTerrain ? 'all' : []);
      pendingTerrain = false;
      renderProps();
    });
  }

  /* ── selection & hierarchy ── */
  function select(ids, { add = false } = {}) {
    const list = Array.isArray(ids) ? ids : ids ? [ids] : [];
    if (add) { for (const id of list) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]; } else sel = list;
    const prim = sel[0] && objects.get(sel[0]);
    if (prim && mode === 'select' && !nodeById(sel[0])?.locked) tc.attach(prim); else tc.detach();
    $('[data-tmodes]', main).hidden = !prim || mode !== 'select';
    // update the selection marks in place: rebuilding the list here would swallow double-clicks (rename)
    for (const li of tree.querySelectorAll('li[data-id]')) li.setAttribute('aria-selected', String(sel.includes(li.dataset.id)));
    renderProps(); updateStats(); dirty = true;
  }
  tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; if (!e.value) commit('Transform'); });
  tc.addEventListener('objectChange', () => {
    const n = nodeById(sel[0]); const o = objects.get(sel[0]); if (!n || !o) return;
    n.pos = o.position.toArray().map((v) => +v.toFixed(3)); n.rot = [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(4)); n.scale = o.scale.toArray().map((v) => +Math.max(0.001, v).toFixed(4));
    env.sun.shadow.needsUpdate = true; dirty = true; renderProps(true);
  });
  const tree = $('[data-tree]', main);
  let dragId = null;
  function renderTree() {
    const row = (id, name, depth, { sys = false, hidden = false, locked = false, hasKids = false, icon = '' } = {}) => `<li role="treeitem" aria-selected="${sel.includes(id)}" data-id="${esc(id)}" tabindex="-1" draggable="${!sys}" style="--d:${depth}" class="${hidden ? 'is-hidden' : ''}${sys ? ' is-sys' : ''}">
      <span class="tree-name">${icon}${esc(name)}</span>
      <button type="button" class="tree-btn" data-vis="${esc(id)}" aria-label="${hidden ? 'Show' : 'Hide'} ${esc(name)}" aria-pressed="${!hidden}">${hidden ? '◌' : '●'}</button>
      ${sys ? '' : `<button type="button" class="tree-btn" data-lock="${esc(id)}" aria-label="${locked ? 'Unlock' : 'Lock'} ${esc(name)}" aria-pressed="${locked}">${locked ? '🔒︎' : '○'}</button>`}</li>`;
    let html = `<li role="treeitem" class="is-root" aria-expanded="true" data-id="root" style="--d:0"><span class="tree-name"><b>${esc(state.name || 'World')}</b></span></li>`;
    for (const [k, l] of SYSTEM) html += row(`sys:${k}`, l, 1, { sys: true, hidden: !!state.hidden[k] || (k === 'water' && !state.water.on) });
    const walk = (pid, d) => { for (const n of childrenOf(state.nodes, pid)) { html += row(n.id, n.name, d, { hidden: !n.visible, locked: n.locked, icon: n.type === 'group' ? '▸ ' : '' }); walk(n.id, d + 1); } };
    walk(null, 1);
    tree.innerHTML = html;
  }
  tree.addEventListener('click', (e) => {
    const vis = e.target.closest('[data-vis]'), lock = e.target.closest('[data-lock]'), li = e.target.closest('li[data-id]');
    if (vis) { const id = vis.dataset.vis; if (id.startsWith('sys:')) { const k = id.slice(4); change((s) => { if (k === 'water' && !s.water.on) { s.water.on = true; s.hidden.water = false; } else s.hidden[k] = !s.hidden[k]; }, 'Visibility'); } else change(() => { const n = nodeById(id); n.visible = !n.visible; }, 'Visibility'); return; }
    if (lock) { change(() => { const n = nodeById(lock.dataset.lock); n.locked = !n.locked; }, 'Lock'); requestAnimationFrame(() => select(sel)); return; }
    if (!li || li.dataset.id === 'root') return;
    const id = li.dataset.id;
    if (e.shiftKey && sel.length && !id.startsWith('sys:')) { const order = [...tree.querySelectorAll('li[data-id]')].map((x) => x.dataset.id).filter((x) => !x.startsWith('sys:') && x !== 'root'); const a = order.indexOf(sel[0]), b = order.indexOf(id); if (a >= 0 && b >= 0) { select(order.slice(Math.min(a, b), Math.max(a, b) + 1)); return; } }
    select(id, { add: e.ctrlKey || e.metaKey });
    if (id.startsWith('sys:')) openSection({ terrain: 'terrain', water: 'water', sky: 'sky', clouds: 'sky', planets: 'sky', scatter: 'objects', lighting: 'render' }[id.slice(4)]);
  });
  tree.addEventListener('dblclick', (e) => { const li = e.target.closest('li[data-id]'); if (li && !li.dataset.id.startsWith('sys:') && li.dataset.id !== 'root') rename(li.dataset.id); });
  tree.addEventListener('keydown', (e) => {
    const items = [...tree.querySelectorAll('li[data-id]')], i = items.indexOf(document.activeElement.closest('li'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]; n.focus(); if (n.dataset.id !== 'root') select(n.dataset.id); }
    if (e.key === 'F2' && sel[0] && !sel[0].startsWith('sys:')) rename(sel[0]);
  });
  tree.addEventListener('focusin', () => { if (!tree.querySelector('li:focus')) tree.querySelector('li[aria-selected=true], li')?.setAttribute('tabindex', '0'); });
  // drag & drop: onto an item = parent to it, onto its upper / lower edge = reorder
  tree.addEventListener('dragstart', (e) => { const li = e.target.closest('li[data-id]'); dragId = li?.dataset.id; e.dataTransfer.effectAllowed = 'move'; });
  tree.addEventListener('dragover', (e) => { if (!dragId) return; e.preventDefault(); const li = e.target.closest('li[data-id]'); tree.querySelectorAll('.drop-in,.drop-above,.drop-below').forEach((x) => x.classList.remove('drop-in', 'drop-above', 'drop-below')); if (!li) return; const r = li.getBoundingClientRect(), y = (e.clientY - r.top) / r.height; li.classList.add(li.dataset.id === 'root' ? 'drop-in' : y < 0.28 ? 'drop-above' : y > 0.72 ? 'drop-below' : 'drop-in'); });
  tree.addEventListener('dragend', () => { dragId = null; tree.querySelectorAll('.drop-in,.drop-above,.drop-below').forEach((x) => x.classList.remove('drop-in', 'drop-above', 'drop-below')); });
  tree.addEventListener('drop', (e) => {
    e.preventDefault(); const li = e.target.closest('li[data-id]'); if (!li || !dragId) return;
    const how = li.classList.contains('drop-above') ? 'above' : li.classList.contains('drop-below') ? 'below' : 'in';
    const target = li.dataset.id; const id = dragId; dragId = null;
    if (target === id || target.startsWith('sys:')) return;
    if (target !== 'root' && descendants(state.nodes, id).some((d) => d.id === target)) { toast('An object cannot go inside its own child.'); return; }
    reparent([id], how === 'in' ? (target === 'root' ? null : target) : nodeById(target).parent, how === 'in' ? null : { ref: target, how });
  });
  /** Move nodes under a new parent, keeping their place in the world. */
  function reparent(ids, parentId, order) {
    change((s) => {
      const pObj = parentId ? objects.get(parentId) : worldRoot;
      for (const id of ids) {
        const n = s.nodes.find((x) => x.id === id), o = objects.get(id); if (!n || !o) continue;
        pObj.attach(o); n.parent = parentId;
        n.pos = o.position.toArray().map((v) => +v.toFixed(3)); n.rot = [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(4)); n.scale = o.scale.toArray().map((v) => +v.toFixed(4));
        if (order) { const from = s.nodes.indexOf(n); s.nodes.splice(from, 1); let to = s.nodes.findIndex((x) => x.id === order.ref); if (order.how === 'below') to += 1 + descendants(s.nodes, order.ref).length; s.nodes.splice(to, 0, n); }
      }
    }, parentId ? 'Parent' : 'Unparent');
  }
  function rename(id) {
    const li = tree.querySelector(`li[data-id="${CSS.escape(id)}"] .tree-name`); if (!li) return;
    const n = nodeById(id); const input = document.createElement('input'); input.className = 'tree-rename'; input.value = n.name; input.maxLength = 60;
    li.replaceWith(input); input.focus(); input.select();
    const done = (ok) => { if (ok && input.value.trim()) change(() => { n.name = input.value.trim(); }, 'Rename'); else renderTree(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
    input.addEventListener('blur', () => done(true), { once: true });
  }
  const userSel = () => sel.filter((id) => !id.startsWith('sys:') && nodeById(id));
  function groupSel() {
    const ids = userSel(); if (!ids.length) { toast('Select objects to group (Ctrl-click or Shift-click in the scene list).'); return; }
    const g = newNode('group', { name: 'Group', parent: nodeById(ids[0]).parent });
    const box = new THREE.Box3(); ids.forEach((id) => box.expandByObject(objects.get(id))); const c = box.getCenter(new THREE.Vector3()); g.pos = [c.x, box.min.y, c.z].map((v) => +v.toFixed(3));
    state.nodes.splice(state.nodes.indexOf(nodeById(ids[0])), 0, g);
    syncNodes().then(() => { reparent(ids, g.id); requestAnimationFrame(() => requestAnimationFrame(() => select(g.id))); });
  }
  function ungroup() {
    const g = nodeById(sel[0]); if (!g || g.type !== 'group') { toast('Select a group to ungroup.'); return; }
    const kids = childrenOf(state.nodes, g.id).map((n) => n.id);
    reparent(kids, g.parent);
    requestAnimationFrame(() => requestAnimationFrame(() => change((s) => { s.nodes = s.nodes.filter((n) => n.id !== g.id); }, 'Ungroup')));
    select(kids);
  }
  function duplicateSel() {
    const ids = userSel(); if (!ids.length) return;
    const out = [];
    change((s) => {
      for (const id of ids) {
        const map = new Map(); const src = [nodeById(id), ...descendants(s.nodes, id)];
        for (const n of src) map.set(n.id, uid());
        const copies = src.map((n) => ({ ...JSON.parse(JSON.stringify(n)), id: map.get(n.id), parent: n.id === id ? n.parent : map.get(n.parent), name: n.id === id ? `${n.name} copy` : n.name }));
        copies[0].pos = [copies[0].pos[0] + 8, copies[0].pos[1], copies[0].pos[2] + 8];
        s.nodes.push(...copies); out.push(copies[0].id);
      }
    }, 'Duplicate');
    setTimeout(() => select(out), 80);
  }
  function deleteSel() {
    const ids = userSel(); if (!ids.length) return;
    const all = new Set(ids.flatMap((id) => [id, ...descendants(state.nodes, id).map((d) => d.id)]));
    select([]);
    change((s) => { s.nodes = s.nodes.filter((n) => !all.has(n.id)); }, `Delete ${all.size}`);
    toast(`${all.size} deleted. ${MOD} Z brings ${all.size > 1 ? 'them' : 'it'} back.`);
  }

  /* ── placing objects ── */
  function groundAtView() {
    const t = controls.target; const x = THREE.MathUtils.clamp(t.x, -SIZE / 2 + 5, SIZE / 2 - 5), z = THREE.MathUtils.clamp(t.z, -SIZE / 2 + 5, SIZE / 2 - 5);
    return [x, Math.max(heightAt(full, N, SIZE, x, z), state.water.on ? state.water.level : -1e9), z];
  }
  function addNode(type, extra = {}) {
    const n = newNode(type, extra);
    if (!extra.pos) { const g = groundAtView(); n.pos = [g[0], g[1] + (type === 'planet' || type === 'island' ? 60 : 0), g[2]]; }
    if (type === 'figure') n.scale = [6, 6, 6];
    change((s) => s.nodes.push(n), `Add ${n.name}`);
    setTimeout(() => { select(n.id); }, 120);
    return n;
  }
  function dropToGround() { for (const id of userSel()) { const n = nodeById(id); const o = objects.get(id); const w = o.getWorldPosition(new THREE.Vector3()); const y = heightAt(full, N, SIZE, w.x, w.z); if (!n.parent) n.pos[1] = +y.toFixed(3); } change(null, 'Drop to ground'); }
  async function importFile(file, kind) {
    if (!file) return;
    try {
      if (file.size > 60e6) throw new Error('Files up to 60 MB.');
      const id = uid('a');
      if (kind === 'image') {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        assets.set(id, { kind: 'image', name: file.name, data });
        addNode('image', { name: file.name.replace(/\.\w+$/, ''), asset: id, mat: { preset: 'plastic', color: '#ffffff', opacity: 0.85 } });
      } else {
        assets.set(id, { kind: 'model', name: file.name, data: await file.arrayBuffer() });
        addNode('model', { name: file.name.replace(/\.\w+$/, ''), asset: id });
      }
      toast(`${file.name} imported.`);
    } catch (e) { toast(e.message || 'This file could not be imported.'); }
  }
  async function importHeightmap(file) {
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file); const c = document.createElement('canvas'); c.width = Math.min(1024, bmp.width); c.height = Math.min(1024, bmp.height);
      const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data; const grey = new Uint8ClampedArray(c.width * c.height); for (let i = 0; i < grey.length; i++) grey[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      const id = uid('l'); live.set(id, fromGrey(grey, c.width, c.height, N, state.gen.height));
      change((s) => { s.layers.push({ id, name: file.name.replace(/\.\w+$/, ''), visible: true, opacity: 1, locked: false }); s.active = id; for (const l of s.layers) if (l.id === 'base') l.visible = false; }, 'Import heightmap', { terrain: true });
      toast('Heightmap imported as a new layer (the generated layer is hidden).');
    } catch { toast('This image could not be read.'); }
  }

  /* ── terrain operations ── */
  function erodeAll(kind) {
    setBusy(true, 'Eroding');
    setTimeout(() => {
      const L = live.get(state.active); const before = full.slice();
      if (kind === 'thermal') erodeThermal(full, N, { iterations: 25, talus: 0.7, cell: CELL }); else erodeHydraulic(full, N, { drops: 50000, seed: Math.floor(Math.random() * 1e5), strength: 1, cell: CELL });
      for (let k = 0; k < full.length; k++) L[k] += full[k] - before[k];
      updateTerrain(); scheduleScatter(true); commit(kind === 'thermal' ? 'Thermal erosion' : 'Hydraulic erosion', [state.active]); setBusy(false);
    }, 30);
  }
  function terrainOp(op) {
    const L = live.get(state.active);
    if (op === 'clear') L.fill(0);
    if (op === 'invert') { let lo = Infinity, hi2 = -Infinity; for (const v of full) { lo = Math.min(lo, v); hi2 = Math.max(hi2, v); } for (let k = 0; k < L.length; k++) L[k] -= 2 * (full[k] - (lo + hi2) / 2); }
    if (op === 'smooth') { for (let it = 0; it < 3; it++) { const src = full.slice(); for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) { const k = j * N + i; const d = (src[k - 1] + src[k + 1] + src[k - N] + src[k + N] + src[k] * 4) / 8 - src[k]; L[k] += d; full[k] += d; } } }
    recombine(); updateTerrain(); scheduleScatter(true); commit({ clear: 'Clear layer', invert: 'Invert terrain', smooth: 'Smooth terrain' }[op], [state.active]);
  }

  /* ── sculpting ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function terrainHit(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, half = SIZE / 2;
    // march along the ray over the heightfield, then refine
    let t = 0, prevT = 0; const step = CELL * 0.75, maxT = SIZE * 6;
    if (camera.isOrthographicCamera) t = -SIZE * 3;
    for (; t < maxT; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (Math.abs(x) < half && Math.abs(z) < half && y <= heightAt(full, N, SIZE, x, z)) {
        let a = prevT, b = t; for (let i = 0; i < 12; i++) { const m = (a + b) / 2; const xm = o.x + d.x * m, zm = o.z + d.z * m; if (o.y + d.y * m <= heightAt(full, N, SIZE, xm, zm)) b = m; else a = m; }
        return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      }
      prevT = t;
    }
    return null;
  }
  const cursor = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3)), new THREE.LineBasicMaterial({ color: '#c4ef2f', depthTest: false, transparent: true }));
  cursor.renderOrder = 20; cursor.visible = false; scene.add(cursor);
  const cursorInner = cursor.clone(); cursorInner.material = new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.5 }); cursorInner.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(96 * 3), 3)); scene.add(cursorInner);
  function placeCursor(p) {
    if (!p) { cursor.visible = cursorInner.visible = false; dirty = true; return; }
    const B = state.brush;
    for (const [line, r] of [[cursor, B.size], [cursorInner, B.size * (1 - B.softness)]]) {
      const a = line.geometry.attributes.position.array;
      for (let i = 0; i < 96; i++) { const ang = (i / 96) * Math.PI * 2; let k = 1; if (B.shape === 'square') k = 1 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))); if (B.shape === 'star') k = 0.55 + 0.45 * Math.abs(Math.cos(ang * 2.5)); const x = p.x + Math.cos(ang) * r * k, z = p.z + Math.sin(ang) * r * k; a[i * 3] = x; a[i * 3 + 1] = heightAt(full, N, SIZE, x, z) + 0.6; a[i * 3 + 2] = z; }
      line.geometry.attributes.position.needsUpdate = true; line.visible = true;
    }
    $('[data-sb-pos]', main).textContent = `x ${p.x.toFixed(0)} · z ${p.z.toFixed(0)} · height ${p.y.toFixed(1)} m`;
    dirty = true;
  }
  let stroke = null;
  const brushNoise = makeNoise(5);
  function sculptAt(p, e) {
    const L = live.get(state.active), layer = state.layers.find((l) => l.id === state.active);
    if (!L || layer.locked || layer.visible === false) { toast(layer?.locked ? 'This layer is locked.' : 'Show the active layer to sculpt on it.'); stroke = null; return; }
    const B = state.brush;
    let tool = B.tool; if (e.shiftKey) tool = { raise: 'lower', lower: 'raise', draw: 'lower', inflate: 'carve', carve: 'raise', detail: 'undetail', undetail: 'detail', push: 'pull', pull: 'push' }[tool] || tool;
    const pressure = B.pressure && e.pointerType === 'pen' ? Math.max(0.05, e.pressure || 0.5) : 1;
    const dir = stroke.last ? [p.x - stroke.last.x, p.z - stroke.last.z] : [0, 0]; const dl = Math.hypot(...dir) || 1;
    const s = { ...B, tool, pressure, dir: [dir[0] / dl, dir[1] / dl], target: stroke.target, size: B.size };
    // keep the scale of the layer opacity in mind: a dab moves the combined surface by d, the layer by d / opacity
    const op = layer.opacity || 1;
    const before = op !== 1 ? L.slice() : null;
    dab(L, full, N, SIZE, p.x, p.z, s, brushNoise);
    if (before) for (let k = 0; k < L.length; k++) if (L[k] !== before[k]) L[k] = before[k] + (L[k] - before[k]) / op;
    stroke.last = p; stroke.n++;
    terrainDirty = true;
  }
  let terrainDirty = false;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (mode !== 'sculpt' || e.button !== 0) return;
    const p = terrainHit(e); if (!p) return;
    e.preventDefault(); renderer.domElement.setPointerCapture(e.pointerId);
    stroke = { last: null, n: 0, target: p.y, spacing: Math.max(0.5, state.brush.size * 0.18) };
    sculptAt(p, e);
  }, sig);
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (mode !== 'sculpt') return;
    const p = terrainHit(e); placeCursor(p);
    if (!stroke || !p) return;
    const d = stroke.last ? Math.hypot(p.x - stroke.last.x, p.z - stroke.last.z) : 1e9;
    if (d >= stroke.spacing) { const steps = Math.min(8, Math.floor(d / stroke.spacing)); const from = stroke.last; for (let i = 1; i <= steps; i++) sculptAt(from ? from.clone().lerp(p, i / steps) : p, e); }
  }, sig);
  const endStroke = () => { if (!stroke) return; stroke = null; updateTerrain(); scheduleScatter(true); commit(`Sculpt: ${state.brush.tool}`, [state.active]); };
  renderer.domElement.addEventListener('pointerup', endStroke, sig);
  renderer.domElement.addEventListener('pointercancel', endStroke, sig);
  renderer.domElement.addEventListener('pointerleave', () => { if (mode === 'sculpt' && !stroke) placeCursor(null); }, sig);

  /* ── selecting in the viewport ── */
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; }, sig);
  renderer.domElement.addEventListener('click', (e) => {
    if (mode !== 'select' || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || tc.dragging) return;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...objects.values()].filter((o) => o.visible), true);
    let o = hits[0]?.object; while (o && !o.userData.node) o = o.parent;
    // pick the outermost unlocked group, like most 3D apps (Alt picks the part itself)
    if (o && !e.altKey) { let up = o; while (up.parent && up.parent.userData.node) up = up.parent; o = up; }
    if (o) { select(o.userData.node, { add: e.ctrlKey || e.metaKey || e.shiftKey }); return; }
    if (terrainHit(e)) { select('sys:terrain'); return; }
    select([]);
  }, sig);
  renderer.domElement.addEventListener('contextmenu', (e) => { e.preventDefault(); if (mode === 'sculpt') return; viewportMenu(e.clientX, e.clientY); }, sig);

  /* ── modes, camera ── */
  function setMode(m) {
    mode = m;
    $$('[data-mode]', main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    controls.mouseButtons = m === 'sculpt' ? { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE } : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = m === 'sculpt' ? { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    $('[data-walkpad]', main).hidden = m !== 'fly';
    if (m !== 'sculpt') placeCursor(null);
    if (m === 'fly') { const dir = new THREE.Vector3(); camera.getWorldDirection(dir); controls.target.copy(camera.position).addScaledVector(dir, 1); controls.minDistance = 0.01; controls.maxDistance = 2; toast('Fly: W A S D to move, E / C up and down, drag to look. Esc leaves.'); }
    else { controls.minDistance = 0.5; controls.maxDistance = SIZE * 4; if (controls.target.distanceTo(camera.position) < 3) { const dir = new THREE.Vector3(); camera.getWorldDirection(dir); controls.target.copy(camera.position).addScaledVector(dir, 80); } }
    select(sel);
    $('[data-sb-hint]', main).textContent = { select: 'Click to select · drag to orbit · right-drag to pan', sculpt: 'Drag to sculpt · Shift inverts · right-drag to orbit · [ ] size', fly: 'W A S D · E / C · drag to look' }[m];
    if (m === 'sculpt' && section !== 'sculpting') openSection('sculpting');
  }
  $$('[data-mode]', main).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $$('[data-tm]', main).forEach((b) => b.addEventListener('click', () => setTM(b.dataset.tm)));
  function setTM(m) { tc.setMode(m); $$('[data-tm]', main).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tm === m))); }
  function setOrtho(on) {
    const from = camera; camera = on ? ortho : persp;
    if (on) { const d = persp.position.distanceTo(controls.target); const a = stage.clientWidth / stage.clientHeight; const h = d * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)); Object.assign(ortho, { left: -h * a, right: h * a, top: h, bottom: -h }); ortho.zoom = 1; ortho.updateProjectionMatrix(); }
    camera.position.copy(from.position); camera.quaternion.copy(from.quaternion);
    controls.object = camera; tc.camera = camera; composer = null; fx = {}; setupEffects();
    state.camera.mode = on ? 'ortho' : 'persp';
    $('[data-act=ortho]', main).setAttribute('aria-pressed', String(on)); resize();
  }
  const CAMS = { hero: [[0.55, 0.32, 0.62], [0, 0.05, 0]], bird: [[0.05, 1.05, 0.35], [0, 0, 0]], ground: [[0.42, 0.06, 0.42], [0, 0.04, 0]], top: [[0.0001, 1.4, 0], [0, 0, 0]], front: [[0, 0.2, 0.9], [0, 0.05, 0]], side: [[0.9, 0.2, 0], [0, 0.05, 0]], wide: [[1.1, 0.55, 1.1], [0, 0, 0]] };
  function setCam(k) {
    const [p, t] = CAMS[k]; const to = new THREE.Vector3(...p).multiplyScalar(SIZE), tt = new THREE.Vector3(...t).multiplyScalar(SIZE);
    if (k === 'ground') to.y = Math.max(to.y, heightAt(full, N, SIZE, to.x, to.z) + 6);
    animateCam(to, tt);
  }
  function animateCam(to, tt, ms = 700) {
    const from = camera.position.clone(), ft = controls.target.clone(), t0 = performance.now();
    if (reducedMotion()) { camera.position.copy(to); controls.target.copy(tt); dirty = true; return; }
    const step = (now) => { const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3; camera.position.lerpVectors(from, to, e); controls.target.lerpVectors(ft, tt, e); dirty = true; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function frameSel() {
    const box = new THREE.Box3();
    for (const id of sel) { if (id === 'sys:terrain' || id.startsWith('sys:')) box.expandByObject(terrain); else if (objects.get(id)) box.expandByObject(objects.get(id)); }
    if (box.isEmpty()) box.expandByObject(terrain);
    const c = box.getCenter(new THREE.Vector3()), r = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    const dir = camera.position.clone().sub(controls.target).normalize();
    animateCam(c.clone().addScaledVector(dir, r * 2.6), c);
  }

  /* ── post effects (AO, depth of field) ── */
  let composer = null, fx = {};
  async function setupEffects() {
    const want = { ao: state.render.ao, dof: state.render.dof };
    if (composer && fx.ao === want.ao && fx.dof === want.dof) { if (fx.bokeh) { fx.bokeh.uniforms.focus.value = state.render.focus; fx.bokeh.uniforms.aperture.value = state.render.aperture * 0.00006; } return; }
    composer?.dispose(); composer = null; fx = { ...want };
    if (!want.ao && !want.dof) return;
    try {
      const [{ EffectComposer }, { RenderPass }, { OutputPass }] = await Promise.all([import('three/examples/jsm/postprocessing/EffectComposer.js'), import('three/examples/jsm/postprocessing/RenderPass.js'), import('three/examples/jsm/postprocessing/OutputPass.js')]);
      const s = renderer.getSize(new THREE.Vector2()); const c = new EffectComposer(renderer); c.addPass(new RenderPass(scene, camera));
      if (want.ao) { const { GTAOPass } = await import('three/examples/jsm/postprocessing/GTAOPass.js'); const g = new GTAOPass(scene, camera, s.x, s.y); g.updateGtaoMaterial({ radius: 6, distanceFallOff: 1, thickness: 4 }); c.addPass(g); }
      if (want.dof) { const { BokehPass } = await import('three/examples/jsm/postprocessing/BokehPass.js'); fx.bokeh = new BokehPass(scene, camera, { focus: state.render.focus, aperture: state.render.aperture * 0.00006, maxblur: 0.012 }); c.addPass(fx.bokeh); }
      c.addPass(new OutputPass()); c.setPixelRatio(renderer.getPixelRatio()); c.setSize(s.x, s.y);
      if (state.render.ao !== want.ao || state.render.dof !== want.dof) { c.dispose(); return; }
      composer = c;
    } catch (e) { console.error(e); toast('Effects are not supported on this device.'); }
    dirty = true;
  }

  /* ── loop ── */
  let dirty = true, raf = 0, last = performance.now(), animate = true;
  const flyKeys = new Set();
  let play = null;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (terrainDirty) { terrainDirty = false; const p = tGeo.attributes.position.array; for (let k = 0; k < N * N; k++) p[k * 3 + 1] = full[k]; tGeo.attributes.position.needsUpdate = true; tGeo.computeVertexNormals(); paintTerrain(); env.sun.shadow.needsUpdate = true; dirty = true; }
    let moved = controls.update(dt);
    if (mode === 'fly' && flyKeys.size) {
      const f = new THREE.Vector3(); camera.getWorldDirection(f); const r = new THREE.Vector3().crossVectors(f, camera.up).normalize(); const v = new THREE.Vector3();
      if (flyKeys.has('f')) v.add(f); if (flyKeys.has('b')) v.sub(f); if (flyKeys.has('r')) v.add(r); if (flyKeys.has('l')) v.sub(r); if (flyKeys.has('u')) v.y += 1; if (flyKeys.has('d')) v.y -= 1;
      v.normalize().multiplyScalar(SIZE * 0.12 * dt * (flyKeys.has('fast') ? 3 : 1));
      camera.position.add(v); controls.target.add(v);
      const g = heightAt(full, N, SIZE, camera.position.x, camera.position.z) + 1.5; if (camera.position.y < g) { const k = g - camera.position.y; camera.position.y += k; controls.target.y += k; }
      moved = true;
    }
    if (play) moved = playTick(now) || moved;
    const anim = env.tick(animate && !document.hidden);
    if (anim) dirty = true;
    if (!moved && !dirty) return;
    dirty = false;
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
    if (camera === ortho) { const hh = (ortho.top - ortho.bottom) / 2; ortho.left = -hh * w / h; ortho.right = hh * w / h; ortho.updateProjectionMatrix(); }
    composer?.setSize(w, h); dirty = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  controls.addEventListener('change', () => { dirty = true; });

  /* ── timeline (camera keyframes) ── */
  function addKey(t) { change((s) => { s.camera.keys = s.camera.keys.filter((k) => Math.abs(k.t - t) > 0.05); s.camera.keys.push({ t: +t.toFixed(2), pos: camera.position.toArray().map((v) => +v.toFixed(2)), target: controls.target.toArray().map((v) => +v.toFixed(2)) }); s.camera.keys.sort((a, b) => a.t - b.t); }, 'Camera key'); }
  function camAt(t) {
    const K = state.camera.keys; if (!K.length) return null;
    if (K.length === 1 || t <= K[0].t) return K[0]; if (t >= K[K.length - 1].t) return K[K.length - 1];
    const pts = (k) => K.map((x) => new THREE.Vector3(...x[k]));
    const i = K.findIndex((k) => k.t > t) - 1, u = (t - K[i].t) / (K[i + 1].t - K[i].t);
    const s = (i + u) / (K.length - 1);
    const cp = new THREE.CatmullRomCurve3(pts('pos'), false, 'centripetal'), ct = new THREE.CatmullRomCurve3(pts('target'), false, 'centripetal');
    return { pos: cp.getPoint(s).toArray(), target: ct.getPoint(s).toArray() };
  }
  let playT = 0;
  function playTick(now) {
    playT = (now - play.start) / 1000;
    if (playT > state.camera.duration) { if (play.loop) { play.start = now; playT = 0; } else { stopPlay(); return false; } }
    const c = camAt(playT); if (c) { camera.position.fromArray(c.pos); controls.target.fromArray(c.target); camera.lookAt(controls.target); }
    const sc = $('[data-scrub]', main); if (sc) sc.value = playT;
    return true;
  }
  function startPlay(loop = false) { if (state.camera.keys.length < 2) { toast('Add at least two camera keys first.'); return; } play = { start: performance.now() - playT * 1000, loop }; renderDock(); }
  function stopPlay() { play = null; renderDock(); }

  /* ── panels ── */
  const left = $('[data-left]', main), props = $('[data-props]', main), dockBody = $('[data-dock-body]', main);
  function openSection(k) { if (!k) return; section = k; $$('[data-sec]', main).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sec === k))); $('[data-sec-title]', main).textContent = SECTIONS.find(([x]) => x === k)[1]; renderLeft(); if (k === 'sculpting' && mode !== 'sculpt') setMode('sculpt'); else if (k !== 'sculpting' && mode === 'sculpt') setMode('select'); }
  $$('[data-sec]', main).forEach((b, i, all) => { b.addEventListener('click', () => openSection(b.dataset.sec)); b.addEventListener('keydown', (e) => { const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); const n = all[(i + d + all.length) % all.length]; n.focus(); openSection(n.dataset.sec); } }); });
  const ctx = {
    get state() { return state; }, get sel() { return sel; }, get mode() { return mode; }, live, assets, objects, nodeById, userSel,
    change, commit, regenerateBase, erodeAll, terrainOp, addNode, dropToGround, importFile, importHeightmap, select, frameSel, setCam, setOrtho, setMode, groupSel, ungroup, duplicateSel, deleteSel, reparent,
    newWorld, saveProject, exportFile, render: renderImage, rebuildScatter: () => rebuildScatter(true), renderLeft: () => renderLeft(), openSection,
    get camera() { return camera; }, get controls() { return controls; }, get projects() { return db.all('worlds'); }, loadProject, deleteProject: (id) => db.del('worlds', id),
  };
  function renderLeft() { const st = left.parentElement.scrollTop; left.innerHTML = ''; renderSection(section, ctx, left); left.parentElement.scrollTop = st; }
  let propsTimer = 0;
  function renderProps(soft) { if (soft) { clearTimeout(propsTimer); propsTimer = setTimeout(() => renderProps(), 120); return; } if (props.contains(document.activeElement) && document.activeElement.matches('input[type=text]')) return; props.innerHTML = ''; renderProperties(ctx, props); }
  function renderDock() {
    $$('[data-dock]', main).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.dock === dockTab)));
    const K = state.camera.keys, L = state.layers;
    if (dockTab === 'timeline') {
      dockBody.innerHTML = `<div class="tl">
        <div class="btn-row"><button type="button" class="btn" data-tl="key">+ Camera key</button><button type="button" class="btn" data-tl="play">${play ? 'Stop' : 'Play'}</button><button type="button" class="btn" data-tl="loop">Loop</button><button type="button" class="btn" data-tl="clear" ${K.length ? '' : 'disabled'}>Clear keys</button>
        <label class="tl-dur">Length <input type="number" min="1" max="120" step="1" value="${state.camera.duration}" data-tl-dur> s</label></div>
        <div class="tl-track"><input type="range" min="0" max="${state.camera.duration}" step="0.01" value="${playT}" data-scrub aria-label="Time">
        ${K.map((k, i) => `<button type="button" class="tl-key" style="left:${(k.t / state.camera.duration) * 100}%" data-key-i="${i}" aria-label="Camera key at ${k.t} s" data-tip="${k.t} s — click to jump, right-click to delete"></button>`).join('')}</div>
        <p class="muted tl-help">Move the camera, set the time, add a key. ${K.length} key${K.length === 1 ? '' : 's'}.</p></div>`;
      dockBody.querySelector('[data-tl=key]').onclick = () => addKey(+$('[data-scrub]', dockBody).value);
      dockBody.querySelector('[data-tl=play]').onclick = () => (play ? stopPlay() : startPlay(false));
      dockBody.querySelector('[data-tl=loop]').onclick = () => startPlay(true);
      dockBody.querySelector('[data-tl=clear]').onclick = () => change((s) => { s.camera.keys = []; }, 'Clear camera keys');
      $('[data-tl-dur]', dockBody).onchange = (e) => change((s) => { s.camera.duration = Math.min(120, Math.max(1, Number(e.target.value) || 8)); }, 'Timeline length');
      $('[data-scrub]', dockBody).oninput = (e) => { playT = +e.target.value; const c = camAt(playT); if (c) { camera.position.fromArray(c.pos); controls.target.fromArray(c.target); dirty = true; } };
      $$('[data-key-i]', dockBody).forEach((b) => { b.onclick = () => { const k = K[+b.dataset.keyI]; playT = k.t; animateCam(new THREE.Vector3(...k.pos), new THREE.Vector3(...k.target), 400); $('[data-scrub]', dockBody).value = k.t; }; b.oncontextmenu = (e) => { e.preventDefault(); change((s) => { s.camera.keys.splice(+b.dataset.keyI, 1); }, 'Delete camera key'); }; });
    }
    if (dockTab === 'layers') {
      dockBody.innerHTML = `<div class="layers"><div class="btn-row"><button type="button" class="btn" data-ly="add">+ Layer</button><button type="button" class="btn" data-ly="merge">Merge down</button></div>
        <ul class="layer-list">${[...L].reverse().map((l) => `<li aria-selected="${l.id === state.active}" data-lid="${esc(l.id)}">
          <button type="button" class="tree-btn" data-lyv="${esc(l.id)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${esc(l.name)}" aria-pressed="${l.visible}">${l.visible ? '●' : '◌'}</button>
          <button type="button" class="tree-btn" data-lyl="${esc(l.id)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${esc(l.name)}" aria-pressed="${l.locked}">${l.locked ? '🔒︎' : '○'}</button>
          <input type="text" value="${esc(l.name)}" maxlength="40" aria-label="Layer name" data-lyn="${esc(l.id)}">
          <input type="range" min="0" max="2" step="0.01" value="${l.opacity}" aria-label="Strength of ${esc(l.name)}" data-lyo="${esc(l.id)}">
          <button type="button" class="tree-btn" data-lyu="${esc(l.id)}" aria-label="Move up">↑</button><button type="button" class="tree-btn" data-lyd="${esc(l.id)}" aria-label="Move down">↓</button>
          <button type="button" class="tree-btn" data-lyx="${esc(l.id)}" aria-label="Delete ${esc(l.name)}" ${L.length < 2 ? 'disabled' : ''}>×</button></li>`).join('')}</ul>
        <p class="muted tl-help">Sculpting goes into the highlighted layer. Strength 0–2 mixes a layer in or exaggerates it.</p></div>`;
      const byId = (id) => state.layers.find((l) => l.id === id);
      $('[data-ly=add]', dockBody).onclick = () => { const id = uid('l'); live.set(id, new Float32Array(N * N)); change((s) => { s.layers.push({ id, name: `Layer ${s.layers.length + 1}`, visible: true, opacity: 1, locked: false }); s.active = id; }, 'Add layer', { terrain: true }); };
      $('[data-ly=merge]', dockBody).onclick = () => { const i = state.layers.findIndex((l) => l.id === state.active); if (i < 1) { toast('Select a layer above another to merge it down.'); return; } const a = state.layers[i], b = state.layers[i - 1]; const A = live.get(a.id), Bd = live.get(b.id); for (let k = 0; k < A.length; k++) Bd[k] = Bd[k] * b.opacity + A[k] * a.opacity * (a.visible ? 1 : 0); live.delete(a.id); change((s) => { s.layers.splice(i, 1); s.layers[i - 1].opacity = 1; s.active = b.id; }, 'Merge layers', { terrain: true }); };
      $$('[data-lid]', dockBody).forEach((li) => li.addEventListener('click', (e) => { if (e.target.closest('button,input')) return; change((s) => { s.active = li.dataset.lid; }, 'Active layer'); }));
      $$('[data-lyv]', dockBody).forEach((b) => { b.onclick = () => change(() => { const l = byId(b.dataset.lyv); l.visible = !l.visible; }, 'Layer visibility', { terrain: true }); });
      $$('[data-lyl]', dockBody).forEach((b) => { b.onclick = () => change(() => { const l = byId(b.dataset.lyl); l.locked = !l.locked; }, 'Lock layer'); });
      $$('[data-lyn]', dockBody).forEach((i) => { i.onchange = () => change(() => { byId(i.dataset.lyn).name = i.value.trim() || 'Layer'; }, 'Rename layer'); });
      $$('[data-lyo]', dockBody).forEach((i) => { i.oninput = () => change(() => { byId(i.dataset.lyo).opacity = +i.value; }, 'Layer strength', { terrain: true }); });
      const move = (id, d) => change((s) => { const i = s.layers.findIndex((l) => l.id === id), j = i + d; if (j < 0 || j >= s.layers.length) return; [s.layers[i], s.layers[j]] = [s.layers[j], s.layers[i]]; }, 'Reorder layers');
      $$('[data-lyu]', dockBody).forEach((b) => { b.onclick = () => move(b.dataset.lyu, 1); });
      $$('[data-lyd]', dockBody).forEach((b) => { b.onclick = () => move(b.dataset.lyd, -1); });
      $$('[data-lyx]', dockBody).forEach((b) => { b.onclick = () => { const id = b.dataset.lyx; change((s) => { s.layers = s.layers.filter((l) => l.id !== id); if (s.active === id) s.active = s.layers[s.layers.length - 1].id; }, 'Delete layer', { terrain: true }); }; });
    }
    if (dockTab === 'history') {
      dockBody.innerHTML = `<ol class="hist">${hist.map((h, i) => `<li><button type="button" data-hi="${i}" aria-current="${i === hi}" class="${i > hi ? 'is-future' : ''}">${esc(h.label)}</button></li>`).join('')}</ol>`;
      $$('[data-hi]', dockBody).forEach((b) => { b.onclick = () => goTo(+b.dataset.hi); });
      dockBody.querySelector('[aria-current=true]')?.scrollIntoView({ block: 'nearest' });
    }
  }
  $$('[data-dock]', main).forEach((b) => b.addEventListener('click', () => { dockTab = b.dataset.dock; renderDock(); }));

  /* ── toolbar, menu, shortcuts ── */
  const actions = {
    undo: () => goTo(hi - 1), redo: () => goTo(hi + 1), frame: frameSel, ortho: () => setOrtho(camera !== ortho),
    anim: () => { animate = !animate; $('[data-act=anim]', main).setAttribute('aria-pressed', String(animate)); dirty = true; },
    shot: () => renderImage(state.render.res || '1920x1080'), menu: () => { const r = $('[data-act=menu]', main).getBoundingClientRect(); viewportMenu(r.right - 240, r.bottom + 6); },
    keys: () => showShortcuts([[`${MOD} · Z`, 'Undo'], [`${MOD} · Shift · Z`, 'Redo'], [`${MOD} · S`, 'Save project'], ['V · B · Q', 'Select · sculpt · fly'], ['W · E · R', 'Move · rotate · scale'], ['[ · ]', 'Brush smaller / bigger'], ['Shift (sculpt)', 'Invert the brush'], ['F', 'Frame selection'], ['O', 'Orthographic camera'], ['1 – 7', 'Camera: hero, bird, ground, top, front, side, wide'], [`${MOD} · G`, 'Group'], [`${MOD} · Shift · G`, 'Ungroup'], [`${MOD} · D`, 'Duplicate'], ['Del', 'Delete'], ['F2 / double-click', 'Rename'], ['K', 'Camera key'], ['Space', 'Animate water & sky'], ['P', 'Render PNG'], ['?', 'This list']]),
    save: () => saveProject(), group: groupSel, dup: duplicateSel, del: deleteSel,
  };
  $$('[data-act]', main).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]?.()));
  function viewportMenu(x, y) {
    const u = userSel().length;
    showMenu([
      { label: 'Undo', hint: `${MOD} Z`, action: actions.undo, disabled: hi <= 0 }, { label: 'Redo', hint: `${MOD} ⇧ Z`, action: actions.redo, disabled: hi >= hist.length - 1 }, '-',
      { label: 'Duplicate', hint: `${MOD} D`, action: duplicateSel, disabled: !u }, { label: 'Delete', hint: 'Del', action: deleteSel, disabled: !u }, { label: 'Group', hint: `${MOD} G`, action: groupSel, disabled: !u }, { label: 'Ungroup', hint: `${MOD} ⇧ G`, action: ungroup, disabled: nodeById(sel[0])?.type !== 'group' }, { label: 'Drop to ground', action: dropToGround, disabled: !u }, '-',
      ...Object.keys(CAMS).map((k, i) => ({ label: `Camera: ${k}`, hint: String(i + 1), action: () => setCam(k) })), { label: 'Orthographic', hint: 'O', checked: camera === ortho, action: actions.ortho }, { label: 'Frame selection', hint: 'F', action: frameSel }, '-',
      { label: 'Render PNG', hint: 'P', action: actions.shot }, { label: 'Keyboard shortcuts', hint: '?', action: actions.keys },
    ], { x, y, label: 'World' });
  }
  const FLY = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', e: 'u', c: 'd', shift: 'fast' };
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.closest?.('input[type=text], input[type=number], input[type=search], input:not([type]), textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? actions.redo() : actions.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); actions.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); saveProject(); return; }
    if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : groupSel(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && k === 'a') { e.preventDefault(); select(state.nodes.filter((n) => !n.parent).map((n) => n.id)); return; }
    if (mod || e.altKey) return;
    if (mode === 'fly' && FLY[k]) { e.preventDefault(); flyKeys.add(FLY[k]); return; }
    if (t.closest?.('input[type=range]') && (k.startsWith('arrow') || /^\d$/.test(k))) return;
    if (k === 'escape') { if (mode !== 'select') setMode('select'); else select([]); return; }
    if (k === 'v') setMode('select'); else if (k === 'b') setMode('sculpt'); else if (k === 'q') setMode(mode === 'fly' ? 'select' : 'fly');
    else if (k === 'f') frameSel(); else if (k === 'o') actions.ortho(); else if (k === 'p') actions.shot(); else if (k === '?') actions.keys();
    else if (k === ' ') { e.preventDefault(); actions.anim(); }
    else if (k === 'k') addKey(+($('[data-scrub]', main)?.value || 0));
    else if (/^[1-7]$/.test(k)) setCam(Object.keys(CAMS)[Number(k) - 1]);
    else if (k === '[' || k === ']') { change((s) => { s.brush.size = Math.max(1, Math.min(200, Math.round(s.brush.size * (k === ']' ? 1.15 : 0.87)))); }, 'Brush size'); if (section === 'sculpting') renderLeft(); }
    else if (mode === 'select' && sel.length && (k === 'w' || k === 'e' || k === 'r')) setTM({ w: 'translate', e: 'rotate', r: 'scale' }[k]);
    else if ((k === 'delete' || k === 'backspace') && userSel().length) { e.preventDefault(); deleteSel(); }
  }, sig);
  document.addEventListener('keyup', (e) => { const f = FLY[e.key.toLowerCase()]; if (f) flyKeys.delete(f); }, sig);
  for (const b of $$('[data-walk]', main)) { const k = b.dataset.walk; b.addEventListener('pointerdown', (e) => { e.preventDefault(); flyKeys.add(k); }, sig); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => flyKeys.delete(k), sig); }

  /* ── status ── */
  function setBusy(on, text = 'Working') { $('[data-busy]', main).hidden = !on; $('[data-busy-text]', main).textContent = text; }
  function setStatus(s, text) { const el = $('[data-sb-state]', main); el.dataset.state = s; $('span', el).textContent = text || (s === 'ready' ? 'Ready' : s); }
  function updateStats() { let tris = 0; scene.traverse((x) => { if (x.isMesh && x.visible && x.geometry?.attributes.position) tris += ((x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3) * (x.isInstancedMesh ? x.count : 1); }); $('[data-sb-tris]', main).textContent = `${(tris / 1000).toFixed(0)}k tris · ${state.nodes.length} objects`; }

  /* ── projects: save, load, autosave, files ── */
  const projectRecord = (id, name) => ({ id, name, date: new Date().toISOString(), state: JSON.parse(JSON.stringify(state)), layers: state.layers.map((l) => ({ id: l.id, data: live.get(l.id) })), assets: [...assets.entries()] });
  let currentId = null, changedSince = false;
  async function saveProject(asNew = false) {
    const name = state.name || 'World';
    if (!currentId || asNew) currentId = uid('w');
    const rec = projectRecord(currentId, name); rec.thumb = shotCanvas(320, 200).toDataURL('image/jpeg', 0.8);
    const ok = await db.put('worlds', currentId, rec);
    toast(ok ? `“${name}” saved.` : 'Saved for this visit only (storage is blocked in this browser).');
    changedSince = false; if (section === 'export') renderLeft();
  }
  async function loadProject(rec) {
    try {
      state = sanitize(rec.state);
      live.clear(); for (const l of rec.layers || []) if (l.data?.length === N * N) live.set(l.id, l.data instanceof Float32Array ? l.data.slice() : new Float32Array(l.data));
      for (const l of state.layers) if (!live.has(l.id)) live.set(l.id, new Float32Array(N * N));
      assets.clear(); for (const [k, v] of rec.assets || []) assets.set(k, v);
      currentId = rec.id && rec.id !== 'autosave' ? rec.id : null;
      for (const o of objects.values()) { o.removeFromParent(); disposeObj(o); } objects.clear(); nodeKeys.clear();
      sel = []; hist.length = 0; hi = -1;
      applyAll({ terrainToo: true }); rebuildScatter(true); commit('Open world', 'all'); renderLeft(); renderProps(); renderDock();
      setStatus('ready', `Opened “${state.name || 'World'}”`);
      return true;
    } catch (e) { console.error(e); toast('This world could not be opened.'); return false; }
  }
  async function autosave() { if (!changedSince) return; changedSince = false; await db.put('worlds', 'autosave', { ...projectRecord('autosave', state.name || 'World'), autosave: true }); }
  const autoTimer = setInterval(autosave, 20000);
  function newWorld(type, seed = Math.floor(Math.random() * 99999)) {
    for (const o of objects.values()) { o.removeFromParent(); disposeObj(o); } objects.clear(); nodeKeys.clear();
    state = worldState(type, seed); live.clear(); live.set('sculpt', new Float32Array(N * N)); sel = []; currentId = null;
    regenerateBase(); applyAll(); rebuildScatter(true); commit(`New world: ${WORLDS[type].label}`, 'all'); renderLeft(); renderProps(); setCam('hero');
  }
  async function exportFile(kind) {
    setBusy(true, 'Exporting');
    try {
      const base = (state.name || 'world').replace(/\W+/g, '-').toLowerCase();
      if (kind === 'project') {
        const data = { app: 'triad-world', v: 1, state, layers: state.layers.map((l) => ({ id: l.id, b64: f32ToB64(live.get(l.id)) })), assets: [...assets.entries()].map(([k, v]) => [k, { ...v, data: v.data instanceof ArrayBuffer ? `bin:${bytesToB64(v.data)}` : v.data }]) };
        download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${base}.triadworld.json`);
      }
      if (kind === 'glb' || kind === 'gltf') {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        const out = new THREE.Group(); out.name = state.name || 'World';
        const t = terrain.clone(); t.material = tMat; out.add(t);
        if (state.water.on) { const w = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ color: state.water.color, transparent: true, opacity: state.water.opacity, roughness: 0.05 })); w.rotation.x = -Math.PI / 2; w.position.y = state.water.level; w.name = 'Water'; out.add(w); }
        const objs = new THREE.Group(); objs.name = 'Objects'; for (const n of childrenOf(state.nodes, null)) objs.add(objects.get(n.id).clone(true)); out.add(objs);
        if (!state.hidden.scatter) out.add(scatterGroup.clone(true));
        const res = await new GLTFExporter().parseAsync(out, { binary: kind === 'glb' });
        download(new Blob([kind === 'glb' ? res : JSON.stringify(res)], { type: kind === 'glb' ? 'model/gltf-binary' : 'model/gltf+json' }), `${base}.${kind}`);
      }
      if (kind === 'obj') {
        const { partsToOBJ } = await import('../lib/obj.js');
        const parts = [{ geometry: tGeo }]; const { obj, mtl } = partsToOBJ(parts, { looks: [{ color: state.pal.mid, roughness: 0.9, metalness: 0 }], name: `${base}-terrain` });
        const { zipSync, strToU8 } = await import('three/examples/jsm/libs/fflate.module.js');
        download(new Blob([zipSync({ [`${base}-terrain.obj`]: strToU8(obj), [`${base}-terrain.mtl`]: strToU8(mtl) })], { type: 'application/zip' }), `${base}-terrain-obj.zip`);
      }
      if (kind === 'heightmap') {
        const { grey, lo, hi: top } = toGrey(full); const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); const img = x.createImageData(N, N);
        for (let k = 0; k < grey.length; k++) img.data.set([grey[k], grey[k], grey[k], 255], k * 4); x.putImageData(img, 0, 0);
        c.toBlob((b) => download(b, `${base}-heightmap.png`)); toast(`Heightmap ${N} × ${N}, ${lo.toFixed(0)} – ${top.toFixed(0)} m.`);
      }
      if (kind === 'texture') { const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); const img = x.createImageData(N, N); const col = tGeo.attributes.color.array; for (let k = 0; k < N * N; k++) img.data.set([col[k * 3] * 255, col[k * 3 + 1] * 255, col[k * 3 + 2] * 255, 255], k * 4); x.putImageData(img, 0, 0); c.toBlob((b) => download(b, `${base}-terrain-colour.png`)); }
    } catch (e) { console.error(e); toast('The export failed.'); }
    setBusy(false);
  }
  async function importProject(file) {
    try {
      const d = JSON.parse(await file.text()); if (d.app !== 'triad-world') throw new Error();
      const layers = (d.layers || []).map((l) => ({ id: l.id, data: b64ToF32(l.b64) }));
      const as = (d.assets || []).filter((a) => Array.isArray(a) && a[1] && typeof a[1].data === 'string').map(([k, v]) => [String(k).slice(0, 60), { kind: v.kind === 'image' ? 'image' : 'model', name: String(v.name || 'file').slice(0, 120), data: v.data.startsWith('bin:') ? b64ToBytes(v.data.slice(4)) : /^data:image\//.test(v.data) ? v.data : '' }]);
      await loadProject({ state: d.state, layers, assets: as }); toast('World opened.');
    } catch { toast('This file is not a TRIAD world.'); }
  }
  ctx.importProject = importProject;
  function shotCanvas(w, h) {
    const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), aspect = persp.aspect;
    const hide = [tc.getHelper(), cursor, cursorInner]; const vis = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
    if (camera === ortho) { const hh = (ortho.top - ortho.bottom) / 2; ortho.left = -hh * w / h; ortho.right = hh * w / h; ortho.updateProjectionMatrix(); }
    composer?.setPixelRatio(1); composer?.setSize(w, h);
    if (composer) composer.render(); else renderer.render(scene, camera);
    const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h);
    renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); persp.aspect = aspect; persp.updateProjectionMatrix(); composer?.setPixelRatio(pr); composer?.setSize(size.x, size.y); resize();
    hide.forEach((o, i) => { o.visible = vis[i]; }); dirty = true;
    return out;
  }
  function renderImage(res) {
    let [w, h] = String(res).split('x').map(Number); if (!w || !h) [w, h] = [1920, 1080];
    const max = renderer.capabilities.maxTextureSize || 4096; const f = Math.min(1, max / Math.max(w, h)); w = Math.round(w * f); h = Math.round(h * f);
    setBusy(true, 'Rendering');
    requestAnimationFrame(() => { try { shotCanvas(w, h).toBlob((b) => { setBusy(false); if (b) { download(b, `${(state.name || 'world').replace(/\W+/g, '-').toLowerCase()}-${w}x${h}.png`); toast(`Rendered ${w} × ${h}.`); } }, 'image/png'); } catch (e) { console.error(e); setBusy(false); toast('The render failed.'); } });
  }

  /* ── start ── */
  try {
    const auto = await db.get('worlds', 'autosave');
    if (!(auto && await loadProject(auto))) newWorld('mountains', 7);
    else toast('Your last session was restored (autosave).');
    renderTree(); renderLeft(); renderProps(); renderDock(); setMode('select'); resize();
    if (!auto) setCam('hero');
    else { persp.position.set(SIZE * 0.55, SIZE * 0.32, SIZE * 0.62); controls.target.set(0, SIZE * 0.05, 0); }
    raf = requestAnimationFrame(loop);
  } catch (e) { console.error(e); setStatus('error', 'The world could not start'); }

  return {
    destroy() {
      autosave(); clearInterval(autoTimer); cancelAnimationFrame(raf); cancelAnimationFrame(raf1); clearTimeout(scatterTimer); closeMenu();
      ac.abort(); ro.disconnect(); tc.detach(); tc.dispose(); controls.dispose(); composer?.dispose();
      for (const o of objects.values()) disposeObj(o);
      scatterGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      tGeo.dispose(); tMat.dispose(); cursor.geometry.dispose(); cursorInner.geometry.dispose(); env.dispose(); envTex.dispose();
      renderer.shadowMap.enabled = prevShadow; renderer.toneMappingExposure = 1.05; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.remove(); renderer.domElement.removeAttribute('aria-label');
    },
  };
}
