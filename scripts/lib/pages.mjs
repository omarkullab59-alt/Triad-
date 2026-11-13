// Page bodies. Each returns the inner <main> HTML; build.mjs wraps it in layout().
import { escapeHtml as e } from './markdown.mjs';
import { imgTag, resolveImage } from './images.mjs';
import {
  emblem, glyph, label, frame, storyCard, newsRow, issueCover, marquee, sectionHead,
  splitWords, fmtDate, fmtDateLong, isoDate, slugify,
} from './components.mjs';
import { stamp } from './brand.mjs';

/* ───────────────────────────── HOME ───────────────────────────── */
export function homePage(ctx) {
  const { site, articles, news, creatives, issues, archive } = ctx;
  const featured = articles.filter((a) => a.featured);
  const lead = featured[0] || articles[0];
  const rest = articles.filter((a) => a !== lead).slice(0, 5);
  const latestNews = news.slice(0, 6);
  const current = issues.find((i) => i.current) || issues[0];

  return `
<section class="hero" data-hero>
  <div class="hero-media" aria-hidden="true">
    ${site.heroImages.map((src, i) => `<div class="hero-slide${i === 0 ? ' is-active' : ''}">${imgTag({ src, alt: '', sizes: '100vw', eager: i === 0 })}</div>`).join('')}
  </div>
  <div class="hero-veil" aria-hidden="true"></div>
  <div class="hero-corners" aria-hidden="true">
    <span class="label">TRD&mdash;000 / CAMPAIGN</span>
    <span class="label">ISSUE ${site.currentIssue} &mdash; ${site.season}</span>
    <span class="label">52.52&deg;N 13.40&deg;E</span>
    <span class="label hero-counter" data-hero-counter>01 / 0${site.heroImages.length}</span>
  </div>
  <div class="plus-field" aria-hidden="true"><i class="plus" style="left:22%;top:30%"></i><i class="plus" style="right:18%;top:62%"></i><i class="plus" style="left:58%;top:18%"></i></div>
  <div class="hero-emblem">${emblem({ title: 'TRIAD dragon emblem' })}</div>
  <div class="hero-statement">
    <p class="hero-kicker serif">An independent fashion &amp; culture collective.</p>
    <p class="hero-rotator" aria-live="off"><span>FASHION.</span><span data-rotate="FASHION.|ART.|NOISE.|IMAGE.|MYTH.">FASHION.</span></p>
  </div>
  <h1 class="hero-word" aria-label="TRIAD"><span>T</span><span>R</span><span>I</span><span>A</span><span>D</span></h1>
  <a class="hero-scroll label" href="#latest">Scroll &darr;</a>
</section>

${marquee(news.slice(0, 6).map((n) => `${e(n.topic.toUpperCase())} &mdash; ${e(n.title)}`), 'marquee--news')}

<section class="block block--stories" id="latest">
  ${sectionHead({ index: '01 / MAGAZINE', title: 'Beyond the ordinary.', link: '/magazine/', linkText: 'All stories', kicker: 'Latest from the magazine — long-form, slow, unrepeatable.' }, ctx)}
  <div class="story-grid">
    ${storyCard(lead, ctx, { variant: 'story-card--lead', sizes: '(max-width: 760px) 100vw, 60vw', eager: false })}
    ${rest.map((a, i) => storyCard(a, ctx, { variant: `story-card--s${i + 1}` })).join('')}
  </div>
</section>

<section class="campaign" data-parallax-wrap>
  <div class="campaign-media" data-parallax>${imgTag({ src: site.campaignImage, alt: 'TRIAD campaign: Built outside the system', sizes: '100vw' })}</div>
  <div class="campaign-text">
    <span class="label">CAMPAIGN / TRD-CMP-002</span>
    <h2 class="campaign-title" data-split>${splitWords('Built outside the system.')}</h2>
    <a class="btn-line" href="${ctx.url('/archive/')}">Enter the archive &#8594;</a>
  </div>
  ${stamp({ top: 'OUTSIDE THE SYSTEM', bottom: 'APPROVED · NOT FOR SALE', center: 'III', cls: 'campaign-stamp' })}
</section>

<section class="block block--news">
  ${sectionHead({ index: '02 / NEWS', title: 'The wire.', link: '/news/', linkText: 'News archive', kicker: 'Fashion week, collections, collaborations, culture.' }, ctx)}
  <ol class="news-list" data-news-list>
    ${latestNews.map((n, i) => newsRow(n, ctx, i)).join('')}
  </ol>
  <p class="label label--dim sample-note">Entries marked “Sample” are fictional placeholders, not real reports.</p>
</section>

<section class="block block--creatives">
  ${sectionHead({ index: '03 / CREATIVES', title: 'Three forces, many hands.', kicker: 'Featured artists and creatives from the TRIAD circle.' }, ctx)}
  <div class="creatives-track" data-drag-scroll tabindex="0" aria-label="Featured creatives, scroll horizontally">
    ${creatives
      .map(
        (c, i) => `<figure class="creative" data-reveal>
      ${frame({ src: c.image, alt: `Portrait placeholder for ${c.name}`, code: `C/${String(i + 1).padStart(2, '0')}`, sizes: '(max-width: 760px) 70vw, 24vw', ctx })}
      <figcaption>
        <span class="label">${e(c.role)} &mdash; ${e(c.city)}</span>
        <strong class="creative-name">${e(c.name)}</strong>
        <span class="serif creative-note">${e(c.note)}</span>
      </figcaption>
    </figure>`
      )
      .join('')}
  </div>
</section>

<section class="block block--issues">
  ${sectionHead({ index: '04 / PRINT', title: 'Issues.', link: '/magazine/', linkText: 'Read the magazine', kicker: `Now: N°${current.number} — ${current.title}` }, ctx)}
  <div class="issues-row">
    ${issues.map((iss, i) => issueCover(iss, ctx, { tilt: [-3, 2, -1.5][i % 3] })).join('')}
  </div>
</section>

<section class="manifesto">
  <p class="manifesto-text" data-scrub-words>Fashion is only the beginning. TRIAD is a platform for creative expression, independent thinking and cultural exchange. Three forces — form, signal, image — working in the same direction.</p>
  <a class="btn-line" href="${ctx.url('/about/')}">The philosophy &#8594;</a>
</section>

<section class="block block--today" data-archive-today data-items='${e(JSON.stringify(archive.map((a) => ({ code: a.code, title: a.title, type: a.type, image: resolveImage(a.image, ctx) }))))}'>
  <div class="today-inner">
    <span class="label">TODAY FROM THE ARCHIVE</span>
    <div class="today-frame frame"><img alt="" width="900" height="1200" loading="lazy" decoding="async"><span class="frame-code" data-today-code></span></div>
    <p class="today-title serif" data-today-title></p>
    <a class="btn-line" href="${ctx.url('/archive/')}">An archive of what&rsquo;s next &#8594;</a>
  </div>
</section>`;
}

