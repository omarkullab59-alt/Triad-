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
    $$('.news-row[data-preview]').forEach((row) => {
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

  /* ── Service worker (offline + installable app) ──────────────── */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register((window.TRIAD_BASE || '/') + 'sw.js').catch(() => {}));
  }

  onScroll();
})();
