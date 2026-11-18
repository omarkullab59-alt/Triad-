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
  earrings: '<circle cx="20" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="46" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="4"/>',
  bangle: '<path d="M14 40a18 14 0 1 1 36 0" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
  chain: '<g fill="none" stroke="currentColor" stroke-width="4"><ellipse cx="14" cy="32" rx="10" ry="6"/><ellipse cx="32" cy="32" rx="4" ry="9"/><ellipse cx="50" cy="32" rx="10" ry="6"/></g>',
  draw: '<path d="M10 52c10-4 14-20 24-20s6 16 20 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M40 8l14 14-22 22H18V30z" fill="none" stroke="currentColor" stroke-width="3"/>',
};
const TILES = [
  ['ring', 'Ring', 'Size, band shape, signet, engraving'],
  ['pendant', 'Pendant', 'From your sketch or photo'],
  ['earrings', 'Earrings', 'Studs or hoops, as a pair'],
  ['bangle', 'Bangle', 'Open cuff or closed bangle'],
  ['chain', 'Chain', 'Link shape, size, length'],
  ['draw', 'Draw', 'Sketch it, see it rendered live'],
];
const NAMES = Object.fromEntries(TILES.map(([k, n]) => [k, n]));

function home(main) {
  const saved = listDesigns();
  main.innerHTML = `
  <section class="hero">
    <p class="label muted">TRIAD Studio · free · no login</p>
    <h1>Design your jewellery<em>no 3D skills needed.</em></h1>
    <p>Pick a piece, move a few sliders, take home a file your jeweller or 3D printer can use.</p>
    <ol class="steps-intro label" aria-label="How it works">
      <li><span class="num num--on">1</span>What?</li><li><span class="num">2</span>Adjust</li><li><span class="num">3</span>Save &amp; share</li>
    </ol>
  </section>
  <h2 class="tiles-head wrap label">1 · What do you want to make?</h2>
  <nav class="tiles" aria-label="Choose what to make">
    ${TILES.map(([k, n, d]) => `<a class="tile${k === 'draw' ? ' tile--draw' : ''}" href="#/${k}">
      <svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[k]}</svg>
      <span><span class="tile-name">${n}</span><br><span class="tile-desc">${d}</span></span></a>`).join('')}
  </nav>
  ${saved.length ? `<section class="saved" aria-labelledby="saved-h">
    <h2 id="saved-h" class="label">Saved on this device</h2>
    <ul class="saved-list">${saved.map((d) => `<li><a href="${esc(d.hash)}"><span class="label muted">${esc(NAMES[d.type] || d.type)}</span>${esc(d.name)}</a>
      <button class="icon-btn" type="button" data-del="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">×</button></li>`).join('')}</ul>
  </section>` : ''}`;
  main.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    deleteDesign(b.dataset.del);
    toast('Deleted.');
    home(main);
  }));
}

/* ── router: #/ · #/ring?… · #/draw ── */
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
  document.title = key && NAMES[key] ? `${NAMES[key]} · TRIAD Studio` : 'TRIAD Studio';
  if (!key || !NAMES[key]) { home(main); window.scrollTo(0, 0); return; }
  main.innerHTML = '<div class="stage-loading" style="min-height:50vh"><div class="spinner" role="img" aria-label="Loading"></div></div>';
  try {
    const mod = key === 'draw' ? await import('./draw/app.js') : await import('./jewellery/app.js');
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
