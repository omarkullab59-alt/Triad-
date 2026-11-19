// COLLECTIONS: your saved projects (from every tool) with notes and concept art, grouped into collections.
// Export a collection as one lookbook image.
import { listProjects, listCollections, saveProject, removeProject, saveCollection, removeCollection } from '../lib/projects.js';
import { listDesigns, designCanvas } from '../lib/designs.js';
import { $, $$, esc, toast, download, makeCanvas, loadImage } from '../lib/dom.js';

const TYPE_NAMES = { ring: 'Ring', pendant: 'Pendant', lettering: 'Lettering', earrings: 'Earrings', bangle: 'Bangle', chain: 'Chain', wearable: 'Crown · Tiara · Mask', couture: 'Couture mask', belt: 'Belt', hat: 'Hat', tape: 'Tape', garment: 'Clothing', plate: 'Plate', vessel: 'Vessel', cutlery: 'Cutlery', cabinet: 'Cabinet', sculpture: 'Sculpture', sketch3d: 'Sketch to 3D', model: '3D model' };
const openHref = (p) => `${p.hash}${p.hash.includes('?') ? '&' : '?'}prj=${p.id}`.replace(/([?&])prj=[^&]*&prj=/, '$1prj=');

export async function mount(main) {
  main.innerHTML = `
  <section class="draw" aria-labelledby="col-h" style="max-width:1200px">
    <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
      <div><p class="label muted">Collections</p><h1 id="col-h" class="section-title" style="font-size:clamp(32px,6vw,56px)">Your projects &amp; collections.</h1></div>
      <div class="btn-row"><button type="button" class="btn btn--lime" data-newc>New collection</button><a class="btn" href="#/">← All tools</a></div>
    </div>
    <p class="muted" style="font-size:14px">Save any design with “Save project” (step 3). Notes and concept art travel with it. Everything stays on this device.</p>
    <div data-cols></div>
  </section>`;
  const holder = $('[data-cols]', main);

  async function draw() {
    const [projects, cols, designs] = await Promise.all([listProjects(), listCollections(), listDesigns()]);
    const thumbOf = (id) => designs.find((d) => d.id === id)?.thumb;
    const groups = [...cols.map((c) => ({ c, items: projects.filter((p) => p.collection === c.id) })), { c: { id: '', name: 'Not in a collection', about: '' }, items: projects.filter((p) => !p.collection || !cols.some((c) => c.id === p.collection)) }];
    holder.innerHTML = groups.filter((g) => g.c.id || g.items.length).map(({ c, items }) => `
      <section class="collection" data-col="${esc(c.id)}">
        <div class="collection-head">
          ${c.id ? `<input class="collection-name" value="${esc(c.name)}" aria-label="Collection name" data-cname="${esc(c.id)}" maxlength="60">` : `<h2 class="label">${esc(c.name)}</h2>`}
          <span class="label muted">${items.length} design${items.length === 1 ? '' : 's'}</span>
          ${c.id ? `<div class="btn-row"><button type="button" class="btn" data-look="${esc(c.id)}">Lookbook image</button><button type="button" class="btn" data-delc="${esc(c.id)}">Remove collection</button></div>` : ''}
        </div>
        ${c.id ? `<textarea class="input" rows="2" placeholder="What is this collection about? Mood, season, references …" data-cabout="${esc(c.id)}" maxlength="4000">${esc(c.about || '')}</textarea>` : ''}
        <ul class="project-grid">${items.map((p) => `<li class="project-card">
          <a href="${esc(openHref(p))}" class="project-thumb">${p.thumb ? `<img src="${p.thumb}" alt="">` : ''}</a>
          <div class="project-body">
            <span class="label muted">${esc(TYPE_NAMES[p.type] || p.type)} · ${new Date(p.date).toLocaleDateString()}</span>
            <strong>${esc(p.name)}</strong>
            <textarea class="input" rows="3" placeholder="Notes …" data-pnotes="${esc(p.id)}" maxlength="8000" aria-label="Notes for ${esc(p.name)}">${esc(p.notes || '')}</textarea>
            ${(p.concepts || []).length ? `<div class="concept-row">${p.concepts.map((id) => (thumbOf(id) ? `<img src="${thumbOf(id)}" alt="Concept art">` : '')).join('')}</div>` : ''}
            <div class="btn-row">
              <a class="btn btn--lime" href="${esc(openHref(p))}">Open</a>
              <select class="input" data-move="${esc(p.id)}" aria-label="Move ${esc(p.name)} to a collection" style="min-height:36px;width:auto"><option value="">Move to…</option>${cols.map((cc) => `<option value="${esc(cc.id)}">${esc(cc.name)}</option>`).join('')}<option value="__none">No collection</option></select>
              <button type="button" class="btn" data-delp="${esc(p.id)}">Delete</button>
            </div>
          </div></li>`).join('') || '<li class="muted" style="padding:8px 0">Empty — save a design into this collection.</li>'}</ul>
      </section>`).join('') || '<p class="muted" style="margin-top:20px">Nothing saved yet. Design something, then “Save project” in step 3.</p>';

    let t;
    const later = (fn) => { clearTimeout(t); t = setTimeout(fn, 500); };
    $$('[data-pnotes]', holder).forEach((el) => el.addEventListener('input', () => later(async () => { const p = projects.find((x) => x.id === el.dataset.pnotes); await saveProject({ ...p, notes: el.value }); })));
    $$('[data-cname]', holder).forEach((el) => el.addEventListener('input', () => later(async () => { const c = cols.find((x) => x.id === el.dataset.cname); await saveCollection({ ...c, name: el.value || 'Collection' }); })));
    $$('[data-cabout]', holder).forEach((el) => el.addEventListener('input', () => later(async () => { const c = cols.find((x) => x.id === el.dataset.cabout); await saveCollection({ ...c, about: el.value }); })));
    $$('[data-move]', holder).forEach((el) => el.addEventListener('change', async () => { const p = projects.find((x) => x.id === el.dataset.move); await saveProject({ ...p, collection: el.value === '__none' ? '' : el.value }); toast('Moved.'); draw(); }));
    $$('[data-delp]', holder).forEach((b) => b.addEventListener('click', async () => { if (!confirm('Delete this project? (Your designs and concept art stay in My designs.)')) return; await removeProject(b.dataset.delp); draw(); }));
    $$('[data-delc]', holder).forEach((b) => b.addEventListener('click', async () => { if (!confirm('Remove this collection? The projects stay and move to “Not in a collection”.')) return; await removeCollection(b.dataset.delc); draw(); }));
    $$('[data-look]', holder).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Making…';
      const c = cols.find((x) => x.id === b.dataset.look);
      const canvas = await lookbook(c, projects.filter((p) => p.collection === c.id));
      canvas.toBlob((blob) => download(blob, `triad-${(c.name || 'collection').replace(/\W+/g, '-').toLowerCase()}-lookbook.png`));
      b.disabled = false; b.textContent = 'Lookbook image';
    }));
  }
  $('[data-newc]', main).addEventListener('click', async () => { await saveCollection({ name: 'New collection' }); draw(); });
  draw();
  return { destroy() {} };
}