/* ─────────────────────────── MAGAZINE ─────────────────────────── */
export function magazinePage(ctx) {
  const { site, articles, issues } = ctx;
  const cats = site.magazineCategories.filter((c) => articles.some((a) => a.category === c));
  return `
<section class="page-head">
  <span class="label">01 / MAGAZINE &mdash; ${articles.length} STORIES</span>
  <h1 class="page-title" data-split>${splitWords('The magazine.')}</h1>
  <p class="page-deck serif">Curated editorial on fashion, photography, designers and the culture that surrounds them. The heart of TRIAD.</p>
</section>

<div class="filter-bar" role="toolbar" aria-label="Filter by category" data-filter="mag">
  <button type="button" class="chip is-active" data-filter-value="all" aria-pressed="true">All <sup>${articles.length}</sup></button>
  ${cats.map((c) => `<button type="button" class="chip" data-filter-value="${slugify(c)}" aria-pressed="false">${e(c)} <sup>${articles.filter((a) => a.category === c).length}</sup></button>`).join('')}
</div>

<section class="mag-grid" data-filter-target="mag">
  ${articles
    .map(
      (a, i) => `<article class="mag-item mag-item--${(i % 6) + 1}" data-cat="${slugify(a.category)}" data-reveal>
    <a href="${ctx.url(a.url)}" data-cursor="Read">
      ${frame({ src: a.cover, alt: '', code: a.code, sizes: '(max-width: 760px) 100vw, 50vw', ctx })}
      <div class="story-meta">${label(a.category)}<span class="dot"></span>${label(fmtDate(a.date), 'label--dim')}<span class="dot"></span>${label(`N°${a.issue}`, 'label--dim')}</div>
      <h2 class="mag-title">${e(a.title)}</h2>
      <p class="mag-deck serif">${e(a.deck)}</p>
      <span class="label label--dim">${e(a.author)} &middot; ${a.readTime} MIN</span>
    </a>
  </article>`
    )
    .join('')}
</section>

<section class="block block--issues" id="issues">
  ${sectionHead({ index: 'PRINT', title: 'All issues.', kicker: 'The printed editions. Each one a different force.' }, ctx)}
  <div class="issues-row">
    ${issues.map((iss, i) => `<div id="issue-${iss.number}">${issueCover(iss, ctx, { tilt: [-2, 1.5, -1][i % 3] })}</div>`).join('')}
  </div>
</section>`;
}

