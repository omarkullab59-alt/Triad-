/* TRIAD — interactions. Vanilla JS, no dependencies, progressive enhancement:
   every page works without this file; it only adds motion and convenience. */
(() => {
  const html = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Motion preference (WCAG 2.2.2 pause control) ────────────── */
  let stored = null;
  try { stored = localStorage.getItem('triad-motion'); } catch (_) { /* private mode */ }
  let reduced = stored ? stored === 'off' : prefersReduced;
  const applyMotion = () => {
    html.classList.toggle('motion-off', reduced);
    $$('[data-motion-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(reduced));
      b.title = reduced ? 'Resume animation' : 'Pause all animation';
      const l = $('[data-motion-label]', b);
      if (l) l.textContent = reduced ? 'Motion off' : 'Motion on';
    });
  };
  applyMotion();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-motion-toggle]')) return;
    reduced = !reduced;
    try { localStorage.setItem('triad-motion', reduced ? 'off' : 'on'); } catch (_) { /* ignore */ }
    applyMotion();
  });
  /* ── Colour mode: Auto (system) → Dark → Light ─────────────────── */
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  let themePref = 'auto';
  try { themePref = localStorage.getItem('triad-theme') || 'auto'; } catch (_) { /* private mode */ }
  const applyTheme = () => {
    const night = html.dataset.force === 'night' || themePref === 'dark' || (themePref === 'auto' && sysDark.matches);
    html.classList.toggle('night', night);
    $$('[data-theme-toggle]').forEach((b) => {
      const l = $('[data-theme-label]', b); if (l) l.textContent = { auto: 'Auto', dark: 'Dark', light: 'Light' }[themePref];
      b.setAttribute('aria-label', `Colour mode: ${themePref}. Tap to change.`);
      b.title = 'Colour mode: auto (system) → dark → light';
    });
  };
  applyTheme();
  sysDark.addEventListener?.('change', applyTheme);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    themePref = { auto: 'dark', dark: 'light', light: 'auto' }[themePref];
    try { localStorage.setItem('triad-theme', themePref); } catch (_) { /* ignore */ }
    applyTheme();
  });
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── Ready / curtain ─────────────────────────────────────────── */
  // Content is never hidden behind a loader: mark ready on the next frame.
  const ready = () => requestAnimationFrame(() => html.classList.add('is-ready'));
  ready();
  addEventListener('pageshow', (e) => { if (e.persisted) { html.classList.remove('is-leaving'); ready(); } });

  /* ── Page transitions ────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    if (/\.(xml|svg|json|png|jpg)$/.test(url.pathname)) return;
    if (reduced) return;
    e.preventDefault();
    html.classList.add('is-leaving');
    closeMenu();
    setTimeout(() => (location.href = url.href), 200);
  });

  /* ── Menu ────────────────────────────────────────────────────── */
  const menu = $('#menu');
  const toggle = $('.menu-toggle');
  $$('.menu-list li').forEach((li, i) => li.firstElementChild.style.setProperty('--n', i));
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => html.classList.add('menu-open'));
    toggle.setAttribute('aria-expanded', 'true');
    $('.mt-text', toggle).textContent = 'Close';
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.menu-list a', menu)?.focus(), 300);
  }
  function closeMenu() {
    if (!html.classList.contains('menu-open')) return;
    html.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    $('.mt-text', toggle).textContent = 'Index';
    document.body.style.overflow = '';
    setTimeout(() => { if (!html.classList.contains('menu-open')) menu.hidden = true; }, 800);
  }
  toggle?.addEventListener('click', () => (html.classList.contains('menu-open') ? closeMenu() : openMenu()));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMenu(); closeLightbox(); }
    if (e.key === 'Tab' && html.classList.contains('menu-open')) {
      const f = [toggle, ...$$('a', menu)];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* ── Header hide on scroll + progress bar ────────────────────── */
  const header = $('.site-header');
  const progress = $('.progress');
  const isArticle = document.body.id === 'article' || document.body.id === 'news-article';
  let lastY = scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = scrollY;
    if (!html.classList.contains('menu-open')) header.classList.toggle('is-hidden', y > 200 && y > lastY + 4);
    if (y < lastY - 4 || y < 200) header.classList.remove('is-hidden');
    lastY = y;
    if (isArticle) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    }
    parallax();
    scrubWords();
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ── Reveal on scroll ────────────────────────────────────────── */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );
  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));

  /* ── Clock (Berlin) ──────────────────────────────────────────── */
  const clock = $('[data-clock]');
  if (clock) {
    const tick = () => {
      const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date());
      clock.textContent = `BER ${t}`;
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ── Hero: one campaign plate per visit (no auto-rotating carousel) ── */
  const hero = $('[data-hero]');
  if (hero) {
    const slides = $$('.hero-slide', hero);
    const counter = $('[data-hero-counter]', hero);
    if (slides.length > 1) {
      const pick = (Math.random() * slides.length) | 0;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === pick));
      const img = $('img', slides[pick]);
      img.loading = 'eager';
      if (counter) counter.textContent = `PLATE 0${pick + 1} / 0${slides.length}`;
    }
    const rot = $('[data-rotate]', hero);
    if (rot && !reduced) {
      const words = rot.dataset.rotate.split('|');
      let w = 0;
      const timer = setInterval(() => {
        if (reduced || w >= words.length - 1) { clearInterval(timer); if (reduced) rot.textContent = words[0]; return; }
        w++;
        scramble(rot, words[w]);
      }, 1100);
    }
  }
  function scramble(el, target) {
    const chars = 'TRIAD△▲/—#0123';
    let frame = 0;
    const len = Math.max(el.textContent.length, target.length);
    const step = () => {
      let out = '';
      for (let i = 0; i < len; i++) out += i < frame / 2 ? target[i] || '' : chars[(Math.random() * chars.length) | 0];
      el.textContent = out;
      if (frame++ < len * 2) requestAnimationFrame(step);
      else el.textContent = target;
    };
    step();
  }

  /* ── Parallax (campaign) ─────────────────────────────────────── */
  const pWraps = $$('[data-parallax-wrap]');
  function parallax() {
    if (reduced) { pWraps.forEach((w) => ($('[data-parallax]', w).style.transform = '')); return; }
    pWraps.forEach((wrap) => {
      const r = wrap.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      $('[data-parallax]', wrap).style.transform = `translate3d(0, ${p * -10}%, 0)`;
    });
  }

  /* ── Manifesto: words light up as you scroll ─────────────────── */
  const scrub = $('[data-scrub-words]');
  let scrubWordsEls = [];
  if (scrub) {
    scrub.innerHTML = scrub.textContent
      .split(/\s+/)
      .map((w) => `<span class="mw${/beginning|three|vision|TRIAD/i.test(w) ? ' mw-red' : ''}">${w}</span>`)
      .join(' ');
    scrubWordsEls = $$('.mw', scrub);
  }
  function scrubWords() {
    if (!scrubWordsEls.length) return;
    if (reduced) { scrubWordsEls.forEach((w) => { w.classList.add('is-lit'); w.classList.toggle('is-red', w.classList.contains('mw-red')); }); return; }
    const r = scrub.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * scrubWordsEls.length);
    scrubWordsEls.forEach((w, i) => {
      w.classList.toggle('is-lit', i < n);
      w.classList.toggle('is-red', i < n && w.classList.contains('mw-red'));
    });
  }

  /* ── News: floating image preview ────────────────────────────── */
  if (fine) {
    const prev = document.createElement('div');
    prev.className = 'news-preview';
    prev.innerHTML = '<img alt="">';
    document.body.appendChild(prev);
    const pimg = $('img', prev);
    let px = 0, py = 0, tx = 0, ty = 0, on = false;
    $$('.news-row[data-preview], .person-row[data-preview]').forEach((row) => {
      row.addEventListener('mouseenter', () => { pimg.src = row.dataset.preview.replace(/\/(\d+)\/(\d+)\?/, '/520/390?'); prev.classList.add('is-on'); on = true; });
      row.addEventListener('mouseleave', () => { prev.classList.remove('is-on'); on = false; });
    });
    addEventListener('mousemove', (e) => { tx = e.clientX + 170; ty = e.clientY; });
    const loop = () => {
      if (on) { px += (tx - px) * 0.18; py += (ty - py) * 0.18; prev.style.left = px + 'px'; prev.style.top = py + 'px'; }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ── Filters (magazine, news, archive) ───────────────────────── */
  $$('[data-filter]').forEach((bar) => {
    const key = bar.dataset.filter;
    const target = $(`[data-filter-target="${key}"]`);
    const items = () => $$('[data-cat], [data-topic]', target);
    const apply = (val) => {
      $$('.chip[data-filter-value]', bar).forEach((c) => {
        const on = c.dataset.filterValue === val;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on);
      });
      items().forEach((it) => {
        const v = it.dataset.cat || it.dataset.topic;
        it.classList.toggle('is-filtered-out', val !== 'all' && v !== val);
        if (val !== 'all' || true) it.classList.add('is-in');
      });
      $$('.news-month', target).forEach((m) => m.classList.toggle('is-filtered-out', !$$('.news-row:not(.is-filtered-out)', m).length));
      target.classList.toggle('is-filtering', val !== 'all');
      const count = $('[data-archive-count]');
      if (count && key === 'arc') count.textContent = String(items().filter((i) => !i.classList.contains('is-filtered-out')).length).padStart(3, '0');
      if (key === 'mag') history.replaceState(null, '', val === 'all' ? location.pathname : '#' + val);
    };
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-value]');
      if (chip) apply(chip.dataset.filterValue);
    });
    const hash = location.hash.slice(1);
    if (hash && $(`[data-filter-value="${hash}"]`, bar)) apply(hash);
  });

  const shuffleBtn = $('[data-shuffle]');
  shuffleBtn?.addEventListener('click', () => {
    const board = $('[data-moodboard]');
    const kids = $$('.mb-item', board);
    for (let i = kids.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [kids[i], kids[j]] = [kids[j], kids[i]];
    }
    kids.forEach((k) => { k.classList.remove('is-in'); board.appendChild(k); });
    requestAnimationFrame(() => kids.forEach((k, i) => setTimeout(() => k.classList.add('is-in'), i * 25)));
  });

  /* ── Lightbox ────────────────────────────────────────────────── */
  let lb, lbIndex = 0, lbItems = [];
  function buildLightbox() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<img class="lb-img" alt=""><p class="lb-caption"></p><button class="lb-close" type="button">Close ✕</button><button class="lb-prev" type="button" aria-label="Previous">← Prev</button><button class="lb-next" type="button" aria-label="Next">Next →</button>';
    document.body.appendChild(lb);
    $('.lb-close', lb).onclick = closeLightbox;
    $('.lb-prev', lb).onclick = () => showLb(lbIndex - 1);
    $('.lb-next', lb).onclick = () => showLb(lbIndex + 1);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) showLb(lbIndex + (d < 0 ? 1 : -1)); });
  }
  function showLb(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const el = lbItems[lbIndex];
    const img = $('.lb-img', lb);
    img.src = el.dataset.lightbox.replace(/\/(\d+)\/(\d+)\?/, (m, w, h) => `/${1600}/${Math.round((h / w) * 1600)}?`);
    img.alt = el.getAttribute('aria-label') || '';
    lb.classList.toggle('is-color', el.hasAttribute('data-color')); // photographers' work is shown as shot
    $('.lb-caption', lb).textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${String(lbItems.length).padStart(2, '0')} — ${el.dataset.caption || ''}`;
  }
  let lbReturn;
  function openLightbox(el) {
    if (!lb) buildLightbox();
    lbItems = $$('[data-lightbox]').filter((x) => !x.closest('.is-filtered-out'));
    lbReturn = el;
    showLb(lbItems.indexOf(el));
    lb.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('.lb-close', lb).focus();
  }
  function closeLightbox() {
    if (!lb || !lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    lbReturn?.focus();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-lightbox]');
    if (t) { e.preventDefault(); openLightbox(t); }
  });
  addEventListener('keydown', (e) => {
    if (!lb || !lb.classList.contains('is-open')) return;
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
  });

  /* ── Drag-to-scroll (creatives) ──────────────────────────────── */
  $$('[data-drag-scroll]').forEach((track) => {
    let down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.classList.add('is-dragging'); });
    addEventListener('pointerup', () => { down = false; track.classList.remove('is-dragging'); });
    track.addEventListener('pointermove', (e) => { if (!down) return; const d = e.clientX - sx; if (Math.abs(d) > 4) moved = true; track.scrollLeft = sl - d; });
    track.addEventListener('click', (e) => { if (moved) e.preventDefault(); }, true);
    track.addEventListener('dragstart', (e) => e.preventDefault());
  });

  /* ── Custom cursor ───────────────────────────────────────────── */
  if (fine && !reduced) {
    html.classList.add('has-cursor');
    const cur = $('.cursor');
    const dot = $('.cursor-dot', cur);
    const ring = $('.cursor-ring', cur);
    const text = $('.cursor-text', cur);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px)`; });
    const loop = () => { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; ring.style.transform = `translate(${rx}px, ${ry}px)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener('mouseover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button, [role="button"], input');
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-link', !lab && !!link);
      text.textContent = lab ? lab.dataset.cursor : '';
    });
    document.addEventListener('mouseleave', () => (cur.style.opacity = 0));
    document.addEventListener('mouseenter', () => (cur.style.opacity = 1));
  }

  /* ── Emblem: smooth speed-up on hover (no jump) ──────────────── */
  // Changing animation-duration in CSS makes the browser recompute the angle → visible jump.
  // Instead we ramp the playbackRate of the running animations, which keeps the current angle.
  $$('.emblem').forEach((em) => {
    const targets = $$('.em-core, .em-ring', em);
    if (!targets.length) return;
    let rate = 1, goal = 1, raf = 0;
    const anims = () => targets.flatMap((t) => t.getAnimations());
    const step = () => {
      rate += (goal - rate) * 0.08;
      if (Math.abs(goal - rate) < 0.01) rate = goal;
      anims().forEach((a) => (a.updatePlaybackRate ? a.updatePlaybackRate(rate) : (a.playbackRate = rate)));
      raf = rate === goal ? 0 : requestAnimationFrame(step);
    };
    const to = (g) => {
      goal = reduced ? 1 : g;
      em.classList.toggle('is-awake', g > 1 && !reduced);
      if (!raf) raf = requestAnimationFrame(step);
    };
    em.addEventListener('pointerenter', () => to(8));
    em.addEventListener('pointerleave', () => to(1));
  });

  /* ── Finder: one query → search links on many marketplaces ──── */
  const finder = $('[data-finder]');
  if (finder) {
    const markets = JSON.parse(finder.dataset.markets || '[]');
    const form = $('[data-finder-form]', finder);
    const input = $('#finder-q', finder);
    const box = $('[data-finder-results]', finder);
    const list = $('[data-market-list]', finder);
    // German → English garment vocabulary for English-language platforms (Grailed, Depop)
    const DE_EN = {
      jacke: 'jacket', mantel: 'coat', hose: 'pants', jeans: 'jeans', hemd: 'shirt', pullover: 'sweater', pulli: 'sweater',
      strickjacke: 'cardigan', kapuzenpullover: 'hoodie', schuhe: 'shoes', stiefel: 'boots', turnschuhe: 'sneakers',
      tasche: 'bag', rucksack: 'backpack', gürtel: 'belt', mütze: 'beanie', kappe: 'cap', kleid: 'dress', rock: 'skirt',
      weste: 'vest', anzug: 'suit', sakko: 'blazer', leder: 'leather', wolle: 'wool', schwarz: 'black', schwarze: 'black',
      schwarzer: 'black', weiß: 'white', weiss: 'white', weiße: 'white', grau: 'grey', graue: 'grey', braun: 'brown',
      braune: 'brown', blau: 'blue', blaue: 'blue', rot: 'red', rote: 'red', grün: 'green', grüne: 'green', beige: 'beige',
      vintage: 'vintage', militär: 'military', armee: 'army', jahre: '', er: '', 'lederjacke': 'leather jacket',
      'jeansjacke': 'denim jacket', 'bomberjacke': 'bomber jacket', 'daunenjacke': 'down jacket', schmuck: 'jewelry', kette: 'necklace', ring: 'ring',
    };
    const FILLER = /\b(ich|suche|such|eine?n?|der|die|das|mit|für|und|in|a|an|the|looking|for|want|i|im|i'm)\b/gi;
    const parse = (raw) => {
      let q = ` ${raw} `;
      const size = (q.match(/\b(?:size|größe|groesse|gr\.?)\s*([a-z0-9.\/]+)/i) || [])[1];
      const price = (q.match(/\b(?:unter|under|max\.?|bis|<)\s*(\d+)\s*(?:€|eur|euro|\$)?/i) || [])[1];
      q = q.replace(/\b(?:size|größe|groesse|gr\.?)\s*[a-z0-9.\/]+/gi, ' ').replace(/\b(?:unter|under|max\.?|bis|<)\s*\d+\s*(?:€|eur|euro|\$)?/gi, ' ');
      q = q.replace(/(\d{2})(?:er|s)\b/gi, '$1s'); // 90er → 90s
      q = q.replace(FILLER, ' ').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
      const en = q.split(' ').map((w) => (DE_EN[w.toLowerCase()] ?? w)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      return { q, en, size, price };
    };
    const build = (tpl, q) => tpl.replace('{q-}', encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))).replace('{q}', encodeURIComponent(q));
    const run = (raw, push = true, ai = null) => {
      const p = parse(raw || '');
      if (ai) { p.q = ai.queryDe || ai.queryEn; p.en = ai.queryEn || ai.queryDe; }
      if (!p.q) return;
      $('[data-finder-query]', finder).textContent = `“${p.q}”`;
      const notes = [p.en !== p.q ? `English platforms: “${p.en}”` : '', p.size ? `size ${p.size}` : '', p.price ? `max ${p.price} €` : ''].filter(Boolean);
      $('[data-finder-variant]', finder).textContent = notes.length ? `${notes.join(' · ')}${p.size || p.price ? ' — set size/price in the platform filters' : ''}` : '';
      list.innerHTML = markets
        .map((m, i) => {
          const term = m.english ? p.en : p.q;
          return `<li class="market" style="--i:${i}"><a href="${build(m.url, term)}" target="_blank" rel="noopener nofollow">
            <span class="market-idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="market-name">${m.name}</span>
            <span class="market-note">${m.note || ''}</span>
            <span class="market-term">${term}</span>
            <span class="market-open">Open results &#8599;</span>
            <span class="visually-hidden">(opens ${m.name} in a new tab)</span></a></li>`;
        })
        .join('');
      box.hidden = false;
      updateAlert(p);
      if (!ai) $('[data-ai-result]', finder).hidden = true;
      if (push) history.replaceState(null, '', `${location.pathname}?q=${encodeURIComponent(ai ? p.q : raw)}`);
      box.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };
    /* Price alert: eBay checked by the TRIAD server (official API), push to this device */
    const alertBox = $('[data-alert-box]', finder);
    const myBox = $('[data-my-alerts]', finder.parentElement || document);
    const alertStatus = $('[data-alert-status]', finder);
    let alertQuery = '';
    const aSay = (t, kind = '') => { alertStatus.textContent = t; alertStatus.className = `alert-status label${kind ? ' is-' + kind : ''}`; };
    const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const iosNeedsInstall = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
    const keyBytes = (k) => { const b = atob(k.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (k.length % 4)) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
    const api = (path, body) => fetch(`${finder.dataset.ai}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || r.status); return d; });
    const currentSub = async () => (pushOk ? (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() : null);
    function updateAlert(p) {
      alertQuery = p.q;
      $('[data-alert-query]', finder).textContent = `“${p.q}”`;
      if (p.price) alertBox.querySelector('[name=max]').value = p.price;
      const native = [...$$('.market a', finder)].filter((a) => /^(vinted|kleinanzeigen|grailed)$/i.test(a.querySelector('.market-name')?.textContent.trim() || ''));
      $('[data-alert-native]', finder).innerHTML = native.map((a) => `<a class="chip" href="${a.href}" target="_blank" rel="noopener nofollow">${a.querySelector('.market-name').textContent} alert &#8599;</a>`).join('');
      aSay(finder.dataset.ai ? '' : 'Alerts switch on as soon as the TRIAD server is connected.');
      $('[data-alert-go]', finder).disabled = !finder.dataset.ai;
    }
    const ago = (t) => { if (!t) return 'not checked yet'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'checked just now' : m < 60 ? `checked ${m} min ago` : `checked ${Math.round(m / 60)} h ago`; };
    const loadMine = async () => {
      if (!finder.dataset.ai || !myBox) return;
      const sub = await currentSub().catch(() => null);
      if (!sub) { myBox.hidden = true; return; }
      try {
        const d = await api('/alerts/mine', { endpoint: sub.endpoint });
        myBox.hidden = !d.items.length;
        $('[data-my-alerts-list]', myBox).innerHTML = d.items.map((a) => `<li class="my-alert"><span class="my-alert-q">${a.query.replace(/[<>&]/g, '')}</span><span class="label label--dim">${a.maxPrice ? `max ${a.maxPrice} € · ` : ''}${a.hits ? `${a.hits} new found · ` : ''}${ago(a.lastChecked)}</span><button type="button" class="chip" data-alert-del="${a.id}" aria-label="Delete alert ${a.query.replace(/"/g, '')}">Delete</button></li>`).join('');
      } catch (_) { myBox.hidden = true; }
    };
    $('[data-alert-form]', finder).addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!finder.dataset.ai || !alertQuery) return;
      if (iosNeedsInstall) return aSay('On iPhone: first add TRIAD to your home screen (Share → “Add to Home Screen”), open it from there, then turn on the alert.', 'error');
      if (!pushOk) return aSay('This browser can’t receive notifications. Try Chrome, Firefox, Edge or Safari (macOS / iOS 16.4+).', 'error');
      const btn = $('[data-alert-go]', finder); btn.disabled = true; aSay('Asking for permission…');
      try {
        if ((await Notification.requestPermission()) !== 'granted') throw new Error('denied');
        if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register((window.TRIAD_BASE || '/') + 'sw.js');
        const reg = await navigator.serviceWorker.ready;
        const { publicKey, ebay } = await api('/alerts/vapid');
        let sub = await reg.pushManager.getSubscription();
        const fresh = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
        try { sub = sub || await fresh(); } catch (_) { await sub?.unsubscribe(); sub = await fresh(); }
        const max = alertBox.querySelector('[name=max]').value;
        await api('/alerts/subscribe', { subscription: sub.toJSON(), query: alertQuery, maxPrice: max ? Number(max) : null });
        aSay(ebay ? `Alert on: “${alertQuery}”${max ? ` up to ${max} €` : ''}. You’ll get a notification when something new is listed.` : 'Alert saved. eBay checks start as soon as the eBay key is connected.', 'ok');
        loadMine();
      } catch (x) {
        aSay({ denied: 'Notifications are blocked — allow them for this site in your browser settings.', too_many_alerts: 'Max. 10 alerts per device — delete one first.', rate_limited: 'Too many tries — wait a minute.' }[x.message] || 'Could not turn on the alert. Try again.', 'error');
      }
      btn.disabled = false;
    });
    myBox?.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-alert-del]');
      const sub = await currentSub().catch(() => null);
      if (!sub) return;
      if (del) { del.disabled = true; await api('/alerts/delete', { endpoint: sub.endpoint, id: del.dataset.alertDel }).catch(() => {}); loadMine(); }
      if (e.target.closest('[data-alert-test]')) { e.target.textContent = 'Sending…'; const d = await api('/alerts/test', { endpoint: sub.endpoint }).catch(() => ({})); e.target.textContent = d.ok ? 'Test sent ✓' : 'Test failed'; }
    });
    loadMine();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (photo && endpoint) return askAI();
      run(input.value);
    });

    /* AI + photo (only when a Worker endpoint is configured) */
    const endpoint = finder.dataset.ai;
    let photo = null; // base64 jpeg
    const aiBox = $('[data-ai-result]', finder);
    const hint = $('[data-finder-hint]', finder);
    if (endpoint) {
      $('[data-ai-controls]', finder).hidden = false;
      $('[data-photo-title]', finder).textContent = 'Photo search';
      $('[data-photo-text]', finder).textContent = 'Add a photo of the piece — TRIAD AI recognises item, colour, material and visible labels and builds the search for you. Your photo is sent only for recognition to TRIAD’s AI service (Cloudflare Workers AI) and is not stored by TRIAD.';
      $('[data-lens-link]', finder).hidden = true;
    }
    const shrink = (file) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1024, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('unreadable'));
      img.src = URL.createObjectURL(file);
    });
    $('[data-photo-input]', finder)?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await shrink(file);
        photo = dataUrl.split(',')[1];
        $('[data-photo-img]', finder).src = dataUrl;
        $('[data-photo-preview]', finder).hidden = false;
        askAI();
      } catch (_) {
        hint.textContent = 'This photo format could not be read. Try a JPG or PNG.';
      }
    });
    $('[data-photo-remove]', finder)?.addEventListener('click', () => {
      photo = null; $('[data-photo-preview]', finder).hidden = true; $('[data-photo-input]', finder).value = '';
    });
    $('[data-ai-go]', finder)?.addEventListener('click', () => askAI());

    async function askAI() {
      const text = input.value.trim();
      if (!text && !photo) { hint.textContent = 'Describe the piece or add a photo first.'; input.focus(); return; }
      finder.classList.add('is-thinking');
      hint.textContent = photo ? 'Looking at your photo…' : 'Refining your search…';
      try {
        const res = await fetch(endpoint.replace(/\/$/, '') + '/analyze', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, image: photo || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'error');
        if (!data.confidence) { hint.textContent = data.note || 'No fashion item recognised. Try another photo or describe it.'; return; }
        const itemL = (data.item || '').toLowerCase();
        const facts = [data.brand && data.brandConfidence >= 0.5 ? data.brand : null, ...[data.color, data.material].filter((x) => x && !itemL.includes(x.toLowerCase())), data.item, data.era].filter(Boolean);
        $('[data-ai-recognised]', finder).textContent = `Recognised: ${facts.join(' · ')} (${Math.round(data.confidence * 100)}%)`;
        $('[data-ai-note]', finder).textContent = data.note || '';
        $('[data-ai-alts]', finder).innerHTML = (data.alternatives || [])
          .map((a) => `<button type="button" class="chip" data-alt="${a.replace(/"/g, '&quot;')}">${a} &#8594;</button>`).join('');
        $$('[data-alt]', finder).forEach((b) => b.addEventListener('click', () => run(text, true, { queryDe: b.dataset.alt, queryEn: b.dataset.alt })));
        run(text, true, data);
        aiBox.hidden = false;
        hint.textContent = 'Not quite right? Edit the words or try an alternative below.';
      } catch (err) {
        hint.textContent = err.message === 'rate_limited' ? 'Too many AI searches right now — try again in a minute.' : 'AI search is unavailable right now. The normal search still works.';
        if (text) run(text);
      } finally {
        finder.classList.remove('is-thinking');
      }
    }
    $$('[data-finder-example]', finder).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.finderExample; run(input.value); }));
    const initial = new URLSearchParams(location.search).get('q');
    if (initial) { input.value = initial; run(initial, false); }
  }

  /* ── Today from the archive (changes every visit) ────────────── */
  const today = $('[data-archive-today]');
  if (today) {
    try {
      const items = JSON.parse(today.dataset.items);
      const pick = items[(Math.random() * items.length) | 0];
      const img = $('img', today);
      img.src = pick.image;
      img.alt = pick.title;
      $('[data-today-code]', today).textContent = pick.code;
      $('[data-today-title]', today).textContent = pick.title;
    } catch (_) { /* ignore */ }
  }

  /* ── Share / copy link ───────────────────────────────────────── */
  $$('[data-share]').forEach((b) =>
    b.addEventListener('click', async () => {
      const data = { title: b.dataset.title, url: location.href };
      try {
        if (navigator.share && !fine) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy link'), 2000); }
      } catch (_) { /* cancelled */ }
    })
  );

  /* ── Newsletter (not connected yet — honest message) ─────────── */
  $$('[data-newsletter]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('input', form);
      const msg = $('.nl-msg', form);
      if (!input.checkValidity() || !input.value) { msg.textContent = 'Enter a valid email address.'; input.focus(); return; }
      msg.textContent = 'The list opens with Issue 004. This form is not connected yet — nothing was stored.';
    })
  );

  /* ── Darkroom: upload, wall, reactions ───────────────────────── */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toJpeg = (file, max, q) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve({ data: c.toDataURL('image/jpeg', q).split(',')[1], width: c.width, height: c.height }); // re-encoding drops EXIF/GPS
    };
    img.onerror = () => reject(new Error('unreadable'));
    img.src = URL.createObjectURL(file);
  });
  const DR_ERR = {
    consent_required: 'Please confirm the checkbox above.', name_required: 'Your name or alias is missing.',
    image_invalid: 'This file could not be used. Try a JPG.', daily_limit: 'Daily limit reached (6 photos). Try again tomorrow.',
    rate_limited: 'Too many requests at once — wait a minute.', origin_not_allowed: 'Uploads only work on the TRIAD website.',
  };

  $$('[data-dr-countdown]').forEach((el) => {
    const days = Math.ceil((new Date(el.dataset.end + 'T23:59:59') - new Date()) / 864e5);
    el.textContent = days > 1 ? `${days} days left` : days === 1 ? 'last day' : 'closed';
    if (days < 1) el.closest('[data-dr-callbox]')?.classList.add('is-closed');
  });

  /* Home: fresh Darkroom frames */
  const nowDark = $('[data-now-darkroom]');
  if (nowDark) {
    const api = nowDark.dataset.api, list = $('[data-now-thumbs]', nowDark);
    const empty = () => { list.remove(); $('[data-now-empty]', nowDark).hidden = false; };
    if (!api) empty();
    else fetch(`${api}/darkroom/feed?sort=new`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
      if (!d.items.length) return empty();
      list.innerHTML = d.items.slice(0, 4).map((p) => `<li><a href="${(window.TRIAD_BASE || '/')}darkroom/?by=${encodeURIComponent(p.by)}" aria-label="${esc(p.title || 'Photo')} by ${esc(p.name)}"><img src="${api}/darkroom/img/${esc(p.id)}/thumb" alt="" loading="lazy" decoding="async"><span class="label">${esc(p.name)}</span></a></li>`).join('');
    }).catch(empty);
  }

  const dr = $('[data-darkroom]');
  if (dr) {
    const api = dr.dataset.api;
    const kinds = JSON.parse(dr.dataset.reactions || '[]');
    const wall = $('[data-dr-wall]', dr);
    const more = $('[data-dr-more]', dr);
    const calls = JSON.parse(dr.dataset.calls || '[]');
    const params = new URLSearchParams(location.search);
    let sort = 'new', next = null;
    let by = (params.get('by') || '').toLowerCase().replace(/^@/, '');
    let call = calls.some((c) => c.slug === params.get('call')) ? params.get('call') : '';
    const today = new Date().toISOString().slice(0, 10);
    const syncUrl = () => {
      const q = new URLSearchParams(); if (by) q.set('by', by); if (call) q.set('call', call);
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    };
    const syncChips = () => {
      $$('[data-dr-sort]', dr).forEach((x) => { const on = x.dataset.drSort === sort; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
      $$('[data-dr-call]', dr).forEach((x) => { const on = x.dataset.drCall === call; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
      const note = $('[data-dr-filternote]', dr);
      const c = calls.find((x) => x.slug === call);
      note.hidden = !c || !!by;
      if (c) $('[data-dr-filtertext]', dr).textContent = `Showing entries for open call ${c.title}.`;
    };
    const profileBox = $('[data-dr-profile]', dr);
    const renderProfile = (pf) => {
      profileBox.hidden = !by;
      if (!by) return;
      $('[data-dr-pname]', dr).textContent = pf ? pf.name : `@${by}`;
      $('[data-dr-pstats]', dr).textContent = pf ? `${pf.photos} photo${pf.photos === 1 ? '' : 's'} on the wall · ${pf.reactions} reaction${pf.reactions === 1 ? '' : 's'} · since ${new Date(pf.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : 'No photos on the wall yet.';
      const ig = $('[data-dr-pinsta]', dr);
      ig.hidden = !(pf && pf.instagram);
      if (pf && pf.instagram) ig.href = `https://instagram.com/${encodeURIComponent(pf.instagram)}`;
      document.title = `${pf ? pf.name : by} — Darkroom — TRIAD`;
    };

    const card = (p) => {
      const callT = calls.find((c) => c.slug === p.call);
      const credit = [`by <a href="?by=${encodeURIComponent(p.by)}" data-dr-by="${esc(p.by)}">${esc(p.name)}</a>`, p.instagram ? `<a href="https://instagram.com/${encodeURIComponent(p.instagram)}" target="_blank" rel="noopener">@${esc(p.instagram)}</a>` : '', esc(p.camera), esc(p.location)].filter(Boolean).join(' &middot; ');
      const alt = `${p.title ? p.title + ' — ' : ''}photo by ${p.name}`;
      return `<article class="dr-card" data-id="${esc(p.id)}">
        <button type="button" class="dr-photo" data-color data-lightbox="${api}/darkroom/img/${esc(p.id)}/full" data-caption="${esc(alt)}" aria-label="Open ${esc(alt)}" data-cursor="View">
          <img src="${api}/darkroom/img/${esc(p.id)}/thumb" alt="${esc(alt)}" loading="lazy" decoding="async" ${p.width ? `width="${p.width}" height="${p.height}"` : ''}>
        </button>
        <div class="dr-meta">${callT ? `<span class="dr-calltag label">Call ${esc(callT.number || '')} / ${esc(callT.title)}</span>` : ''}${p.title ? `<h3 class="dr-title">${esc(p.title)}</h3>` : ''}<p class="dr-credit">${credit}</p>${p.caption ? `<p class="dr-caption">${esc(p.caption)}</p>` : ''}</div>
        <div class="dr-reacts">${kinds.map((k) => `<button type="button" class="dr-react" data-kind="${k.kind}" aria-pressed="${p.mine.includes(k.kind)}" title="${esc(k.label)} — ${esc(k.hint)}" aria-label="${esc(k.label)}: ${p.reactions[k.kind] || 0}">${k.icon}<span data-n>${p.reactions[k.kind] || 0}</span></button>`).join('')}
          <button type="button" class="dr-report" data-report>Report</button></div>
      </article>`;
    };
    const showEmpty = (on) => { $('[data-dr-empty]', dr).hidden = !on; };
    const load = async (append = false) => {
      wall.setAttribute('aria-busy', 'true');
      try {
        const q = new URLSearchParams({ sort }); if (by) q.set('by', by); if (call) q.set('call', call); if (append && next) q.set('before', next);
        const r = await fetch(`${api}/darkroom/feed?${q}`);
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        next = d.next;
        if (!append) renderProfile(d.profile);
        wall.insertAdjacentHTML(append ? 'beforeend' : 'afterbegin', d.items.map(card).join(''));
        if (!append) $$('.dr-ghost, .dr-card', wall).slice(d.items.length).forEach((x) => x.remove());
        showEmpty(!append && !d.items.length);
        more.hidden = !next;
      } catch (_) {
        $$('.dr-ghost', wall).forEach((x) => x.remove());
        if (!$('.dr-card', wall)) showEmpty(true);
      }
      wall.setAttribute('aria-busy', 'false');
    };
    const reload = () => { $$('.dr-card', wall).forEach((x) => x.remove()); syncChips(); syncUrl(); if (api) load(); };
    syncChips();
    if (by) renderProfile(null);
    if (api) load(); else { $$('.dr-ghost', wall).forEach((x) => x.remove()); wall.setAttribute('aria-busy', 'false'); showEmpty(true); }

    $$('[data-dr-sort]', dr).forEach((b) => b.addEventListener('click', () => { if (sort === b.dataset.drSort) return; sort = b.dataset.drSort; reload(); }));
    $$('[data-dr-call]', dr).forEach((b) => b.addEventListener('click', () => { call = call === b.dataset.drCall ? '' : b.dataset.drCall; reload(); }));
    $$('[data-dr-call-view]').forEach((b) => b.addEventListener('click', () => { call = b.dataset.drCallView; by = ''; reload(); $('.dr-bar', dr).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }));
    $$('[data-dr-clear]', dr).forEach((b) => b.addEventListener('click', () => { by = ''; call = ''; document.title = 'Darkroom — TRIAD'; reload(); }));
    wall.addEventListener('click', (e) => {
      const a = e.target.closest('[data-dr-by]'); if (!a) return;
      e.preventDefault(); by = a.dataset.drBy; call = ''; reload();
      dr.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
    $('[data-dr-pshare]', dr)?.addEventListener('click', async (e) => {
      const url = location.origin + location.pathname + '?by=' + encodeURIComponent(by);
      try {
        if (navigator.share && !fine) await navigator.share({ title: document.title, url });
        else { await navigator.clipboard.writeText(url); e.target.textContent = 'Link copied ✓'; setTimeout(() => (e.target.textContent = 'Copy link to this wall'), 2000); }
      } catch (_) { /* cancelled */ }
    });
    // Open call: countdown, expired calls can't be picked, "Submit to …" preselects the call
    const callSelect = $('[data-dr-callselect]', dr);
    if (callSelect) [...callSelect.options].forEach((o) => { if (o.value && ((o.dataset.end && o.dataset.end < today) || (o.dataset.start && o.dataset.start > today))) { o.disabled = true; if (o.selected) callSelect.value = ''; } });
    $$('[data-dr-join]').forEach((b) => b.addEventListener('click', () => { if (callSelect && !callSelect.querySelector(`option[value="${b.dataset.drJoin}"]`)?.disabled) callSelect.value = b.dataset.drJoin; }));
    more.addEventListener('click', () => load(true));

    wall.addEventListener('click', async (e) => {
      const btn = e.target.closest('.dr-react, [data-report]');
      if (!btn) return;
      const c = btn.closest('.dr-card'); const id = c.dataset.id;
      if (btn.matches('[data-report]')) {
        if (!btn.classList.contains('is-armed')) { btn.classList.add('is-armed'); btn.textContent = 'Report? Tap again'; return; }
        btn.disabled = true; btn.textContent = 'Sending…';
        try { await fetch(`${api}/darkroom/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); btn.textContent = 'Reported — thanks'; }
        catch (_) { btn.textContent = 'Failed'; btn.disabled = false; }
        return;
      }
      const kind = btn.dataset.kind; const n = $('[data-n]', btn);
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on)); n.textContent = Math.max(0, +n.textContent + (on ? 1 : -1)); // optimistic
      if (on && !reduced) { btn.classList.add('is-pop'); setTimeout(() => btn.classList.remove('is-pop'), 200); }
      try {
        const r = await fetch(`${api}/darkroom/react`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, kind }) });
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        $$('.dr-react', c).forEach((b) => { const k = b.dataset.kind; $('[data-n]', b).textContent = d.reactions[k]; b.setAttribute('aria-pressed', String(d.mine.includes(k))); b.setAttribute('aria-label', `${kinds.find((x) => x.kind === k).label}: ${d.reactions[k]}`); });
      } catch (_) { btn.setAttribute('aria-pressed', String(!on)); n.textContent = Math.max(0, +n.textContent + (on ? -1 : 1)); }
    });

    /* upload */
    const form = $('[data-dr-form]', dr);
    const input = $('[data-dr-files]', dr);
    const previews = $('[data-dr-previews]', dr);
    const status = $('[data-dr-status]', dr);
    const drop = $('[data-dr-drop]', dr);
    let files = [];
    const say = (t, kind = '') => { status.textContent = t; status.className = `dr-status label ${kind ? 'is-' + kind : ''}`; };
    const renderPrev = () => {
      previews.innerHTML = files.map((f, i) => `<li class="dr-prev" ${f.state ? `data-state="${f.state}"` : ''}><img src="${f.url}" alt=""><button type="button" class="photo-remove" data-rm="${i}" aria-label="Remove photo ${i + 1}">&#10005;</button></li>`).join('');
    };
    const add = (list) => {
      const imgs = [...list].filter((f) => /^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
      const room = 6 - files.length;
      imgs.slice(0, room).forEach((f) => files.push({ file: f, url: URL.createObjectURL(f) }));
      if (imgs.length > room) say('Max 6 photos per submission.', 'error'); else say('');
      renderPrev();
    };
    input?.addEventListener('change', () => { add(input.files); input.value = ''; });
    previews.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; URL.revokeObjectURL(files[b.dataset.rm].url); files.splice(+b.dataset.rm, 1); renderPrev(); });
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => add(e.dataTransfer.files));

    try { const me = JSON.parse(localStorage.getItem('triad-darkroom') || '{}'); ['name', 'instagram'].forEach((k) => { if (me[k] && form.elements[k]) form.elements[k].value = me[k]; }); } catch (_) { /* ignore */ }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!api) return;
      const f = form.elements;
      if (!files.length) { say('Choose at least one photo.', 'error'); drop.focus?.(); input.focus(); return; }
      if (!f.name.value.trim()) { say(DR_ERR.name_required, 'error'); f.name.focus(); return; }
      if (!f.consent.checked) { say(DR_ERR.consent_required, 'error'); f.consent.focus(); return; }
      try { localStorage.setItem('triad-darkroom', JSON.stringify({ name: f.name.value.trim(), instagram: f.instagram.value.trim() })); } catch (_) { /* ignore */ }
      const send = $('[data-dr-send]', form); send.disabled = true;
      let ok = 0, err = '';
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item.state === 'sent') { ok++; continue; }
        item.state = 'sending'; renderPrev(); say(`Developing ${i + 1} / ${files.length}…`);
        try {
          const full = await toJpeg(item.file, 1600, 0.82);
          const thumb = await toJpeg(item.file, 640, 0.78);
          const r = await fetch(`${api}/darkroom/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
            name: f.name.value, instagram: f.instagram.value, title: f.title.value, location: f.location.value, camera: f.camera.value,
            caption: f.caption.value, website: f.website.value, call: f.call ? f.call.value : '', consent: true, image: full.data, thumb: thumb.data, width: full.width, height: full.height,
          }) });
          if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'failed'); }
          item.state = 'sent'; ok++;
        } catch (x) {
          item.state = 'error'; err = DR_ERR[x.message] || (x.message === 'unreadable' ? 'One photo could not be read (HEIC? Export as JPG).' : 'Upload failed — check your connection and try again.');
          if (x.message === 'daily_limit') break;
        }
        renderPrev();
      }
      send.disabled = false;
      if (ok === files.length) {
        say(`${ok} photo${ok > 1 ? 's' : ''} in the darkroom. The crew reviews them — usually within 48 hours.`, 'ok');
        setTimeout(() => { files.forEach((x) => URL.revokeObjectURL(x.url)); files = []; renderPrev(); }, 2500);
      } else say(`${ok} of ${files.length} sent. ${err}`, 'error');
    });
  }

  /* ── Darkroom moderation ─────────────────────────────────────── */
  const adm = $('[data-dr-admin]');
  if (adm) {
    const api = adm.dataset.api;
    const login = $('[data-dr-login]', adm), panel = $('[data-dr-panel]', adm), queue = $('[data-dr-queue]', adm), st = $('[data-dr-admin-status]', adm);
    let token = ''; let tab = 'pending';
    try { token = sessionStorage.getItem('triad-dr-admin') || ''; } catch (_) { /* ignore */ }
    const authed = (path, opts = {}) => fetch(api + path, { ...opts, headers: { ...(opts.headers || {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    const open = async () => {
      st.textContent = 'Loading…'; st.className = 'label label--dim';
      const r = await authed(`/darkroom/admin/queue?status=${tab}`).catch(() => null);
      if (!r || !r.ok) {
        const unauthorized = r && r.status === 401;
        if (unauthorized) { token = ''; try { sessionStorage.removeItem('triad-dr-admin'); } catch (_) { /* ignore */ } login.hidden = false; panel.hidden = true; }
        st.textContent = unauthorized ? 'Wrong key.' : 'Server not reachable.'; st.className = 'label is-error';
        if (unauthorized) login.querySelector('p').textContent = 'Wrong key.';
        return;
      }
      login.hidden = true; panel.hidden = false;
      const d = await r.json();
      $$('[data-dr-count]', adm).forEach((s) => (s.textContent = d.totals[s.dataset.drCount] || ''));
      st.textContent = d.items.length ? '' : `Nothing ${tab}.`;
      queue.innerHTML = d.items.map((p) => `<li class="dr-q" data-id="${esc(p.id)}"><img alt="" data-src="/darkroom/img/${esc(p.id)}/full">
        <div><strong>${esc(p.title || 'Untitled')}</strong><p class="label label--dim">${esc(p.name)}${p.instagram ? ' · @' + esc(p.instagram) : ''}${p.camera ? ' · ' + esc(p.camera) : ''}${p.location ? ' · ' + esc(p.location) : ''}${p.call ? ' · CALL: ' + esc(p.call) : ''} · ${new Date(p.created).toLocaleString()}${p.reports ? ` · ${p.reports} reports` : ''}</p>${p.caption ? `<p>${esc(p.caption)}</p>` : ''}</div>
        <div class="dr-q-actions">${tab !== 'approved' ? '<button type="button" class="chip" data-act="approve">Approve</button>' : ''}${tab !== 'rejected' ? '<button type="button" class="chip" data-act="reject">Reject</button>' : ''}<button type="button" class="chip" data-act="delete">Delete</button></div></li>`).join('');
      for (const img of $$('img[data-src]', queue)) {
        authed(img.dataset.src).then((x) => (x.ok ? x.blob() : null)).then((b) => { if (b) img.src = URL.createObjectURL(b); }).catch(() => {});
      }
    };
    login.addEventListener('submit', (e) => { e.preventDefault(); token = login.elements.token.value.trim(); try { sessionStorage.setItem('triad-dr-admin', token); } catch (_) { /* ignore */ } open(); });
    $$('[data-dr-tab]', adm).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.drTab; $$('[data-dr-tab]', adm).forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); open(); }));
    $('[data-dr-logout]', adm).addEventListener('click', () => { token = ''; try { sessionStorage.removeItem('triad-dr-admin'); } catch (_) { /* ignore */ } location.reload(); });
    queue.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'delete' && !b.classList.contains('is-armed')) { b.classList.add('is-armed'); b.textContent = 'Really delete?'; return; }
      const li = b.closest('[data-id]'); b.disabled = true;
      const r = await authed('/darkroom/admin/decide', { method: 'POST', body: JSON.stringify({ id: li.dataset.id, action: b.dataset.act }) }).catch(() => null);
      if (r && r.ok) { li.remove(); open(); } else { b.disabled = false; st.textContent = 'Action failed.'; st.className = 'label is-error'; }
    });
    if (token && api) open();
  }

  /* ── Service worker (offline + installable app) ──────────────── */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register((window.TRIAD_BASE || '/') + 'sw.js').catch(() => {}));
  }

  onScroll();
})();
