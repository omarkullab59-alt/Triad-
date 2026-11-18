// The 3D editor for every object: 1. What? (start page) → 2. Adjust → 3. Save & share
import { createViewer, MATERIALS, HOME_LOOKS, ACCENT } from './viewer.js';
import { partsToSTL } from './stl.js';
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
import { engrave, SIDES, faceSize } from './engrave.js';
import { textMask, canvasMask } from './revolve.js';
import { motifOptions, renderMotif, motifPixels, MOTIFS, trimCanvas } from '../lib/motifs.js';
import { openOrderDialog } from '../lib/order.js';
import * as THREE from 'three';
import { slider, choice, toggle, textField, ringSize } from '../ui/controls.js';
import { $, $$, esc, toast, download, makeCanvas, fileToPixels, loadImage, imageToPixels, reducedMotion } from '../lib/dom.js';
import { METALS, HOME, grams, weightLabel } from '../lib/sizes.js';
import { saveDesign, takeHandoff } from '../lib/store.js';
import { fontOptions, ensureFont, addFontFile, initFonts } from '../lib/fonts.js';
import { listSymbols, getSymbol, renderSymbol, symbolPixels } from '../lib/symbols.js';
import { renderPoster, renderInfoCard } from './images.js';
import { openSendDialog } from '../lib/send.js';