/* ─────────────────────────── ARTICLE ─────────────────────────── */
export function articlePage(ctx, a) {
  const related = ctx.articles
    .filter((x) => x !== a)
    .sort((x, y) => (y.category === a.category) - (x.category === a.category) || new Date(y.date) - new Date(x.date))
    .slice(0, 3);

  return `
<article class="article" itemscope itemtype="https://schema.org/Article">
  <header class="art-hero">
    <div class="art-hero-media">${imgTag({ src: resolveImage(a.cover, ctx), alt: a.title, sizes: '100vw', eager: true })}</div>
    <div class="art-hero-veil" aria-hidden="true"></div>
    <div class="art-hero-top">
      <a class="label back-link" href="${ctx.url('/magazine/')}">&#8592; Magazine</a>
      <span class="label">${e(a.code)}</span>
    </div>
    <div class="art-hero-text">
      <div class="story-meta">${label(a.category)}<span class="dot"></span>${label(`Issue N°${a.issue}`, 'label--dim')}</div>
      <h1 class="art-title" itemprop="headline" data-split>${splitWords(a.title)}</h1>
    </div>
  </header>

  <div class="art-layout">
    <aside class="art-aside">
      <dl class="art-meta">
        <div><dt class="label label--dim">Published</dt><dd><time datetime="${isoDate(a.date)}" itemprop="datePublished">${fmtDateLong(a.date)}</time></dd></div>
        <div><dt class="label label--dim">Category</dt><dd><a href="${ctx.url('/magazine/')}#${slugify(a.category)}">${e(a.category)}</a></dd></div>
        <div><dt class="label label--dim">Credits</dt><dd itemprop="author">${e(a.author)}</dd></div>
        <div><dt class="label label--dim">Reading</dt><dd>${a.readTime} minutes</dd></div>
      </dl>
      <div class="art-share">
        <span class="label label--dim">Share</span>
        <button type="button" class="label share-btn" data-share data-title="${e(a.title)}">Copy link</button>
      </div>
      ${glyph({ cls: 'art-glyph' })}
    </aside>

    <div class="art-body" itemprop="articleBody">
      <p class="art-deck serif">${e(a.deck)}</p>
      ${a.html}
    </div>
  </div>

  ${a.gallery?.length ? `<section class="art-gallery">
    <header class="ag-head"><span class="label">PLATES / ${String(a.gallery.length).padStart(2, '0')}</span><span class="label label--dim">Click to enlarge</span></header>
    ${ctx.renderGallery(a.gallery.map((src, i) => ({ src, alt: `${a.title}, plate ${i + 1}`, caption: `${a.code} — PL. ${String(i + 1).padStart(2, '0')}` })), ctx)}
  </section>` : ''}

  <footer class="art-end">
    ${emblem({ ring: false, cls: 'art-end-emblem' })}
    <span class="label">END OF TRANSMISSION &mdash; ${e(a.code)}</span>
  </footer>
</article>

<section class="block block--related">
  ${sectionHead({ index: 'CONTINUE', title: 'Related stories.', link: '/magazine/', linkText: 'All stories' }, ctx)}
  <div class="related-grid">${related.map((r) => storyCard(r, ctx, { sizes: '(max-width: 760px) 100vw, 33vw' })).join('')}</div>
</section>`;
}

