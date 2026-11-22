// FINDER: search everything in the Studio by culture, era, style, mood or shape — and look further in museum archives.
import { buildIndex, search, ELSEWHERE } from './index.js';
import { renderMotif } from '../lib/motifs.js';
import { ensureFont } from '../lib/fonts.js';
import { $, $$, esc } from '../lib/dom.js';

const SUGGEST = ['japanese', 'celtic', 'gothic', 'art deco', 'baroque', 'moorish', 'aztec', 'greek', 'chinese', 'punk', 'snake', 'dragon', 'crystal', 'horns', 'couture', 'skull', 'arabic', 'russian', 'pattern', 'bronze'];

export async function mount(main, _key, query) {
  const items = buildIndex();
  main.innerHTML = `
  <section class="draw" aria-labelledby="find-h" style="max-width:1100px">
    <div><p class="label muted">Finder</p><h1 id="find-h" class="section-title" style="font-size:clamp(32px,6vw,56px)">Find a culture, a style, a shape.</h1></div>
    <form class="find-form" role="search" data-form>
      <label for="find-q" class="visually-hidden">Search</label>
      <input id="find-q" class="input" type="search" placeholder="e.g. japanese waves, celtic knot, gothic, crystal mask, art deco …" autocomplete="off" enterkeyhint="search">
      <button class="btn btn--lime" type="submit">Find</button>
    </form>
    <div class="chips" aria-label="Ideas">${SUGGEST.map((s) => `<button type="button" class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <p class="label muted" aria-live="polite" data-count></p>
    <div class="find-results" data-results></div>
    <section data-elsewhere hidden aria-labelledby="else-h" style="margin-top:24px">
      <h2 id="else-h" class="label">Look further (opens museum archives &amp; image search in a new tab)</h2>
      <div class="btn-row" style="margin-top:8px" data-links></div>
      <p class="muted" style="font-size:13px;margin-top:8px">Use them for inspiration. Then draw your own version in Symbol or Draw and turn it into 3D.</p>
    </section>
  </section>`;
  const input = $('#find-q', main);
  const results = $('[data-results]', main);

  function show(q) {
    const hits = search(q, items).slice(0, 80);
    $('[data-count]', main).textContent = q.trim() ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q}”` : '';
    const groups = new Map();
    for (const h of hits) (groups.get(h.kind) || groups.set(h.kind, []).get(h.kind)).push(h);
    const order = ['Motif', 'Pattern', 'Couture', 'Starting point', 'Pose', 'Font', 'Tool', 'Material'];
    const title = (kind) => ({ Couture: 'Couture masks & headpieces', Pose: 'Sculpture poses', 'Starting point': 'Starting points' }[kind] || `${kind}s`);
    results.innerHTML = [...groups].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([kind, list]) => `
      <h2 class="label" style="margin:18px 0 8px">${esc(title(kind))}</h2>
      <ul class="find-grid">${list.map((h) => `<li class="find-card">
        ${h.motif ? `<div class="find-thumb" data-motif="${esc(h.motif)}"></div>` : h.font ? `<div class="find-thumb find-font" data-font="${esc(h.font)}" style="font-family:'${esc(h.font)}'">${esc(h.sample)}</div>` : ''}
        <div class="find-body"><span class="label muted">${esc(h.sub || kind)}</span><strong>${esc(h.label)}</strong>
        <div class="btn-row">${h.actions ? h.actions.map(([l, href]) => `<a class="btn" href="${esc(href)}">${esc(l)}</a>`).join('') : h.href ? `<a class="btn btn--lime" href="${esc(h.href)}">Open</a>` : ''}</div></div></li>`).join('')}</ul>`).join('')
      || (q.trim() ? '<p class="muted">Nothing in the Studio yet — try another word, or look further below.</p>' : '');
    $$('[data-motif]', results).forEach((el) => renderMotif(el.dataset.motif, 160).then((c) => { el.innerHTML = `<img src="${c.toDataURL()}" alt="">`; }));
    $$('[data-font]', results).forEach((el) => ensureFont(el.dataset.font, el.textContent));
    $('[data-links]', main).innerHTML = ELSEWHERE.map(([l, u]) => `<a class="btn" href="${u}${encodeURIComponent(q)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('');
    $('[data-elsewhere]', main).hidden = !q.trim();
  }
  const go = (q) => { input.value = q; try { history.replaceState(null, '', `#/find?q=${encodeURIComponent(q)}`); } catch { /* ignore */ } show(q); };
  $('[data-form]', main).addEventListener('submit', (e) => { e.preventDefault(); go(input.value); });
  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => go(input.value), 220); });
  $$('[data-s]', main).forEach((b) => b.addEventListener('click', () => go(b.dataset.s)));
  const q0 = query.get('q') || '';
  input.value = q0;
  show(q0);
  if (!q0) input.focus();
  return { update(q) { const v = q.get('q') || ''; if (v !== input.value) { input.value = v; show(v); } }, destroy() { clearTimeout(t); } };
}
