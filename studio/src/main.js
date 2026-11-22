import './styles.css';
import { $, esc, toast } from './lib/dom.js';
import { listDesigns, deleteDesign, getMode, setMode } from './lib/store.js';

/* ── colour mode: auto → light → dark (stored under the same key as the TRIAD site) ── */
const MODES = ['auto', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
function applyMode(mode) {
  const html = document.documentElement;
  html.dataset.mode = mode;
  html.classList.toggle('night', mode === 'dark' || (mode === 'auto' && media.matches));
  const btn = $('[data-mode-toggle]');
  if (btn) {
    $('[data-mode-label]', btn).textContent = mode[0].toUpperCase() + mode.slice(1);
    btn.setAttribute('aria-label', `Colour mode: ${mode}. Change`);
  }
  window.dispatchEvent(new CustomEvent('studio:theme'));
}
$('[data-mode-toggle]').addEventListener('click', () => {
  const next = MODES[(MODES.indexOf(document.documentElement.dataset.mode || 'auto') + 1) % 3];
  setMode(next);
  applyMode(next);
});
media.addEventListener?.('change', () => applyMode(getMode()));
applyMode(getMode());

/* ── home ── */
const ICONS = {
  ring: '<ellipse cx="32" cy="36" rx="20" ry="18" fill="none" stroke="currentColor" stroke-width="5"/><path d="M24 14l8-8 8 8z" fill="currentColor"/>',
  pendant: '<path d="M32 4v10" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M32 22l18 30H14z" fill="none" stroke="currentColor" stroke-width="4"/>',
  lettering: '<text x="32" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="30" font-weight="700" fill="currentColor">Aا字</text>',
  earrings: '<circle cx="20" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="46" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/>',
  bangle: '<path d="M14 40a18 14 0 1 1 36 0" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
  chain: '<g fill="none" stroke="currentColor" stroke-width="4"><ellipse cx="14" cy="32" rx="10" ry="6"/><ellipse cx="32" cy="32" rx="4" ry="9"/><ellipse cx="50" cy="32" rx="10" ry="6"/></g>',
  plate: '<ellipse cx="32" cy="34" rx="26" ry="10" fill="none" stroke="currentColor" stroke-width="4"/><ellipse cx="32" cy="33" rx="13" ry="4.5" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  vessel: '<path d="M18 12h28M20 12c-6 14 -6 34 4 42h16c10-8 10-28 4-42" fill="none" stroke="currentColor" stroke-width="4"/>',
  cutlery: '<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M16 58V30M10 8v14a6 6 0 0 0 12 0V8M16 8v12"/><path d="M32 58V8c6 4 8 16 0 24"/><path d="M48 58V32"/><ellipse cx="48" cy="18" rx="6" ry="11"/></g>',
  cabinet: '<g fill="none" stroke="currentColor" stroke-width="4"><rect x="12" y="8" width="40" height="44"/><path d="M32 8v44M12 52l-2 6M52 52l2 6"/></g><path d="M27 28v6M37 28v6" stroke="currentColor" stroke-width="4"/>',
  draw: '<path d="M10 52c10-4 14-20 24-20s6 16 20 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M40 8l14 14-22 22H18V30z" fill="none" stroke="currentColor" stroke-width="3"/>',
  symbol: '<g fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="22"/><path d="M32 12l17 30H15z"/></g><circle cx="32" cy="32" r="4" fill="currentColor"/>',
  sketch3d: '<path d="M10 50l16-30 10 16 6-8 12 22z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M10 50l8 6h44l-8-6" fill="none" stroke="currentColor" stroke-width="3"/>',
  couture: '<path d="M14 18c4-10 32-10 36 0 4 14 0 30-18 40C14 48 10 32 14 18z" fill="none" stroke="currentColor" stroke-width="4"/><g fill="currentColor"><circle cx="24" cy="26" r="3"/><circle cx="40" cy="26" r="3"/><circle cx="32" cy="36" r="2.5"/><circle cx="26" cy="44" r="2.5"/><circle cx="38" cy="44" r="2.5"/></g>',
  garment: '<path d="M22 8l-14 8 6 12 6-3v31h24V25l6 3 6-12-14-8c-2 5-6 7-10 7s-8-2-10-7z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>',
  hat: '<path d="M10 44c0-20 10-34 22-34s22 14 22 34z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M6 44h52v8H6z" fill="currentColor"/><path d="M22 14v30M32 10v34M42 14v30" stroke="currentColor" stroke-width="2"/>',
  belt: '<rect x="4" y="26" width="56" height="12" fill="none" stroke="currentColor" stroke-width="4"/><rect x="10" y="20" width="16" height="24" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="40" cy="32" r="2" fill="currentColor"/><circle cx="48" cy="32" r="2" fill="currentColor"/>',
  tape: '<path d="M4 22h56v20H4z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M12 22l-8 10M24 22L10 42M36 22L22 42M48 22L34 42M60 22L46 42M60 34l-6 8" stroke="currentColor" stroke-width="3"/>',
  collections: '<rect x="6" y="16" width="36" height="40" fill="none" stroke="currentColor" stroke-width="4"/><path d="M16 10h36v40" fill="none" stroke="currentColor" stroke-width="4"/><path d="M14 28h20M14 36h20M14 44h12" stroke="currentColor" stroke-width="3"/>',
  designs: '<rect x="8" y="10" width="48" height="40" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><path d="M12 44l14-16 10 10 6-6 10 12" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="44" cy="20" r="4" fill="currentColor"/>',
  find: '<circle cx="27" cy="27" r="16" fill="none" stroke="currentColor" stroke-width="5"/><path d="M39 39l15 15" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
  wearable: '<path d="M8 50V20l12 14 12-22 12 22 12-14v30z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 50h48" stroke="currentColor" stroke-width="6"/>',
  sculpture: '<circle cx="32" cy="12" r="6" fill="currentColor"/><path d="M32 18v20M32 24l-12 8M32 24l12-10M32 38l-8 14M32 38l8 14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M14 56h36" stroke="currentColor" stroke-width="5"/>',
  world: '<circle cx="44" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M4 52l14-22 9 12 8-10 14 20z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M4 58c8-4 16-4 24 0s16 4 32 0" fill="none" stroke="currentColor" stroke-width="2.5"/>',
  ether: '<circle cx="32" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M22 58l4-22-8-6 14-6 14 6-8 6 4 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><ellipse cx="32" cy="58" rx="24" ry="4" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 30c6-10 12-14 20-14M58 30c-6-10-12-14-20-14" fill="none" stroke="currentColor" stroke-width="2"/>',
  model: '<g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="M32 6l22 12v26L32 58 10 44V18z"/><path d="M10 18l22 12 22-12M32 30v28"/></g>',
};
const GROUPS = [
  ['Worlds', [
    ['world', 'World Builder', 'Generate & sculpt landscapes, skies, water, planets'],
    ['ether', 'Ether World', '3D fashion universe: character, wardrobe, showroom'],
  ]],
  ['Jewellery', [
    ['ring', 'Ring', 'Size, band, signet, engraving'],
    ['pendant', 'Pendant', 'From your sketch or photo'],
    ['lettering', 'Lettering', 'Names in any script & font'],
    ['earrings', 'Earrings', 'Studs or hoops, as a pair'],
    ['bangle', 'Bangle', 'Open cuff or closed bangle'],
    ['chain', 'Chain', 'Link shape, size, length'],
    ['wearable', 'Crown · Tiara · Mask', 'Templates or your own drawing'],
    ['couture', 'Couture mask', 'Veils, crystals, horns, cages'],
  ]],
  ['Wear', [
    ['garment', 'Clothing', 'Tops, trousers, skirts — every measurement'],
    ['hat', 'Hats', 'Beanie, cap, bucket hat, balaclava'],
    ['belt', 'Belt', 'Strap, buckle, cutting template'],
    ['tape', 'Tape', 'Your text or design, endless'],
  ]],
  ['Home', [
    ['plate', 'Plate', 'Dinner, coupe, deep, wavy'],
    ['vessel', 'Bowl · Cup · Vase', 'Bowls, cups, mugs, vases'],
    ['cutlery', 'Cutlery', 'Fork, knife, spoon, sets'],
    ['cabinet', 'Cabinet', 'Sideboard, wardrobe, shelf'],
    ['sculpture', 'Sculpture', 'Figures, snakes, dragons, busts'],
  ]],
  ['Create', [
    ['collections', 'Collections', 'Projects, notes, concept art'],
    ['designs', 'My designs', 'Upload your artwork, use it anywhere'],
    ['find', 'Finder', 'Search cultures, styles, shapes'],
    ['draw', 'Draw', 'Sketch it, see it rendered live'],
    ['symbol', 'Symbol', 'Design your own signs & logos'],
    ['sketch3d', 'Sketch to 3D', 'Cut-out, relief or turned'],
    ['model', 'Upload 3D', 'Work on your STL / OBJ / GLB'],
  ]],
];
const TILES = GROUPS.flatMap(([, t]) => t);
const NAMES = Object.fromEntries(TILES.map(([k, n]) => [k, n]));

function home(main) {
  const saved = listDesigns();
  main.innerHTML = `
  <section class="hero">
    <div class="hero-text">
      <p class="label muted">TRIAD Studio · free · no login</p>
      <h1>Design your own objects<em>no 3D skills needed.</em></h1>
      <p>Jewellery, clothing, couture, homeware and sculpture — shaped live in 3D, engraved, printed or destroyed, exported for your maker or 3D printer.</p>
    </div>
    <form class="hero-search" role="search" data-hero-search>
      <label for="hs" class="visually-hidden">Find a culture, style or shape</label>
      <input id="hs" type="search" placeholder="Find: japanese, gothic, celtic, crystal mask, dragon …" enterkeyhint="search" autocomplete="off">
      <button class="btn btn--lime" type="submit">Find</button>
    </form>
  </section>
  <section class="recent wrap" aria-labelledby="recent-h" data-recent hidden>
    <div class="recent-head"><h2 id="recent-h" class="label">Recent projects</h2><a class="label muted" href="#/collections">All collections →</a></div>
    <ul class="recent-list" data-recent-list></ul>
  </section>
  ${GROUPS.map(([g, tiles]) => `<h2 class="wrap label muted tiles-head">${g}</h2>
  <nav class="tiles" aria-label="${g}">
    ${tiles.map(([k, n, d]) => `<a class="tile${k === 'draw' ? ' tile--draw' : ''}${k === 'ether' || k === 'world' ? ' tile--wide' : ''}" href="#/${k}">
      <svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[k]}</svg>
      <span><span class="tile-name">${n}</span><br><span class="tile-desc">${d}</span></span></a>`).join('')}
  </nav>`).join('')}
  ${saved.length ? `<section class="saved" aria-labelledby="saved-h">
    <h2 id="saved-h" class="label">Saved on this device</h2>
    <ul class="saved-list">${saved.map((d) => `<li><a href="${esc(d.hash)}"><span class="label muted">${esc(NAMES[d.type] || d.type)}</span> ${esc(d.name)}</a>
      <button class="icon-btn" type="button" data-del="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">×</button></li>`).join('')}</ul>
  </section>` : ''}`;
  import('./lib/projects.js').then(async ({ listProjects }) => {
    const list = (await listProjects()).slice(0, 6);
    if (!list.length || !main.querySelector('[data-recent]')) return;
    main.querySelector('[data-recent-list]').innerHTML = list.map((pr) => `<li><a href="${esc(pr.hash || `#/${pr.type}`)}${String(pr.hash || '').includes('?') ? '&' : '?'}prj=${esc(pr.id)}">
      <span class="recent-thumb">${pr.thumb ? `<img src="${esc(pr.thumb)}" alt="">` : ''}</span>
      <span class="recent-name">${esc(pr.name)}</span><span class="label muted">${esc(NAMES[pr.type] || pr.type)} · ${esc((pr.date || '').slice(0, 10))}</span></a></li>`).join('');
    main.querySelector('[data-recent]').hidden = false;
  }).catch(() => {});
  main.querySelector('[data-hero-search]').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/find?q=${encodeURIComponent(main.querySelector('#hs').value)}`; });
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    deleteDesign(b.dataset.del);
    toast('Deleted.');
    home(main);
  }));
}

