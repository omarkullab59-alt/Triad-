// Page shell: <head> with SEO + social + JSON-LD, header, menu overlay, footer.
import { escapeHtml as e } from './markdown.mjs';
import { emblem, glyph, label, marquee } from './components.mjs';
import { symbol } from './brand.mjs';

// Three pillars — "three forces" as navigation: READ (signal), SEE (image), FIND.
export const PILLARS = [
  { key: 'read', text: 'Read', n: 'I', sym: 'air', items: [
    { href: '/magazine/', text: 'Magazine', sym: 'chord' }, { href: '/news/', text: 'News', sym: 'air' }, { href: '/people/', text: 'Voices', sym: 'tonnetz' }] },
  { key: 'see', text: 'See', n: 'II', sym: 'fire', items: [
    { href: '/darkroom/', text: 'Darkroom', sym: 'pyramid' }, { href: '/archive/', text: 'Archive', sym: 'sierpinski' }] },
  { key: 'find', text: 'Find', n: 'III', sym: 'delta', items: [
    { href: '/finder/', text: 'Finder', sym: 'delta' }] },
];
export const pillarOf = (path) => PILLARS.find((p) => p.items.some((i) => path.startsWith(i.href))) || null;

export function layout(ctx, { title, description, path, body, image, type = 'website', jsonld, theme = 'dark', pageId = 'page', noindex = false, night = false }) {
  const { site } = ctx;
  const fullTitle = title ? `${title} — ${site.title}` : `${site.title} — ${site.tagline}`;
  const canonical = site.url.replace(/\/$/, '') + path;
  const ogImage = image ? (/^https?:/.test(image) ? image : site.url.replace(/\/$/, '') + image) : site.url.replace(/\/$/, '') + '/assets/brand/emblem-orange.svg';
  const active = (href) => (path.startsWith(href) ? ' aria-current="page"' : '');
  const v = ctx.version;
  const pillar = pillarOf(path);

  return `<!doctype html>
<html lang="${site.lang}" data-theme="${theme}"${night ? ' data-force="night" class="night"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(description || site.description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="robots" content="noai, noimageai">
<meta name="tdm-reservation" content="1">
<meta name="tdm-policy" content="${site.url}/legal/darkroom-rules/">
<meta property="og:site_name" content="${site.title}">
<meta property="og:title" content="${e(fullTitle)}">
<meta property="og:description" content="${e(description || site.description)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${e(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="${night ? 'dark' : 'light dark'}">
<meta name="theme-color" content="#fbfaf8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0b0b" media="(prefers-color-scheme: dark)">
<script>/* light / dark before first paint: forced page → saved choice → system setting */(function(){var h=document.documentElement,p=null;try{p=localStorage.getItem('triad-theme')}catch(e){}var n=h.dataset.force==='night'||p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('night',n)})();</script>
<link rel="icon" href="${ctx.url('/assets/icons/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.url('/assets/icons/icon-192.png')}">
<link rel="manifest" href="${ctx.url('/manifest.webmanifest')}">
<link rel="alternate" type="application/rss+xml" title="TRIAD" href="${ctx.url('/feed.xml')}">
<link rel="preconnect" href="https://picsum.photos">
${ctx.localFonts
    ? `<link rel="stylesheet" href="${ctx.url('/assets/fonts/fonts.css')}?v=${v}">`
    : `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">`}
<link rel="stylesheet" href="${ctx.url('/assets/css/main.css')}?v=${v}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
<script>document.documentElement.classList.add('js');window.TRIAD_BASE=${JSON.stringify(ctx.base)};</script>
<script src="${ctx.url('/assets/js/main.js')}?v=${v}" defer></script>
</head>
<body id="${pageId}">
<a class="skip" href="#main">Skip to content</a>

<div class="curtain" aria-hidden="true">${emblem({ ring: false, cls: 'curtain-emblem' })}<span class="curtain-label">TRIAD — LOADING TRANSMISSION</span></div>
<div class="cursor" aria-hidden="true"><span class="cursor-dot"></span><span class="cursor-ring"><span class="cursor-text"></span></span></div>
<div class="progress" aria-hidden="true"></div>

<header class="site-header">
  <a class="brand" href="${ctx.url('/')}" aria-label="TRIAD — home">
    ${glyph({ cls: 'brand-emblem', color: 'currentColor' })}
    <span class="brand-word">TRIAD</span>
  </a>
  <nav class="nav" aria-label="Primary">
    <ul>
      ${PILLARS.map((p) => `<li class="nav-pillar${pillar === p ? ' is-current' : ''}"><span class="nav-pillar-name">${symbol(p.sym, { cls: 'nav-sym' })}${p.text}</span>${p.items.map((n) => `<a href="${ctx.url(n.href)}"${active(n.href)}>${n.text}</a>`).join('')}</li>`).join('')}
      <li class="nav-pillar nav-about"><a href="${ctx.url('/about/')}"${active('/about/')}>About</a></li>
    </ul>
  </nav>
  <div class="header-meta">
    <span class="label label--dim">N&deg;${site.currentIssue}</span>
    <span class="label clock" data-clock>BER --:--</span>
    <button class="theme-toggle label" type="button" data-theme-toggle aria-label="Colour mode"><span class="tt-icon" aria-hidden="true"></span><span data-theme-label>Auto</span></button>
    <button class="motion-toggle label" type="button" data-motion-toggle aria-pressed="false" title="Pause all animation"><span class="mt-dot" aria-hidden="true"></span><span data-motion-label>Motion on</span></button>
  </div>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu">
    <span class="mt-text">Index</span><span class="mt-lines" aria-hidden="true"><i></i><i></i><i></i></span>
  </button>
</header>

<nav class="tabbar" aria-label="Sections">
  <a href="${ctx.url('/')}"${path === '/' ? ' aria-current="page"' : ''}>${glyph({ cls: 'tab-icon', color: 'currentColor' })}<span>Now</span></a>
  ${PILLARS.map((p) => `<a href="${ctx.url(p.items[0].href)}"${pillar === p ? ' aria-current="true"' : ''}>${symbol(p.sym, { cls: 'tab-icon' })}<span>${p.text}</span></a>`).join('')}
</nav>


<div class="menu" id="menu" hidden>
  <div class="menu-inner">
    <nav aria-label="Menu">
      <ol class="menu-list">
        <li><a href="${ctx.url('/')}"><sup>00</sup>Now</a></li>
        ${PILLARS.map((p) => p.items.map((n, i) => `<li${i === 0 ? ' class="menu-pillar-start"' : ''}><a href="${ctx.url(n.href)}"><sup>${i === 0 ? `${p.n} ${p.text.toUpperCase()}` : ''}</sup>${n.text}</a></li>`).join('')).join('')}
        <li class="menu-pillar-start"><a href="${ctx.url('/about/')}"><sup>&mdash;</sup>About</a></li>
      </ol>
    </nav>
    <div class="menu-side">
      ${emblem({ cls: 'menu-emblem', motto: 'FASHION IS ONLY THE BEGINNING · ' })}
      <p class="menu-note serif">Three forces.<br>One vision.</p>
      <ul class="menu-social">${site.social.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label} &#8599;</a></li>`).join('')}</ul>
    </div>
  </div>
</div>

<main id="main" tabindex="-1">
${pillar && pillar.items.length > 1 && pillar.items.some((i) => i.href === path) ? `<nav class="pillar-bar" aria-label="${pillar.text}">
  <span class="pillar-bar-name label">${pillar.n} / ${pillar.text}</span>
  ${pillar.items.map((n) => `<a class="chip${path.startsWith(n.href) ? ' is-active' : ''}" href="${ctx.url(n.href)}"${active(n.href)}>${n.text}</a>`).join('')}
</nav>` : ''}
${body}
</main>

<footer class="site-footer">
  ${marquee(['BUILT OUTSIDE THE SYSTEM', 'THREE FORCES. ONE VISION.', 'AN ARCHIVE OF WHAT&rsquo;S NEXT', 'FASHION IS ONLY THE BEGINNING', 'BEYOND THE ORDINARY'], 'marquee--footer')}
  <div class="footer-grid">
    <div class="footer-emblem">${emblem({ motto: 'TRIAD · INDEPENDENT · MMXXVI · ' })}</div>
    <div class="footer-col">
      ${label('Transmission')}
      <p class="serif footer-lead">Letters from the collective. Irregular. Never noise.</p>
      <form class="newsletter" data-newsletter novalidate>
        <label for="nl-email" class="visually-hidden">Email address</label>
        <input id="nl-email" type="email" name="email" placeholder="your@email" autocomplete="email" required>
        <button type="submit">Join &#8594;</button>
        <p class="nl-msg label" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="footer-col">
      ${label('Index')}
      <ul class="footer-links">
        ${PILLARS.map((p) => p.items.map((n) => `<li><a href="${ctx.url(n.href)}"><span class="label label--dim">${p.text}</span> ${n.text}</a></li>`).join('')).join('')}
        <li><a href="${ctx.url('/about/')}">About</a></li>
        <li><a href="${ctx.url('/feed.xml')}">RSS</a></li>
      </ul>
    </div>
    <div class="footer-col">
      ${label('Elsewhere')}
      <ul class="footer-links">${site.social.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`).join('')}</ul>
    </div>
  </div>
  <div class="footer-word" aria-hidden="true">TRIAD</div>
  <div class="footer-base">
    <span class="label">&copy; ${new Date().getFullYear()} TRIAD Collective</span>
    <span class="label label--dim">${site.location}</span>
    <span class="label footer-legal"><a href="${ctx.url('/legal/impressum/')}">Impressum</a> &middot; <a href="${ctx.url('/legal/datenschutz/')}">Datenschutz</a> &middot; <a href="${ctx.url('/legal/darkroom-rules/')}">Darkroom rules</a></span>
    <span class="label label--dim">Sample content is fictional and for demonstration only.</span>
    <span class="label">${glyph({ cls: 'footer-glyph' })}</span>
  </div>
</footer>
</body>
</html>`;
}
