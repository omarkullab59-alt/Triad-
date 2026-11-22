// MY DESIGNS: upload your own artwork once, then put it on anything with one tap.
import { listDesigns, addDesignFile, deleteDesign, designPixels, vectorize, upscale, VECTOR_PRESETS } from '../lib/designs.js';
import { setHandoff } from '../lib/store.js';
import { $, $$, esc, toast } from '../lib/dom.js';

const USES = (id) => [
  ['Print on a cap', `#/hat?kind=cap&brim=72&curve=60&thick=2&mat=cotton&pk=image&pd=${id}&pside=front&psz=34&py=22`],
  ['Print on a beanie', `#/hat?kind=beanie&pk=image&pd=${id}&pside=front&psz=30&py=-55`],
  ['On tape', `#/tape?design=${id}&text=TRIAD+`],
  ['Engrave on a ring', `#/ring?width=8&ek=image&edz=${id}&eside=top&esz=95&efill=1`],
  ['Print on a plate', `#/plate?pk=image&pd=${id}&pside=top&psz=55`],
  ['Print around a vase', `#/vessel?kind=vase&diameter=110&height=280&belly=40&base=70&neck=55&pk=image&pd=${id}&pside=around&psz=45`],
  ['Emboss on a sculpture base', `#/sculpture?ek=image&edz=${id}&eside=front&esz=32&ey=-80&ed=1&efill=1`],
];

export async function mount(main) {
  main.innerHTML = `
  <section class="draw" aria-labelledby="des-h" style="max-width:1100px">
    <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
      <div><p class="label muted">My designs</p><h1 id="des-h" class="section-title" style="font-size:clamp(32px,6vw,56px)">Your artwork, on anything.</h1></div>
      <a class="btn" href="#/">← All tools</a>
    </div>
    <div class="drop" data-drop style="padding:18px">
      <p style="margin-bottom:10px">PNG, JPG, WebP or SVG — logos, drawings, photos, patterns. Drop files here or:</p>
      <button type="button" class="btn btn--lime" data-up>Upload designs</button><input type="file" accept="image/*,.svg" multiple hidden>
      <p class="muted" style="font-size:13px;margin-top:10px">Stored only on this device. Nothing is uploaded to a server. SVG files stay vectors: sharp at any size.</p>
      <p class="muted" style="font-size:13px;margin-top:4px"><b>Make sharp</b> turns a pixel image into a vector (best for logos, drawings, type). <b>AI upscale</b> enlarges small photos and artwork 2× or 4×. Both run on your device, free.</p>
    </div>
    <ul class="find-grid" data-list style="margin-top:14px"></ul>
  </section>`;
  const list = $('[data-list]', main);
  async function draw() {
    const items = await listDesigns();
    list.innerHTML = items.length ? items.map((d) => `<li class="find-card">
      <div class="find-thumb"><img src="${d.thumb}" alt=""></div>
      <div class="find-body"><span class="label muted">${d.vector ? '<span class="tape" style="font-size:10px">Vector · sharp at any size</span>' : `${d.w} × ${d.h} px${Math.max(d.w, d.h) < 900 ? ' · small' : ''}`}</span><strong>${esc(d.name)}</strong>
        ${d.vector ? '' : `<div class="btn-row" style="margin-bottom:6px"><select class="input" data-vp="${esc(d.id)}" aria-label="Vector style" style="min-height:36px;width:auto">${Object.entries(VECTOR_PRESETS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select><button type="button" class="btn btn--lime" data-vec="${esc(d.id)}">Make sharp</button><button type="button" class="btn" data-up2="${esc(d.id)}">AI upscale ×2</button><button type="button" class="btn" data-up4="${esc(d.id)}">AI upscale ×4</button></div>`}
        <div class="btn-row">${USES(d.id).map(([l, h]) => `<a class="btn" href="${esc(h)}">${esc(l)}</a>`).join('')}
          <button type="button" class="btn" data-pend="${esc(d.id)}">Pendant</button>
          <button type="button" class="btn" data-sk="${esc(d.id)}">3D object</button>
          <button type="button" class="btn" data-del="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">Delete</button></div></div></li>`).join('')
      : '<li class="muted">No designs yet. Upload your first one above.</li>';
    const busy = (b, text) => { b.disabled = true; b.textContent = text; };
    $$('[data-vec]', list).forEach((b) => b.addEventListener('click', async () => {
      busy(b, 'Working…');
      try { const v = await vectorize(b.dataset.vec, $(`[data-vp="${b.dataset.vec}"]`, list).value); toast(`“${v.name}” added — sharp at any size.`); } catch (e) { console.error(e); toast('This image could not be vectorised.'); }
      draw();
    }));
    for (const f of [2, 4]) $$(`[data-up${f}]`, list).forEach((b) => b.addEventListener('click', async () => {
      busy(b, 'Loading AI…');
      try { const v = await upscale(b.dataset[`up${f}`], f, (pr) => { b.textContent = `Upscaling ${Math.round(pr * 100)} %`; }); toast(`“${v.name}” added (${v.w} × ${v.h} px).`); }
      catch (e) { console.error(e); toast('Upscaling did not work on this device. Try “Make sharp” instead.'); }
      draw();
    }));
    $$('[data-del]', list).forEach((b) => b.addEventListener('click', async () => { await deleteDesign(b.dataset.del); toast('Deleted.'); draw(); }));
    $$('[data-pend]', list).forEach((b) => b.addEventListener('click', async () => { setHandoff({ pixels: await designPixels(b.dataset.pend, 1000), fill: false, bold: 1, params: { threshold: 150 } }); location.hash = '#/pendant'; }));
    $$('[data-sk]', list).forEach((b) => b.addEventListener('click', async () => { setHandoff({ pixels: await designPixels(b.dataset.sk, 1000), fill: false, bold: 1, params: { threshold: 150, mode: 'flat', size: 80, depth: 5 } }); location.hash = '#/sketch3d'; }));
  }
  const input = $('input', main);
  const take = async (files) => {
    let n = 0;
    for (const f of files) { try { await addDesignFile(f); n++; } catch (e) { toast(e.message || 'This file could not be opened.'); } }
    if (n) toast(`${n} design${n > 1 ? 's' : ''} added.`);
    draw();
  };
  $('[data-up]', main).addEventListener('click', () => input.click());
  input.addEventListener('change', () => { take([...input.files]); input.value = ''; });
  const drop = $('[data-drop]', main);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); take([...e.dataTransfer.files]); });
  draw();
  return { destroy() {} };
}
