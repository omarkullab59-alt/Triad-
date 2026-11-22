// DRAW: sketch on the left (top on phones), a live AI render of the jewellery appears next to it.
// 0.8 s after the last stroke the sketch goes to our Cloudflare Worker (Workers AI, image-to-image).
import { AI_URL } from '../lib/config.js';
import { $, $$, esc, toast, download, makeCanvas, loadImage, reducedMotion } from '../lib/dom.js';
import { setHandoff } from '../lib/store.js';
import { slider } from '../ui/controls.js';

const SIZE = 1024;      // drawing resolution
const SEND = 512;       // what goes to the AI
const IDLE_MS = 800;
const WIDTHS = { S: 5, M: 12, L: 26 };
export const STYLES = [
  ['silver', 'Silver'], ['chrome', 'Chrome'], ['gold', 'Gold'], ['lime', 'Lime enamel'], ['frost', 'Frost / Iceland'], ['skin', 'On skin'],
];

export async function mount(main) {
  const st = { tool: 'brush', width: 'M', strokes: [], redo: [], bg: null, style: 'silver', custom: '', closeness: 60, resultUrl: null, busy: false };

  main.innerHTML = `
  <section class="draw" aria-labelledby="draw-h">
    <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
      <div><p class="label muted">Draw</p><h1 id="draw-h" class="section-title" style="font-size:clamp(32px,6vw,56px)">Sketch it. See it.</h1></div>
      <a class="btn" href="#/">← All tools</a>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Drawing tools">
      <button type="button" class="tool-btn" data-tool="brush" aria-pressed="true">Brush</button>
      <button type="button" class="tool-btn" data-tool="eraser" aria-pressed="false">Eraser</button>
      <span class="sep" aria-hidden="true"></span>
      ${Object.entries(WIDTHS).map(([k, w]) => `<button type="button" class="tool-btn" data-w="${k}" aria-pressed="${k === 'M'}" aria-label="Line ${({ S: 'thin', M: 'medium', L: 'thick' })[k]}"><span class="dotsz" style="width:${4 + w / 2}px;height:${4 + w / 2}px"></span></button>`).join('')}
      <span class="sep" aria-hidden="true"></span>
      <button type="button" class="tool-btn" data-act="undo" aria-label="Undo (Ctrl+Z)">↶ Undo</button>
      <button type="button" class="tool-btn" data-act="redo" aria-label="Redo (Ctrl+Shift+Z)">↷ Redo</button>
      <button type="button" class="tool-btn" data-act="clear">Clear</button>
      <button type="button" class="tool-btn" data-act="photo">Photo</button>
      <input type="file" accept="image/*" hidden data-photo>
    </div>
    <div class="draw-panes">
      <div class="pane" data-pane>
        <canvas data-bg width="${SIZE}" height="${SIZE}" aria-hidden="true"></canvas>
        <canvas data-ink width="${SIZE}" height="${SIZE}" role="img" aria-label="Drawing area. Draw with a finger, pen or mouse."></canvas>
        <p class="pane-status label" data-hint>Draw here: a ring, a charm, a shape</p>
      </div>
      <div class="pane pane--result" aria-live="polite" aria-busy="false" data-result>
        <p class="pane-empty" data-empty>${AI_URL ? 'Your jewellery render appears here a moment after you stop drawing.' : 'The live AI render is not switched on for this site yet. You can still draw and build your sketch as a 3D pendant.'}</p>
        <p class="pane-status label" data-status hidden></p>
      </div>
    </div>
    <div class="group" style="margin:4px 0 0">
      <span class="label" id="style-l">Style</span>
      <div class="chips" role="radiogroup" aria-labelledby="style-l" data-styles style="margin-top:8px">
        ${STYLES.map(([k, l]) => `<button type="button" class="chip" role="radio" data-s="${k}" aria-checked="${k === 'silver'}" tabindex="${k === 'silver' ? 0 : -1}">${esc(l)}</button>`).join('')}
      </div>
    </div>
    <div class="field" style="max-width:560px"><label for="d-custom" class="label">Your own words (optional)</label>
      <input id="d-custom" type="text" maxlength="120" placeholder="e.g. with a small black stone" autocomplete="off"></div>
    <div data-close style="max-width:560px"></div>
    <div class="btn-row">
      <button type="button" class="btn btn--lime" data-act="pendant">Build as 3D pendant →</button>
      <button type="button" class="btn btn--solid" data-act="object">Make a 3D object →</button>
      <button type="button" class="btn" data-act="crown">Crown / mask →</button>
      <button type="button" class="btn" data-act="now" ${AI_URL ? '' : 'disabled'}>Render again</button>
      <button type="button" class="btn" data-act="save-sketch">Save sketch</button>
      <button type="button" class="btn" data-act="save-render" disabled>Save render</button>
    </div>
    <p class="privacy">Sketches and renders are not stored and not used to train AI. They go to the render server only to make your picture and are deleted right after.</p>
  </section>`;

  const ink = $('[data-ink]', main), bg = $('[data-bg]', main);
  const ic = ink.getContext('2d'), bc = bg.getContext('2d');
  const resultBox = $('[data-result]', main);
  const status = $('[data-status]', main);

  /* ── drawing ── */
  function drawBg() {
    bc.fillStyle = '#fff'; bc.fillRect(0, 0, SIZE, SIZE);
    if (st.bg) {
      const k = Math.max(SIZE / st.bg.width, SIZE / st.bg.height);
      bc.globalAlpha = 0.55;
      bc.drawImage(st.bg, (SIZE - st.bg.width * k) / 2, (SIZE - st.bg.height * k) / 2, st.bg.width * k, st.bg.height * k);
      bc.globalAlpha = 1;
    }
  }
  function strokePath(c, s) {
    c.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    c.strokeStyle = '#0a0a0a'; c.fillStyle = '#0a0a0a';
    c.lineCap = 'round'; c.lineJoin = 'round';
    const p = s.pts;
    if (p.length === 1) { c.beginPath(); c.arc(p[0][0], p[0][1], (s.w * p[0][2]) / 2, 0, Math.PI * 2); c.fill(); return; }
    for (let i = 1; i < p.length; i++) {
      c.lineWidth = s.w * (p[i][2] + p[i - 1][2]) / 2;
      c.beginPath(); c.moveTo(p[i - 1][0], p[i - 1][1]); c.lineTo(p[i][0], p[i][1]); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }
  function redraw() {
    ic.clearRect(0, 0, SIZE, SIZE);
    for (const s of st.strokes) strokePath(ic, s);
    $('[data-hint]', main).hidden = st.strokes.length > 0;
  }
  let cur = null;
  const toXY = (e) => { const r = ink.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE]; };
  const pressure = (e) => (e.pointerType === 'pen' && e.pressure > 0 ? 0.35 + e.pressure * 1.1 : 1);
  ink.addEventListener('pointerdown', (e) => {
    if (cur) return;
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    cur = { tool: st.tool, w: WIDTHS[st.width] * (st.tool === 'eraser' ? 2.2 : 1), pts: [[...toXY(e), pressure(e)]], id: e.pointerId };
    st.strokes.push(cur); st.redo = [];
    strokePath(ic, { ...cur });
    clearTimeout(idle);
  });
  ink.addEventListener('pointermove', (e) => {
    if (!cur || e.pointerId !== cur.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const pt = [...toXY(ev), pressure(ev)];
      const last = cur.pts[cur.pts.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 1.5) continue;
      cur.pts.push(pt);
      strokePath(ic, { ...cur, pts: [last, pt] });
    }
  });
  const end = (e) => {
    if (!cur || e.pointerId !== cur.id) return;
    cur = null;
    redraw();
    changed();
  };
  ink.addEventListener('pointerup', end);
  ink.addEventListener('pointercancel', end);

  /* ── toolbar ── */
  const pressGroup = (sel, attr, val) => $$(sel, main).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
  $$('[data-tool]', main).forEach((b) => b.addEventListener('click', () => { st.tool = b.dataset.tool; pressGroup('[data-tool]', 'tool', st.tool); }));
  $$('[data-w]', main).forEach((b) => b.addEventListener('click', () => { st.width = b.dataset.w; pressGroup('[data-w]', 'w', st.width); }));
  const undo = () => { if (!st.strokes.length) return; st.redo.push(st.strokes.pop()); redraw(); changed(); };
  const redo = () => { if (!st.redo.length) return; st.strokes.push(st.redo.pop()); redraw(); changed(); };
  const photoInput = $('[data-photo]', main);
  photoInput.addEventListener('change', async () => {
    const f = photoInput.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try { st.bg = await loadImage(url); drawBg(); changed(); toast('Photo added behind your drawing. Trace over it.'); }
    catch { toast('This photo could not be opened. Try a JPG or PNG.'); }
    finally { URL.revokeObjectURL(url); photoInput.value = ''; }
  });
  const actions = {
    undo, redo,
    clear: () => { if (!st.strokes.length && !st.bg) return; st.strokes = []; st.redo = []; st.bg = null; drawBg(); redraw(); showEmpty(); toast('Cleared.'); },
    photo: () => (st.bg ? (st.bg = null, drawBg(), changed(), toast('Photo removed.')) : photoInput.click()),
    now: () => render(true),
    pendant: () => {
      if (!st.strokes.some((s) => s.tool === 'brush')) { toast('Draw something first.'); return; }
      setHandoff({ dataUrl: sketchCanvas(SIZE / 2, false).toDataURL('image/png') });
      location.hash = '#/pendant';
    },
    object: () => {
      if (!st.strokes.some((s) => s.tool === 'brush')) { toast('Draw something first.'); return; }
      setHandoff({ dataUrl: sketchCanvas(SIZE / 2, false).toDataURL('image/png'), params: { mode: 'flat', size: 80, depth: 5 } });
      location.hash = '#/sketch3d';
    },
    crown: () => {
      if (!st.strokes.some((s) => s.tool === 'brush')) { toast('Draw something first.'); return; }
      setHandoff({ dataUrl: sketchCanvas(SIZE / 2, false).toDataURL('image/png'), fill: false, bold: 2 });
      location.hash = '#/wearable';
    },
    'save-sketch': () => sketchCanvas(SIZE, true).toBlob((b) => download(b, 'triad-sketch.png')),
    'save-render': () => { if (st.resultUrl) download(st.resultUrl, 'triad-render.jpg'); },
  };
  $$('[data-act]', main).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]()));
  const onKey = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.matches('input, textarea')) return;
    if (e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? redo : undo)(); }
    if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  };
  document.addEventListener('keydown', onKey);

  /* ── style & closeness ── */
  const styleBtns = $$('[data-s]', main);
  const pickStyle = (b, focus) => {
    st.style = b.dataset.s;
    styleBtns.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    if (focus) b.focus();
    changed(0);
  };
  styleBtns.forEach((b, i) => {
    b.addEventListener('click', () => pickStyle(b));
    b.addEventListener('keydown', (e) => { const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (d) { e.preventDefault(); pickStyle(styleBtns[(i + d + styleBtns.length) % styleBtns.length], true); } });
  });
  let tCustom;
  $('#d-custom', main).addEventListener('input', (e) => { clearTimeout(tCustom); tCustom = setTimeout(() => { st.custom = e.target.value.trim(); changed(0); }, 600); });
  $('[data-close]', main).append(slider({
    name: 'closeness', label: 'How close to my sketch', help: 'High keeps your lines. Low lets the AI invent more.', min: 0, max: 100, step: 5, unit: '%', value: st.closeness,
    onInput: (v) => { st.closeness = v; changed(); },
  }));

  /* ── AI render ── */
  function sketchCanvas(size, withPhoto) {
    const c = makeCanvas(size, size);
    const x = c.getContext('2d');
    if (withPhoto) x.drawImage(bg, 0, 0, size, size); else { x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); }
    x.drawImage(ink, 0, 0, size, size);
    return c;
  }
  let idle, ctrl, seq = 0;
  function changed(delay = IDLE_MS) {
    if (!AI_URL) return;
    clearTimeout(idle);
    if (!st.strokes.length && !st.bg) return;
    idle = setTimeout(() => render(), delay);
  }
  function setStatus(text, busy) {
    status.hidden = !text; status.textContent = text || '';
    resultBox.setAttribute('aria-busy', String(!!busy));
    let sp = $('.spinner', resultBox);
    if (busy && !sp) { sp = document.createElement('div'); sp.className = 'spinner'; sp.setAttribute('aria-hidden', 'true'); resultBox.append(sp); }
    if (!busy) sp?.remove();
  }
  function showEmpty() {
    $('img', resultBox)?.remove();
    $('[data-empty]', resultBox).hidden = false;
    $('[data-act="save-render"]', main).disabled = true;
    setStatus('');
  }
  async function render(force) {
    if (!AI_URL || (!st.strokes.length && !st.bg)) return;
    ctrl?.abort();
    ctrl = new AbortController();
    const my = ++seq;
    setStatus('Rendering…', true);
    try {
      const image = sketchCanvas(SEND, true).toDataURL('image/jpeg', 0.85);
      const res = await fetch(`${AI_URL}/render`, {
        method: 'POST', signal: ctrl.signal, referrerPolicy: 'no-referrer-when-downgrade',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, style: st.style, prompt: st.custom, closeness: st.closeness / 100, seed: force ? Math.floor(Math.random() * 1e6) : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error || 'failed'), { status: res.status });
      }
      const blob = await res.blob();
      if (my !== seq) return;
      if (st.resultUrl) URL.revokeObjectURL(st.resultUrl);
      st.resultUrl = URL.createObjectURL(blob);
      let img = $('img', resultBox);
      if (!img) { img = document.createElement('img'); resultBox.prepend(img); }
      img.alt = `AI render of your sketch in ${STYLES.find(([k]) => k === st.style)[1]} style`;
      img.src = st.resultUrl;
      $('[data-empty]', resultBox).hidden = true;
      $('[data-act="save-render"]', main).disabled = false;
      setStatus(`${STYLES.find(([k]) => k === st.style)[1]} · AI render`);
    } catch (e) {
      if (e.name === 'AbortError' || my !== seq) return;
      const msg = {
        quota: 'Today’s free AI renders are used up. Try again tomorrow — drawing and 3D still work.',
        rate_limited: 'Slow down a little: too many renders in a minute. It continues in a moment.',
        origin_not_allowed: 'The render server only answers TRIAD Studio’s own address.',
        not_configured: 'The render server is not set up yet.',
      }[e.message] || 'The render did not work this time. Draw on, it tries again.';
      setStatus(msg, false);
      if (e.message === 'rate_limited') { clearTimeout(idle); idle = setTimeout(() => render(), 15000); }
    }
  }

  drawBg();
  redraw();
  if (reducedMotion()) resultBox.style.transition = 'none';

  return {
    destroy() {
      clearTimeout(idle); clearTimeout(tCustom);
      ctrl?.abort();
      document.removeEventListener('keydown', onKey);
      if (st.resultUrl) URL.revokeObjectURL(st.resultUrl);
    },
  };
}
