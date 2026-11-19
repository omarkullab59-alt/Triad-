// PROJECTS & COLLECTIONS: every design (from any tool) can be saved as a project together with notes and
// concept art, and grouped into collections. Everything stays on this device (IndexedDB).
//
// project    = { id, name, type, hash, notes, concepts: [designId…], collection, thumb, date }
// collection = { id, name, about, date }
import * as db from './db.js';
import { esc, toast } from './dom.js';
import { listDesigns, designPicker } from './designs.js';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let pCache = null, cCache = null;

export async function listProjects() {
  if (!pCache) pCache = (await db.all('projects')).map((r) => r.value).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return pCache;
}
export async function getProject(id) { return (await listProjects()).find((p) => p.id === id) || null; }
export async function saveProject(p) {
  const full = { notes: '', concepts: [], collection: '', ...p, id: p.id || newId(), date: new Date().toISOString() };
  await db.put('projects', full.id, full);
  pCache = null;
  return full;
}
export async function removeProject(id) { await db.del('projects', id); pCache = null; }

export async function listCollections() {
  if (!cCache) cCache = (await db.all('collections')).map((r) => r.value).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return cCache;
}
export async function saveCollection(c) {
  const full = { about: '', ...c, id: c.id || newId(), date: c.date || new Date().toISOString() };
  await db.put('collections', full.id, full);
  cCache = null;
  return full;
}
export async function removeCollection(id) {
  for (const p of await listProjects()) if (p.collection === id) await saveProject({ ...p, collection: '' });
  await db.del('collections', id); cCache = null;
}

/**
 * Save dialog: name, collection, notes and concept art for the current design.
 * @param o.project   existing project (to update) or null
 * @param o.defaults  { name, type, hash, thumb }
 * @returns Promise<project|null>
 */
export async function openProjectDialog({ project = null, defaults }) {
  const cols = await listCollections();
  const p = { ...defaults, ...(project || {}), hash: defaults.hash, thumb: defaults.thumb, type: defaults.type };
  let concepts = [...(p.concepts || [])];
  const dlg = document.createElement('dialog');
  dlg.setAttribute('aria-labelledby', 'pj-h');
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <div class="dlg-head"><h2 id="pj-h" class="section-title">${project ? 'Update project' : 'Save project'}</h2><button class="icon-btn" value="x" aria-label="Close">×</button></div>
    ${p.thumb ? `<img src="${p.thumb}" alt="" style="max-height:200px;object-fit:contain;background:var(--wash)">` : ''}
    <div class="field"><label for="pj-name">Name</label><input id="pj-name" class="input" type="text" maxlength="80" value="${esc(p.name || '')}" required></div>
    <div class="field"><label for="pj-col">Collection</label>
      <select id="pj-col" class="input"><option value="">No collection</option>${cols.map((c) => `<option value="${esc(c.id)}"${c.id === p.collection ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ New collection…</option></select></div>
    <div class="field" data-newcol hidden><label for="pj-newcol">Name of the new collection</label><input id="pj-newcol" class="input" type="text" maxlength="60" placeholder="e.g. SS27 — Fog"></div>
    <div class="field"><label for="pj-notes">Notes</label><textarea id="pj-notes" class="input" rows="5" maxlength="8000" placeholder="Ideas, fabric, fit, references, who it is for …">${esc(p.notes || '')}</textarea></div>
    <div data-concepts></div>
    <div class="btn-row"><button class="btn btn--lime" value="save" data-save>${project ? 'Update' : 'Save'}</button><button class="btn" value="x">Cancel</button></div>
    <p class="muted" style="font-size:13px">Stored only on this device. Open everything in <a href="#/collections">Collections</a>.</p>
  </form>`;
  document.body.append(dlg);
  const col = dlg.querySelector('#pj-col');
  col.addEventListener('change', () => { dlg.querySelector('[data-newcol]').hidden = col.value !== '__new'; });
  // concept art: several of your designs (multi-select)
  const box = dlg.querySelector('[data-concepts]');
  const drawConcepts = async () => {
    const all = await listDesigns();
    box.innerHTML = `<div class="ctl-head"><span class="ctl-name">Concept art</span></div><p class="ctl-help">Moodboards, sketches, references — tap to attach or remove. Upload new ones below.</p><div class="motif-grid" data-cg></div>`;
    const grid = box.querySelector('[data-cg]');
    for (const d of all) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(concepts.includes(d.id))); b.title = d.name; b.setAttribute('aria-label', `Concept art: ${d.name}`);
      b.innerHTML = `<img src="${d.thumb}" alt="">`;
      b.addEventListener('click', () => { concepts = concepts.includes(d.id) ? concepts.filter((x) => x !== d.id) : [...concepts, d.id]; b.setAttribute('aria-pressed', String(concepts.includes(d.id))); });
      grid.append(b);
    }
    box.append(designPicker({ label: 'Add concept art', help: 'Upload images (PNG, JPG, WebP, SVG). They are attached automatically.', onPick: (id) => { if (!concepts.includes(id)) concepts.push(id); drawConcepts(); } }));
  };
  await drawConcepts();
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => { dlg.remove(); resolve(null); });
    dlg.querySelector('[data-save]').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!dlg.querySelector('form').reportValidity()) return;
      let collection = col.value;
      if (collection === '__new') {
        const name = dlg.querySelector('#pj-newcol').value.trim() || 'New collection';
        collection = (await saveCollection({ name })).id;
      }
      const saved = await saveProject({ ...p, name: dlg.querySelector('#pj-name').value.trim(), notes: dlg.querySelector('#pj-notes').value, concepts, collection });
      dlg.remove();
      toast(`“${saved.name}” saved${collection ? ' to the collection' : ''}.`);
      resolve(saved);
    });
  });
}
