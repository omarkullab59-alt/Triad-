// The 3D editor for every object: 1. What? (start page) → 2. Adjust → 3. Save & share
import { createViewer, MATERIALS, HOME_LOOKS, ACCENT } from './viewer.js';
import { createHistory, changedKeys } from '../lib/history.js';
import { showMenu, closeMenu, showShortcuts } from '../ui/menu.js';
import { ICON } from '../ui/icons.js';
import { partsToSTL } from './stl.js';
import { partsToOBJ } from '../lib/obj.js';
import { encodeShapes } from './outline.js';
import { geometryVolume } from './revolve.js';
import { destroy, DESTROY_STYLES } from './destroy.js';
import { ring } from './types/ring.js';
import { pendant } from './types/pendant.js';
import { lettering } from './types/lettering.js';
import { earrings } from './types/earrings.js';
import { bangle } from './types/bangle.js';
import { chain } from './types/chain.js';
import { plate } from '../home/plate.js';
import { vessel } from '../home/vessel.js';
import { cutlery } from '../home/cutlery.js';
import { cabinet } from '../home/cabinet.js';
import { sketch3d } from '../make/sketch3d.js';
import { model, loadModelFile } from '../make/model.js';
import { sculpture } from '../sculpt/sculpture.js';
import { wearable } from './types/wearable.js';
import { couture } from '../sculpt/couture.js';
import { belt } from '../wear/belt.js';
import { hat } from '../wear/hat.js';
import { tape } from '../wear/tape.js';
import { garment, flatSVG, parseEdits, stringifyEdits } from '../wear/garment.js';
import { printOnto } from './print.js';
import { lookOf } from './viewer.js';
import { engrave, SIDES, faceSize } from './engrave.js';
import { textMask, canvasMask } from './revolve.js';
import { motifOptions, renderMotif, motifPixels, MOTIFS, trimCanvas } from '../lib/motifs.js';
import * as THREE from 'three';
import { slider, choice, toggle, textField, ringSize } from '../ui/controls.js';
import { $, $$, esc, toast, download, makeCanvas, fileToPixels, loadImage, imageToPixels, reducedMotion } from '../lib/dom.js';
import { METALS, HOME, grams, weightLabel } from '../lib/sizes.js';
import { saveDesign, takeHandoff } from '../lib/store.js';
import { fontOptions, ensureFont, addFontFile, initFonts, fontStack, isRTL } from '../lib/fonts.js';
import { listSymbols, getSymbol, renderSymbol, symbolPixels } from '../lib/symbols.js';
import { renderPoster, renderInfoCard } from './images.js';
import { openSendDialog } from '../lib/send.js';
import { designPicker, designCanvas, designPixels, designShape, listDesigns } from '../lib/designs.js';
import { getProject, saveProject, openProjectDialog } from '../lib/projects.js';

export const TYPES = { ring, pendant, lettering, earrings, bangle, chain, wearable, couture, garment, belt, hat, tape, plate, vessel, cutlery, cabinet, sculpture, sketch3d, model };
const MAX_VISIBLE = 5;
const CATEGORY = { jewel: 'Jewellery', wear: 'Wear', home: 'Home', make: 'Create' };
const MOD = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
export const SHORTCUTS = [
  [`${MOD} · Z`, 'Undo'], [`${MOD} · Shift · Z`, 'Redo (also Ctrl Y)'], [`${MOD} · S`, 'Save project'], [`${MOD} · E`, 'Export panel'],
  ['1', 'Front view'], ['3', 'Side view'], ['7', 'Top view'], ['0', 'Perspective view'], ['F', 'Frame the object'],
  ['W', 'Wireframe on / off'], ['G', 'Ground grid on / off'], ['L', 'Landscape scene (Bryce-style) on / off'], ['+ · −', 'Zoom in / out'], ['← · → · ↑ · ↓', 'Turn (viewport focused)'],
  ['Right-click', 'Viewport menu'], ['?', 'This list'],
];
const JEWEL_MATS = ['silver', 'chrome', 'gold', 'black'];

const defaults = (t) => Object.fromEntries(t.params.map((q) => [q.key, q.default]));
const materialsOf = (T) => T.materials || JEWEL_MATS;
const isHome = (T) => T.category === 'home';
const optionsOf = (d, p) => (typeof d.options === 'function' ? d.options(p) : d.options);
function matInfo(T, key) {
  if (isHome(T)) return HOME[key] || METALS[key];
  return METALS[key] || HOME[key];
}
const matLook = (T, key) => (isHome(T) ? HOME_LOOKS[key] : MATERIALS[key] || HOME_LOOKS[key]);

function parseQuery(T, q) {
  const p = defaults(T);
  for (const def of T.params) {
    if (!q.has(def.key)) continue;
    const raw = q.get(def.key);
    if (def.type === 'range' || def.type === 'ringsize') {
      const n = Number(raw);
      if (Number.isFinite(n)) p[def.key] = def.type === 'range' ? Math.min(def.max, Math.max(def.min, n)) : Math.min(26, Math.max(12, n));
    } else if (def.type === 'toggle') p[def.key] = raw === '1';
    else if (def.type === 'select') p[def.key] = raw; // validated below (options can depend on other values)
    else if (def.type === 'model') { /* files never travel in links */ }
    else p[def.key] = String(raw).slice(0, def.type === 'source' ? 6000 : def.max || 60);
  }
  for (const def of T.params) if (def.type === 'select' && !optionsOf(def, p).some(([v]) => v === p[def.key])) p[def.key] = typeof def.options === 'function' ? optionsOf(def, p)[0][0] : def.default;
  const mats = materialsOf(T);
  const n = (k, d, max) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? Math.min(max, Math.max(0, v)) : d; };
  return {
    p,
    metal: mats.includes(q.get('mat')) ? q.get('mat') : T.defaultMaterial || mats[0],
    accent: q.get('acc') === '1',
    sys: ['eu', 'us', 'mm'].includes(q.get('sys')) ? q.get('sys') : 'eu',
    e: {
      kind: ['text', 'motif', 'symbol', 'image'].includes(q.get('ek')) ? q.get('ek') : 'none',
      text: (q.get('et') || 'TRIAD').slice(0, 40), font: q.get('ef') || 'Pirata One', motif: MOTIFS[q.get('em')] ? q.get('em') : 'snake', sym: q.get('es') || '',
      side: SIDES.some(([k]) => k === q.get('eside')) ? q.get('eside') : T.engraveDefault?.side || 'front',
      size: n('esz', T.engraveDefault?.size ?? 45, 100), x: q.has('ex') ? Math.max(-100, Math.min(100, Number(q.get('ex')) || 0)) : 0,
      y: q.has('ey') ? Math.max(-100, Math.min(100, Number(q.get('ey')) || 0)) : T.engraveDefault?.y ?? 0,
      rot: q.has('er') ? Math.max(-180, Math.min(180, Number(q.get('er')) || 0)) : 0,
      depth: q.has('ed') ? Math.max(0.05, Math.min(8, Number(q.get('ed')) || 0.3)) : T.engraveDefault?.depth ?? (T.category === 'home' ? 1 : 0.3),
      mode: q.get('emode') === 'emboss' ? 'emboss' : 'engrave', fill: q.get('efill') === '1', design: q.get('edz') || '', hq: q.get('ehq') === '1',
    },
    pr: {
      kind: ['image', 'motif', 'text'].includes(q.get('pk')) ? q.get('pk') : 'none',
      motif: MOTIFS[q.get('pm')] ? q.get('pm') : 'seigaiha', text: (q.get('pt') || 'TRIAD').slice(0, 40), font: q.get('pf') || 'Anton',
      color: /^#[0-9a-f]{6}$/i.test(q.get('pc') || '') ? q.get('pc') : '#0a0a0a',
      side: SIDES.some(([k]) => k === q.get('pside')) ? q.get('pside') : 'front',
      size: n('psz', 70, 100), x: q.has('px') ? Number(q.get('px')) || 0 : 0, y: q.has('py') ? Number(q.get('py')) || 0 : 0, rot: q.has('pr') ? Number(q.get('pr')) || 0 : 0,
      tile: q.get('ptile') === '1', tiles: Math.round(n('ptn', 4, 16)) || 4, design: q.get('pd') || '',
    },
    prj: q.get('prj') || '',
    col: { color: /^#[0-9a-f]{6}$/i.test(q.get('col') || '') ? q.get('col') : '', accent: /^#[0-9a-f]{6}$/i.test(q.get('acol') || '') ? q.get('acol') : '#c4ef2f' },
    d: {
      dmg: n('dmg', 0, 100), dirt: n('dirt', 0, 100), seed: Math.round(n('dseed', 7, 99999)),
      style: DESTROY_STYLES.some(([k]) => k === q.get('dst')) ? q.get('dst') : 'erode',
    },
  };
}