/* ───────────────────────────── NEWS ───────────────────────────── */
export function newsPage(ctx) {
  const { site, news } = ctx;
  const topics = site.newsTopics.filter((t) => news.some((n) => n.topic === t));
  const byMonth = new Map();
  news.forEach((n) => {
    const d = new Date(n.date);
    const key = d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(n);
  });
  let idx = 0;
  const lead = news[0];

  return `
<section class="page-head page-head--paper">
  <span class="label">02 / NEWS &mdash; CONTINUOUSLY UPDATED</span>
  <h1 class="page-title" data-split>${splitWords('The wire.')}</h1>
  <p class="page-deck serif">Fashion week, collections, collaborations, campaigns, emerging designers and the movements around them.</p>
  <p class="sample-banner"><strong>Sample content.</strong> All entries currently shown are fictional placeholders written to demonstrate the layout. They do not describe real events, people or brands.</p>
</section>

<a class="news-lead" href="${ctx.url(lead.url)}" data-cursor="Read">
  ${frame({ src: lead.image, alt: '', code: 'LATEST', sizes: '(max-width: 760px) 100vw, 55vw', ctx })}
  <div class="news-lead-text">
    <div class="story-meta">${label(lead.topic)}<span class="dot"></span>${label(fmtDate(lead.date), 'label--dim')}${lead.sample ? '<span class="sample-tag">Sample</span>' : ''}</div>
    <h2 class="news-lead-title">${e(lead.title)}</h2>
    <p class="serif">${e(lead.excerpt)}</p>
  </div>
</a>

<div class="filter-bar filter-bar--paper" role="toolbar" aria-label="Filter by topic" data-filter="news">
  <button type="button" class="chip is-active" data-filter-value="all" aria-pressed="true">All</button>
  ${topics.map((t) => `<button type="button" class="chip" data-filter-value="${slugify(t)}" aria-pressed="false">${e(t)}</button>`).join('')}
</div>

<section class="news-archive" data-filter-target="news">
  ${[...byMonth.entries()]
    .map(
      ([month, items]) => `<div class="news-month">
    <h2 class="news-month-title"><span>${e(month)}</span><sup>${items.length}</sup></h2>
    <ol class="news-list" data-news-list>${items.map((n) => newsRow(n, ctx, idx++)).join('')}</ol>
  </div>`
    )
    .join('')}
</section>`;
}

export function newsArticlePage(ctx, n) {
  const related = ctx.news.filter((x) => x !== n).sort((x, y) => (y.topic === n.topic) - (x.topic === n.topic)).slice(0, 4);
  return `
<article class="news-article" itemscope itemtype="https://schema.org/NewsArticle">
  <header class="na-head">
    <a class="label back-link" href="${ctx.url('/news/')}">&#8592; The wire</a>
    <div class="story-meta">${label(n.topic)}<span class="dot"></span><time class="label label--dim" datetime="${isoDate(n.date)}" itemprop="datePublished">${fmtDateLong(n.date)}</time></div>
    <h1 class="na-title" itemprop="headline" data-split>${splitWords(n.title)}</h1>
    <p class="na-excerpt serif">${e(n.excerpt)}</p>
    ${n.sample ? `<div class="sample-banner sample-banner--stamp">${stamp({ top: 'SAMPLE ENTRY', bottom: 'FICTIONAL · NOT A REPORT', center: '!', cls: 'na-stamp' })}<p><strong>Fictional sample entry.</strong> This article was written to demonstrate the TRIAD news layout. The people, labels and events described are invented.</p></div>` : ''}
  </header>
  ${n.image ? `<figure class="na-figure">${frame({ src: n.image, alt: '', code: n.code, sizes: '(max-width: 760px) 100vw, 70vw', ctx })}</figure>` : ''}
  <div class="na-body" itemprop="articleBody">
    <p class="label label--dim">${e(n.author || 'TRIAD News Desk')}</p>
    ${n.html}
  </div>
</article>
<section class="block block--paper">
  ${sectionHead({ index: 'MORE', title: 'More from the wire.', link: '/news/', linkText: 'All news' }, ctx)}
  <ol class="news-list" data-news-list>${related.map((r, i) => newsRow(r, ctx, i)).join('')}</ol>
</section>`;
}