export const TYPES = { ring, pendant, lettering, earrings, bangle, chain, wearable, plate, vessel, cutlery, cabinet, sculpture, sketch3d, model };
const MAX_VISIBLE = 5;
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
      mode: q.get('emode') === 'emboss' ? 'emboss' : 'engrave', fill: q.get('efill') === '1',
    },
    order: q.get('order') === '1',
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
    <section class="stage" aria-label="3D preview">
      <p class="stage-hint label">Drag to turn · pinch or double-tap to zoom</p>
      <div class="stage-tools" role="group" aria-label="View">
        <button type="button" data-v="left" aria-label="Turn left">⟲</button>
        <button type="button" data-v="right" aria-label="Turn right">⟳</button>
        <button type="button" data-v="in" aria-label="Zoom in">+</button>
        <button type="button" data-v="out" aria-label="Zoom out">−</button>
        <button type="button" data-v="fit" aria-label="Reset view">⌂</button>
      </div>
      <p class="stage-weight label" aria-live="polite" data-weight></p>
    </section>
    <section class="panel">
      <div class="stepbar" role="tablist" aria-label="Steps">
        <a href="#/"><span class="num">1</span>What?</a>
        <button type="button" role="tab" id="tab-adjust" aria-controls="adjust" data-tab="adjust"><span class="num">2</span>Adjust</button>
        <button type="button" role="tab" id="tab-save" aria-controls="save" data-tab="save"><span class="num">3</span>Save &amp; share</button>
      </div>
      <div id="adjust" role="tabpanel" aria-labelledby="tab-adjust">
        <h1 class="section-title">${esc(T.label)}</h1>
        <div class="group" data-tpl-group><span class="label">Start from</span><div class="chips" data-templates></div></div>
        <div class="group" data-mysym hidden><span class="label">My symbols</span><div class="chips" data-mysyms></div></div>
        <div class="group" data-motifs-group hidden><span class="label">Motifs</span><div class="motif-grid" data-motifs></div></div>
        <div data-controls></div>
        <div class="group"><span class="label">Material</span>
          <div class="chips" role="radiogroup" aria-label="Material" data-metals></div>
          <div data-accent style="margin-top:6px"></div>
        </div>
        <details class="more" data-engrave>
          <summary>Engrave &amp; emboss <span class="tape" style="margin-left:6px;font-size:10px" data-eng-badge hidden>on</span></summary>
          <div data-engrave-body></div>
        </details>
        <details class="more destroy" data-destroy>
          <summary>Destroy mode <span class="tape" style="margin-left:6px;font-size:10px" data-dmg-badge hidden></span></summary>
          <div data-destroy-body></div>
        </details>
        <div data-checks aria-live="polite"></div>
        <p style="margin-top:20px"><button type="button" class="btn btn--solid" data-go-save style="width:100%">Next: save &amp; share →</button></p>
      </div>
      <div id="save" role="tabpanel" aria-labelledby="tab-save" hidden></div>
    </section>
  </div>`;

  const stage = $('.stage', main);
  const viewer = createViewer(stage, { reducedMotion: reducedMotion() });
  viewer.renderer.domElement.tabIndex = 0;
  viewer.renderer.domElement.setAttribute('aria-label', `${T.label}, 3D preview. Arrow keys turn it, plus and minus zoom.`);
  viewer.renderer.domElement.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (k) { e.preventDefault(); viewer.nudge(...k); }
    if (e.key === '+' || e.key === '=') viewer.zoom(0.8);
    if (e.key === '-') viewer.zoom(1.25);
  });
  $$('.stage-tools button', main).forEach((b) => b.addEventListener('click', () => {
    ({ left: () => viewer.nudge(-0.4, 0), right: () => viewer.nudge(0.4, 0), in: () => viewer.zoom(0.75), out: () => viewer.zoom(1.33), fit: () => viewer.fit(T.view) })[b.dataset.v]();
  }));
  const applyMaterial = () => viewer.setMaterial(st.metal, st.accent, { home: isHome(T) || !MATERIALS[st.metal], dirty: st.d.dirt > 0 });
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
        st.pixels = await motifPixels(k, typeId === 'wearable' ? 500 : 420);
        Object.assign(st.p, { shape: 'custom', fill: false, bold: 1, threshold: 128, invert: false });
        renderControls(); rebuild(true);
      });
      grid.append(b);
    }
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
    const visible = T.params.filter((d) => !d.show || d.show(st.p, ctx));
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
      <button type="button" class="btn btn--lime">Open STL / OBJ / GLB / PLY</button><input type="file" accept=".stl,.obj,.glb,.gltf,.ply" hidden></div>`;
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
        st.pixels = await fileToPixels(file, typeId === 'sketch3d' ? 480 : 360);
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
    const acc = $('[data-accent]', main);
    acc.innerHTML = '';
    acc.append(toggle({ name: 'accent', label: `${ACCENT.label} accent`, help: 'Colours the top, plate, front or handles in TRIAD lime (enamel, paint or glaze).', value: st.accent,
      onInput: (v) => { st.accent = v; applyMaterial(); syncHash(); } }));
  }

  /* ── engrave & emboss (any object) ── */
  function renderEngrave() {
    const body = $('[data-engrave-body]', main);
    const e = st.e;
    body.innerHTML = '<p class="ctl-help" style="margin-top:4px">Put text, a motif, your symbol or a picture onto any side. Engrave cuts it in, emboss lifts it out.</p>';
    const set = (k, redraw) => (v) => { e[k] = v; if (redraw) renderEngrave(); rebuild(); };
    body.append(choice({ name: 'ek', label: 'What', help: 'Choose what to put on the piece.', value: e.kind, options: [['none', 'Nothing'], ['text', 'Text'], ['motif', 'Motif'], ['symbol', 'My symbol'], ['image', 'Picture']], onInput: set('kind', true) }));
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
    if (e.kind === 'image') {
      const wrap = document.createElement('div'); wrap.className = 'ctl'; wrap.dataset.key = 'ei';
      wrap.innerHTML = `<div class="ctl-head"><span class="ctl-name">Picture</span></div><p class="ctl-help">A logo, drawing or photo. Dark parts are used.</p><button type="button" class="btn">${st.engImg ? 'Change picture' : 'Upload picture'}</button><input type="file" accept="image/*" hidden>`;
      const input = $('input', wrap);
      $('button', wrap).addEventListener('click', () => input.click());
      input.addEventListener('change', async () => { try { const px = await fileToPixels(input.files[0], 700); st.engImg = alphaCanvas(px); renderEngrave(); rebuild(); } catch { toast('This picture could not be opened.'); } });
      body.append(wrap);
    }
    body.append(
      choice({ name: 'eside', label: 'Where', help: 'The side of the piece it goes on. “Around” wraps it like a label.', value: e.side, options: SIDES, onInput: set('side') }),
      slider({ name: 'esz', label: 'Size', help: 'Height compared with that side of the piece.', min: 3, max: 100, step: 1, unit: '%', value: e.size, onInput: set('size') }),
      slider({ name: 'ed', label: 'Depth', help: 'How deep it is cut (or how high it stands out).', min: 0.05, max: 8, step: 0.05, unit: 'mm', value: e.depth, onInput: set('depth') }),
      choice({ name: 'emode', label: 'Cut in or stand out', help: 'Engrave cuts into the surface, emboss raises it.', value: e.mode, options: [['engrave', 'Engrave'], ['emboss', 'Emboss']], onInput: set('mode') }),
      slider({ name: 'ex', label: 'Move left / right', help: 'Position across that side.', min: -100, max: 100, step: 1, unit: '%', value: e.x, onInput: set('x') }),
      slider({ name: 'ey', label: 'Move down / up', help: 'Position up and down on that side.', min: -100, max: 100, step: 1, unit: '%', value: e.y, onInput: set('y') }),
      slider({ name: 'er', label: 'Rotate', help: 'Turn the engraving.', min: -180, max: 180, step: 1, unit: '°', value: e.rot, onInput: set('rot') }),
      toggle({ name: 'efill', label: 'Fill with lime enamel', help: 'Colours the engraving in TRIAD lime (enamel or paint).', value: e.fill, onInput: set('fill') }),
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
    if (e.kind === 'image') c = st.engImg;
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

  /* ── build ── */
  let timer = 0, fitNext = true, buildNo = 0;
  async function prepare() {
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
    const heavy = st.d.dmg > 0 || st.d.dirt > 0;
    if (heavy) $('[data-weight]', main).textContent = 'Building…';
    timer = setTimeout(async () => {
      const my = ++buildNo;
      await prepare();
      if (my !== buildNo) return;
      let r;
      try {
        r = T.build(st.p, {
          makeCanvas, pixels: st.pixels, model: st.model,
          symbolCanvas: (id) => st.symCanvas.get(id) || null, symbolPixels: (id) => st.symPixels.get(id) || null,
          motifCanvas: (id) => st.motifCanvas?.get(id) || null,
        });
        // engrave / emboss
        st.engraved = false;
        if (!r.empty && st.e.kind !== 'none') {
          const box = new THREE.Box3();
          for (const part of r.parts) if (!part.instances) { part.geometry.computeBoundingBox(); box.union(part.geometry.boundingBox); }
          if (!box.isEmpty()) {
            const [fw, fh] = faceSize(box, st.e.side);
            const sizeMm = (Math.min(fw, fh) * st.e.size) / 100;
            const mask = await engraveMask(sizeMm);
            if (my !== buildNo) return;
            if (mask) {
              const opts = { mask, box, side: st.e.side, offset: [(st.e.x / 100) * (fw / 2), (st.e.y / 100) * (fh / 2)], rot: st.e.rot, depth: st.e.depth, mode: st.e.mode, fill: st.e.fill, height: sizeMm };
              r.parts = r.parts.map((part) => (part.instances ? part : { ...part, geometry: engrave(part.geometry, opts) }));
              r.volume = r.parts.reduce((sum, part) => sum + geometryVolume(part.geometry) * (part.instances?.length || 1), 0);
              if (st.e.mode === 'engrave') r.minWall = Math.max(0, (r.minWall || 0) - st.e.depth);
              r.dims.push(['Engraving', `${{ text: `“${st.e.text}”`, motif: MOTIFS[st.e.motif].label, symbol: 'your symbol', image: 'your picture' }[st.e.kind]} · ${st.e.side} · ${sizeMm.toFixed(1)} mm · ${st.e.mode} ${st.e.depth} mm${st.e.fill ? ' · lime enamel' : ''}`]);
              if (st.e.mode === 'engrave' && st.e.depth > (T.minWall || 0.8) * 0.6 && r.minWall < (T.minWall || 0.8)) r.warnings.push(`The engraving (${st.e.depth} mm) is deep for this wall. Make it shallower or the piece thicker.`);
              if (r.parts.some((x) => x.instances)) r.warnings.push('Chains are not engraved link by link.');
              st.engraved = true;
            }
          }
        }
        if (!r.empty && (st.d.dmg > 0 || st.d.dirt > 0)) {
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
        r = { parts: [], volume: 0, minWall: 0, warnings: ['This combination could not be built. Try other values.'], dims: [], title: T.label, empty: true };
      }
      if (my !== buildNo) return;
      st.result = r;
      viewer.setParts(r.parts);
      if (fitNext) { viewer.fit(T.view); fitNext = false; }
      updateChecks();
      drawPreview();
      syncHash();
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
    q.set('eside', e.side); q.set('esz', e.size); q.set('ed', e.depth);
    if (e.x) q.set('ex', e.x); if (e.y) q.set('ey', e.y); if (e.rot) q.set('er', e.rot);
    if (e.mode !== 'engrave') q.set('emode', e.mode); if (e.fill) q.set('efill', '1');
  }
  function hashFor() {
    const q = new URLSearchParams();
    const d = defaults(T);
    for (const def of T.params) {
      let v = st.p[def.key];
      if (def.type === 'model') continue;
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
    ...(st.e.kind === 'image' ? ['The engraved picture stays on your device.'] : []),
  ];

  /* ── step 3 ── */
  const fileBase = () => `triad-${typeId}-${new Date().toISOString().slice(0, 10)}`;
  const poster = (mark) => renderPoster(viewer, { mark, title: st.result.title, material: materialLabel() });
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
        <button type="button" class="btn" data-a="poster" ${r.empty ? 'disabled' : ''}>Image for Instagram <small>1080 × 1350 PNG</small></button>
        <label class="check"><input type="checkbox" data-mark checked> <span>Add TRIAD lettering to the image</span></label>
        <button type="button" class="btn" data-a="card" ${r.empty ? 'disabled' : ''}>Info card image <small>sizes &amp; weight for your maker</small></button>
        <button type="button" class="btn" data-a="link">Share link <small>everything is in the link</small></button>
        <button type="button" class="btn" data-a="save">Save on this device <small>no account</small></button>
        <button type="button" class="btn btn--lime" data-a="order" ${r.empty ? 'disabled' : ''}>Order this piece <small>price estimate &amp; request</small></button>
        <button type="button" class="btn" data-a="shop">Copy shop link <small>opens straight to “Order”</small></button>
        <button type="button" class="btn btn--solid" data-a="send" ${r.empty ? 'disabled' : ''}>Send to TRIAD <small>submit to the Darkroom</small></button>
      </div>
      ${localOnly().map((w) => `<p class="muted" style="font-size:13px;margin-top:10px">${esc(w)}</p>`).join('')}
      <p class="muted" style="font-size:13px;margin-top:14px">STL files are in millimetres. Weights are estimates for solid material.</p>`;
    const name = () => ($('#design-name', box).value.trim() || r.title);
    const act = {
      stl: () => {
        const buf = partsToSTL(st.result.parts, viewer.exportMatrix());
        download(new Blob([buf], { type: 'model/stl' }), `${fileBase()}.stl`);
        toast('STL saved. Open it in your slicer or send it to your maker.');
      },
      poster: async () => { const c = await poster($('[data-mark]', box).checked); c.toBlob((b) => download(b, `${fileBase()}-instagram.png`)); toast('Image saved.'); },
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
      save: () => {
        const ok = saveDesign({ name: name(), type: typeId, hash: hashFor() });
        toast(ok ? 'Saved on this device. Find it on the start page.' : 'Your browser blocks saving here. Use “Share link” and keep the link instead.');
      },
      order: () => openOrder(),
      shop: async () => { const url = `${shareUrl()}&order=1`.replace(/#\/(\w+)&/, '#/$1?'); try { await navigator.clipboard.writeText(url); toast('Shop link copied: customers land on “Order this piece”.'); } catch { prompt('Copy this link:', url); } },
      send: () => openSendDialog({ makeImage: () => poster(true), title: name(), caption: `${st.result.title} · ${materialLabel()}. Designed in TRIAD Studio.` }),
    };
    $$('[data-a]', box).forEach((b) => b.addEventListener('click', () => act[b.dataset.a]()));
  }

  function openOrder() {
    const r = st.result;
    if (!r || r.empty) return;
    openOrderDialog({
      title: r.title, typeId, category: typeId === 'cabinet' ? 'home' : typeId === 'sculpture' ? 'sculpture' : T.category || 'jewel',
      summary: [['Piece', r.title], ...r.dims.filter(([k]) => !['Weight'].includes(k))],
      materials: materialsOf(T).map((k) => [k, matInfo(T, k).label, gramsFor(k)]), material: st.metal,
      engraved: st.engraved, destroyed: st.d.dmg > 0, enamel: st.accent || st.e.fill, url: shareUrl(),
    });
  }

  /* ── go ── */
  renderControls();
  renderMaterials();
  renderEngrave();
  if (st.e.kind === 'none') $('[data-engrave]', main).open = false;
  renderDestroy();
  showTab('adjust', false, false);
  rebuild(true);
  if (st.order) { const wait = setInterval(() => { if (st.result) { clearInterval(wait); openOrder(); } }, 200); }
  const onTheme = () => viewer.render();
  window.addEventListener('studio:theme', onTheme);

  return {
    update(q) {
      Object.assign(st, parseQuery(T, q));
      st.pixels = null;
      applyMaterial();
      renderControls(); renderMaterials(); renderEngrave(); renderDestroy(); rebuild(true);
    },
    destroy() {
      clearTimeout(timer); buildNo++;
      clearTimeout(hashTimer);
      window.removeEventListener('studio:theme', onTheme);
      viewer.destroy();
    },
  };
}
