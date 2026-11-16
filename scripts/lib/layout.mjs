// Page shell: <head> with SEO + social + JSON-LD, header, menu overlay, footer.
import { escapeHtml as e } from './markdown.mjs';
import { emblem, glyph, label, marquee } from './components.mjs';
import { symbol } from './brand.mjs';

const NAV = [
  { href: '/magazine/', text: 'Magazine', n: '01', sym: 'fire' },
  { href: '/news/', text: 'News', n: '02', sym: 'air' },
  { href: '/people/', text: 'Voices', n: '03', sym: 'chord' },
  { href: '/archive/', text: 'Archive', n: '04', sym: 'sierpinski' },
  { href: '/finder/', text: 'Finder', n: '05', sym: 'delta' },
  { href: '/about/', text: 'About', n: '06', sym: 'borromean', menuOnly: true },
];

export function layout(ctx, { title, description, path, body, image, type = 'website', jsonld, theme = 'dark', pageId = 'page', noindex = false }) {
  const { site } = ctx;
  const fullTitle = title ? `${title} — ${site.title}` : `${site.title} — ${site.tagline}`;
  const canonical = site.url.replace(/\/$/, '') + path;
  const ogImage = image ? (/^https?:/.test(image) ? image : site.url.replace(/\/$/, '') + image) : site.url.replace(/\/$/, '') + '/assets/brand/emblem-lime.svg';
  const active = (href) => (path.startsWith(href) ? ' aria-current="page"' : '');
  const v = ctx.version;

  return `<!doctype html>
<html lang="${site.lang}" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(description || site.description)}">
<link rel="canonical" href="${canonical}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:site_name" content="${site.title}">
<meta property="og:title" content="${e(fullTitle)}">
<meta property="og:description" content="${e(description || site.description)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${e(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fbfaf8">
<link rel="icon" href="${ctx.url('/assets/icons/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.url('/assets/icons/icon-192.png')}">
<link rel="manifest" href="${ctx.url('/manifest.webmanifest')}">
<link rel="alternate" type="application/rss+xml" title="TRIAD" href="${ctx.url('/feed.xml')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://picsum.photos">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
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
      ${NAV.map((n) => `<li><a href="${ctx.url(n.href)}"${active(n.href)}><sup>${n.n}</sup>${n.text}</a></li>`).join('')}
    </ul>
  </nav>
  <div class="header-meta">
    <span class="label label--dim">N&deg;${site.currentIssue}</span>
    <span class="label clock" data-clock>BER --:--</span>
    <button class="motion-toggle label" type="button" data-motion-toggle aria-pressed="false" title="Pause all animation"><span class="mt-dot" aria-hidden="true"></span><span data-motion-label>Motion on</span></button>
  </div>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu">
    <span class="mt-text">Index</span><span class="mt-lines" aria-hidden="true"><i></i><i></i><i></i></span>
  </button>
</header>

<nav class="tabbar" aria-label="Sections">
  ${NAV.filter((n) => !n.menuOnly).map((n) => `<a href="${ctx.url(n.href)}"${active(n.href)}>${symbol(n.sym, { cls: 'tab-icon' })}<span>${n.text}</span></a>`).join('')}
</nav>

<div class="menu" id="menu" hidden>
  <div class="menu-inner">
    <nav aria-label="Menu">
      <ol class="menu-list">
        <li><a href="${ctx.url('/')}"><sup>00</sup>Home</a></li>
        ${NAV.map((n) => `<li><a href="${ctx.url(n.href)}"><sup>${n.n}</sup>${n.text}</a></li>`).join('')}
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
        ${NAV.map((n) => `<li><a href="${ctx.url(n.href)}">${n.text}</a></li>`).join('')}
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
    <span class="label label--dim">Sample content is fictional and for demonstration only.</span>
    <span class="label">${glyph({ cls: 'footer-glyph' })}</span>
  </div>
</footer>
</body>
</html>`;
}