/* ── tooltips: one floating label for every [data-tip] (mouse hover and keyboard focus) ── */
let tipEl = null, tipFor = null, tipTimer = 0;
function hideTip() { clearTimeout(tipTimer); tipEl?.remove(); tipEl = null; tipFor = null; }
function showTip(el, delay) {
  if (tipFor === el) return;
  hideTip();
  tipFor = el;
  tipTimer = setTimeout(() => {
    if (!el.isConnected) return;
    tipEl = document.createElement('div');
    tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip');
    tipEl.textContent = el.dataset.tip;
    document.body.append(tipEl);
    const r = el.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    const below = r.top < 60;
    tipEl.style.left = `${Math.max(6, Math.min(innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2))}px`;
    tipEl.style.top = `${below ? r.bottom + 6 : r.top - t.height - 6}px`;
  }, delay);
}
document.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const el = e.target.closest?.('[data-tip]'); if (el) showTip(el, 380); else if (tipFor) hideTip(); });
document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && e.target.matches(':focus-visible')) showTip(el, 150); else hideTip(); });
for (const ev of ['pointerdown', 'scroll', 'keydown', 'hashchange']) window.addEventListener(ev, hideTip, true);

/* ── router: #/ · #/ring?… · #/draw ── */
const PAGES = ['draw', 'symbol', 'find', 'designs', 'collections'];
let current = null;
let currentKey = '';
async function route() {
  const main = $('#main');
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const key = path || '';
  // same tool, only the parameters changed (back/forward or a pasted link): let the tool update itself
  if (key === currentKey && current?.update) { current.update(new URLSearchParams(query)); return; }
  current?.destroy?.();
  current = null;
  currentKey = key;
  document.body.classList.toggle('in-tool', !!NAMES[key] && !PAGES.includes(key));
  document.title = key && NAMES[key] ? `${NAMES[key]} · TRIAD Studio` : 'TRIAD Studio';
  if (!key || !NAMES[key]) { home(main); window.scrollTo(0, 0); return; }
  main.innerHTML = '<div class="stage-loading" style="min-height:50vh"><div class="spinner" role="img" aria-label="Loading"></div></div>';
  try {
    const mod = key === 'draw' ? await import('./draw/app.js') : key === 'symbol' ? await import('./symbol/app.js') : key === 'find' ? await import('./find/app.js') : key === 'designs' ? await import('./designs/app.js') : key === 'collections' ? await import('./collections/app.js') : key === 'ether' ? await import('./ether/app.js') : key === 'world' ? await import('./world/app.js') : await import('./jewellery/app.js');
    if (currentKey !== key) return;
    current = await mod.mount(main, key, new URLSearchParams(query));
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="wrap" style="padding-top:40px"><p>Sorry, this tool could not start. ${/WebGL/i.test(e?.message) ? 'Your browser has 3D graphics (WebGL) switched off.' : 'Please reload the page.'}</p><p style="margin-top:16px"><a class="btn" href="#/">Back to start</a></p></div>`;
  }
  window.scrollTo(0, 0);
  if (document.activeElement === document.body || !main.contains(document.activeElement)) main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
route();

/* ── installable app / offline shell ── */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
