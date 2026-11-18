// JEWELLERY: 1. What? (chosen on the start page) → 2. Adjust → 3. Save & share
import { createViewer, MATERIALS, ACCENT } from './viewer.js';
import { partsToSTL } from './stl.js';
import { encodeShapes } from './outline.js';
import { ring } from './types/ring.js';
import { pendant } from './types/pendant.js';
import { earrings } from './types/earrings.js';
import { bangle } from './types/bangle.js';
import { chain } from './types/chain.js';
import { slider, choice, toggle, textField, ringSize } from '../ui/controls.js';
import { $, $$, esc, toast, download, makeCanvas, fileToPixels, loadImage, imageToPixels, reducedMotion } from '../lib/dom.js';
import { METALS, grams } from '../lib/sizes.js';
import { saveDesign, takeHandoff } from '../lib/store.js';
import { renderPoster, renderInfoCard } from './images.js';
import { openSendDialog } from '../lib/send.js';

const TYPES = { ring, pendant, earrings, bangle, chain };
const MAX_VISIBLE = 5;

const defaults = (t) => Object.fromEntries(t.params.map((q) => [q.key, q.default]));

function parseQuery(t, q) {
  const p = defaults(t);
  for (const def of t.params) {
    if (!q.has(def.key)) continue;
    const raw = q.get(def.key);
    if (def.type === 'range' || def.type === 'ringsize') {
      const n = Number(raw);
      if (Number.isFinite(n)) p[def.key] = def.type === 'range' ? Math.min(def.max, Math.max(def.min, n)) : Math.min(26, Math.max(12, n));
    } else if (def.type === 'toggle') p[def.key] = raw === '1';
    else if (def.type === 'select') { if (def.options.some(([v]) => v === raw)) p[def.key] = raw; }
    else p[def.key] = String(raw).slice(0, def.type === 'source' ? 6000 : def.max || 40);
  }
  return {
    p,
    metal: METALS[q.get('mat')] ? q.get('mat') : 'silver',
    accent: q.get('acc') === '1',
    sys: ['eu', 'us', 'mm'].includes(q.get('sys')) ? q.get('sys') : 'eu',
  };
}