/* ─────────────────────────── ARCHIVE ─────────────────────────── */
export function archivePage(ctx) {
  const { archive } = ctx;
  const types = [...new Set(archive.map((a) => a.type))];
  return `
<section class="page-head page-head--archive">
  <span class="label">03 / ARCHIVE &mdash; <span data-archive-count>${String(archive.length).padStart(3, '0')}</span> OBJECTS</span>
  <h1 class="page-title" data-split>${splitWords('An archive of what’s next.')}</h1>
  <p class="page-deck serif">Editorial photography, campaigns, references, graphics, symbols and historical fragments. A curated moodboard of the TRIAD universe.</p>
</section>

<div class="filter-bar" role="toolbar" aria-label="Filter archive" data-filter="arc">
  <button type="button" class="chip is-active" data-filter-value="all" aria-pressed="true">All</button>
  ${types.map((t) => `<button type="button" class="chip" data-filter-value="${t}" aria-pressed="false">${e(t)}</button>`).join('')}
  <button type="button" class="chip chip--action" data-shuffle>&#8635; Shuffle</button>
</div>

<section class="moodboard" data-filter-target="arc" data-moodboard>
  ${archive
    .map(
      (a, i) => `<figure class="mb-item mb-item--${a.type}" data-cat="${a.type}" data-reveal style="--r:${((i * 37) % 7) - 3}">
    <button type="button" class="mb-open" data-lightbox="${e(resolveImage(a.image, ctx))}" data-caption="${e(`${a.code} — ${a.title} (${a.year}). ${a.note}`)}" aria-label="Open ${e(a.title)}" data-cursor="View">
      ${imgTag({ src: resolveImage(a.image, ctx), alt: a.title, sizes: '(max-width: 760px) 50vw, 25vw' })}
      <span class="mb-code">${e(a.code)}</span>
    </button>
    <figcaption><span class="label">${e(a.type)}</span><span class="mb-title">${e(a.title)}</span><span class="label label--dim">${e(a.year)}</span></figcaption>
  </figure>`
    )
    .join('')}
</section>`;
}

