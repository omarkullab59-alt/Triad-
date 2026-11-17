// Reusable editorial components. Every function returns an HTML string.
import { escapeHtml as e } from './markdown.mjs';
import { imgTag, resolveImage } from './images.mjs';
import { emblem, glyph, symbol } from './brand.mjs';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const fmtDate = (d) => {
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, '0')}.${String(x.getUTCMonth() + 1).padStart(2, '0')}.${x.getUTCFullYear()}`;
};
export const fmtDateLong = (d) => {
  const x = new Date(d);
  return `${MONTHS[x.getUTCMonth()]} ${String(x.getUTCDate()).padStart(2, '0')}, ${x.getUTCFullYear()}`;
};
export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
export const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Split a headline into animated words. */
export const splitWords = (text) =>
  e(text)
    .split(/\s+/)
    .map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`)
    .join(' ');

export const label = (text, cls = '') => `<span class="label ${cls}">${e(text)}</span>`;

/** Image inside the TRIAD frame: crop marks + code. */
export function frame({ src, alt = '', code = '', sizes = '50vw', eager = false, cls = '', ctx }) {
  return `<div class="frame ${cls}">
  ${imgTag({ src: resolveImage(src, ctx), alt, sizes, eager })}
  <i class="crop crop--tl"></i><i class="crop crop--br"></i>
  ${code ? `<span class="frame-code">${e(code)}</span>` : ''}
</div>`;
}

export function storyCard(a, ctx, { variant = '', sizes = '(max-width: 760px) 100vw, 45vw', eager = false } = {}) {
  return `<article class="story-card ${variant}" data-reveal>
  <a href="${ctx.url(a.url)}" class="story-link" data-cursor="Read">
    ${frame({ src: a.cover, alt: '', code: a.code, sizes, eager, ctx })}
    <div class="story-meta">
      ${label(a.category)}<span class="dot"></span>${label(fmtDate(a.date), 'label--dim')}
    </div>
    <h3 class="story-title">${e(a.title)}</h3>
    ${variant.includes('story-card--lead') ? `<p class="story-deck">${e(a.deck)}</p>` : ''}
  </a>
</article>`;
}

export function newsRow(n, ctx, i = 0) {
  return `<li class="news-row" data-topic="${slugify(n.topic)}" data-preview="${e(resolveImage(n.image, ctx))}">
  <a href="${ctx.url(n.url)}">
    <span class="news-idx">${String(i + 1).padStart(3, '0')}</span>
    <time datetime="${isoDate(n.date)}" class="news-date">${fmtDate(n.date)}</time>
    <span class="news-topic">${e(n.topic)}</span>
    <span class="news-title">${e(n.title)}</span>
    ${n.sample ? '<span class="sample-tag" title="Fictional sample entry for layout purposes">Sample</span>' : '<span></span>'}
    <span class="news-arrow" aria-hidden="true">&#8599;</span>
  </a>
</li>`;
}

export function wireRow(w) {
  const d = w.date ? new Date(w.date) : null;
  const when = d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}` : '';
  return `<li class="wire-row" data-cat="${slugify(w.source)}">
  <a href="${e(w.link)}" target="_blank" rel="noopener nofollow" data-cursor="Open">
    <time datetime="${e(w.date || '')}" class="news-date">${when}</time>
    <span class="wire-source">${e(w.source)}</span>
    <span class="wire-title">${e(w.title)}</span>
    <span class="news-arrow" aria-hidden="true">&#8599;</span>
    <span class="visually-hidden">(opens ${e(w.source)} in a new tab)</span>
  </a>
</li>`;
}

export function issueCover(issue, ctx, { tilt = 0 } = {}) {
  return `<a class="issue-cover${issue.designed ? ' is-designed' : ''}" href="${issue.pages?.length ? ctx.url(`/magazine/issue-${issue.number}/`) : ctx.url('/magazine/') + '#issue-' + issue.number}" style="--tilt:${tilt}deg" data-cursor="Issue ${e(issue.number)}">
  ${imgTag({ src: resolveImage(issue.cover, ctx), alt: `TRIAD Issue ${issue.number} cover`, sizes: '(max-width: 760px) 80vw, 30vw' })}
  <span class="ic-mast">TRIAD</span>
  <span class="ic-no">N&deg;${e(issue.number)}</span>
  <span class="ic-season">${e(issue.season)}</span>
  <span class="ic-title">${e(issue.title)}</span>
  <span class="ic-lines">${issue.lines.map((l) => `<span>${e(l)}</span>`).join('')}</span>
  <span class="ic-code">ISSN 0000-0003 · €0.00 · ${e(issue.season.toUpperCase())}</span>
</a>`;
}

export function marquee(items, cls = '') {
  const row = items.map((t) => `<span>${t}</span><span class="mq-sep" aria-hidden="true">+</span>`).join('');
  return `<div class="marquee ${cls}" aria-hidden="true"><div class="mq-track">${row}${row}</div></div>`;
}

export function sectionHead({ index, title, link, linkText, kicker = '', sym = '' }, ctx) {
  return `<header class="section-head">
  <span class="sh-index">${sym ? symbol(sym, { cls: 'sh-sym' }) : ''}${e(index)}</span>
  <h2 class="sh-title" data-split>${splitWords(title)}</h2>
  ${kicker ? `<p class="sh-kicker">${e(kicker)}</p>` : ''}
  ${link ? `<a class="sh-link" href="${ctx.url(link)}">${e(linkText)} <span aria-hidden="true">&#8594;</span></a>` : ''}
</header>`;
}

export { emblem, glyph, symbol };
