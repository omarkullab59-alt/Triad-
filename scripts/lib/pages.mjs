// Page bodies. Each returns the inner <main> HTML; build.mjs wraps it in layout().
import { escapeHtml as e, renderMarkdown } from './markdown.mjs';
import { imgTag, resolveImage } from './images.mjs';
import {
  emblem, glyph, symbol, label, frame, storyCard, newsRow, wireRow, issueCover, issueGrid, marquee, sectionHead,
  splitWords, fmtDate, fmtDateLong, isoDate, slugify,
} from './components.mjs';
import { stamp, SYMBOLS } from './brand.mjs';

/* ───────────────────────────── HOME ───────────────────────────── */
// "Now on TRIAD": a live front page — open call, fresh Darkroom frames, latest story, headlines, quick find.
function nowSection(ctx, lead) {
  const api = (ctx.site.aiEndpoint || '').replace(/\/$/, '');
  const call = activeCall(ctx.calls || []);
  const heads = [
    ...ctx.news.map((n) => ({ title: n.title, href: ctx.url(n.url), src: n.sample ? 'TRIAD · sample' : 'TRIAD', date: n.date, ext: false })),
    ...ctx.wire.items.map((w) => ({ title: w.title, href: w.link, src: w.source, date: w.date, ext: true })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  const built = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  return `
<section class="now" aria-labelledby="now-title">
  <header class="now-head">
    <span class="label"><span class="live-dot" aria-hidden="true"></span>00 / NOW ON TRIAD</span>
    <h2 id="now-title" class="now-title">What&rsquo;s happening.</h2>
    <span class="label label--dim">Updated ${e(built)} &middot; Berlin${ctx.site.social?.[0] ? ` &middot; <a class="now-ig" href="${e(ctx.site.social[0].url)}" target="_blank" rel="noopener me">${e(ctx.site.social[0].handle || ctx.site.social[0].label)} &#8599;</a>` : ''}</span>
  </header>
  <div class="now-grid">
    ${call ? `<a class="now-card now-call" href="${ctx.url('/darkroom/')}#submit">
      <span class="label"><span class="tape">OPEN CALL ${e(call.number || '')}</span></span>
      <strong class="now-call-title">${e(call.title)}</strong>
      <span class="now-call-brief serif">${e(call.brief || '')}</span>
      <span class="label now-call-cta">Submit until ${e(fmtShort(call.end))} &middot; <span data-dr-countdown data-end="${e(call.end)}"></span> &#8594;</span>
    </a>` : `<a class="now-card now-call" href="${ctx.url('/darkroom/')}">
      <span class="label"><span class="tape">DARKROOM</span></span>
      <strong class="now-call-title">Your frames.</strong>
      <span class="now-call-brief serif">Upload your photos &mdash; the crew develops every one by hand.</span>
      <span class="label now-call-cta">Submit photos &#8594;</span>
    </a>`}
    <section class="now-card now-dark" data-now-darkroom data-api="${e(api)}" aria-labelledby="now-dark-title">
      <header class="now-card-head"><h3 id="now-dark-title" class="label">${symbol('pyramid', { cls: 'chip-sym' })}Fresh from the Darkroom</h3><a class="label now-more" href="${ctx.url('/darkroom/')}">The wall &#8594;</a></header>
      <ul class="now-thumbs" data-now-thumbs>${Array.from({ length: 4 }, () => '<li class="dr-ghost" aria-hidden="true" style="--h:100%"></li>').join('')}</ul>
      <p class="now-empty serif" data-now-empty hidden>${api ? 'The wall is waiting for the first frames.' : 'Opening soon &mdash; be the first on the wall.'}</p>
    </section>
    <a class="now-card now-story" href="${ctx.url(lead.url)}">
      <span class="now-story-img">${imgTag({ src: lead.cover, alt: '', sizes: '(max-width: 760px) 100vw, 30vw' })}</span>
      <span class="label">${symbol('chord', { cls: 'chip-sym' })}Read &middot; ${e(lead.category)} &middot; ${lead.readTime} min</span>
      <strong class="now-story-title">${e(lead.title)}</strong>
    </a>
    <section class="now-card now-wire" aria-labelledby="now-wire-title">
      <header class="now-card-head"><h3 id="now-wire-title" class="label">${symbol('air', { cls: 'chip-sym' })}The wire</h3><a class="label now-more" href="${ctx.url('/news/')}">All news &#8594;</a></header>
      <ol class="now-heads">${heads.map((h) => `<li><a href="${e(h.href)}"${h.ext ? ' target="_blank" rel="noopener nofollow"' : ''}><span class="label label--dim">${e(h.src)}</span><span class="now-head-title">${e(h.title)}</span></a></li>`).join('')}</ol>
    </section>
    <form class="now-card now-find" action="${ctx.url('/finder/')}" role="search">
      <label for="now-q" class="label">${symbol('delta', { cls: 'chip-sym' })}Find it secondhand</label>
      <div class="now-find-row"><input id="now-q" name="q" type="search" placeholder="e.g. Carhartt Detroit jacket" autocomplete="off" enterkeyhint="search"><button type="submit" class="btn btn--solid">Find</button></div>
      <span class="label label--dim">Vinted, Grailed, eBay, Depop &amp; more at once</span>
    </form>
  </div>
</section>`;
}

export function homePage(ctx) {
  const { site, articles, news, creatives, issues, archive } = ctx;
  const featured = articles.filter((a) => a.featured);
  const lead = featured[0] || articles[0];
  const rest = articles.filter((a) => a !== lead).slice(0, 2);
  const current = issues.find((i) => i.current) || issues[0];
  // The campaign band only appears once a real campaign photo is set in the CMS (no placeholder stock image).
  const showCampaign = site.campaignImage && !/picsum\.photos/.test(site.campaignImage);

  return `
<section class="hero" data-hero>
  <div class="hero-media" aria-hidden="true">
    ${site.heroImages.map((src, i) => `<div class="hero-slide${i === 0 ? ' is-active' : ''}">${imgTag({ src, alt: '', sizes: '100vw', eager: i === 0 })}</div>`).join('')}
  </div>
  <div class="hero-veil" aria-hidden="true"></div>
  <div class="hero-corners" aria-hidden="true">
    <span class="label">TRD&mdash;000 / CAMPAIGN</span>
    <span class="label"><span class="tape">ISSUE ${site.currentIssue} &mdash; ${site.season}</span></span>
    <span class="label">52.52&deg;N 13.40&deg;E</span>
    <span class="label hero-counter" data-hero-counter>PLATE 01 / 0${site.heroImages.length}</span>
  </div>
  <div class="plus-field" aria-hidden="true"><i class="plus" style="left:22%;top:30%"></i><i class="plus" style="right:18%;top:62%"></i><i class="plus" style="left:58%;top:18%"></i></div>
  <div class="hero-emblem mark-swap" data-mark-swap>
    <div class="ms-a">${emblem({ title: 'TRIAD dragon emblem' })}</div>
    <div class="ms-b"><span class="hand-mark" role="img" aria-label="TRIAD hand, three fingers raised"></span></div>
  </div>
  <div class="hero-statement">
    <p class="hero-kicker serif">An independent fashion &amp; culture collective.</p>
    <p class="hero-rotator" aria-live="off"><span>FASHION.</span><span data-rotate="FASHION.|ART.|NOISE.|IMAGE.|MYTH.">FASHION.</span></p>
  </div>
  <h1 class="hero-word" aria-label="TRIAD"><span>T</span><span>R</span><span>I</span><span>A</span><span>D</span></h1>
  <span class="hero-scroll label" aria-hidden="true">Scroll &darr;</span>
</section>

${nowSection(ctx, lead)}

<section class="block block--stories" id="latest">
  ${sectionHead({ index: '01 / MAGAZINE', sym: 'fire', title: 'Beyond the ordinary.', link: '/magazine/', linkText: 'All stories', kicker: 'Latest from the magazine — long-form, slow, unrepeatable.' }, ctx)}
  <div class="story-grid">
    ${storyCard(lead, ctx, { variant: 'story-card--lead', sizes: '(max-width: 760px) 100vw, 60vw', eager: false })}
    ${rest.map((a, i) => storyCard(a, ctx, { variant: `story-card--s${i + 1}` })).join('')}
  </div>
</section>

<section class="manifesto">
  <p class="manifesto-text" data-scrub-words>Fashion is only the beginning. TRIAD is a platform for creative expression, independent thinking and cultural exchange. Three forces — form, signal, image — working in the same direction.</p>
  <span class="tag tag--sign" role="img" aria-label="Signed: TRIAD (hand tag)"></span>
  <a class="btn-line" href="${ctx.url('/about/')}">The philosophy &#8594;</a>
</section>

${showCampaign ? `<section class="campaign" data-parallax-wrap>
  <div class="campaign-media" data-parallax>${imgTag({ src: site.campaignImage, alt: 'TRIAD campaign: Built outside the system', sizes: '100vw' })}</div>
  <div class="campaign-text">
    <span class="label">CAMPAIGN / TRD-CMP-002</span>
    <h2 class="campaign-title" data-split>${splitWords('Built outside the system.')}</h2>
    <a class="btn-line" href="${ctx.url('/archive/')}">Enter the archive &#8594;</a>
  </div>
  ${stamp({ top: 'OUTSIDE THE SYSTEM', bottom: 'APPROVED · NOT FOR SALE', center: 'III', cls: 'campaign-stamp' })}
</section>` : ''}

<section class="block ways" aria-labelledby="ways-title">
  <h2 id="ways-title" class="label ways-title">${symbol('borromean', { cls: 'sh-sym' })}Three ways in</h2>
  <div class="ways-grid">
    <a class="way" href="${ctx.url('/people/')}">
      <span class="way-img">${imgTag({ src: resolveImage(creatives.find((c) => !/picsum/.test(c.image || ''))?.image || '/uploads/triad/between-two-cars.jpg', ctx), alt: '', sizes: '(max-width: 760px) 100vw, 30vw' })}</span>
      <span class="label">I / Voices</span>
      <strong class="way-title">Three forces, many hands.</strong>
      <span class="serif way-note">Artists, designers and local legends from the TRIAD circle.</span>
    </a>
    <a class="way" href="${ctx.url(`/magazine/issue-${current.number}/`)}">
      <span class="way-img way-img--issue">${imgTag({ src: resolveImage(current.cover, ctx), alt: '', sizes: '(max-width: 760px) 100vw, 30vw' })}<span class="ic-mast">TRIAD</span><span class="ic-no">N&deg;${e(String(current.number))}</span></span>
      <span class="label">II / Print</span>
      <strong class="way-title">N&deg;${e(String(current.number))} &mdash; ${e(current.title)}</strong>
      <span class="serif way-note">${current.pages?.length ? `Flip through all ${current.pages.length} pages.` : 'The current issue. Slow pages for fast times.'}</span>
    </a>
    <a class="way" href="${ctx.url('/archive/')}" data-archive-today data-items='${e(JSON.stringify(archive.slice(0, 60).map((a) => ({ code: a.code, title: a.title, type: a.type, image: resolveImage(a.image, ctx) }))))}'>
      <span class="way-img"><img alt="" width="900" height="1200" loading="lazy" decoding="async"><span class="frame-code" data-today-code></span></span>
      <span class="label">III / Today from the archive</span>
      <strong class="way-title" data-today-title>An archive of what&rsquo;s next.</strong>
      <span class="serif way-note">One piece a day, picked from the collective&rsquo;s archive.</span>
    </a>
  </div>
</section>`;
}

const igHead = (ctx, n) => {
  const ig = (ctx.site.social || []).find((x) => /instagram/i.test(x.label));
  return ig ? `<div class="ig-head"><span class="ig-handle">${e(ig.handle || 'Instagram')}</span><span class="label label--dim">${n} posts</span><a class="chip" href="${ig.url}" target="_blank" rel="noopener me">Follow on Instagram &#8599;</a></div>` : '';
};

/* ─────────────────────────── MAGAZINE ─────────────────────────── */
export function magazinePage(ctx) {
  const { site, articles, issues } = ctx;
  const cats = site.magazineCategories.filter((c) => articles.some((a) => a.category === c));
  return `
<section class="page-head">
  <span class="label page-kicker">${symbol('fire', { cls: 'sh-sym' })}01 / MAGAZINE &mdash; ${articles.length} STORIES</span>
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
  ${sectionHead({ index: 'PRINT', title: 'All issues.', kicker: `${issues.length} issues, newest first — in the same order as our Instagram.` }, ctx)}
  ${igHead(ctx, issues.length)}
  ${issueGrid(issues, ctx)}
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
      ${a.people.length ? `<div class="art-people"><span class="label label--dim">In this story</span>${a.people.map((p) => `<a class="person-chip" href="${ctx.url(p.url)}">${imgTag({ src: resolveImage(p.portrait, ctx), alt: '', sizes: '40px' })}<span>${e(p.name)}</span></a>`).join('')}</div>` : ''}
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

  ${Array.isArray(a.find) && a.find.length ? `<section class="find-it" aria-labelledby="find-${a.slug}">
    <span class="label page-kicker">${symbol('delta', { cls: 'sh-sym' })}FIND IT SECONDHAND</span>
    <h2 class="find-it-title" id="find-${a.slug}">The look, second time around.</h2>
    <ul class="find-it-list">${a.find.map((q) => `<li><a class="chip" href="${ctx.url('/finder/')}?q=${encodeURIComponent(q)}">${e(q)} &#8594;</a></li>`).join('')}</ul>
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
  <span class="label page-kicker">${symbol('air', { cls: 'sh-sym' })}02 / NEWS &mdash; CONTINUOUSLY UPDATED</span>
  <h1 class="page-title" data-split>${splitWords('The wire.')}</h1>
  <p class="page-deck serif">Fashion week, collections, collaborations, campaigns, emerging designers and the movements around them.</p>
  ${news.some((n) => n.sample) ? '<p class="sample-banner"><strong>Sample content.</strong> Some entries are fictional placeholders.</p>' : ''}
</section>

${lead ? `<a class="news-lead" href="${ctx.url(lead.url)}" data-cursor="Read">
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
</section>` : ''}

${ctx.wire.items.length ? (() => {
  const srcs = [...new Set(ctx.wire.items.map((w) => w.source))].sort();
  return `<section class="wire-section" id="elsewhere">
  <header class="wire-head">
    <span class="label page-kicker">${symbol('tonnetz', { cls: 'sh-sym' })}ELSEWHERE &mdash; ${ctx.wire.items.length} HEADLINES</span>
    <h2 class="news-month-title"><span>From elsewhere.</span></h2>
    <p class="serif wire-intro">What other publishers are reporting. Headlines link to the original source; TRIAD does not host their content. Updated ${ctx.wire.updated ? new Date(ctx.wire.updated).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) : ''} (Berlin).</p>
  </header>
  <div class="filter-bar filter-bar--paper" role="toolbar" aria-label="Filter by publisher" data-filter="wire">
    <button type="button" class="chip is-active" data-filter-value="all" aria-pressed="true">All</button>
    ${srcs.map((s) => `<button type="button" class="chip" data-filter-value="${slugify(s)}" aria-pressed="false">${e(s)}</button>`).join('')}
  </div>
  <ol class="wire-list" data-filter-target="wire">${ctx.wire.items.map(wireRow).join('')}</ol>
</section>`;
})() : ''}`;
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
    ${n.sourceUrl ? `<p class="na-source label">Source: <a href="${e(n.sourceUrl)}" target="_blank" rel="noopener">${e(n.source || new URL(n.sourceUrl).hostname)} &#8599;</a></p>` : ''}
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
  <span class="label page-kicker">${symbol('sierpinski', { cls: 'sh-sym' })}05 / ARCHIVE &mdash; <span data-archive-count>${String(archive.length).padStart(3, '0')}</span> OBJECTS</span>
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
    { n: 'I', sym: 'earth', name: 'Form', text: 'Fashion. Cut, cloth, construction. The body as the first site of culture.' },
    { n: 'II', sym: 'air', name: 'Signal', text: 'Music and sound. The noise that moves through a scene before anyone names it.' },
    { n: 'III', sym: 'fire', name: 'Image', text: 'Art, photography, design. What remains when the moment is gone.' },
  ];
  return `
<section class="about-intro">
  <span class="label page-kicker">${symbol('borromean', { cls: 'sh-sym' })}07 / ABOUT</span>
  <h1 class="about-title" data-split>${splitWords('TRIAD is not a magazine.')}</h1>
  <div class="about-emblem mark-swap" data-mark-swap>
    <div class="ms-a">${emblem({ title: 'TRIAD emblem', motto: 'THREE FORCES · ONE VISION · ' })}</div>
    <div class="ms-b"><span class="hand-mark" role="img" aria-label="TRIAD hand, three fingers raised"></span></div>
  </div>
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
    <div class="force-top"><span class="force-n">${f.n}</span>${symbol(f.sym, { cls: 'force-sym' })}</div>
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
    <figure class="sys sys--emblem sys--hand"><span class="hand-mark" role="img" aria-label="TRIAD hand"></span><figcaption><span class="label">01B — The hand</span><span class="serif">Three fingers raised, drawn square by square. It takes turns with the dragon: two marks, one collective.</span></figcaption></figure>
    <figure class="sys sys--glyph">${glyph()}<figcaption><span class="label">02 — Glyph</span><span class="serif">Three plus signs on the corners of a triangle. Three forces, added together. For tags, buttons, small sizes.</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--stack"><span>TRI</span><i></i><span>AD</span></div><figcaption><span class="label">03 — Stacked wordmark</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--spaced">T&thinsp;&mdash;&thinsp;R&thinsp;&mdash;&thinsp;I&thinsp;&mdash;&thinsp;A&thinsp;&mdash;&thinsp;D</div><figcaption><span class="label">04 — Technical wordmark</span></figcaption></figure>
    <figure class="sys sys--word"><div class="wm wm--serif"><em>Triad</em><sup>MMXXVI</sup></div><figcaption><span class="label">05 — Editorial signature</span></figcaption></figure>
    <figure class="sys sys--stamp">${stamp({ top: 'TRIAD ARCHIVE', bottom: 'PROPERTY OF THE COLLECTIVE', center: '003' })}<figcaption><span class="label">06 — Archive stamp</span></figcaption></figure>
    <figure class="sys sys--codes">
      <ul class="codes">
        <li><span class="label label--dim">Issue</span><span>N&deg;${e(ctx.site.currentIssue)} &mdash; ${e(ctx.site.season)}</span></li>
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
        <li style="--c:#c4ef2f"><span>TRIAD Lime</span><code>#C4EF2F</code></li>
        <li style="--c:#0a0a0a"><span>Black</span><code>#0A0A0A</code></li>
        <li style="--c:#efede8"><span>Wash</span><code>#EFEDE8</code></li>
        <li style="--c:#8d8f93"><span>Silver</span><code>#8D8F93</code></li>
      </ul>
      <figcaption><span class="label">08 — Palette</span></figcaption>
    </figure>
  </div>
  <p class="system-downloads label">Download: ${['emblem-white', 'emblem-lime', 'emblem-black', 'emblem-mark', 'glyph-pattern', 'stamp-archive', 'wordmark-stacked']
    .map((f) => `<a href="${ctx.url(`/assets/brand/${f}.svg`)}" download>${f}.svg</a>`)
    .join(' / ')}</p>
</section>

<section class="symbols" id="symbols">
  ${sectionHead({ index: 'LIBRARY', sym: 'delta', title: 'Triangle. Triad. Pyramid.', kicker: 'Ten signs from geometry, alchemy, music and architecture — redrawn for TRIAD. Free to use on garments, covers and screens.' }, ctx)}
  <ul class="sym-grid">
    ${Object.entries(SYMBOLS)
      .map(([k, s], i) => `<li class="sym-card" data-reveal>
      ${symbol(k, { label: s.name })}
      <div class="sym-meta">
        <span class="label label--dim">S/${String(i + 1).padStart(2, '0')} &mdash; ${e(s.de)}</span>
        <strong class="sym-name">${e(s.name)}</strong>
        <p class="serif">${e(s.meaning)}</p>
        <a class="label sym-dl" href="${ctx.url(`/assets/brand/symbol-${k}.svg`)}" download>SVG &darr;</a>
      </div>
    </li>`)
      .join('')}
  </ul>
</section>

<section class="about-close">
  <h2 class="about-close-title" data-split>${splitWords('Three forces. One vision.')}</h2>
  <p class="serif">For collaborations, submissions and correspondence: <a href="mailto:${ctx.site.email}">${ctx.site.email}</a></p>
</section>`;
}

export function peoplePage(ctx) {
  const kinds = [['all', 'All'], ['artist', 'Artists'], ['legend', 'Local legends']];
  return `
<section class="page-head">
  <span class="label page-kicker">${symbol('chord', { cls: 'sh-sym' })}03 / VOICES &mdash; ${ctx.people.length} PEOPLE</span>
  <h1 class="page-title" data-split>${splitWords('Voices.')}</h1>
  <p class="page-deck serif">An archive of the people who shape the culture before it has a name — artists, designers and local legends. In their own words.</p>
  ${ctx.people.some((p) => p.sample) ? '<p class="sample-banner"><strong>Sample profiles.</strong> The people currently shown are fictional placeholders written to demonstrate the layout.</p>' : ''}
</section>

<div class="filter-bar" role="toolbar" aria-label="Filter voices" data-filter="people">
  ${kinds.map(([v, l], i) => `<button type="button" class="chip${i ? '' : ' is-active'}" data-filter-value="${v}" aria-pressed="${i ? 'false' : 'true'}">${l} <sup>${v === 'all' ? ctx.people.length : ctx.people.filter((p) => p.kind === v).length}</sup></button>`).join('')}
</div>

${ctx.people.length ? '' : `<div class="people-empty"><p class="serif">The first voices are being recorded. Photographers, designers, DJs, makers — if you shape the culture around you, we want to talk.</p><a class="btn" href="${ctx.url('/darkroom/')}">Show us your work in the Darkroom &#8599;</a></div>`}
<ol class="people-index" data-filter-target="people">
  ${ctx.people
    .map(
      (p, i) => `<li class="person-row" data-cat="${e(p.kind || 'artist')}" data-preview="${e(resolveImage(p.portrait, ctx))}">
    <a href="${ctx.url(p.url)}" data-cursor="Meet">
      <span class="news-idx">${String(i + 1).padStart(3, '0')}</span>
      <span class="person-name">${e(p.name)}</span>
      <span class="person-role">${e(p.role)}${p.kind === 'legend' ? ' <span class="tape">Local legend</span>' : ''}</span>
      <span class="person-city label label--dim">${e(p.city)} &middot; ${e(p.since || '')}</span>
      <span class="person-count label">${p.features.length ? `${p.features.length} ${p.features.length > 1 ? 'stories' : 'story'}` : 'Profile'}</span>
      <span class="news-arrow" aria-hidden="true">&#8599;</span>
    </a>
  </li>`
    )
    .join('')}
</ol>`;
}

export function personPage(ctx, p) {
  return `
<article class="person">
  <header class="person-hero">
    <div class="person-portrait">${frame({ src: p.portrait, alt: `Portrait of ${p.name}`, code: `VOICE ${String(ctx.people.indexOf(p) + 1).padStart(3, '0')}`, sizes: '(max-width: 760px) 100vw, 45vw', eager: true, ctx })}</div>
    <div class="person-head">
      <a class="label back-link" href="${ctx.url('/people/')}">&#8592; Voices</a>
      <span class="label">${p.kind === 'legend' ? '<span class="tape">Local legend</span>' : e(p.role)}</span>
      <h1 class="person-title" data-split>${splitWords(p.name)}</h1>
      <dl class="art-meta person-meta">
        <div><dt class="label label--dim">Role</dt><dd>${e(p.role)}</dd></div>
        <div><dt class="label label--dim">City</dt><dd>${e(p.city)}</dd></div>
        <div><dt class="label label--dim">Active</dt><dd>${e(p.since || '—')}</dd></div>
      </dl>
      ${p.quote ? `<blockquote class="pullquote person-quote"><p>${e(p.quote)}</p></blockquote>` : ''}
    </div>
  </header>
  ${p.sample ? '<p class="sample-banner person-sample"><strong>Sample profile.</strong> This person is fictional and shown to demonstrate the layout.</p>' : ''}
  <div class="art-layout person-body">
    <aside class="art-aside">${symbol('chord', { cls: 'art-glyph' })}</aside>
    <div class="art-body">${p.html}</div>
  </div>
  ${p.features.length ? `<section class="block block--related">
    ${sectionHead({ index: 'ARCHIVE', sym: 'fire', title: 'Stories & interviews.' }, ctx)}
    <div class="related-grid">${p.features.map((a) => storyCard(a, ctx, { sizes: '(max-width: 760px) 100vw, 33vw' })).join('')}</div>
  </section>` : ''}
</article>`;
}

export function finderPage(ctx) {
  const examples = ['Helmut Lang jacket 90s', 'military field jacket', 'Rick Owens boots', 'Carhartt Detroit jacket', 'vintage leather coat', 'Maison Margiela tabi'];
  return `
<section class="page-head finder-head">
  <span class="label page-kicker">${symbol('delta', { cls: 'sh-sym' })}06 / FINDER &mdash; ${ctx.marketplaces.length} MARKETPLACES</span>
  <h1 class="page-title" data-split>${splitWords('Find it. Anywhere.')}</h1>
  <p class="page-deck serif">Describe the piece once. TRIAD searches Google, Vinted, Grailed, eBay and more for you &mdash; then you look at the results there.</p>
</section>

<section class="finder" data-finder data-markets='${e(JSON.stringify(ctx.marketplaces))}' data-ai="${e(ctx.site.aiEndpoint || '')}">
  <form class="finder-form" role="search" data-finder-form>
    <label for="finder-q" class="label">What are you looking for?</label>
    <div class="finder-input">
      <input id="finder-q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="e.g. black military jacket 90s, size M">
      <button type="submit" class="finder-go">Search &#8594;</button>
    </div>
    <div class="finder-ai" data-ai-controls hidden>
      <label class="chip finder-photo-btn">
        <input type="file" accept="image/*" data-photo-input class="visually-hidden">
        ${symbol('sierpinski', { cls: 'chip-sym' })}<span>Add photo</span>
      </label>
      <figure class="photo-preview" data-photo-preview hidden><img alt="Selected photo" data-photo-img><button type="button" class="photo-remove" data-photo-remove aria-label="Remove photo">&#10005;</button></figure>
      <button type="button" class="chip chip--ai" data-ai-go>${symbol('delta', { cls: 'chip-sym' })}<span>Search with AI</span></button>
    </div>
    <p class="finder-hint label label--dim" data-finder-hint>German or English both work. Brand + piece + detail works best.</p>
  </form>

  <div class="finder-examples" aria-label="Examples">
    <span class="label label--dim">Try</span>
    ${examples.map((x) => `<button type="button" class="chip" data-finder-example="${e(x)}">${e(x)}</button>`).join('')}
  </div>

  <div class="finder-results" data-finder-results aria-live="polite" hidden>
    <div class="ai-result" data-ai-result hidden>
      <span class="label"><span class="tape">TRIAD AI</span></span>
      <p class="ai-recognised" data-ai-recognised></p>
      <p class="serif ai-note" data-ai-note></p>
      <div class="ai-alts" data-ai-alts></div>
    </div>
    <header class="finder-results-head">
      <span class="label">Results for</span>
      <strong class="finder-query" data-finder-query></strong>
      <span class="label label--dim" data-finder-variant></span>
    </header>
    <ol class="market-list" data-market-list></ol>
    <p class="label label--dim finder-note">Results open on each platform in a new tab. TRIAD is not affiliated with these marketplaces and does not see what you buy.</p>

    <section class="alert-box" data-alert-box aria-labelledby="alert-title">
      <header class="alert-head">
        <span class="label">${symbol('air', { cls: 'chip-sym' })}Price alert</span>
        <h2 id="alert-title" class="alert-title">Tell me when it drops.</h2>
        <p class="serif alert-text">TRIAD checks eBay about once an hour and pings your phone when a new listing for <b data-alert-query></b> appears &mdash; free, no account.</p>
      </header>
      <form class="alert-form" data-alert-form>
        <label class="alert-price"><span class="label">Max. price (optional)</span><span class="alert-price-row"><input type="number" name="max" min="1" max="99999" inputmode="numeric" placeholder="80"><span>&euro;</span></span></label>
        <button type="submit" class="btn btn--solid" data-alert-go>&#128276; Turn on alert</button>
        <p class="alert-status label" data-alert-status role="status"></p>
      </form>
      <div class="alert-native">
        <span class="label label--dim">Vinted, Kleinanzeigen &amp; Grailed don&rsquo;t allow outside alerts &mdash; use their own (free): open your search and tap &ldquo;Save search&rdquo; / &ldquo;Suchauftrag&rdquo;.</span>
        <div class="alert-native-links" data-alert-native></div>
      </div>
    </section>
  </div>

  <section class="my-alerts" data-my-alerts hidden aria-labelledby="my-alerts-title">
    <h2 id="my-alerts-title" class="label">${symbol('air', { cls: 'chip-sym' })}Your alerts on this device</h2>
    <ul class="my-alerts-list" data-my-alerts-list></ul>
    <button type="button" class="btn-line" data-alert-test>Send a test notification</button>
  </section>

  <aside class="finder-photo">
    ${symbol('sierpinski', { cls: 'finder-photo-sym' })}
    <div>
      <span class="label" data-photo-title>Have a photo instead?</span>
      <p class="serif" data-photo-text>Open Google Lens, upload your photo and it tells you what the piece is. Paste the name here — TRIAD searches every marketplace for it. On your phone you can also long-press any photo and choose “Search with Google Lens” (Android) or “Look Up” (iPhone).</p>
      <a class="btn-line" href="https://lens.google.com/" target="_blank" rel="noopener" data-lens-link>Open Google Lens &#8599;</a>
    </div>
  </aside>
</section>`;
}

export function notFoundPage(ctx) {
  return `
<section class="not-found">
  <span class="tag tag--404" role="img" aria-label="TRIAD hand tag"></span>
  <span class="label">ERROR 404 &mdash; TRD-NULL</span>
  <h1 class="page-title">Lost in the archive.</h1>
  <p class="serif">This page does not exist. Or it was never meant to be found.</p>
  <a class="btn-line" href="${ctx.url('/')}">Return home &#8594;</a>
</section>`;
}

/* ── DARKROOM: photographers upload, the crew approves, everyone reacts ── */
export const REACTIONS = [
  { kind: 'fire', sym: 'fire', label: 'Burns', hint: 'pure heat' },
  { kind: 'chord', sym: 'chord', label: 'Resonates', hint: 'hits a note' },
  { kind: 'delta', sym: 'delta', label: 'Archive it', hint: 'belongs in the archive' },
];

const fmtShort = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const activeCall = (calls, now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  return calls.find((c) => (!c.start || c.start <= today) && (!c.end || today <= c.end)) || null;
};

export function darkroomPage(ctx) {
  const api = (ctx.site.aiEndpoint || '').replace(/\/$/, '');
  const reactions = REACTIONS.map((r) => ({ ...r, icon: symbol(r.sym, { cls: 'react-sym' }) }));
  const calls = ctx.calls || [];
  const call = activeCall(calls);
  const callsData = calls.map(({ slug, title, number, start, end }) => ({ slug, title, number, start, end }));
  return `
<section class="page-head darkroom-head">
  <span class="tag tag--darkroom" aria-hidden="true"></span>
  <span class="label page-kicker">${symbol('pyramid', { cls: 'sh-sym' })}04 / DARKROOM &mdash; OPEN SUBMISSIONS</span>
  <h1 class="page-title" data-split>${splitWords('Darkroom.')}</h1>
  <p class="page-deck serif">Your frames on TRIAD. We develop every upload by hand &mdash; the strongest go on the wall.</p>
  <div class="dr-actions">
    <a class="btn btn--solid" href="#submit">Submit photos &#8594;</a>
    <span class="label label--dim">Free &middot; no account &middot; you keep your rights</span>
  </div>
  <a class="noai" href="${ctx.url('/legal/darkroom-rules/')}#no-ai-training">${symbol('delta', { cls: 'noai-sym' })}<span><b>Never used to train AI.</b> <span class="noai-more">How we protect your work &#8594;</span></span></a>
</section>
${call ? `
<section class="dr-call" aria-labelledby="dr-call-title" data-dr-callbox="${e(call.slug)}">
  <div class="dr-call-head">
    <span class="label"><span class="tape">OPEN CALL ${e(call.number || '')}</span></span>
    <span class="label dr-deadline">until ${e(fmtShort(call.end))} &middot; <span data-dr-countdown data-end="${e(call.end)}"></span></span>
  </div>
  <h2 id="dr-call-title" class="dr-call-title">${e(call.title)}</h2>
  <div class="dr-call-body">
    <p class="serif dr-call-brief">${e(call.brief || '')}</p>
    ${call.outcome ? `<p class="dr-call-outcome">${symbol('fire', { cls: 'chip-sym' })}<span>${e(call.outcome)}</span></p>` : ''}
    <div class="dr-call-actions">
      <a class="btn btn--solid" href="#submit" data-dr-join="${e(call.slug)}">Submit to ${e(call.title)} &#8594;</a>
      <button type="button" class="btn" data-dr-call-view="${e(call.slug)}">See entries</button>
    </div>
  </div>
</section>` : ''}

<section class="darkroom" data-darkroom data-api="${e(api)}" data-calls="${e(JSON.stringify(callsData))}" data-reactions="${e(JSON.stringify(reactions))}">
  <div class="filter-bar dr-bar">
    <div class="chips" role="group" aria-label="Sort">
      <button type="button" class="chip is-active" data-dr-sort="new" aria-pressed="true">Newest</button>
      <button type="button" class="chip" data-dr-sort="top" aria-pressed="false">Most reactions</button>
      ${calls.map((c) => `<button type="button" class="chip" data-dr-call="${e(c.slug)}" aria-pressed="false">Call: ${e(c.title)}</button>`).join('')}
    </div>
    <ul class="dr-legend" aria-label="Reactions">
      ${reactions.map((r) => `<li>${r.icon}<span class="label">${r.label}</span></li>`).join('')}
    </ul>
  </div>

  <header class="dr-profile" data-dr-profile hidden>
    <span class="label">${symbol('pyramid', { cls: 'sh-sym' })}PHOTOGRAPHER</span>
    <h2 class="dr-profile-name" data-dr-pname></h2>
    <p class="dr-profile-stats label" data-dr-pstats></p>
    <div class="dr-profile-actions">
      <a class="btn" data-dr-pinsta target="_blank" rel="noopener" hidden>Instagram &#8599;</a>
      <button type="button" class="btn" data-dr-pshare>Copy link to this wall</button>
      <button type="button" class="btn-line" data-dr-clear>&#8592; All photographers</button>
    </div>
  </header>
  <div class="dr-filter-note label" data-dr-filternote hidden><span data-dr-filtertext></span> <button type="button" class="btn-line" data-dr-clear>Show everything</button></div>

  <div class="dr-wall" data-dr-wall aria-live="polite" aria-busy="true">
    ${Array.from({ length: 6 }, (_, i) => `<div class="dr-ghost" style="--h:${[130, 90, 115, 100, 140, 85][i]}%" aria-hidden="true"></div>`).join('')}
  </div>
  <div class="dr-empty" data-dr-empty hidden>
    <span class="label"><span class="tape">FIRST ROLL</span></span>
    <h2 class="dr-empty-title">The wall is waiting<br>for your frames.</h2>
    <p class="serif">${api ? 'Nothing developed yet. Be the first &mdash; the crew reviews every upload, usually within 48&nbsp;hours.' : 'The darkroom opens as soon as the TRIAD server is connected. Until then, nothing can be uploaded.'}</p>
  </div>
  <button type="button" class="btn dr-more" data-dr-more hidden>Load more</button>

  <section class="dr-submit" id="submit" aria-labelledby="dr-submit-title">
    <header class="dr-submit-head">
      <span class="label">${symbol('delta', { cls: 'sh-sym' })}SUBMIT</span>
      <h2 id="dr-submit-title" class="dr-submit-title">Upload &rarr; develop &rarr; wall.</h2>
      <ol class="dr-steps">
        <li><b>01</b><span>Upload up to 6 photos. We shrink them to web size in your browser and strip location data.</span></li>
        <li><b>02</b><span>The crew reviews every frame by hand. Nothing is public before that.</span></li>
        <li><b>03</b><span>On the wall: credited with your name &amp; Instagram, plus your own page with all your frames to share. Tag <a href="https://www.instagram.com/triad.closet/" target="_blank" rel="noopener">@triad.closet</a> when you post it.</span></li>
        <li><b>${symbol('delta', { cls: 'chip-sym' })}</b><span><strong>Never used to train AI.</strong> AI crawlers are blocked and text &amp; data mining is reserved (&sect;&nbsp;44b UrhG) &mdash; for every photo.</span></li>
      </ol>
    </header>

    <form class="dr-form" data-dr-form novalidate ${api ? '' : 'data-disabled'}>
      <fieldset ${api ? '' : 'disabled'}>
        <legend class="visually-hidden">Photo submission</legend>
        <label class="dr-drop" data-dr-drop>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple data-dr-files class="visually-hidden">
          ${symbol('sierpinski', { cls: 'dr-drop-sym' })}
          <span class="dr-drop-title">Choose photos</span>
          <span class="label label--dim">or drop them here &middot; JPG, PNG, WebP &middot; max 6</span>
        </label>
        <ul class="dr-previews" data-dr-previews></ul>

        <div class="dr-fields">
          <label><span class="label">Name / Alias <abbr title="required">*</abbr></span><input name="name" required maxlength="60" autocomplete="nickname"></label>
          <label><span class="label">Instagram</span><input name="instagram" maxlength="40" placeholder="@" autocapitalize="off" spellcheck="false"></label>
          <label><span class="label">Title</span><input name="title" maxlength="80" placeholder="applies to all photos"></label>
          <label><span class="label">Place</span><input name="location" maxlength="60" placeholder="e.g. Berlin, Wedding"></label>
          <label><span class="label">Camera / Film</span><input name="camera" maxlength="60" placeholder="e.g. Contax T2, Portra 400"></label>
          ${calls.length ? `<label class="dr-wide"><span class="label">Open call</span><select name="call" data-dr-callselect>
            <option value="">No open call &mdash; just the wall</option>
            ${calls.map((c) => `<option value="${e(c.slug)}" data-start="${e(c.start || '')}" data-end="${e(c.end || '')}"${call && c.slug === call.slug ? ' selected' : ''}>${e(c.number ? c.number + ' / ' : '')}${e(c.title)}</option>`).join('')}
          </select></label>` : ''}
          <label class="dr-wide"><span class="label">Caption</span><textarea name="caption" maxlength="280" rows="2"></textarea></label>
          <label class="dr-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        </div>

        <label class="dr-consent">
          <input type="checkbox" name="consent" required>
          <span>I took these photos myself. People who can be recognised agreed to be shown. TRIAD may show them on this website with my credit; I can ask for removal at any time. <a href="${ctx.url('/legal/darkroom-rules/')}">Darkroom rules</a></span>
        </label>
        <div class="dr-submit-row">
          <button type="submit" class="btn btn--solid" data-dr-send>Send to the darkroom &#8594;</button>
          <p class="dr-status label" data-dr-status role="status"></p>
        </div>
      </fieldset>
    </form>
  </section>
</section>`;
}

export function darkroomAdminPage(ctx) {
  const api = (ctx.site.aiEndpoint || '').replace(/\/$/, '');
  return `
<section class="page-head">
  <span class="label page-kicker">${symbol('pyramid', { cls: 'sh-sym' })}DARKROOM / MODERATION</span>
  <h1 class="page-title">Develop.</h1>
  <p class="page-deck serif">Approve, reject or delete submissions. Only the crew has the key.</p>
</section>
<section class="dr-admin" data-dr-admin data-api="${e(api)}">
  <form class="dr-login" data-dr-login>
    <label><span class="label">Admin key</span><input type="password" name="token" autocomplete="current-password" required minlength="16"></label>
    <button class="btn btn--solid" type="submit">Open</button>
    <p class="label label--dim">${api ? 'The key is the DARKROOM_ADMIN_TOKEN secret. It stays in this browser tab only.' : 'Server not connected yet — see docs/DARKROOM.md.'}</p>
  </form>
  <div data-dr-panel hidden>
    <div class="chips dr-tabs" role="group" aria-label="Status">
      ${['pending', 'flagged', 'approved', 'rejected'].map((s, i) => `<button type="button" class="chip${i ? '' : ' is-active'}" data-dr-tab="${s}" aria-pressed="${!i}">${s} <sup data-dr-count="${s}"></sup></button>`).join('')}
      <button type="button" class="chip chip--action" data-dr-logout>Lock</button>
    </div>
    <p class="label label--dim" data-dr-admin-status role="status"></p>
    <ul class="dr-queue" data-dr-queue></ul>
    <section class="dr-stats"><h2 class="label">Visitors</h2><div data-dr-stats><p class="label label--dim">Loading…</p></div></section>
  </div>
</section>`;
}

export function legalPage(ctx, l) {
  return `
<article class="legal">
  <header class="page-head"><span class="label page-kicker">${symbol('borromean', { cls: 'sh-sym' })}LEGAL &mdash; ${e(String(l.updated || ''))}</span><h1 class="page-title">${e(l.title)}</h1></header>
  <div class="na-body legal-body">${renderMarkdown(l.body, ctx)}</div>
</article>`;
}

/* ── Issue reader: flip through the printed pages ─────────────────────── */
export function issuePage(ctx, issue) {
  const pages = (issue.pages?.length ? issue.pages : [issue.cover]).map((src) => resolveImage(src, ctx));
  const stories = ctx.articles.filter((a) => String(a.issue) === String(issue.number));
    const flip = pages.length > 1;
  return `
<section class="page-head reader-head">
  <a class="label" href="${ctx.url('/magazine/')}">&#8592; Magazine</a>
  <span class="label page-kicker">${symbol('chord', { cls: 'sh-sym' })}PRINT &mdash; N&deg;${e(issue.number)} &middot; ${e(issue.season || '')}${issue.current ? ' &middot; CURRENT ISSUE' : ''}</span>
  <h1 class="page-title">${e(issue.title || `N°${issue.number}`)}</h1>
  ${issue.date || issue.instagram ? `<p class="label issue-post">${issue.date ? `Posted ${e(fmtDate(issue.date))}` : ''}${issue.instagram ? ` &middot; <a href="${e(issue.instagram)}" target="_blank" rel="noopener">See the post on Instagram &#8599;</a>` : ''}</p>` : ''}
  <p class="label label--dim">${flip ? `${pages.length} pages &middot; swipe, scroll or use &larr; &rarr; &middot; tap a page to open it full screen` : `Cover${stories.length ? ` &middot; ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} in this issue` : ''} &middot; tap to open full screen`}</p>
</section>
<section class="reader${flip ? '' : ' reader--single'}" data-reader aria-label="Issue ${e(issue.number)}, ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}">
  <div class="reader-track" data-reader-track tabindex="0" aria-roledescription="carousel">
    ${pages.map((src, i) => `<figure class="reader-page" data-reader-page aria-label="Page ${i + 1} of ${pages.length}">
      <button type="button" class="reader-open" data-lightbox="${e(src)}" data-color data-caption="N°${e(issue.number)} — ${pages.length > 1 ? `page ${i + 1}/${pages.length}` : 'cover'}" aria-label="Open ${pages.length > 1 ? `page ${i + 1}` : 'cover'} full screen">${imgTag({ src, alt: `Issue ${issue.number}, ${pages.length > 1 ? `page ${i + 1}` : 'cover'}`, sizes: '(max-width: 760px) 86vw, 42vw', eager: i < 2 })}</button>
      <figcaption class="label label--dim">${i === 0 ? 'Cover' : i === pages.length - 1 ? 'Back' : String(i + 1).padStart(2, '0')}</figcaption>
    </figure>`).join('')}
  </div>
  ${flip ? `<div class="reader-controls">
    <button type="button" class="chip" data-reader-prev aria-label="Previous page">&larr;</button>
    <span class="label reader-count" data-reader-count aria-live="polite">1 / ${pages.length}</span>
    <button type="button" class="chip" data-reader-next aria-label="Next page">&rarr;</button>
  </div>` : ''}
</section>
${stories.length ? `<section class="block issue-stories">
  ${sectionHead({ index: `N°${issue.number}`, sym: 'fire', title: 'In this issue.' }, ctx)}
  <div class="mag-grid">${stories.map((a) => storyCard(a, ctx, {})).join('')}</div>
</section>` : ''}
<section class="block issue-more">
  <span class="label">${symbol('pyramid', { cls: 'sh-sym' })}All issues</span>
  ${issueGrid(ctx.issues, ctx, { current: issue })}
</section>`;
}
