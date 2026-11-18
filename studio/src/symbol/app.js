// SYMBOL: design your own shapes, symbols and logos. Brush, shapes, text in any script and font,
// pictures, cut-outs and symmetry. Saved in your own library on this device, usable in every 3D tool.
import { $, $$, esc, toast, download, fileToPixels, reducedMotion } from '../lib/dom.js';
import { SIZE, SHAPE_KINDS, SYMMETRY, renderSymbol, symbolPixels, drawElement, listSymbols, saveSymbol, deleteSymbol } from '../lib/symbols.js';
import { fontOptions, addFontFile, initFonts } from '../lib/fonts.js';
import { setHandoff } from '../lib/store.js';
import { slider, choice } from '../ui/controls.js';
import { motifOptions, renderMotif } from '../lib/motifs.js';

const blank = () => ({ id: null, name: 'My symbol', symmetry: 'none', elements: [] });

export async function mount(main) {
  initFonts();
  let doc = blank();
  const st = { tool: 'brush', shape: 'circle', op: 'add', width: 40, font: 'Pirata One', sel: -1, undo: [], redo: [] };

  main.innerHTML = `
  <section class="draw" aria-labelledby="sym-h">
    <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
      <div><p class="label muted">Symbol</p><h1 id="sym-h" class="section-title" style="font-size:clamp(32px,6vw,56px)">Design your own sign.</h1></div>
      <a class="btn" href="#/">← All tools</a>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Symbol tools">
      <button type="button" class="tool-btn" data-tool="brush" aria-pressed="true">Brush</button>
      <button type="button" class="tool-btn" data-tool="shape" aria-pressed="false">Shape</button>
      <button type="button" class="tool-btn" data-tool="text" aria-pressed="false">Text</button>
      <button type="button" class="tool-btn" data-tool="select" aria-pressed="false">Move</button>
      <button type="button" class="tool-btn" data-tool="motif" aria-pressed="false">Motif</button>
      <button type="button" class="tool-btn" data-act="image">Picture</button>
      <input type="file" accept="image/*" hidden data-file>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" class="tool-btn" data-op="add" aria-pressed="true">＋ Add</button>
      <button type="button" class="tool-btn" data-op="cut" aria-pressed="false">− Cut out</button>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" class="tool-btn" data-act="undo" aria-label="Undo">↶</button>
      <button type="button" class="tool-btn" data-act="redo" aria-label="Redo">↷</button>
      <button type="button" class="tool-btn" data-act="clear">New</button>
    </div>
    <div class="draw-panes">
      <div>
        <div class="pane" style="background:#fff">
          <canvas data-c width="${SIZE}" height="${SIZE}" role="img" aria-label="Symbol canvas"></canvas>
          <p class="pane-status label" data-hint>Draw, or pick a shape and drag on the canvas</p>
        </div>
      </div>
      <div style="display:grid;gap:4px;align-content:start" data-side></div>
    </div>
    <div class="field" style="max-width:560px"><label for="sym-name" class="label">Name</label><input id="sym-name" type="text" maxlength="40" value="My symbol"></div>
    <div class="btn-row">
      <button type="button" class="btn btn--lime" data-act="save">Save to my symbols</button>
      <button type="button" class="btn btn--solid" data-act="pendant">Make a pendant →</button>
      <button type="button" class="btn" data-act="obj">Make a 3D object →</button>
      <button type="button" class="btn" data-act="crown">Crown / mask →</button>
      <button type="button" class="btn" data-act="png">Download PNG</button>
    </div>
    <p class="muted" style="font-size:14px">Saved symbols show up in Pendant, Earrings (studs), Ring (“Your symbol on top”) and Sketch to 3D. They stay on this device.</p>
    <section aria-labelledby="lib-h" style="margin-top:12px"><h2 id="lib-h" class="label">My symbols</h2><ul class="saved-list" data-lib></ul></section>
  </section>`;

  const canvas = $('[data-c]', main);
  const ctx = canvas.getContext('2d');
  const side = $('[data-side]', main);
  let drawing = null;

  /* ── render ── */
  let renderNo = 0;
  async function render() {
    const my = ++renderNo;
    const img = await renderSymbol(doc, SIZE);
    if (my !== renderNo) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // guide grid
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 2;
    for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * 100, 0); ctx.lineTo(i * 100, SIZE); ctx.moveTo(0, i * 100); ctx.lineTo(SIZE, i * 100); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(79,104,0,0.35)';
    ctx.beginPath(); ctx.moveTo(500, 0); ctx.lineTo(500, SIZE); ctx.moveTo(0, 500); ctx.lineTo(SIZE, 500); ctx.stroke();
    ctx.drawImage(img, 0, 0);
    const el = doc.elements[st.sel];
    if (el && el.type !== 'path') {
      ctx.save(); ctx.translate(el.x, el.y); ctx.rotate(((el.rot || 0) * Math.PI) / 180);
      ctx.strokeStyle = '#c4ef2f'; ctx.lineWidth = 6; ctx.setLineDash([18, 10]);
      ctx.strokeRect(-el.s / 2 - 10, -el.s / 2 - 10, el.s + 20, el.s + 20); ctx.restore();
    }
    $('[data-hint]', main).hidden = doc.elements.length > 0;
  }
  const commit = () => { st.undo.push(JSON.stringify(doc)); if (st.undo.length > 80) st.undo.shift(); st.redo = []; };

  /* ── side panel: settings for the current tool / selected element ── */
  function renderSide() {
    side.innerHTML = '';
    side.append(choice({ name: 'sym', label: 'Symmetry', help: 'Repeat everything you draw: mirrored, or turned 3, 4 or 6 times around the centre.', options: SYMMETRY, value: doc.symmetry,
      onInput: (v) => { commit(); doc.symmetry = v; render(); } }));
    const el = doc.elements[st.sel];
    if (st.tool === 'select' && el && el.type !== 'path') {
      const set = (k) => (v) => { el[k] = v; render(); };
      side.append(
        slider({ name: 'size', label: 'Size', help: 'Size of the selected part.', min: 20, max: 1400, step: 5, value: el.s, onInput: set('s') }),
        slider({ name: 'rot', label: 'Rotation', help: 'Turn the selected part.', min: -180, max: 180, step: 1, unit: '°', value: el.rot || 0, onInput: set('rot') }),
      );
      if (el.type === 'image') side.append(slider({ name: 'thr', label: 'Picture detection', help: 'Which parts of the picture count as shape.', min: 20, max: 240, step: 1, value: el.threshold, onInput: set('threshold') }));
      if (el.type === 'text') {
        const t = document.createElement('div'); t.className = 'ctl';
        t.innerHTML = `<label class="ctl-name" for="sel-t">Text</label><input id="sel-t" type="text" maxlength="40" value="${esc(el.text)}" style="margin-top:6px">`;
        t.querySelector('input').addEventListener('input', (e) => { el.text = e.target.value; render(); });
        side.append(t, choice({ name: 'sf', label: 'Font', help: 'Style or script.', options: fontOptions(), value: el.font, onInput: (v) => { el.font = v; render(); } }));
      }
      const row = document.createElement('div'); row.className = 'btn-row'; row.style.marginTop = '10px';
      row.innerHTML = `<button type="button" class="btn" data-x="op">${el.op === 'cut' ? 'Make it add' : 'Make it cut out'}</button><button type="button" class="btn" data-x="dup">Duplicate</button><button type="button" class="btn" data-x="del">Delete</button>`;
      row.querySelector('[data-x=op]').addEventListener('click', () => { commit(); el.op = el.op === 'cut' ? 'add' : 'cut'; renderSide(); render(); });
      row.querySelector('[data-x=dup]').addEventListener('click', () => { commit(); doc.elements.push({ ...structuredClone(el), x: el.x + 40, y: el.y + 40 }); st.sel = doc.elements.length - 1; renderSide(); render(); });
      row.querySelector('[data-x=del]').addEventListener('click', () => { commit(); doc.elements.splice(st.sel, 1); st.sel = -1; renderSide(); render(); });
      side.append(row);
      return;
    }
    if (st.tool === 'brush' || st.tool === 'shape') side.append(slider({ name: 'w', label: st.tool === 'brush' ? 'Brush size' : 'Line width (outline shapes)', help: 'Thicker lines are stronger in metal.', min: 6, max: 160, step: 2, value: st.width, onInput: (v) => { st.width = v; } }));
    if (st.tool === 'shape') {
      side.append(choice({ name: 'shape', label: 'Shape', help: 'Pick a shape, then drag on the canvas: where you start is the centre.', options: SHAPE_KINDS, value: st.shape, onInput: (v) => { st.shape = v; } }));
      const o = document.createElement('label'); o.className = 'check';
      o.innerHTML = `<input type="checkbox" ${st.outline ? 'checked' : ''}> <span>Outline only</span>`;
      o.querySelector('input').addEventListener('change', (e) => { st.outline = e.target.checked; });
      side.append(o);
    }
    if (st.tool === 'text') {
      const t = document.createElement('div'); t.className = 'ctl';
      t.innerHTML = '<label class="ctl-name" for="new-t">Text</label><p class="ctl-help">Any language: TRIAD, 東京, حب, Москва … Type, then tap the canvas to place it.</p><input id="new-t" type="text" maxlength="40" value="TRIAD">';
      side.append(t, choice({ name: 'font', label: 'Font', help: 'Style or script. Upload your own below.', options: fontOptions(), value: st.font, onInput: (v) => { st.font = v; } }));
      const up = document.createElement('div'); up.className = 'btn-row'; up.style.marginTop = '8px';
      up.innerHTML = '<button type="button" class="btn">Upload your own font</button><input type="file" accept=".ttf,.otf,.woff,.woff2" hidden>';
      up.querySelector('button').addEventListener('click', () => up.querySelector('input').click());
      up.querySelector('input').addEventListener('change', async (e) => {
        try { st.font = await addFontFile(e.target.files[0]); renderSide(); toast('Font added.'); } catch (err) { toast(err.message); }
      });
      side.append(up);
    }
    if (st.tool === 'motif') {
      const wrap = document.createElement('div'); wrap.className = 'ctl';
      wrap.innerHTML = '<span class="ctl-name">Motifs</span><p class="ctl-help">Tap one to add it. Then move, size and turn it, mirror or repeat it with Symmetry.</p><div class="motif-grid"></div>';
      const grid = wrap.querySelector('.motif-grid');
      for (const [k, label] of motifOptions()) {
        const b = document.createElement('button'); b.type = 'button'; b.title = label; b.setAttribute('aria-label', `Add ${label}`);
        renderMotif(k, 96).then((c) => { b.innerHTML = `<img src="${c.toDataURL()}" alt="">`; });
        b.addEventListener('click', () => { commit(); doc.elements.push({ type: 'motif', motif: k, x: 500, y: 500, s: 600, rot: 0, op: st.op }); st.sel = doc.elements.length - 1; st.tool = 'select'; pressTools(); renderSide(); render(); });
        grid.append(b);
      }
      side.append(wrap);
    }
    if (st.tool === 'select') side.insertAdjacentHTML('beforeend', '<p class="muted" style="font-size:14px;margin-top:10px">Tap a shape, text or picture to select it, then drag to move it.</p>');
  }

  /* ── pointer ── */
  const toXY = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE]; };
  function hit([x, y]) {
    for (let i = doc.elements.length - 1; i >= 0; i--) {
      const el = doc.elements[i];
      if (el.type === 'path') continue;
      const a = (-(el.rot || 0) * Math.PI) / 180, dx = x - el.x, dy = y - el.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      const half = el.type === 'text' ? el.s * Math.max(1, el.text.length * 0.35) : el.s / 2 + 20;
      if (Math.abs(lx) <= half && Math.abs(ly) <= el.s / 2 + 20) return i;
    }
    return -1;
  }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toXY(e);
    if (st.tool === 'brush') { commit(); const el = { type: 'path', pts: [p], w: st.width, op: st.op }; doc.elements.push(el); drawing = { el }; render(); }
    else if (st.tool === 'shape') { commit(); const el = { type: 'shape', shape: st.shape, x: p[0], y: p[1], s: 40, rot: 0, op: st.op, outline: !!st.outline, w: st.width }; doc.elements.push(el); drawing = { el, start: p }; st.sel = doc.elements.length - 1; render(); }
    else if (st.tool === 'text') {
      const text = ($('#new-t', main)?.value || '').trim();
      if (!text) { toast('Type a text first.'); return; }
      commit(); doc.elements.push({ type: 'text', text, font: st.font, x: p[0], y: p[1], s: 180, rot: 0, op: st.op });
      st.sel = doc.elements.length - 1; st.tool = 'select'; pressTools(); renderSide(); render();
    } else if (st.tool === 'select') {
      st.sel = hit(p); renderSide(); render();
      if (st.sel >= 0) { commit(); const el = doc.elements[st.sel]; drawing = { el, off: [el.x - p[0], el.y - p[1]] }; }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = toXY(e);
    const { el } = drawing;
    if (el.type === 'path') { const last = el.pts[el.pts.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) el.pts.push(p); }
    else if (drawing.start) { el.s = Math.max(20, Math.hypot(p[0] - drawing.start[0], p[1] - drawing.start[1]) * 2); el.rot = el.shape === 'line' ? (Math.atan2(p[1] - drawing.start[1], p[0] - drawing.start[0]) * 180) / Math.PI : 0; }
    else { el.x = p[0] + drawing.off[0]; el.y = p[1] + drawing.off[1]; }
    render();
  });
  const end = () => { if (drawing?.start && drawing.el.s <= 20) drawing.el.s = 260; drawing = null; render(); if (st.tool === 'shape') renderSide(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  /* ── toolbar ── */
  function pressTools() { $$('[data-tool]', main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === st.tool))); }
  $$('[data-tool]', main).forEach((b) => b.addEventListener('click', () => { st.tool = b.dataset.tool; if (st.tool !== 'select') st.sel = -1; pressTools(); renderSide(); render(); }));
  $$('[data-op]', main).forEach((b) => b.addEventListener('click', () => { st.op = b.dataset.op; $$('[data-op]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  const fileIn = $('[data-file]', main);
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; fileIn.value = '';
    if (!f) return;
    try {
      const px = await fileToPixels(f, 700);
      const c = document.createElement('canvas'); c.width = px.width; c.height = px.height; c.getContext('2d').putImageData(px, 0, 0);
      commit();
      doc.elements.push({ type: 'image', src: c.toDataURL('image/png'), threshold: 140, x: 500, y: 500, s: 700, rot: 0, op: 'add' });
      st.sel = doc.elements.length - 1; st.tool = 'select'; pressTools(); renderSide(); render();
      toast('Picture added. Use “Picture detection” to clean it up, then draw on top.');
    } catch { toast('This picture could not be opened.'); }
  });
  const pngOf = async () => { const c = await renderSymbol(doc, 1200); const o = document.createElement('canvas'); o.width = o.height = 1200; const x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1200); x.drawImage(c, 0, 0); return o; };
  const name = () => $('#sym-name', main).value.trim() || 'My symbol';
  const actions = {
    undo: () => { if (!st.undo.length) return; st.redo.push(JSON.stringify(doc)); doc = JSON.parse(st.undo.pop()); st.sel = -1; renderSide(); render(); },
    redo: () => { if (!st.redo.length) return; st.undo.push(JSON.stringify(doc)); doc = JSON.parse(st.redo.pop()); st.sel = -1; renderSide(); render(); },
    clear: () => { commit(); doc = { ...blank(), symmetry: doc.symmetry }; $('#sym-name', main).value = doc.name; st.sel = -1; renderSide(); render(); },
    image: () => fileIn.click(),
    save: async () => {
      if (!doc.elements.length) { toast('Draw something first.'); return; }
      doc = await saveSymbol({ ...doc, name: name() });
      toast(`“${doc.name}” saved to your symbols.`);
      renderLib();
    },
    pendant: async () => {
      if (!doc.elements.length) { toast('Draw something first.'); return; }
      setHandoff({ pixels: await symbolPixels(doc), fill: false, bold: 0, params: { threshold: 128 } });
      location.hash = '#/pendant';
    },
    obj: async () => {
      if (!doc.elements.length) { toast('Draw something first.'); return; }
      setHandoff({ pixels: await symbolPixels(doc, 480), fill: false, bold: 0, params: { threshold: 128, mode: 'flat', size: 80, depth: 6 } });
      location.hash = '#/sketch3d';
    },
    crown: async () => {
      if (!doc.elements.length) { toast('Draw something first.'); return; }
      setHandoff({ pixels: await symbolPixels(doc, 500), fill: false, bold: 0, params: { threshold: 128 } });
      location.hash = '#/wearable';
    },
    png: async () => (await pngOf()).toBlob((b) => download(b, `triad-symbol-${name().replace(/\W+/g, '-').toLowerCase()}.png`)),
  };
  $$('[data-act]', main).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]()));
  const onKey = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? actions.redo : actions.undo)(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel >= 0) { e.preventDefault(); commit(); doc.elements.splice(st.sel, 1); st.sel = -1; renderSide(); render(); }
    if (st.sel >= 0 && e.key.startsWith('Arrow')) {
      e.preventDefault(); const el = doc.elements[st.sel]; const d = e.shiftKey ? 50 : 10;
      if (e.key === 'ArrowLeft') el.x -= d; if (e.key === 'ArrowRight') el.x += d; if (e.key === 'ArrowUp') el.y -= d; if (e.key === 'ArrowDown') el.y += d;
      render();
    }
  };
  document.addEventListener('keydown', onKey);

  /* ── library ── */
  async function renderLib() {
    const list = await listSymbols();
    const ul = $('[data-lib]', main);
    ul.innerHTML = list.length ? list.map((s) => `<li><a href="#/symbol" data-open="${esc(s.id)}"><img src="${s.thumb}" alt="" width="40" height="40" style="background:#fff;border-radius:4px">${esc(s.name)}</a>
      <button class="icon-btn" type="button" data-del="${esc(s.id)}" aria-label="Delete ${esc(s.name)}">×</button></li>`).join('') : '<li class="muted" style="padding:10px 0">Nothing saved yet.</li>';
    $$('[data-open]', ul).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const s = list.find((x) => x.id === a.dataset.open);
      doc = structuredClone(s); $('#sym-name', main).value = s.name; st.undo = []; st.sel = -1; renderSide(); render();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }));
    $$('[data-del]', ul).forEach((b) => b.addEventListener('click', async () => { await deleteSymbol(b.dataset.del); toast('Deleted.'); renderLib(); }));
  }

  renderSide();
  render();
  renderLib();
  return { destroy() { document.removeEventListener('keydown', onKey); } };
}
export { drawElement };