/** One tall image: title, about, then every design with its notes and concept art. */
async function lookbook(c, items) {
  try { await document.fonts.load('400 80px Anton'); } catch { /* fallback */ }
  const W = 1600, pad = 70, rowH = 560;
  const H = 360 + items.length * (rowH + 40) + 120;
  const cv = makeCanvas(W, H); const x = cv.getContext('2d');
  x.fillStyle = '#fbfaf8'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#0a0a0a'; x.font = '400 110px Anton, Impact, sans-serif'; x.fillText(String(c.name).toUpperCase(), pad, 170);
  x.fillStyle = '#c4ef2f'; x.fillRect(pad, 200, 220, 14);
  x.fillStyle = '#5f6064'; x.font = '400 30px "Inter Tight", Arial, sans-serif';
  wrap(x, c.about || '', W - 2 * pad).slice(0, 3).forEach((l, i) => x.fillText(l, pad, 270 + i * 40));
  let y = 360;
  for (const p of items) {
    if (p.thumb) { const img = await loadImage(p.thumb); const k = Math.min(520 / img.width, rowH / img.height); x.fillStyle = '#eceff0'; x.fillRect(pad, y, 520, rowH); x.drawImage(img, pad + (520 - img.width * k) / 2, y + (rowH - img.height * k) / 2, img.width * k, img.height * k); }
    const tx = pad + 560;
    x.fillStyle = '#0a0a0a'; x.font = '400 54px Anton, Impact, sans-serif'; x.fillText(String(p.name).toUpperCase().slice(0, 34), tx, y + 60);
    x.font = '500 22px "JetBrains Mono", monospace'; x.fillStyle = '#5f6064'; x.fillText((TYPE_NAMES[p.type] || p.type).toUpperCase(), tx, y + 100);
    x.font = '400 28px "Inter Tight", Arial, sans-serif'; x.fillStyle = '#0a0a0a';
    wrap(x, p.notes || '', W - tx - pad).slice(0, 7).forEach((l, i) => x.fillText(l, tx, y + 150 + i * 38));
    let cx = tx;
    for (const id of (p.concepts || []).slice(0, 5)) { const cc = await designCanvas(id, 400); if (!cc) continue; const k = 150 / Math.max(cc.width, cc.height); x.drawImage(cc, cx, y + rowH - 160, cc.width * k, cc.height * k); cx += 170; }
    y += rowH + 40;
  }
  x.fillStyle = '#0a0a0a'; x.fillRect(0, H - 80, W, 80); x.fillStyle = '#c4ef2f'; x.font = '500 22px "JetBrains Mono", monospace'; x.fillText(`TRIAD STUDIO · ${new Date().toISOString().slice(0, 10)}`, pad, H - 32);
  return cv;
}
function wrap(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