/* ───────────────────────────── ABOUT ───────────────────────────── */
export function aboutPage(ctx) {
  const forces = [
    { n: 'I', name: 'Form', text: 'Fashion. Cut, cloth, construction. The body as the first site of culture.' },
    { n: 'II', name: 'Signal', text: 'Music and sound. The noise that moves through a scene before anyone names it.' },
    { n: 'III', name: 'Image', text: 'Art, photography, design. What remains when the moment is gone.' },
  ];
  return `
<section class="about-intro">
  <span class="label">04 / ABOUT</span>
  <h1 class="about-title" data-split>${splitWords('TRIAD is not a magazine.')}</h1>
  <div class="about-emblem">${emblem({ title: 'TRIAD emblem', motto: 'THREE FORCES · ONE VISION · ' })}</div>
</section>

<section class="about-statements">
  <p data-reveal>It is a platform for creative expression, independent thinking and cultural exchange.</p>
  <p data-reveal>Fashion is the starting point. Art, music, photography and design are where it goes.</p>
  <p data-reveal>We publish what we believe in. We archive what deserves to last. We ignore the rest.</p>
</section>

<section class="forces">
  ${forces
    .map(
      (f) => `<article class="force" data-reveal>
    <span class="force-n">${f.n}</span>
    <h2 class="force-name">${f.name}</h2>
    <p class="serif">${f.text}</p>
  </article>`
    )
    .join('')}
</section>

<section class="system">
  ${sectionHead({ index: 'THE SYSTEM', title: 'Symbols.', kicker: 'A visual language built for print, garments, covers and screens.' }, ctx)}
  <div class="system-grid">
    <figure class="sys sys--emblem">${emblem({ title: 'Primary emblem' })}<figcaption><span class="label">01 — Primary emblem</span><span class="serif">Three serpent-dragons, each body drawn in three lines, chasing one another around a closed triangle. No beginning, no hierarchy.</span></figcaption></figure>
    <figure class="sys sys--glyph">${glyph()}<figcaption><span class="label">02 — Glyph</span><span class="serif">Three plus signs on the corners of a triangle. Three forces, added together. For tags, buttons, small sizes.</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--stack"><span>TRI</span><i></i><span>AD</span></div><figcaption><span class="label">03 — Stacked wordmark</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--spaced">T&thinsp;&mdash;&thinsp;R&thinsp;&mdash;&thinsp;I&thinsp;&mdash;&thinsp;A&thinsp;&mdash;&thinsp;D</div><figcaption><span class="label">04 — Technical wordmark</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--serif"><em>Triad</em><sup>MMXXVI</sup></div><figcaption><span class="label">05 — Editorial signature</span></figcaption></figure>
    <figure class="sys sys--stamp">${stamp({ top: 'TRIAD ARCHIVE', bottom: 'PROPERTY OF THE COLLECTIVE', center: '003' })}<figcaption><span class="label">06 — Archive stamp</span></figcaption></figure>
    <figure class="sys sys--codes">
      <ul class="codes">
        <li><span class="label label--dim">Issue</span><span>N&deg;003 &mdash; WINTER 26</span></li>
        <li><span class="label label--dim">Magazine</span><span>TRD-MAG-003-07</span></li>
        <li><span class="label label--dim">Archive</span><span>TRD-ARC-016</span></li>
        <li><span class="label label--dim">News</span><span>TRD-WIRE-2611-04</span></li>
        <li><span class="label label--dim">Campaign</span><span>TRD-CMP-002</span></li>
      </ul>
      <figcaption><span class="label">07 — Codes &amp; numbering</span></figcaption>
    </figure>
    <figure class="sys sys--palette">
      <ul class="palette">
        <li style="--c:#fbfaf8"><span>White</span><code>#FBFAF8</code></li>
        <li style="--c:#ff5a00"><span>TRIAD Orange</span><code>#FF5A00</code></li>
        <li style="--c:#0a0a0a"><span>Black</span><code>#0A0A0A</code></li>
        <li style="--c:#efede8"><span>Wash</span><code>#EFEDE8</code></li>
        <li style="--c:#8d8f93"><span>Silver</span><code>#8D8F93</code></li>
      </ul>
      <figcaption><span class="label">08 — Palette</span></figcaption>
    </figure>
  </div>
  <p class="system-downloads label">Download: ${['emblem-white', 'emblem-orange', 'emblem-black', 'emblem-mark', 'glyph-pattern', 'stamp-archive', 'wordmark-stacked']
    .map((f) => `<a href="${ctx.url(`/assets/brand/${f}.svg`)}" download>${f}.svg</a>`)
    .join(' / ')}</p>
</section>

<section class="about-close">
  <h2 class="about-close-title" data-split>${splitWords('Three forces. One vision.')}</h2>
  <p class="serif">For collaborations, submissions and correspondence: <a href="mailto:${ctx.site.email}">${ctx.site.email}</a></p>
</section>`;
}

export function notFoundPage(ctx) {
  return `
<section class="not-found">
  ${emblem({ title: 'TRIAD emblem' })}
  <span class="label">ERROR 404 &mdash; TRD-NULL</span>
  <h1 class="page-title">Lost in the archive.</h1>
  <p class="serif">This page does not exist. Or it was never meant to be found.</p>
  <a class="btn-line" href="${ctx.url('/')}">Return home &#8594;</a>
</section>`;
}