export async function mount(main, typeId, query) {
  const T = TYPES[typeId];
  const st = { ...parseQuery(T, query), pixels: null, result: null, tab: 'adjust' };

  // Draw → "Build as 3D pendant"
  if (typeId === 'pendant') {
    const h = takeHandoff();
    if (h?.dataUrl) {
      try { st.pixels = imageToPixels(await loadImage(h.dataUrl)); Object.assign(st.p, { shape: 'custom', fill: true, bold: 2, threshold: 170 }); } catch { /* ignore */ }
    }
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
        <div class="group"><span class="label">Start from</span><div class="chips" data-templates></div></div>
        <div data-controls></div>
        <div class="group"><span class="label">Material</span>
          <div class="chips" role="radiogroup" aria-label="Material" data-metals></div>
          <div data-accent style="margin-top:6px"></div>
        </div>
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
    ({ left: () => viewer.nudge(-0.4, 0), right: () => viewer.nudge(0.4, 0), in: () => viewer.zoom(0.75), out: () => viewer.zoom(1.33), fit: () => viewer.fit() })[b.dataset.v]();
  }));
  viewer.setMaterial(st.metal, st.accent);

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
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showTab(tabs[(i + 1) % 2].dataset.tab, true); }
    });
  });
  $('[data-go-save]', main).addEventListener('click', () => showTab('save', true));

  /* ── templates ── */
  const tplBox = $('[data-templates]', main);
  T.templates.forEach((tpl) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = tpl.label;
    b.addEventListener('click', () => {
      const { accent, ...rest } = tpl.p;
      st.p = { ...defaults(T), ...(typeId === 'ring' ? { size: st.p.size } : {}), ...(typeId === 'bangle' ? { wrist: st.p.wrist } : {}), ...rest };
      if (typeId === 'pendant') st.pixels = null;
      st.accent = !!accent;
      viewer.setMaterial(st.metal, st.accent);
      renderControls(); renderMaterials();
      rebuild(true);
      toast(`${tpl.label} loaded. Now adjust it.`);
    });
    tplBox.append(b);
  });

  /* ── controls ── */
  const ctlBox = $('[data-controls]', main);
  function renderControls() {
    const focusedKey = document.activeElement?.closest?.('[data-key]')?.dataset.key;
    ctlBox.innerHTML = '';
    const ctx = { hasPixels: !!st.pixels };
    const visible = T.params.filter((d) => !d.show || d.show(st.p, ctx));
    const main = visible.filter((d) => !d.more).slice(0, MAX_VISIBLE);
    const more = visible.filter((d) => d.more || !main.includes(d));
    const make = (d) => {
      const set = (v) => { st.p[d.key] = v; rebuild(); };
      const setAndRedraw = (v) => { st.p[d.key] = v; renderControls(); rebuild(); };
      const common = { name: d.key, label: d.label, help: d.help, value: st.p[d.key] };
      if (d.type === 'range') return slider({ ...common, min: d.min, max: d.max, step: d.step, unit: d.unit, onInput: set });
      if (d.type === 'select') return choice({ ...common, options: d.options, onInput: setAndRedraw });
      if (d.type === 'toggle') return toggle({ ...common, onInput: setAndRedraw });
      if (d.type === 'text') return textField({ ...common, max: d.max, onInput: set });
      if (d.type === 'ringsize') return ringSize({ ...common, system: st.sys, onInput: set, onSystem: (k) => { st.sys = k; renderControls(); syncHash(); } });
      if (d.type === 'source') return sourceControl(d);
      return document.createElement('div');
    };
    main.forEach((d) => ctlBox.append(make(d)));
    if (more.length) {
      const det = document.createElement('details');
      det.className = 'more';
      det.open = st.moreOpen || false;
      det.addEventListener('toggle', () => { st.moreOpen = det.open; });
      det.innerHTML = `<summary>More options <span class="muted" style="text-transform:none;letter-spacing:0">(${more.length})</span></summary>`;
      more.forEach((d) => det.append(make(d)));
      ctlBox.append(det);
    }
    if (focusedKey) {
      const el = ctlBox.querySelector(`[data-key="${focusedKey}"] [aria-checked="true"], [data-key="${focusedKey}"] input, [data-key="${focusedKey}"] select, [data-key="${focusedKey}"] button`);
      el?.focus({ preventScroll: true });
    }
  }

  /* pendant: picture in */
  let preview = null;
  function sourceControl(d) {
    const el = document.createElement('div');
    el.className = 'ctl';
    el.dataset.key = d.key;
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name">${esc(d.label)}</span></div><p class="ctl-help">${esc(d.help)}</p>
      <div class="source drop">
        <canvas width="192" height="192" role="img" aria-label="What we detected from your picture"></canvas>
        <div style="display:grid;gap:8px">
          <button type="button" class="btn btn--lime" data-upload>Upload sketch or photo</button>
          <a class="btn" href="#/draw">Draw it first</a>
          <input type="file" accept="image/*" hidden>
        </div>
      </div>`;
    const input = $('input[type=file]', el);
    $('[data-upload]', el).addEventListener('click', () => input.click());
    const take = async (file) => {
      if (!file || !/^image\//.test(file.type)) { toast('Please choose a picture (JPG, PNG, HEIC is not supported in every browser).'); return; }
      try {
        st.pixels = await fileToPixels(file);
        st.p.shape = 'custom'; st.p.fill = false; st.p.bold = 0;
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
    const m = st.result?.mask;
    if (!m) {
      // decoded outline from a link: draw the shapes
      const r = st.result;
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
    for (let i = 0; i < m.mask.length; i++) {
      const on = m.mask[i];
      img.data.set(on ? [79, 104, 0, 255] : [255, 255, 255, 0], i * 4);
    }
    const tmp = makeCanvas(m.width, m.height);
    tmp.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(tmp, (192 - m.width * k) / 2, (192 - m.height * k) / 2, m.width * k, m.height * k);
  }

  /* ── materials ── */
  function renderMaterials() {
    const box = $('[data-metals]', main);
    box.innerHTML = Object.entries(MATERIALS).map(([k, m]) => `<button type="button" class="chip" role="radio" aria-checked="${k === st.metal}" tabindex="${k === st.metal ? 0 : -1}" data-m="${k}"><span class="swatch" style="background:${m.swatch}"></span>${esc(m.label)}</button>`).join('');
    const btns = $$('[data-m]', box);
    const pick = (b, focus) => { st.metal = b.dataset.m; viewer.setMaterial(st.metal, st.accent); renderMaterials(); updateChecks(); syncHash(); if (focus) $(`[data-m="${st.metal}"]`, main).focus(); };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); pick(btns[(i + d + btns.length) % btns.length], true); } });
    });
    const acc = $('[data-accent]', main);
    acc.innerHTML = '';
    acc.append(toggle({ name: 'accent', label: `${ACCENT.label} accent`, help: 'Fills the top, plate or front with TRIAD lime enamel (preview only, ask your jeweller).', value: st.accent,
      onInput: (v) => { st.accent = v; viewer.setMaterial(st.metal, st.accent); syncHash(); } }));
  }

  /* ── build ── */
  let raf = 0, fitNext = true;
  function rebuild(fit = false) {
    fitNext = fitNext || fit;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      try {
        st.result = T.build(st.p, { makeCanvas, pixels: st.pixels });
      } catch (e) {
        console.error(e);
        st.result = { parts: [], volume: 0, minWall: 0, warnings: ['This combination could not be built. Try other values.'], dims: [], title: T.label, empty: true };
      }
      viewer.setParts(st.result.parts);
      if (fitNext) { viewer.fit(); fitNext = false; }
      updateChecks();
      drawPreview();
      syncHash();
      if (st.tab === 'save') renderSave();
    });
  }

  function weightText(metal = st.metal) {
    const g = grams(st.result?.volume || 0, METALS[metal].density);
    return g < 10 ? g.toFixed(1) : Math.round(g).toString();
  }
  function updateChecks() {
    const r = st.result;
    if (!r) return;
    $('[data-weight]', main).textContent = r.empty ? '' : `≈ ${weightText()} g · ${METALS[st.metal].label}`;
    $('[data-checks]', main).innerHTML = r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')
      + (r.empty ? '' : !r.warnings.length || r.minWall >= 0.8 ? `<p class="ok">✓ Thinnest part ${r.minWall.toFixed(2)} mm: thick enough to cast (min. 0.8 mm).</p>` : '');
  }

  /* ── link in the address bar ── */
  function hashFor() {
    const q = new URLSearchParams();
    const d = defaults(T);
    for (const def of T.params) {
      let v = st.p[def.key];
      if (def.type === 'source') {
        if (st.pixels || v === 'custom') {
          if (!st.result?.shapes?.length) continue;
          v = `o:${encodeShapes(st.result.shapes, st.result.box)}`;
        }
      }
      if (v === d[def.key] || v === '' || v === undefined) continue;
      q.set(def.key, def.type === 'toggle' ? (v ? '1' : '0') : String(v));
    }
    if (st.metal !== 'silver') q.set('mat', st.metal);
    if (st.accent) q.set('acc', '1');
    if (st.sys !== 'eu') q.set('sys', st.sys);
    const s = q.toString();
    return `#/${typeId}${s ? `?${s}` : ''}`;
  }
  let hashTimer;
  function syncHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => { try { history.replaceState(null, '', hashFor()); } catch { /* ignore */ } }, 300);
  }
  const shareUrl = () => `${location.origin}${location.pathname}${hashFor()}`;

  /* ── step 3 ── */
  const fileBase = () => `triad-${typeId}-${new Date().toISOString().slice(0, 10)}`;
  async function poster(mark) {
    return renderPoster(viewer, { mark, title: st.result.title, material: `${METALS[st.metal].label}${st.accent ? ' + lime enamel' : ''}` });
  }
  function renderSave() {
    const r = st.result;
    const box = $('#save', main);
    if (!r) return;
    const keepName = $('#design-name', box)?.value;
    const weights = Object.entries(METALS).map(([k, m]) => `<li${k === st.metal ? ' aria-current="true"' : ''}>${k === st.metal ? '<b>' : ''}${esc(m.label)}: ≈ ${weightText(k)} g${k === st.metal ? '</b>' : ''}</li>`).join('');
    box.innerHTML = `
      <h1 class="section-title">Save &amp; share</h1>
      <div class="card" style="margin-top:12px">
        <p class="label muted">Info card</p>
        <h2>${esc(r.title)}</h2>
        <dl>${r.dims.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
          <dt>Weight</dt><dd><ul class="weights">${weights}</ul></dd>
          <dt>Thinnest</dt><dd>${r.minWall ? `${r.minWall.toFixed(2)} mm` : '–'} ${r.minWall && r.minWall < 0.8 ? '(below 0.8 mm)' : ''}</dd></dl>
        ${r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}
      </div>
      <div class="field" style="margin-top:16px"><label for="design-name" class="label">Name of your design</label>
        <input type="text" id="design-name" maxlength="60" value="${esc(keepName || r.title)}"></div>
      <div class="save-actions">
        <button type="button" class="btn btn--lime" data-a="stl" ${r.empty ? 'disabled' : ''}>Download STL <small>3D print · wax for casting</small></button>
        <button type="button" class="btn" data-a="poster" ${r.empty ? 'disabled' : ''}>Image for Instagram <small>1080 × 1350 PNG</small></button>
        <label class="check"><input type="checkbox" data-mark checked> <span>Add TRIAD lettering to the image</span></label>
        <button type="button" class="btn" data-a="card" ${r.empty ? 'disabled' : ''}>Info card image <small>sizes &amp; weight for your jeweller</small></button>
        <button type="button" class="btn" data-a="link">Share link <small>everything is in the link</small></button>
        <button type="button" class="btn" data-a="save">Save on this device <small>no account</small></button>
        <button type="button" class="btn btn--solid" data-a="send" ${r.empty ? 'disabled' : ''}>Send to TRIAD <small>submit to the Darkroom</small></button>
      </div>
      <p class="muted" style="font-size:13px;margin-top:14px">STL files are in millimetres. Weights are estimates for solid metal; casting and polishing change them a little.</p>`;
    const name = () => ($('#design-name', box).value.trim() || r.title);
    const mark = () => $('[data-mark]', box).checked;
    const act = {
      stl: () => {
        const buf = partsToSTL(st.result.parts, viewer.exportMatrix());
        download(new Blob([buf], { type: 'model/stl' }), `${fileBase()}.stl`);
        toast('STL saved. Open it in your slicer or send it to your jeweller.');
      },
      poster: async () => { const c = await poster(mark()); c.toBlob((b) => download(b, `${fileBase()}-instagram.png`)); toast('Image saved.'); },
      card: async () => {
        const c = await renderInfoCard(viewer, { name: name(), result: st.result, metal: st.metal, accent: st.accent, url: shareUrl(), weightText });
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
      send: () => openSendDialog({ makeImage: () => poster(true), title: name(), caption: `${st.result.title} · ${METALS[st.metal].label}${st.accent ? ' + lime enamel' : ''}. Designed in TRIAD Studio.` }),
    };
    $$('[data-a]', box).forEach((b) => b.addEventListener('click', () => act[b.dataset.a]()));
  }

  /* ── go ── */
  renderControls();
  renderMaterials();
  showTab('adjust', false, false);
  rebuild(true);
  const onTheme = () => viewer.render();
  window.addEventListener('studio:theme', onTheme);

  return {
    update(q) {
      Object.assign(st, parseQuery(T, q));
      st.pixels = null;
      viewer.setMaterial(st.metal, st.accent);
      renderControls(); renderMaterials(); rebuild(true);
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(hashTimer);
      window.removeEventListener('studio:theme', onTheme);
      viewer.destroy();
    },
  };
}