export async function mount(main, typeId, query) {
  const T = TYPES[typeId];
  const st = { ...parseQuery(T, query), pixels: null, model: null, result: null, tab: 'adjust', symCanvas: new Map(), symPixels: new Map() };
  initFonts();

  // hand-over from Draw or the Symbol designer
  if (T.params.some((d) => d.type === 'source')) {
    const h = takeHandoff();
    try {
      if (h?.pixels) st.pixels = h.pixels;
      else if (h?.dataUrl) st.pixels = imageToPixels(await loadImage(h.dataUrl));
      if (st.pixels) Object.assign(st.p, { shape: 'custom', fill: h.fill ?? true, bold: h.bold ?? 2, threshold: 170 }, h.params || {});
    } catch { /* ignore */ }
  }

  main.innerHTML = `
  <div class="tool">
    <section class="stage" aria-label="3D viewport">
      <div class="vp-bar" role="toolbar" aria-label="Viewport tools">
        <div class="seg-group" role="group" aria-label="Camera" data-cams>
          <button type="button" data-cam="persp" data-tip="Perspective (0)" aria-pressed="true">Persp</button>
          <button type="button" data-cam="front" data-tip="Front (1)" aria-pressed="false">Front</button>
          <button type="button" data-cam="right" data-tip="Side (3)" aria-pressed="false">Side</button>
          <button type="button" data-cam="top" data-tip="Top (7)" aria-pressed="false">Top</button>
        </div>
        <div class="seg-group" role="group" aria-label="Drawing" data-viewsw hidden>
          <button type="button" data-view="3d" aria-pressed="true">3D</button><button type="button" data-view="flat" aria-pressed="false">Flat</button><button type="button" data-view="edit" aria-pressed="false" data-tip="Drag points on the flat drawing">Edit points</button>
        </div>
        <span class="vp-spacer"></span>
        <div class="tb-group" role="group" aria-label="History">
          <button type="button" class="tb" data-act="undo" data-tip="Undo (${MOD} Z)" aria-label="Undo" disabled>${ICON.undo}</button>
          <button type="button" class="tb" data-act="redo" data-tip="Redo (${MOD} Shift Z)" aria-label="Redo" disabled>${ICON.redo}</button>
        </div>
        <div class="tb-group" role="group" aria-label="Display">
          <button type="button" class="tb" data-act="wire" data-tip="Wireframe (W)" aria-label="Wireframe" aria-pressed="false">${ICON.wire}</button>
          <button type="button" class="tb" data-act="grid" data-tip="Ground grid (G)" aria-label="Ground grid" aria-pressed="false">${ICON.grid}</button>
          <button type="button" class="tb" data-act="land" data-tip="Landscape scene, Bryce-style (L)" aria-label="Landscape scene" aria-pressed="false">${ICON.land}</button>
        </div>
        <div class="tb-group" role="group" aria-label="Zoom">
          <button type="button" class="tb" data-act="out" data-tip="Zoom out (−)" aria-label="Zoom out">${ICON.zoomOut}</button>
          <button type="button" class="tb" data-act="in" data-tip="Zoom in (+)" aria-label="Zoom in">${ICON.zoomIn}</button>
          <button type="button" class="tb" data-act="fit" data-tip="Frame object (F)" aria-label="Frame object">${ICON.fit}</button>
        </div>
        <button type="button" class="tb" data-act="menu" data-tip="More" aria-label="More viewport actions" aria-haspopup="menu">${ICON.more}</button>
      </div>
      <p class="stage-hint label">Drag to turn · pinch to zoom</p>
      <div class="vp-busy" data-busy hidden><span class="spinner spinner--sm" aria-hidden="true"></span>Building</div>
      <div class="flat-view" data-flat hidden></div>
      <div class="statusbar">
        <span class="sb-state" data-sb-state role="status" aria-live="polite"><i aria-hidden="true"></i><span>Ready</span></span>
        <span class="sb-item" data-weight></span>
        <span class="sb-item sb-wide" data-sb-size></span>
        <span class="sb-item sb-wide" data-sb-tris></span>
        <span class="sb-item sb-wide" data-sb-time></span>
        <span class="vp-spacer"></span>
        <button type="button" class="tb tb--sm" data-act="keys" data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">${ICON.keyboard}</button>
      </div>
    </section>
    <section class="panel" aria-label="Properties">
      <header class="panel-head">
        <a class="tb panel-back" href="#/" data-tip="All tools" aria-label="All tools">${ICON.back}</a>
        <div class="panel-name"><span class="label muted">${CATEGORY[T.category] || 'Jewellery'}</span><h1>${esc(T.label)}</h1></div>
        <button type="button" class="tb" data-act="save" data-tip="Save project (${MOD} S)" aria-label="Save project">${ICON.save}</button>
      </header>
      <div class="stepbar" role="tablist" aria-label="Panels">
        <button type="button" role="tab" id="tab-adjust" aria-controls="adjust" data-tab="adjust">Design</button>
        <button type="button" role="tab" id="tab-save" aria-controls="save" data-tab="save">Export</button>
      </div>
      <div id="adjust" role="tabpanel" aria-labelledby="tab-adjust">
        <div class="group" data-tpl-group><span class="label">Start from</span><div class="chips" data-templates></div></div>
        <div class="group" data-mysym hidden><span class="label">My symbols</span><div class="chips" data-mysyms></div></div>
        <div class="group" data-motifs-group hidden><span class="label">Motifs</span><div class="motif-grid" data-motifs></div></div>
        <div data-controls></div>
        <div class="group"><span class="label">Material</span>
          <div class="chips" role="radiogroup" aria-label="Material" data-metals></div>
          <div data-colour style="margin-top:10px"></div>
          <div data-accent style="margin-top:6px"></div>
        </div>
        <details class="more" data-print>
          <summary>Print &amp; colour pattern <span class="tape" style="margin-left:6px;font-size:10px" data-print-badge hidden>on</span></summary>
          <div data-print-body></div>
        </details>
        <details class="more" data-notes>
          <summary>Notes &amp; concept art <span class="tape" style="margin-left:6px;font-size:10px" data-notes-badge hidden>saved</span></summary>
          <div data-notes-body></div>
        </details>
        <details class="more" data-engrave>
          <summary>Engrave &amp; emboss <span class="tape" style="margin-left:6px;font-size:10px" data-eng-badge hidden>on</span></summary>
          <div data-engrave-body></div>
        </details>
        <details class="more destroy" data-destroy>
          <summary>Destroy mode <span class="tape" style="margin-left:6px;font-size:10px" data-dmg-badge hidden></span></summary>
          <div data-destroy-body></div>
        </details>
        <div data-checks aria-live="polite"></div>
        <p class="panel-next"><button type="button" class="btn btn--solid" data-go-save>Export →</button></p>
      </div>
      <div id="save" role="tabpanel" aria-labelledby="tab-save" hidden></div>
    </section>
  </div>`;

  const stage = $('.stage', main);
  const viewer = createViewer(stage, { reducedMotion: reducedMotion() });
  viewer.renderer.domElement.tabIndex = 0;
  viewer.renderer.domElement.setAttribute('aria-label', `${T.label}, 3D viewport. Arrow keys turn it, plus and minus zoom, right-click for the menu.`);
  const sig = { signal: viewer.signal };
  viewer.renderer.domElement.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (k) { e.preventDefault(); viewer.nudge(...k); markCam(''); }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = viewer.renderer.domElement.getBoundingClientRect(); viewportMenu(r.left + 24, r.top + 24); }
  }, sig);
  viewer.renderer.domElement.addEventListener('contextmenu', (e) => { e.preventDefault(); viewportMenu(e.clientX, e.clientY); }, sig);
  viewer.controls.addEventListener('start', () => markCam(''));

  const markCam = (name) => $$('[data-cam]', main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cam === name)));
  const setCam = (name) => { if (st.view !== '3d') setDrawingView('3d'); viewer.setView(name); markCam(name); };
  const press = (act, on) => $(`[data-act="${act}"]`, main)?.setAttribute('aria-pressed', String(on));
  const actions = {
    undo: () => undo(), redo: () => redo(),
    wire: () => { press('wire', viewer.setWireframe(!viewer.wireframe)); },
    grid: () => { press('grid', viewer.setGrid(!viewer.grid)); press('land', viewer.landscape); },
    land: () => { press('land', viewer.setLandscape(!viewer.landscape)); press('grid', viewer.grid); },
    newLand: () => { press('land', viewer.setLandscape(true, Math.floor(Math.random() * 9999))); press('grid', false); },
    in: () => viewer.zoom(0.75), out: () => viewer.zoom(1.33),
    fit: () => { viewer.fit(T.view); markCam(T.view === 'top' ? 'top' : 'persp'); },
    shot: () => viewportShot(),
    menu: () => { const r = $('[data-act="menu"]', main).getBoundingClientRect(); viewportMenu(r.right - 220, r.bottom + 6, $('[data-act="menu"]', main)); },
    keys: () => showShortcuts(SHORTCUTS),
    save: () => saveAsProject($('#design-name', main)?.value?.trim() || st.project?.name || st.result?.title || T.label),
    export: () => showTab('save', true),
  };
  $$('[data-act]', main).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]?.()));
  $$('[data-cam]', main).forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));

  function viewportMenu(x, y, returnFocus = viewer.renderer.domElement) {
    showMenu([
      { label: 'Undo', hint: `${MOD} Z`, action: undo, disabled: !hist.canUndo },
      { label: 'Redo', hint: `${MOD} ⇧ Z`, action: redo, disabled: !hist.canRedo },
      '-',
      { label: 'Frame object', hint: 'F', action: actions.fit },
      { label: 'Perspective', hint: '0', action: () => setCam('persp') },
      { label: 'Front', hint: '1', action: () => setCam('front') },
      { label: 'Back', action: () => setCam('back') },
      { label: 'Side', hint: '3', action: () => setCam('right') },
      { label: 'Top', hint: '7', action: () => setCam('top') },
      { label: 'Bottom', action: () => setCam('bottom') },
      '-',
      { label: 'Wireframe', hint: 'W', checked: viewer.wireframe, action: actions.wire },
      { label: 'Ground grid', hint: 'G', checked: viewer.grid, action: actions.grid },
      { label: 'Landscape scene (Bryce-style)', hint: 'L', checked: viewer.landscape, action: actions.land },
      ...(viewer.landscape ? [{ label: 'New random landscape', action: actions.newLand }] : []),
      '-',
      { label: 'Save viewport as PNG', action: actions.shot, disabled: !st.result || st.result.empty },
      { label: 'Download STL', action: () => exportSTL(), disabled: !st.result || st.result.empty },
      { label: 'Open in Bryce (OBJ + MTL)', action: () => exportOBJ(true), disabled: !st.result || st.result.empty },
      { label: 'Export panel…', hint: `${MOD} E`, action: actions.export },
      { label: 'Keyboard shortcuts', hint: '?', action: actions.keys },
    ], { x, y, label: 'Viewport', returnFocus });
  }
  function viewportShot() {
    const r = stage.getBoundingClientRect();
    const k = 2048 / Math.max(r.width, r.height);
    const c = viewer.snapshot(Math.round(r.width * k), Math.round(r.height * k), { fill: 0.75 });
    c.toBlob((b) => { if (b) { download(b, `${fileBase()}-viewport.png`); toast('Viewport saved as PNG (transparent background).'); } });
  }
  async function exportOBJ(guide) {
    const nm = ($('#design-name', main)?.value.trim() || st.result.title || typeId);
    const { obj, mtl, base } = partsToOBJ(st.result.parts, { matrix: viewer.exportMatrix(), looks: viewer.looks(), name: `${fileBase()}` });
    const { zipSync, strToU8 } = await import('three/examples/jsm/libs/fflate.module.js');
    const readme = `${nm}\nTRIAD Studio · OBJ + MTL · units: millimetres\n\nBryce: File > Import Object… > ${base}.obj (keep the .mtl next to it for the colours).\nBlender / Cinema 4D / Maya / Daz Studio / ZBrush: import ${base}.obj.\n`;
    const zip = zipSync({ [`${base}.obj`]: strToU8(obj), [`${base}.mtl`]: strToU8(mtl), 'README.txt': strToU8(readme) });
    download(new Blob([zip], { type: 'application/zip' }), `${base}-obj.zip`);
    if (guide) openBryceGuide(); else toast('OBJ + MTL saved (zip).');
  }
  function exportSTL() {
    const buf = partsToSTL(st.result.parts, viewer.exportMatrix());
    download(new Blob([buf], { type: 'model/stl' }), `${fileBase()}.stl`);
    toast('STL saved. Open it in your slicer or send it to your maker.');
  }

  // global shortcuts (not while typing, not under a dialog)
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable="true"]') && !(e.ctrlKey || e.metaKey) ) return;
    if (t.closest?.('input[type=text], input[type=search], textarea, [contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); actions.save(); return; }
    if (mod && k === 'e') { e.preventDefault(); actions.export(); return; }
    if (mod || e.altKey) return;
    const cam = { 1: 'front', 3: 'right', 7: 'top', 0: 'persp' }[e.key];
    if (cam && (e.code?.startsWith('Numpad') || !t.closest?.('.panel'))) { e.preventDefault(); setCam(cam); return; }
    if (t.closest?.('.panel') && !['?'].includes(e.key)) return; // letters in the panel stay with the controls
    if (k === 'f') { e.preventDefault(); actions.fit(); }
    else if (k === 'w') { e.preventDefault(); actions.wire(); }
    else if (k === 'g') { e.preventDefault(); actions.grid(); }
    else if (k === 'l') { e.preventDefault(); actions.land(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); viewer.zoom(0.8); }
    else if (e.key === '-') { e.preventDefault(); viewer.zoom(1.25); }
    else if (e.key === '?') { e.preventDefault(); actions.keys(); }
  }, sig);
  const applyMaterial = () => viewer.setMaterial(st.metal, st.accent, { home: isHome(T) || !MATERIALS[st.metal], dirty: st.d.dirt > 0, color: st.col.color, accentColor: st.col.accent, fillColor: st.col.accent, partMaterial: T.partMaterialParam ? st.p[T.partMaterialParam] : '' });
  applyMaterial();

  /* ── tabs ── */
  const tabs = $$('[role=tab]', main);
  function showTab(name, focus, scroll = true) {
    st.tab = name;
    tabs.forEach((t) => { const on = t.dataset.tab === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    $('#adjust', main).hidden = name !== 'adjust';
    $('#save', main).hidden = name !== 'save';
    if (name === 'save') renderSave();
    if (focus) $(`#tab-${name}`, main).focus();
    if (scroll && matchMedia('(max-width: 959px)').matches) $('.stepbar', main).scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showTab(tabs[(i + 1) % 2].dataset.tab, true); } });
  });
  $('[data-go-save]', main).addEventListener('click', () => showTab('save', true));

  /* ── templates ── */
  const tplBox = $('[data-templates]', main);
  $('[data-tpl-group]', main).hidden = !T.templates.length;
  T.templates.forEach((tpl) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = tpl.label;
    b.addEventListener('click', () => {
      const { accent, ...rest } = tpl.p;
      const keep = Object.fromEntries(['size', 'wrist'].filter((k) => k in st.p && (typeId === 'ring' || typeId === 'bangle')).map((k) => [k, st.p[k]]));
      st.p = { ...defaults(T), ...keep, ...rest };
      if (T.params.some((d) => d.type === 'source')) st.pixels = null;
      st.accent = !!accent;
      applyMaterial();
      renderControls(); renderMaterials();
      rebuild(true);
      toast(`${tpl.label} loaded. Now adjust it.`);
    });
    tplBox.append(b);
  });
  // motifs as starting shapes (pendant, sketch → 3D, crowns)
  if (T.params.some((d) => d.type === 'source')) {
    $('[data-motifs-group]', main).hidden = false;
    const grid = $('[data-motifs]', main);
    for (const [k, label] of motifOptions()) {
      const b = document.createElement('button');
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', `Motif: ${label}`);
      renderMotif(k, 96).then((c) => { b.innerHTML = `<img src="${c.toDataURL()}" alt="">`; });
      b.addEventListener('click', async () => {
        st.pixels = await motifPixels(k, 1000);
        Object.assign(st.p, { shape: `m:${k}`, fill: false, bold: 1, threshold: 128, invert: false });
        st.pixelsFrom = `m:${k}`;
        renderControls(); rebuild(true);
      });
      grid.append(b);
    }
  }
  // my designs as starting shapes
  if (T.params.some((d) => d.type === 'source')) {
    const holder = document.createElement('div');
    holder.className = 'group';
    holder.append(designPicker({ label: 'My designs', help: 'Use one of your uploaded designs as the shape (dark = solid).', onPick: async (id) => {
      st.pixels = await designPixels(id, 1000);
      Object.assign(st.p, { shape: 'custom', fill: false, bold: 1, threshold: 150, invert: false });
      st.pixelsFrom = null;
      renderControls(); rebuild(true);
    } }));
    $('[data-motifs-group]', main).after(holder);
  }
  // own symbols as starting shapes (pendant, sketch → 3D)
  if (T.params.some((d) => d.type === 'source')) {
    listSymbols().then((syms) => {
      if (!syms.length) return;
      $('[data-mysym]', main).hidden = false;
      const box = $('[data-mysyms]', main);
      for (const s of syms.slice(0, 16)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip';
        b.innerHTML = `<img src="${s.thumb}" alt="" width="22" height="22" style="border-radius:3px;background:#fff">${esc(s.name)}`;
        b.addEventListener('click', async () => {
          st.pixels = await symbolPixels(s);
          Object.assign(st.p, { shape: 'custom', fill: false, bold: 0, threshold: 128, invert: false });
          renderControls(); rebuild(true);
        });
        box.append(b);
      }
    });
  }

  /* ── controls ── */
  const ctlBox = $('[data-controls]', main);
  function renderControls() {
    const focusedKey = document.activeElement?.closest?.('[data-key]')?.dataset.key;
    ctlBox.innerHTML = '';
    const ctx = { hasPixels: !!st.pixels };
    const visible = T.params.filter((d) => d.type !== 'hidden' && (!d.show || d.show(st.p, ctx)));
    const first = visible.filter((d) => !d.more).slice(0, MAX_VISIBLE);
    const more = visible.filter((d) => !first.includes(d));
    const make = (d) => {
      const set = (v) => { st.p[d.key] = v; rebuild(); };
      const setAndRedraw = (v) => { st.p[d.key] = v; renderControls(); rebuild(); };
      const common = { name: d.key, label: d.label, help: d.help, value: st.p[d.key] };
      if (d.type === 'range') return slider({ ...common, min: d.min, max: d.max, step: d.step, unit: d.unit, onInput: set });
      if (d.type === 'select') return choice({ ...common, options: optionsOf(d, st.p), onInput: (v) => {
        st.p[d.key] = v;
        for (const k of d.resets || []) {
          const r = T.params.find((x) => x.key === k);
          if (!r) continue;
          if (r.defaultFor) st.p[k] = r.defaultFor(st.p) ?? st.p[k];
          else if (typeof r.options === 'function') st.p[k] = optionsOf(r, st.p)[0][0];
        }
        renderControls(); rebuild(!!d.resets);
      } });
      if (d.type === 'toggle') return toggle({ ...common, onInput: setAndRedraw });
      if (d.type === 'text') return textField({ ...common, max: d.max, onInput: set });
      if (d.type === 'ringsize') return ringSize({ ...common, system: st.sys, onInput: set, onSystem: (k) => { st.sys = k; renderControls(); syncHash(); } });
      if (d.type === 'source') return sourceControl(d);
      if (d.type === 'font') return fontControl(d, common, set);
      if (d.type === 'symbol') return symbolControl(d, common, set);
      if (d.type === 'model') return modelControl(d);
      if (d.type === 'design') { const el = designPicker({ label: d.label, help: d.help, value: st.p[d.key], onPick: (id) => { st.p[d.key] = id; rebuild(); } }); el.dataset.key = d.key; return el; }
      return document.createElement('div');
    };
    first.forEach((d) => ctlBox.append(make(d)));
    if (more.length) {
      const det = document.createElement('details');
      det.className = 'more';
      det.open = st.moreOpen || false;
      det.addEventListener('toggle', () => { st.moreOpen = det.open; });
      det.innerHTML = `<summary>More options <span class="muted" style="text-transform:none;letter-spacing:0">(${more.length})</span></summary>`;
      more.forEach((d) => det.append(make(d)));
      ctlBox.append(det);
    }
    if (focusedKey) ctlBox.querySelector(`[data-key="${focusedKey}"] [aria-checked="true"], [data-key="${focusedKey}"] input, [data-key="${focusedKey}"] select, [data-key="${focusedKey}"] button`)?.focus({ preventScroll: true });
  }

  function fontControl(d, common, set) {
    const el = choice({ ...common, options: fontOptions(), onInput: set });
    const row = document.createElement('div');
    row.className = 'btn-row'; row.style.marginTop = '8px';
    row.innerHTML = '<button type="button" class="btn">Upload your own font</button><input type="file" accept=".ttf,.otf,.woff,.woff2" hidden>';
    const input = $('input', row);
    $('button', row).addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      try { const fam = await addFontFile(input.files[0]); st.p[d.key] = fam; renderControls(); rebuild(); toast('Font added. It stays on this device.'); }
      catch (e) { toast(e.message || 'This font could not be read.'); }
    });
    el.append(row);
    return el;
  }

  function symbolControl(d, common, set, get = () => st.p[d.key]) {
    const el = document.createElement('div');
    el.className = 'ctl'; el.dataset.key = d.key;
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(d.label)}</span></div><p class="ctl-help">${esc(d.help)}</p><div class="chips" role="radiogroup" aria-label="${esc(d.label)}"></div>
      <p style="margin-top:8px"><a class="btn" href="#/symbol">Design a symbol →</a></p>`;
    const box = $('.chips', el);
    listSymbols().then((syms) => {
      const opts = [{ id: '', name: 'None' }, ...syms];
      for (const s of opts) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String((get() || '') === s.id));
        b.innerHTML = `${s.thumb ? `<img src="${s.thumb}" alt="" width="22" height="22" style="border-radius:3px;background:#fff">` : ''}${esc(s.name)}`;
        b.addEventListener('click', () => { $$('[role=radio]', box).forEach((x) => x.setAttribute('aria-checked', String(x === b))); set(s.id); });
        box.append(b);
      }
      if (!syms.length) box.insertAdjacentHTML('beforeend', '<p class="muted" style="font-size:14px">No symbols yet.</p>');
    });
    return el;
  }

  function modelControl(d) {
    const el = document.createElement('div');
    el.className = 'ctl'; el.dataset.key = d.key;
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(d.label)}</span></div><p class="ctl-help">${esc(d.help)}</p>
      <div class="drop"><p class="label" style="margin-bottom:8px">${st.model ? esc(st.model.name) : 'No file yet'}</p>
      <button type="button" class="btn btn--lime">Open GLB / STL / OBJ / FBX / 3MF / DAE / PLY</button><input type="file" accept=".stl,.obj,.glb,.gltf,.ply,.fbx,.3mf,.dae" hidden></div>`;
    const input = $('input', el);
    $('button', el).addEventListener('click', () => input.click());
    const take = async (file) => {
      if (!file) return;
      toast('Opening…');
      try { st.model = await loadModelFile(file); renderControls(); rebuild(true); toast(`${file.name} loaded.`); }
      catch (e) { toast(e.message || 'This file could not be opened.'); }
    };
    input.addEventListener('change', () => take(input.files[0]));
    const drop = $('.drop', el);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); take(e.dataTransfer.files[0]); });
    return el;
  }

  /* picture in (pendant, sketch → 3D) */
  let preview = null;
  function sourceControl(d) {
    const el = document.createElement('div');
    el.className = 'ctl';
    el.dataset.key = d.key;
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(d.label)}</span></div><p class="ctl-help">${esc(d.help)}</p>
      <div class="source drop">
        <canvas width="192" height="192" role="img" aria-label="What we detected from your picture"></canvas>
        <div style="display:grid;gap:8px">
          <button type="button" class="btn btn--lime" data-upload>Upload sketch, photo or design</button>
          <div class="btn-row"><a class="btn" href="#/draw">Draw</a><a class="btn" href="#/symbol">Symbol</a></div>
          <input type="file" accept="image/*" hidden>
        </div>
      </div>`;
    const input = $('input[type=file]', el);
    $('[data-upload]', el).addEventListener('click', () => input.click());
    const take = async (file) => {
      if (!file || !/^image\//.test(file.type)) { toast('Please choose a picture (JPG, PNG, WebP).'); return; }
      try {
        st.pixels = await fileToPixels(file, 1000);
        st.p.shape = 'custom'; st.p.fill = false; st.p.bold = typeId === 'sketch3d' ? 2 : 0;
        renderControls(); rebuild(true);
        toast('Picture loaded. Move “Outline detection” until the shape looks right.');
      } catch { toast('This picture could not be opened. Try a JPG or PNG.'); }
    };
    input.addEventListener('change', () => take(input.files[0]));
    const drop = $('.drop', el);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); take(e.dataTransfer.files[0]); });
    preview = $('canvas', el);
    drawPreview();
    return el;
  }
  function drawPreview() {
    if (!preview || !preview.isConnected) return;
    const c = preview.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 192, 192);
    const r = st.result;
    const m = r?.mask;
    if (!m && st.pixels && st.p.mode === 'relief') {
      const t = makeCanvas(st.pixels.width, st.pixels.height); t.getContext('2d').putImageData(st.pixels, 0, 0);
      const k = 192 / Math.max(t.width, t.height); c.drawImage(t, (192 - t.width * k) / 2, (192 - t.height * k) / 2, t.width * k, t.height * k);
      return;
    }
    if (!m) {
      if (r?.shapes) {
        const { box } = r; const s = 168 / Math.max(box.maxX - box.minX, box.maxY - box.minY);
        c.fillStyle = '#4f6800';
        c.beginPath();
        for (const sh of r.shapes) for (const loop of [sh.outer, ...sh.holes]) loop.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](12 + (x - box.minX) * s, 12 + (y - box.minY) * s));
        c.fill('evenodd');
      }
      return;
    }
    const k = 192 / Math.max(m.width, m.height);
    const img = c.createImageData(m.width, m.height);
    for (let i = 0; i < m.mask.length; i++) img.data.set(m.mask[i] ? [79, 104, 0, 255] : [255, 255, 255, 0], i * 4);
    const tmp = makeCanvas(m.width, m.height);
    tmp.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(tmp, (192 - m.width * k) / 2, (192 - m.height * k) / 2, m.width * k, m.height * k);
  }

  /* ── materials ── */
  function renderMaterials() {
    const box = $('[data-metals]', main);
    const keys = materialsOf(T);
    box.innerHTML = keys.map((k) => { const m = matLook(T, k); return `<button type="button" class="chip" role="radio" aria-checked="${k === st.metal}" tabindex="${k === st.metal ? 0 : -1}" data-m="${k}"><span class="swatch" style="background:${m.swatch}"></span>${esc(matInfo(T, k).label)}</button>`; }).join('');
    const btns = $$('[data-m]', box);
    const pick = (b, focus) => { st.metal = b.dataset.m; applyMaterial(); renderMaterials(); updateChecks(); syncHash(); if (st.tab === 'save') renderSave(); if (focus) $(`[data-m="${st.metal}"]`, main).focus(); };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); pick(btns[(i + d + btns.length) % btns.length], true); } });
    });
    renderColour();
    const acc = $('[data-accent]', main);
    acc.innerHTML = '';
    acc.append(toggle({ name: 'accent', label: `${ACCENT.label} accent`, help: 'Colours the top, plate, front or handles in TRIAD lime (enamel, paint or glaze).', value: st.accent,
      onInput: (v) => { st.accent = v; applyMaterial(); renderColour(); syncHash(); } }));
  }

  /* ── colours ── */
  const PALETTE = [['', 'Natural'], ['#c4ef2f', 'TRIAD lime']]; // TRIAD: lime #C4EF2F is the only colour
  function colourRow(label, help, value, onPick, natural = true, extra = []) {
    const el = document.createElement('div'); el.className = 'ctl'; el.style.paddingTop = '6px';
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(label)}</span></div><p class="ctl-help">${esc(help)}</p><div class="chips" role="radiogroup" aria-label="${esc(label)}"></div>`;
    const box = $('.chips', el);
    for (const [c, l] of [...PALETTE.filter(([c]) => natural || c), ...extra]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(c === value));
      b.innerHTML = `<span class="swatch" style="background:${c || 'linear-gradient(135deg,#ddd,#888)'}"></span>${esc(l)}`;
      b.addEventListener('click', () => onPick(c));
      box.append(b);
    }
    return el;
  }
  function renderColour() {
    const box = $('[data-colour]', main);
    box.innerHTML = '';
    box.append(colourRow('Colour', 'Natural material, or paint / glaze / lacquer / coloured plating in any colour.', st.col.color, (c) => { st.col.color = c; applyMaterial(); renderColour(); syncHash(); }));
    if (st.accent || st.e.fill) box.append(colourRow('Accent & fill colour', 'Colour of the accent parts and filled engravings (enamel).', st.col.accent, (c) => { st.col.accent = c || '#c4ef2f'; applyMaterial(); renderColour(); syncHash(); }, false));
  }

  /* ── print (colour pictures & patterns on the surface) ── */
  function renderPrint() {
    const body = $('[data-print-body]', main);
    const pr = st.pr;
    body.innerHTML = '<p class="ctl-help" style="margin-top:4px">Print a picture, motif, text or repeating pattern in colour onto any side — like a decal, UV print or ceramic transfer. The 3D shape stays the same; download “Colour model (GLB)” to keep the colours.</p>';
    const set = (k, redraw) => (v) => { pr[k] = v; if (redraw) renderPrint(); rebuild(); };
    body.append(choice({ name: 'pk', label: 'What', help: 'Choose what to print.', value: pr.kind, options: [['none', 'Nothing'], ['image', 'My design (full colour)'], ['motif', 'Motif / pattern'], ['text', 'Text']], onInput: set('kind', true) }));
    $('[data-print-badge]', main).hidden = pr.kind === 'none';
    if (pr.kind === 'none') return;
    if (pr.kind === 'motif') {
      const wrap = document.createElement('div'); wrap.className = 'ctl'; wrap.dataset.key = 'pm';
      wrap.innerHTML = '<div class="ctl-head"><span class="ctl-name">Motif or pattern</span></div><p class="ctl-help">Patterns (waves, houndstooth, leopard …) repeat nicely with “Repeat”.</p><div class="motif-grid" role="radiogroup" aria-label="Motif"></div>';
      const grid = $('.motif-grid', wrap);
      for (const [k, label] of motifOptions()) {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === pr.motif)); b.setAttribute('aria-label', label); b.title = label;
        renderMotif(k, 96).then((c) => { b.innerHTML = `<img src="${c.toDataURL()}" alt="">`; });
        b.addEventListener('click', () => { pr.motif = k; pr.tile = !!MOTIFS[k].pattern; renderPrint(); rebuild(); });
        grid.append(b);
      }
      body.append(wrap);
    }
    if (pr.kind === 'text') body.append(textField({ name: 'pt', label: 'Text', help: 'Any language.', value: pr.text, max: 40, onInput: set('text') }), choice({ name: 'pf', label: 'Font', help: 'Style or script.', value: pr.font, options: fontOptions(), onInput: set('font') }));
    if (pr.kind === 'image') body.append(designPicker({ label: 'Your design', help: 'Pick one of your designs or upload a new one. Full colour; transparent PNGs let the material show through.', value: pr.design, onPick: (id) => { pr.design = id; rebuild(); } }));
    if (pr.kind !== 'image') body.append(colourRow('Print colour', 'Colour of the motif, pattern or text.', pr.color, (c) => { pr.color = c || '#0a0a0a'; renderPrint(); rebuild(); }, false, [['#0a0a0a', 'TRIAD black']]));
    body.append(
      choice({ name: 'pside', label: 'Where', help: 'The side to print on. “Around” wraps it like a label.', value: pr.side, options: SIDES, onInput: set('side') }),
      slider({ name: 'psz', label: 'Size', help: 'Height compared with that side of the piece.', min: 5, max: 100, step: 1, unit: '%', value: pr.size, onInput: set('size') }),
      toggle({ name: 'ptile', label: 'Repeat as a pattern', help: 'Tiles the motif over the whole print area.', value: pr.tile, onInput: set('tile', true) }),
    );
    if (pr.tile) body.append(slider({ name: 'ptn', label: 'Repeats', help: 'How many times across.', min: 1, max: 16, step: 1, value: pr.tiles, onInput: set('tiles') }));
    body.append(
      slider({ name: 'px', label: 'Move left / right', help: 'Position across that side.', min: -100, max: 100, step: 1, unit: '%', value: pr.x, onInput: set('x') }),
      slider({ name: 'py', label: 'Move down / up', help: 'Position up and down.', min: -100, max: 100, step: 1, unit: '%', value: pr.y, onInput: set('y') }),
      slider({ name: 'pr', label: 'Rotate', help: 'Turn the print.', min: -180, max: 180, step: 1, unit: '°', value: pr.rot, onInput: set('rot') }),
    );
    $('[data-print]', main).open = true;
  }
  /** The print as a canvas plus its aspect (width / height). */
  async function printArt() {
    const pr = st.pr;
    const tint = (src, color) => { const c = makeCanvas(src.width, src.height); const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; };
    let art = null;
    if (pr.kind === 'image' && pr.design) art = await designCanvas(pr.design, 4096);
    if (pr.kind === 'motif') { const m = await renderMotif(pr.motif, pr.tile ? 512 : 2048); art = tint(MOTIFS[pr.motif].pattern ? m : trimCanvas(m, 6), pr.color); }
    if (pr.kind === 'text' && pr.text.trim()) {
      await ensureFont(pr.font, pr.text);
      const c = makeCanvas(8, 8); let x = c.getContext('2d'); const font = fontStack(pr.font, 200, pr.text); x.font = font;
      c.width = Math.ceil(x.measureText(pr.text).width) + 40; c.height = 280; x = c.getContext('2d');
      x.font = font; x.fillStyle = pr.color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = isRTL(pr.text) ? 'rtl' : 'ltr'; x.fillText(pr.text, c.width / 2, c.height / 2);
      art = c;
    }
    if (!art) return null;
    if (!pr.tile) return { canvas: art, aspect: art.width / art.height };
    const n = pr.tiles, tw = 256, th = Math.round((256 * art.height) / art.width);
    const c = makeCanvas(tw * n, th * n); const x = c.getContext('2d');
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) x.drawImage(art, i * tw, j * th, tw, th);
    return { canvas: c, aspect: c.width / c.height };
  }

  /* ── engrave & emboss (any object) ── */
  function renderEngrave() {
    const body = $('[data-engrave-body]', main);
    const e = st.e;
    body.innerHTML = '<p class="ctl-help" style="margin-top:4px">Put text, a motif, your symbol or a picture onto any side. Engrave cuts it in, emboss lifts it out.</p>';
    const set = (k, redraw) => (v) => { e[k] = v; if (redraw) renderEngrave(); rebuild(); };
    body.append(choice({ name: 'ek', label: 'What', help: 'Choose what to put on the piece.', value: e.kind, options: [['none', 'Nothing'], ['text', 'Text'], ['motif', 'Motif'], ['symbol', 'My symbol'], ['image', 'My design']], onInput: set('kind', true) }));
    if (e.kind === 'none') { $('[data-eng-badge]', main).hidden = true; return; }
    $('[data-eng-badge]', main).hidden = false;
    if (e.kind === 'text') {
      body.append(textField({ name: 'et', label: 'Text', help: 'Any language: names, dates, 東京, حب, Москва …', value: e.text, max: 40, onInput: set('text') }));
      body.append(choice({ name: 'ef', label: 'Font', help: 'Style or script. Upload your own in Lettering or Symbol.', value: e.font, options: fontOptions(), onInput: set('font') }));
    }
    if (e.kind === 'motif') {
      const wrap = document.createElement('div'); wrap.className = 'ctl'; wrap.dataset.key = 'em';
      wrap.innerHTML = '<div class="ctl-head"><span class="ctl-name">Motif</span></div><p class="ctl-help">Snakes, dragons, skull, flames, thorns …</p><div class="motif-grid" role="radiogroup" aria-label="Motif"></div>';
      const grid = $('.motif-grid', wrap);
      for (const [k, label] of motifOptions()) {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === e.motif)); b.setAttribute('aria-label', label); b.title = label;
        renderMotif(k, 96).then((c) => { b.innerHTML = `<img src="${c.toDataURL()}" alt="">`; });
        b.addEventListener('click', () => { e.motif = k; $$('[role=radio]', grid).forEach((x) => x.setAttribute('aria-checked', String(x === b))); rebuild(); });
        grid.append(b);
      }
      body.append(wrap);
    }
    if (e.kind === 'symbol') body.append(symbolControl({ key: 'es', label: 'Which symbol', help: 'Make your own in “Symbol”.' }, {}, (v) => { e.sym = v; rebuild(); }, () => e.sym));
    if (e.kind === 'image') body.append(designPicker({ label: 'Your design', help: 'Pick one of your designs or upload a new one (PNG, JPG, WebP, SVG). Dark parts are engraved.', value: e.design, onPick: (id) => { e.design = id; rebuild(); } }));
    body.append(
      choice({ name: 'eside', label: 'Where', help: 'The side of the piece it goes on. “Around” wraps it like a label.', value: e.side, options: SIDES, onInput: set('side') }),
      slider({ name: 'esz', label: 'Size', help: 'Height compared with that side of the piece.', min: 3, max: 100, step: 1, unit: '%', value: e.size, onInput: set('size') }),
      slider({ name: 'ed', label: 'Depth', help: 'How deep it is cut (or how high it stands out).', min: 0.05, max: 8, step: 0.05, unit: 'mm', value: e.depth, onInput: set('depth') }),
      choice({ name: 'emode', label: 'Cut in or stand out', help: 'Engrave cuts into the surface, emboss raises it.', value: e.mode, options: [['engrave', 'Engrave'], ['emboss', 'Emboss']], onInput: set('mode') }),
      slider({ name: 'ex', label: 'Move left / right', help: 'Position across that side.', min: -100, max: 100, step: 1, unit: '%', value: e.x, onInput: set('x') }),
      slider({ name: 'ey', label: 'Move down / up', help: 'Position up and down on that side.', min: -100, max: 100, step: 1, unit: '%', value: e.y, onInput: set('y') }),
      slider({ name: 'er', label: 'Rotate', help: 'Turn the engraving.', min: -180, max: 180, step: 1, unit: '°', value: e.rot, onInput: set('rot') }),
      toggle({ name: 'ehq', label: 'Extra fine detail', help: 'Finer mesh for small text and detailed designs (slower, bigger file).', value: e.hq, onInput: set('hq') }),
      toggle({ name: 'efill', label: 'Fill with enamel', help: 'Colours the engraving (TRIAD lime or any colour under Material).', value: e.fill, onInput: (v) => { e.fill = v; renderColour(); rebuild(); } }),
    );
    $('[data-engrave]', main).open = true;
  }
  function alphaCanvas(px) {
    const c = makeCanvas(px.width, px.height); const x = c.getContext('2d');
    const d = new ImageData(new Uint8ClampedArray(px.data), px.width, px.height);
    for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11 < 140; d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = on ? 255 : 0; }
    x.putImageData(d, 0, 0); return c;
  }
  async function engraveMask(sizeMm) {
    const e = st.e;
    if (e.kind === 'text' && e.text.trim()) { await ensureFont(e.font, e.text); return textMask(e.text.trim(), sizeMm, makeCanvas, e.font); }
    let c = null;
    if (e.kind === 'motif') c = await renderMotif(e.motif, 700);
    if (e.kind === 'symbol' && e.sym) { const doc = await getSymbol(e.sym); if (doc) c = await renderSymbol(doc, 700); }
    if (e.kind === 'image' && e.design) c = await designShape(e.design);
    if (c) c = trimCanvas(c, 4);
    return c ? canvasMask(c, sizeMm * (c.width / c.height), { useAlpha: true }) : null;
  }

  /* ── destroy mode ── */
  function renderDestroy() {
    const body = $('[data-destroy-body]', main);
    body.innerHTML = '<p class="ctl-help" style="margin-top:4px">Wear the piece down for a raw, broken, found-in-the-ground look. Works on everything, the STL file included.</p>';
    body.append(
      slider({ name: 'dmg', label: 'How destroyed', help: '0 % is new. 100 % is half-eaten.', min: 0, max: 100, step: 1, unit: '%', value: st.d.dmg, onInput: (v) => { st.d.dmg = v; rebuild(); } }),
      choice({ name: 'dst', label: 'Kind of damage', help: 'Eroded = sanded and pitted, cracked = deep fissures, chipped = broken-off pieces, melted = sagging.', options: DESTROY_STYLES, value: st.d.style, onInput: (v) => { st.d.style = v; rebuild(); } }),
      slider({ name: 'dirt', label: 'Dirt & patina', help: 'Dark grime in every dent, like old silver or a buried object.', min: 0, max: 100, step: 1, unit: '%', value: st.d.dirt, onInput: (v) => { st.d.dirt = v; applyMaterial(); rebuild(); } }),
    );
    const again = document.createElement('p');
    again.innerHTML = '<button type="button" class="btn" style="margin-top:10px">New random damage</button>';
    again.querySelector('button').addEventListener('click', () => { st.d.seed = Math.floor(Math.random() * 99999); rebuild(); });
    body.append(again);
    $('[data-destroy]', main).open = st.d.dmg > 0 || st.d.dirt > 0;
  }

  /* ── undo / redo ── */
  const hist = createHistory();
  const stateObj = () => ({ p: st.p, metal: st.metal, accent: st.accent, sys: st.sys, e: st.e, pr: st.pr, d: st.d, col: st.col });
  let lastState = null;
  function record() {
    const obj = JSON.parse(JSON.stringify(stateObj()));
    const snap = JSON.stringify(obj);
    if (hist.push(snap, changedKeys(lastState, obj))) lastState = obj;
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    const u = $('[data-act="undo"]', main), r = $('[data-act="redo"]', main);
    if (u) u.disabled = !hist.canUndo;
    if (r) r.disabled = !hist.canRedo;
  }
  function restore(snap, verb) {
    if (!snap) { toast(`Nothing to ${verb}.`, 1400); return; }
    const o = JSON.parse(snap);
    lastState = o;
    Object.assign(st, { p: o.p, metal: o.metal, accent: o.accent, sys: o.sys, e: o.e, pr: o.pr, d: o.d, col: o.col });
    applyMaterial();
    renderControls(); renderMaterials(); renderEngrave(); renderPrint(); renderDestroy();
    rebuild();
    updateHistoryButtons();
  }
  const undo = () => restore(hist.undo(), 'undo');
  const redo = () => restore(hist.redo(), 'redo');

  /* ── status bar ── */
  function setBusy(on) {
    $('[data-busy]', main).hidden = !on;
    const s = $('[data-sb-state]', main);
    s.dataset.state = on ? 'busy' : st.result?.failed ? 'error' : st.result?.empty ? 'idle' : 'ready';
    $('span', s).textContent = on ? 'Building…' : st.result?.failed ? 'Build failed — try other values' : st.result?.empty ? (T.emptyHint || 'Nothing to show yet') : 'Ready';
  }
  function updateStatus(ms) {
    const r = st.result;
    if (!r || r.empty) { ['size', 'tris', 'time'].forEach((k) => { $(`[data-sb-${k}]`, main).textContent = ''; }); return; }
    const { tris, size } = viewer.stats();
    const mm = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
    $('[data-sb-size]', main).textContent = `${mm(size[0])} × ${mm(size[1])} × ${mm(size[2])} mm`;
    $('[data-sb-tris]', main).textContent = `${tris.toLocaleString('en')} tris`;
    $('[data-sb-time]', main).textContent = `${Math.round(ms)} ms`;
  }

  /* ── build ── */
  let timer = 0, fitNext = true, buildNo = 0;
  async function prepare() {
    const src = T.params.find((d) => d.type === 'source');
    if (src && String(st.p[src.key]).startsWith('m:') && st.pixelsFrom !== st.p[src.key] && MOTIFS[st.p[src.key].slice(2)]) {
      st.pixels = await motifPixels(st.p[src.key].slice(2), 1000);
      st.pixelsFrom = st.p[src.key];
      if (!st.renderedFrom) { st.renderedFrom = true; renderControls(); }
    }
    st.designC = st.designC || new Map();
    for (const d of T.params) if (d.type === 'design' && st.p[d.key] && !st.designC.has(st.p[d.key])) st.designC.set(st.p[d.key], await designCanvas(st.p[d.key]));
    st.motifCanvas = st.motifCanvas || new Map();
    for (const m of T.hasMotif?.(st.p) || []) if (!st.motifCanvas.has(m)) st.motifCanvas.set(m, await renderMotif(m, 700));
    const fonts = [];
    for (const d of T.params) if (d.type === 'font') fonts.push([st.p[d.key], T.params.filter((x) => x.type === 'text').map((x) => st.p[x.key]).join('')]);
    await Promise.all(fonts.map(([f, t]) => ensureFont(f, t)));
    for (const d of T.params) {
      const id = d.type === 'symbol' ? st.p[d.key] : '';
      if (id && !st.symCanvas.has(id)) {
        const doc = await getSymbol(id);
        if (doc) { st.symCanvas.set(id, await renderSymbol(doc, 600)); st.symPixels.set(id, await symbolPixels(doc)); }
      }
    }
  }
  function rebuild(fit = false) {
    fitNext = fitNext || fit;
    clearTimeout(timer);
    const heavy = st.d.dmg > 0 || st.d.dirt > 0 || T.slow || st.e.kind !== 'none' || st.pr.kind !== 'none';
    if (heavy) setBusy(true);
    timer = setTimeout(async () => {
      const my = ++buildNo;
      const t0 = performance.now();
      setBusy(true);
      await prepare();
      if (my !== buildNo) return;
      let r;
      try {
        r = T.build(st.p, {
          makeCanvas, pixels: st.pixels, model: st.model, material: st.metal,
          symbolCanvas: (id) => st.symCanvas.get(id) || null, symbolPixels: (id) => st.symPixels.get(id) || null,
          motifCanvas: (id) => st.motifCanvas?.get(id) || null,
          designCanvas: (id) => (id && st.designC?.get(id)) || null,
        });
        // engrave / emboss
        st.engraved = false;
        if (!r.empty && st.e.kind !== 'none' && !T.noEngrave) {
          const box = new THREE.Box3();
          for (const part of r.parts) if (!part.instances) { part.geometry.computeBoundingBox(); box.union(part.geometry.boundingBox); }
          if (!box.isEmpty()) {
            const [fw, fh] = faceSize(box, st.e.side);
            const sizeMm = (Math.min(fw, fh) * st.e.size) / 100;
            const mask = await engraveMask(sizeMm);
            if (my !== buildNo) return;
            if (mask) {
              const opts = { mask, box, side: st.e.side, offset: [(st.e.x / 100) * (fw / 2), (st.e.y / 100) * (fh / 2)], rot: st.e.rot, depth: st.e.depth, mode: st.e.mode, fill: st.e.fill, height: sizeMm, fine: st.e.hq };
              r.parts = r.parts.map((part) => (part.instances ? part : { ...part, geometry: engrave(part.geometry, opts) }));
              r.volume = r.parts.reduce((sum, part) => sum + geometryVolume(part.geometry) * (part.instances?.length || 1), 0);
              if (st.e.mode === 'engrave') r.minWall = Math.max(0, (r.minWall || 0) - st.e.depth);
              r.dims.push(['Engraving', `${{ text: `“${st.e.text}”`, motif: MOTIFS[st.e.motif].label, symbol: 'your symbol', image: 'your design' }[st.e.kind]} · ${st.e.side} · ${sizeMm.toFixed(1)} mm · ${st.e.mode} ${st.e.depth} mm${st.e.fill ? ' · lime enamel' : ''}`]);
              if (st.e.mode === 'engrave' && st.e.depth > (T.minWall || 0.8) * 0.6 && r.minWall < (T.minWall || 0.8)) r.warnings.push(`The engraving (${st.e.depth} mm) is deep for this wall. Make it shallower or the piece thicker.`);
              if (r.parts.some((x) => x.instances)) r.warnings.push('Chains are not engraved link by link.');
              st.engraved = true;
            }
          }
        }
        if (!r.empty && !T.noDestroy && (st.d.dmg > 0 || st.d.dirt > 0)) {
          let depth = 0;
          r.parts = r.parts.map((part) => {
            const out = destroy(part.geometry, { amount: st.d.dmg / 100, dirt: st.d.dirt / 100, style: st.d.style, seed: st.d.seed, wall: r.minWall || T.minWall || 1 });
            depth = Math.max(depth, out.depth);
            return { ...part, geometry: out.geometry };
          });
          if (depth > 0) {
            r.volume = r.parts.reduce((s, part) => s + geometryVolume(part.geometry) * (part.instances?.length || 1), 0);
            r.minWall = Math.max(0, r.minWall - depth);
            r.dims.push(['Destroyed', `${st.d.dmg} % ${DESTROY_STYLES.find(([k]) => k === st.d.style)[1].toLowerCase()}, up to ${depth.toFixed(2)} mm deep`]);
          }
          if (st.d.dirt > 0) r.dims.push(['Dirt', `${st.d.dirt} % (colour only, not in the STL)`]);
        }
      } catch (e) {
        console.error(e);
        r = { parts: [], volume: 0, minWall: 0, warnings: ['This combination could not be built. Try other values.'], dims: [], title: T.label, empty: true, failed: true };
      }
      // print (after destroy mode, so the colours sit on the final surface)
      let printCanvas = null, printRepeat = false;
      if (r?.texture && st.pr.kind === 'none') { printCanvas = r.texture.canvas; printRepeat = !!r.texture.repeat; }
      if (r && !r.empty && st.pr.kind !== 'none') {
        try {
          const art = await printArt();
          if (my !== buildNo) return;
          const box = new THREE.Box3();
          for (const part of r.parts) if (!part.instances) { part.geometry.computeBoundingBox(); box.union(part.geometry.boundingBox); }
          if (art && !box.isEmpty()) {
            const [fw, fh] = faceSize(box, st.pr.side);
            let h = (Math.min(fw, fh) * st.pr.size) / 100, w = h * art.aspect;
            if (st.pr.tile && st.pr.size >= 100) { w = fw; h = fh; }
            const opts = { box, side: st.pr.side, offset: [(st.pr.x / 100) * (fw / 2), (st.pr.y / 100) * (fh / 2)], rot: st.pr.rot, width: w, height: h };
            r.parts = r.parts.map((part) => (part.instances ? part : { ...part, geometry: printOnto(part.geometry, opts) }));
            // texture: the material colour behind, the print on top
            const look = lookOf(st.metal, isHome(T) || !MATERIALS[st.metal]);
            const maxTex = Math.min(4096, viewer.renderer.capabilities.maxTextureSize || 4096);
            const W = Math.min(maxTex, Math.max(512, Math.round(2048 * Math.min(4, w / h)))), Hh = Math.min(maxTex, Math.round(W / (w / h)));
            printCanvas = makeCanvas(W, Hh);
            const x = printCanvas.getContext('2d');
            x.fillStyle = st.col.color || look.color; x.fillRect(0, 0, W, Hh);
            if (st.pr.tile && st.pr.size >= 100) { const th = W / art.aspect; for (let yy = 0; yy < Hh; yy += th) x.drawImage(art.canvas, 0, yy, W, th); } // whole side: keep the pattern's proportions
            else x.drawImage(art.canvas, 0, 0, W, Hh);
            r.dims.push(['Print', `${{ motif: MOTIFS[st.pr.motif].label, image: 'your design', text: `“${st.pr.text}”` }[st.pr.kind]} · ${st.pr.side} · ${w.toFixed(0)} × ${h.toFixed(0)} mm`]);
          }
        } catch (e) { console.error(e); }
      }
      if (my !== buildNo) return;
      viewer.setPrint(printCanvas, { repeat: printRepeat });
      applyMaterial();
      st.result = r;
      viewer.setParts(r.parts);
      if (fitNext) { viewer.fit(T.view); fitNext = false; }
      updateChecks();
      drawPreview();
      renderFlat();
      syncHash();
      setBusy(false);
      updateStatus(performance.now() - t0);
      record();
      $('[data-dmg-badge]', main).hidden = !st.d.dmg;
      $('[data-dmg-badge]', main).textContent = `${st.d.dmg} %`;
      if (st.tab === 'save') renderSave();
    }, heavy ? 220 : 16);
  }

  const gramsFor = (key) => grams(st.result?.volume || 0, matInfo(T, key).density);
  const materialLabel = () => `${matInfo(T, st.metal).label}${st.accent ? ' + lime accent' : ''}`;
  function updateChecks() {
    const r = st.result;
    if (!r) return;
    const limit = T.minWall || 0.8;
    $('[data-weight]', main).textContent = r.empty ? '' : `≈ ${weightLabel(gramsFor(st.metal))} · ${matInfo(T, st.metal).label}`;
    const extra = !r.empty && r.minWall < limit && st.d.dmg > 0 ? [`Destroy mode leaves about ${r.minWall.toFixed(2)} mm at the thinnest point (minimum ${limit} mm). Lower the damage if you want to cast or print it.`] : [];
    $('[data-checks]', main).innerHTML = [...r.warnings, ...extra].map((w) => `<p class="warn">${esc(w)}</p>`).join('')
      + (r.empty ? '' : r.minWall >= limit ? `<p class="ok">✓ Thinnest part ${r.minWall.toFixed(2)} mm: thick enough (min. ${limit} mm).</p>` : '');
  }

  /* ── link in the address bar ── */
  function engraveQuery(q) {
    const e = st.e;
    if (e.kind === 'none') return;
    q.set('ek', e.kind);
    if (e.kind === 'text') { q.set('et', e.text); q.set('ef', e.font); }
    if (e.kind === 'motif') q.set('em', e.motif);
    if (e.kind === 'symbol') q.set('es', e.sym);
    if (e.kind === 'image' && e.design) q.set('edz', e.design);
    q.set('eside', e.side); q.set('esz', e.size); q.set('ed', e.depth);
    if (e.x) q.set('ex', e.x); if (e.y) q.set('ey', e.y); if (e.rot) q.set('er', e.rot);
    if (e.mode !== 'engrave') q.set('emode', e.mode); if (e.fill) q.set('efill', '1'); if (e.hq) q.set('ehq', '1');
  }
  function hashFor() {
    const q = new URLSearchParams();
    const d = defaults(T);
    for (const def of T.params) {
      let v = st.p[def.key];
      if (def.type === 'model') continue;
      if (def.type === 'source' && String(v).startsWith('m:') && st.pixelsFrom === v) { q.set(def.key, v); continue; }
      if (def.type === 'source' && (st.pixels || v === 'custom')) {
        if (!st.result?.shapes?.length) continue;
        v = `o:${encodeShapes(st.result.shapes, st.result.box)}`;
      }
      if (v === d[def.key] || v === '' || v === undefined) continue;
      q.set(def.key, def.type === 'toggle' ? (v ? '1' : '0') : String(v));
    }
    if (st.metal !== (T.defaultMaterial || materialsOf(T)[0])) q.set('mat', st.metal);
    if (st.accent) q.set('acc', '1');
    if (st.sys !== 'eu') q.set('sys', st.sys);
    if (st.d.dmg) { q.set('dmg', st.d.dmg); q.set('dst', st.d.style); q.set('dseed', st.d.seed); }
    if (st.d.dirt) { q.set('dirt', st.d.dirt); q.set('dseed', st.d.seed); }
    engraveQuery(q);
    const pr = st.pr;
    if (pr.kind !== 'none') {
      q.set('pk', pr.kind); if (pr.kind === 'motif') q.set('pm', pr.motif); if (pr.kind === 'image' && pr.design) q.set('pd', pr.design); if (pr.kind === 'text') { q.set('pt', pr.text); q.set('pf', pr.font); }
      if (pr.kind !== 'image') q.set('pc', pr.color);
      q.set('pside', pr.side); q.set('psz', pr.size); if (pr.x) q.set('px', pr.x); if (pr.y) q.set('py', pr.y); if (pr.rot) q.set('pr', pr.rot);
      if (pr.tile) { q.set('ptile', '1'); q.set('ptn', pr.tiles); }
    }
    if (st.col.color) q.set('col', st.col.color);
    if (st.project) q.set('prj', st.project.id);
    if (st.col.accent !== '#c4ef2f') q.set('acol', st.col.accent);
    const s = q.toString();
    return `#/${typeId}${s ? `?${s}` : ''}`;
  }
  let hashTimer;
  function syncHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => { try { history.replaceState(null, '', hashFor()); } catch { /* ignore */ } }, 300);
  }
  const shareUrl = () => `${location.origin}${location.pathname}${hashFor()}`;
  const localOnly = () => [
    ...(st.model ? ['Uploaded 3D models stay on your device: the link shows the settings, not the file.'] : []),
    ...(T.params.some((d) => d.type === 'symbol' && st.p[d.key]) ? ['Your own symbols live on this device. Others who open the link see the piece without it.'] : []),
    ...(T.params.some((d) => d.type === 'font' && String(st.p[d.key]).startsWith('Studio ')) ? ['Your uploaded font lives on this device. Others see a standard font.'] : []),
    ...(st.pixels && st.p.mode === 'relief' ? ['Reliefs come from your picture, which is not in the link.'] : []),
    ...(st.e.kind === 'image' || st.pr.kind === 'image' ? ['Your own designs stay on your device. Others who open the link see the piece without them.'] : []),
    ...(st.pr.kind !== 'none' || st.col.color ? ['STL files have no colour. Use “Colour model (GLB)” for colour 3D printing or other apps.'] : []),
  ];

  /* ── step 3 ── */
  const fileBase = () => `triad-${typeId}-${new Date().toISOString().slice(0, 10)}`;
  const poster = (mark, scale = 1) => renderPoster(viewer, { mark, scale, title: st.result.title, material: materialLabel() });
  function renderSave() {
    const r = st.result;
    const box = $('#save', main);
    if (!r) return;
    const keepName = $('#design-name', box)?.value;
    const mats = materialsOf(T);
    const weights = mats.map((k) => `<li${k === st.metal ? ' aria-current="true"' : ''}>${k === st.metal ? '<b>' : ''}${esc(matInfo(T, k).label)}: ≈ ${weightLabel(gramsFor(k))}${k === st.metal ? '</b>' : ''}</li>`).join('');
    const limit = T.minWall || 0.8;
    box.innerHTML = `
      <h1 class="section-title">Save &amp; share</h1>
      <div class="card" style="margin-top:12px">
        <p class="label muted">Info card</p>
        <h2>${esc(r.title)}</h2>
        <dl>${r.dims.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
          <dt>Material</dt><dd>${esc(materialLabel())}</dd>
          <dt>Weight</dt><dd><ul class="weights">${weights}</ul></dd>
          <dt>Thinnest</dt><dd>${r.minWall ? `${r.minWall.toFixed(2)} mm` : '–'} ${r.minWall && r.minWall < limit ? `(below ${limit} mm)` : ''}</dd></dl>
        ${r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
      </div>
      <div class="field" style="margin-top:16px"><label for="design-name" class="label">Name of your design</label>
        <input type="text" id="design-name" maxlength="60" value="${esc(keepName || r.title)}"></div>
      <div class="save-actions">
        <button type="button" class="btn btn--lime" data-a="stl" ${r.empty ? 'disabled' : ''}>Download STL <small>3D print · casting · CNC</small></button>
        ${(r.downloads || []).map((dl, i) => `<button type="button" class="btn" data-dl="${i}">${esc(dl.label)} <small>${esc(dl.small || '')}</small></button>`).join('')}
        <button type="button" class="btn btn--solid" data-a="blender" ${r.empty ? 'disabled' : ''}>Open in Blender <small>edit further, then upload back</small></button>
        <button type="button" class="btn" data-a="bryce" ${r.empty ? 'disabled' : ''}>Open in Bryce <small>OBJ + MTL · also Daz, C4D, Maya</small></button>
        <button type="button" class="btn" data-a="glb" ${r.empty ? 'disabled' : ''}>Colour model (GLB) <small>colours, print, enamel</small></button>
        <button type="button" class="btn" data-a="poster" ${r.empty ? 'disabled' : ''}>Image for Instagram <small>1080 × 1350 PNG</small></button>
        <label class="check"><input type="checkbox" data-mark checked> <span>Add TRIAD lettering to the image</span></label>
        <label class="check"><input type="checkbox" data-hi> <span>Extra high resolution (2160 × 2700, for print and zoom)</span></label>
        <button type="button" class="btn" data-a="card" ${r.empty ? 'disabled' : ''}>Info card image <small>sizes &amp; weight for your maker</small></button>
        <button type="button" class="btn" data-a="link">Share link <small>everything is in the link</small></button>
        <button type="button" class="btn btn--lime" data-a="save">${st.project ? 'Update project' : 'Save project'} <small>with notes &amp; concept art, in a collection</small></button>
        <button type="button" class="btn btn--solid" data-a="send" ${r.empty ? 'disabled' : ''}>Send to TRIAD <small>submit to the Darkroom</small></button>
      </div>
      ${localOnly().map((w) => `<p class="muted" style="font-size:13px;margin-top:10px">${esc(w)}</p>`).join('')}
      <p class="muted" style="font-size:13px;margin-top:14px">STL files are in millimetres. Weights are estimates for solid material.</p>`;
    const name = () => ($('#design-name', box).value.trim() || r.title);
    const act = {
      stl: () => exportSTL(),
      blender: async () => {
        toast('Preparing the model for Blender…');
        try {
          const buf = await viewer.exportGLB();
          download(new Blob([buf], { type: 'model/gltf-binary' }), `${fileBase()}-blender.glb`);
          openBlenderGuide();
        } catch (e) { console.error(e); toast('The model could not be exported.'); }
      },
      glb: async () => {
        toast('Preparing the colour model…');
        try { const buf = await viewer.exportGLB(); download(new Blob([buf], { type: 'model/gltf-binary' }), `${fileBase()}.glb`); toast('GLB saved: open it in any 3D app, colour 3D print services, or AR.'); }
        catch (e) { console.error(e); toast('The colour model could not be made.'); }
      },
      poster: async () => { const c = await poster($('[data-mark]', box).checked, $('[data-hi]', box).checked ? 2 : 1); c.toBlob((b) => download(b, `${fileBase()}-instagram.png`)); toast('Image saved.'); },
      card: async () => {
        const c = await renderInfoCard(viewer, { name: name(), result: st.result, materialLabel: materialLabel(), weights: materialsOf(T).slice(0, 4).map((k) => [matInfo(T, k).label, weightLabel(gramsFor(k))]), url: shareUrl() });
        c.toBlob((b) => download(b, `${fileBase()}-info.png`));
        toast('Info card saved.');
      },
      link: async () => {
        const url = shareUrl();
        if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: `${name()} · TRIAD Studio`, url }); return; } catch { /* cancelled */ } }
        try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone with it sees this design.'); }
        catch { prompt('Copy this link:', url); }
      },
      save: () => saveAsProject(name()),
      bryce: () => exportOBJ(true).catch((e) => { console.error(e); toast('The OBJ file could not be made.'); }),
      send: () => openSendDialog({ makeImage: () => poster(true), title: name(), caption: `${st.result.title} · ${materialLabel()}. Designed in TRIAD Studio.` }),
    };
    $$('[data-a]', box).forEach((b) => b.addEventListener('click', () => act[b.dataset.a]()));
    $$('[data-dl]', box).forEach((b) => b.addEventListener('click', async () => {
      const dl = r.downloads[Number(b.dataset.dl)];
      const pr = st.project;
      const concepts = [];
      for (const id of pr?.concepts || []) { const c = await designCanvas(id, 512); if (c) { const k = 260 / Math.max(c.width, c.height); const t = makeCanvas(Math.round(c.width * k), Math.round(c.height * k)); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); concepts.push(t.toDataURL('image/png')); } }
      const prints = [];
      if (st.pr.kind !== 'none') prints.push(`Print: ${st.pr.kind === 'motif' ? MOTIFS[st.pr.motif].label : st.pr.kind === 'text' ? `“${st.pr.text}”` : 'own design'} · ${st.pr.side} · ${st.pr.size}%`);
      if (st.e.kind !== 'none') prints.push(`${st.e.mode === 'emboss' ? 'Embossed' : 'Engraved'} ${st.e.kind} · ${st.e.side}`);
      const ctx = { name: name(), notes: pr ? pr.notes || '' : st.draftNotes || '', concepts, material: materialLabel(), prints, fill: matLook(T, st.metal)?.swatch };
      download(await dl.make(ctx), dl.filename); toast(`${dl.label} saved.`);
    }));
  }

  function openBlenderGuide() {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-labelledby', 'bl-h');
    dlg.innerHTML = `<form class="dlg" method="dialog">
      <div class="dlg-head"><h2 id="bl-h" class="section-title">Continue in Blender</h2><button class="icon-btn" value="x" aria-label="Close">×</button></div>
      <p>Your model was saved as a <b>.glb</b> file (with materials, colours, print and enamel).</p>
      <ol style="padding-left:20px;display:grid;gap:6px">
        <li>Open <b>Blender</b> (free from blender.org).</li>
        <li><b>File → Import → glTF 2.0 (.glb)</b> and choose the file.</li>
        <li>To work in millimetres: <b>Scene → Units → Unit Scale 0.001, Length: Millimeters</b>. The model is true to size.</li>
        <li>Sculpt, model, render — anything Blender can do.</li>
        <li>Back to the Studio: <b>File → Export → glTF 2.0</b> (or STL / OBJ / FBX), then open <a href="#/model">Upload 3D</a> to add engravings, print, destroy mode, materials or to send it to TRIAD.</li>
      </ol>
      <div class="btn-row"><a class="btn btn--lime" href="https://www.blender.org/download/" target="_blank" rel="noopener">Get Blender ↗</a><button class="btn" value="x">Done</button></div>
    </form>`;
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  function openBryceGuide() {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-labelledby', 'br-h');
    dlg.innerHTML = `<form class="dlg" method="dialog">
      <div class="dlg-head"><h2 id="br-h" class="section-title">Continue in Bryce</h2><button class="icon-btn" value="x" aria-label="Close">×</button></div>
      <p>Saved a <b>.zip</b> with your model as <b>OBJ</b> plus its colours (<b>MTL</b>). Unzip it into one folder.</p>
      <ol style="padding-left:20px;display:grid;gap:6px">
        <li>Open <b>Bryce</b> (Daz 3D) on your computer.</li>
        <li><b>File → Import Object…</b> and choose the <b>.obj</b> file. Keep the .mtl next to it, then the colours come along.</li>
        <li>Bryce sizes imports to its own units: scale it in the object's attributes if needed, then drop it into your terrain, sky and water.</li>
        <li>Back to the Studio: export from Bryce (e.g. as OBJ) and open it in <a href="#/model">Upload 3D</a> for engravings, print, destroy mode or to send it to TRIAD.</li>
      </ol>
      <p class="muted" style="font-size:13px">Bryce is a desktop program without a web version or interface for other apps, so it cannot run inside the Studio. For a quick Bryce-style look right here, switch on the <b>landscape scene</b> in the viewport (L). The same file also opens in Blender, Cinema 4D, Maya, Daz Studio and ZBrush.</p>
      <div class="btn-row"><button class="btn" value="x">Done</button></div>
    </form>`;
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  /* ── flat view & point editing (clothing) ── */
  st.view = '3d';
  if (T.flatEditor) $('[data-viewsw]', main).hidden = false;
  function setDrawingView(v) {
    st.view = v;
    $$('[data-view]', main).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === v)));
    $('[data-flat]', main).hidden = v === '3d';
    viewer.renderer.domElement.style.visibility = v === '3d' ? 'visible' : 'hidden';
    if (v !== '3d') markCam('');
    renderFlat();
  }
  $$('[data-view]', main).forEach((b) => b.addEventListener('click', () => setDrawingView(b.dataset.view)));
  function renderFlat() {
    const box = $('[data-flat]', main);
    if (!T.flatEditor || st.view === '3d' || !st.result?.flats) return;
    const fill = matLook(T, st.metal)?.swatch || '#ecebe5';
    const handles = st.view === 'edit';
    box.innerHTML = ['front', 'back'].map((v) => { const f = flatSVG(st.result.flats[v], { fill: st.col.color || fill, handles, w: Math.max(f0(st.result.flats[v]), 1) }); return `<figure><figcaption class="label">${v}</figcaption><svg viewBox="${f.box.join(' ')}" data-side="${v}" role="img" aria-label="${v} flat drawing">${f.svg}</svg></figure>`; }).join('')
      + (handles ? `<p class="flat-help">Drag a point to reshape. ${st.p.asym ? 'Left and right are edited separately.' : 'Both sides move together (turn on “Asymmetric editing” under More).'} <button type="button" class="btn" data-reset>Reset points</button></p>` : '');
    if (!handles) return;
    $('[data-reset]', box)?.addEventListener('click', () => { st.p.edits = ''; rebuild(); });
    for (const svg of $$('svg', box)) {
      svg.addEventListener('pointerdown', (e) => {
        const h = e.target.closest('.flat-handle');
        if (!h) return;
        e.preventDefault();
        svg.setPointerCapture(e.pointerId);
        const name = h.dataset.pt;
        const start = toSvg(svg, e);
        const edits = parseEdits(st.p.edits);
        const side = name.endsWith('_L') ? 'L' : name.endsWith('_R') ? 'R' : '';
        const base = name.replace(/_[LR]$/, '');
        const key = st.p.asym || !side ? name : base;
        const sign = !st.p.asym && side === 'L' ? -1 : 1;
        const orig = edits[key] ? [...edits[key]] : [0, 0];
        const move = (ev) => {
          const pnt = toSvg(svg, ev);
          edits[key] = [orig[0] + sign * (pnt.x - start.x), orig[1] - (pnt.y - start.y)];
          st.p.edits = stringifyEdits(edits);
          st.result.flats = garment.flats(st.p);
          for (const s2 of $$('svg[data-side]', box)) { const v = s2.dataset.side; const f = flatSVG(st.result.flats[v], { fill: st.col.color || matLook(T, st.metal)?.swatch || '#ecebe5', handles: true, w: Math.max(f0(st.result.flats[v]), 1) }); s2.innerHTML = f.svg; }
        };
        const up = () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up); syncHash(); rebuild(); };
        svg.addEventListener('pointercancel', up);
        svg.addEventListener('pointermove', move);
        svg.addEventListener('pointerup', up);
      });
    }
  }
  const f0 = (view) => { const xs = view.outline.map((q) => q.x); return (Math.max(...xs) - Math.min(...xs)) / 500; };
  const toSvg = (svg, e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };

  /* ── projects: notes & concept art ── */
  const thumbnail = () => {
    try {
      const shot = viewer.snapshot(360, 450, { fill: 0.7 });
      const c = makeCanvas(360, 450); const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, '#f2f4f3'); g.addColorStop(1, '#d6dcde');
      x.fillStyle = g; x.fillRect(0, 0, 360, 450); x.drawImage(shot, 0, 0); // misty background instead of black
      return c.toDataURL('image/jpeg', 0.85);
    } catch { return ''; }
  };
  async function saveAsProject(nm) {
    const saved = await openProjectDialog({ project: st.project, defaults: { name: nm, type: typeId, hash: hashFor().replace(/[?&]prj=[^&]*/, '').replace(/^(#\/\w+)&/, '$1?'), thumb: thumbnail(), notes: st.project?.notes ?? st.draftNotes ?? '' } });
    if (saved) { st.project = saved; syncHash(); renderNotes(); if (st.tab === 'save') renderSave(); }
  }
  function renderNotes() {
    const body = $('[data-notes-body]', main);
    const pr = st.project;
    body.innerHTML = `<p class="ctl-help" style="margin-top:4px">${pr ? `Project “${esc(pr.name)}”${pr.collection ? ' · in a collection' : ''}. Notes save automatically.` : 'Write down ideas while you design. They are kept when you “Save project”.'}</p>
      <textarea class="input" rows="5" maxlength="8000" placeholder="Fabric, fit, details, references, who it is for …" data-note>${esc(pr ? pr.notes || '' : st.draftNotes || '')}</textarea>
      <div class="concept-row" data-cthumbs style="margin-top:8px"></div>
      <p class="btn-row" style="margin-top:8px"><button type="button" class="btn" data-pdlg>${pr ? 'Concept art & collection…' : 'Save project…'}</button><a class="btn" href="#/collections">Collections</a></p>`;
    $('[data-notes-badge]', main).hidden = !pr;
    let t;
    $('[data-note]', body).addEventListener('input', (e) => {
      if (!st.project) { st.draftNotes = e.target.value; return; }
      clearTimeout(t); t = setTimeout(async () => { st.project = await saveProject({ ...st.project, notes: e.target.value }); }, 500);
    });
    $('[data-pdlg]', body).addEventListener('click', () => saveAsProject($('#design-name', main)?.value?.trim() || st.project?.name || st.result?.title || T.label));
    if (pr?.concepts?.length) listDesigns().then((all) => { $('[data-cthumbs]', body).innerHTML = pr.concepts.map((id) => all.find((d) => d.id === id)).filter(Boolean).map((d) => `<img src="${d.thumb}" alt="Concept art: ${esc(d.name)}" title="${esc(d.name)}">`).join(''); });
  }
  if (st.prj) getProject(st.prj).then((pr) => { if (pr) { st.project = pr; renderNotes(); $('[data-notes]', main).open = true; } });

  /* ── go ── */
  renderControls();
  renderMaterials();
  renderNotes();
  renderEngrave();
  if (st.e.kind === 'none') $('[data-engrave]', main).open = false;
  if (T.noEngrave) $('[data-engrave]', main).hidden = true;
  if (T.noDestroy) $('[data-destroy]', main).hidden = true;
  if (T.noPrint) $('[data-print]', main).hidden = true;
  renderPrint();
  if (st.pr.kind === 'none') $('[data-print]', main).open = false;
  renderDestroy();
  showTab('adjust', false, false);
  rebuild(true);
  const onTheme = () => { if (viewer.grid) viewer.setGrid(true); viewer.render(); };
  window.addEventListener('studio:theme', onTheme);

  return {
    update(q) {
      Object.assign(st, parseQuery(T, q));
      st.pixels = null;
      applyMaterial();
      renderControls(); renderMaterials(); renderEngrave(); renderPrint(); renderDestroy(); rebuild(true);
    },
    destroy() {
      closeMenu();
      clearTimeout(timer); buildNo++;
      clearTimeout(hashTimer);
      window.removeEventListener('studio:theme', onTheme);
      viewer.destroy();
    },
  };
}
