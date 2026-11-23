#!/usr/bin/env python3
"""
TRIAD — automated usability & accessibility audit.

Runs every key page on a desktop and a mobile profile and checks:
  - JS errors, horizontal overflow
  - text contrast (WCAG 1.4.3: 4.5:1 normal, 3:1 large)
  - target size (WCAG 2.5.8: 24x24 CSS px; 44x44 recommended on touch)
  - min. font size on mobile, body line length (Baymard: 50–75 chars)
  - heading structure, image alt, accessible link names, lang
  - moving content without pause control (WCAG 2.2.2)
  - load timing: first paint, content visible, LCP, CLS
  - keyboard: skip link first, visible focus, no focus on hidden items
plus scripted user tasks (time + actions to complete).

Usage:  python3 tests/usability_audit.py [base_url] [--json out.json]
Needs:  playwright (python) + Chromium/Chrome.
"""
import asyncio, json, sys, time, pathlib
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:4321").rstrip("/")
OUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
HERE = pathlib.Path(__file__).parent
PLACEHOLDER = (HERE / "placeholder.jpg").read_bytes()

PAGES = [
    ("Home", "/"),
    ("Magazine", "/magazine/"),
    ("Issue", "/magazine/issue-012/"),
    ("Article", "/magazine/three-forces-the-first-shoot/"),
    ("News", "/news/"),
    ("Archive", "/archive/"),
    ("Voices", "/people/"),
    ("Finder", "/finder/"),
    ("Darkroom", "/darkroom/"),
    ("Datenschutz", "/legal/datenschutz/"),
    ("About", "/about/"),
]
PROFILES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}),
    "mobile": dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2),
}

AUDIT_JS = r"""
() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null;
    const [r,g,b] = m.slice(0,3).map(Number).map(v => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4) });
    return 0.2126*r+0.7152*g+0.0722*b; };
  const alpha = (c) => { const m = c.match(/[\d.]+/g); return m && m.length>3 ? Number(m[3]) : 1; };
  const bgOf = (el) => { let e = el; while (e) { const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none' && !/gradient/.test(s.backgroundImage)) return {img:true};
      if (alpha(s.backgroundColor) > 0.5) return {color:s.backgroundColor};
      if (e.querySelector && e !== el && e.matches('.frame,.hero,.campaign,.art-hero,.issue-cover')) return {img:true};
      e = e.parentElement; }
    return {color:'rgb(255,255,255)'}; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none' && Number(s.opacity)>0.05 && !el.closest('[hidden],[aria-hidden="true"]'); };

  // contrast
  const contrast = []; let checked = 0;
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement;
    if (!t.textContent.trim() || seen.has(el) || !visible(el)) continue; seen.add(el);
    const s = getComputedStyle(el); if (s.mixBlendMode !== 'normal') continue;
    const bg = bgOf(el); if (bg.img) continue;
    const L1 = lum(s.color), L2 = lum(bg.color); if (L1==null||L2==null) continue;
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const px = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    checked++;
    if (ratio < (large ? 3 : 4.5)) contrast.push({text: t.textContent.trim().slice(0,40), ratio: Math.round(ratio*100)/100, size: px, cls: el.className.toString().slice(0,40)});
  }

  // targets
  const small = [], under44 = [];
  document.querySelectorAll('a,button,input,[role=button]').forEach(el => {
    if (!visible(el)) return;
    if (el.closest('p,li.inline,figcaption,dd') && el.tagName==='A' && el.closest('.art-body,.na-body,.about-close,.system-downloads,.sample-banner')) return; // inline text links are exempt
    const r = el.getBoundingClientRect();
    const item = {name:(el.innerText||el.getAttribute('aria-label')||el.value||'').trim().slice(0,30), w:Math.round(r.width), h:Math.round(r.height), cls: el.className.toString().slice(0,30)};
    if (r.width < 24 || r.height < 24) small.push(item); else if (r.width < 44 || r.height < 44) under44.push(item);
  });

  // fonts
  const tiny = new Set();
  document.querySelectorAll('main *, header *, footer *').forEach(el => {
    if (!visible(el) || !el.childNodes.length) return;
    const hasText = [...el.childNodes].some(n => n.nodeType===3 && n.textContent.trim()); if (!hasText) return;
    const px = parseFloat(getComputedStyle(el).fontSize); if (px < 12) tiny.add(`${px}px ${el.className.toString().split(' ')[0]||el.tagName}`);
  });

  // line length in long-form text
  const lines = [];
  document.querySelectorAll('.art-body > p, .na-body > p').forEach(p => {
    const range = document.createRange(); range.selectNodeContents(p);
    const rects = [...range.getClientRects()]; const tops = new Set(rects.map(r => Math.round(r.top)));
    if (tops.size > 1) lines.push(Math.round(p.textContent.length / tops.size));
  });

  // structure
  const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map(h => Number(h.tagName[1]));
  let skips = 0; for (let i=1;i<hs.length;i++) if (hs[i]-hs[i-1]>1) skips++;
  const noAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
  const noName = [...document.querySelectorAll('a,button')].filter(el => visible(el) && !(el.innerText.trim()||el.getAttribute('aria-label')||el.querySelector('img[alt]:not([alt=""])'))).length;

  // moving content
  const moving = [];
  document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el);
    if (s.animationName !== 'none' && s.animationIterationCount === 'infinite' && visible(el) && !el.closest('.curtain,.cursor')) moving.push(el.className.baseVal ?? el.className.toString());
  });
  const pauseCtl = !!document.querySelector('[data-motion-toggle]');

  return {
    lang: document.documentElement.lang, h1: hs.filter(h=>h===1).length, headingSkips: skips,
    imgNoAlt: noAlt, unnamedControls: noName,
    contrastChecked: checked, contrastFails: contrast.slice(0,12), contrastFailCount: contrast.length,
    targetsUnder24: small.slice(0,10), targetsUnder24Count: small.length, targetsUnder44Count: under44.length,
    tinyFonts: [...tiny].slice(0,10),
    lineLength: lines.length ? {min: Math.min(...lines), max: Math.max(...lines), avg: Math.round(lines.reduce((a,b)=>a+b,0)/lines.length)} : null,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    domNodes: document.getElementsByTagName('*').length,
    infiniteAnimations: [...new Set(moving)].length, pauseControl: pauseCtl,
  };
}
"""

PERF_JS = r"""
() => new Promise(res => {
  const out = {lcp: 0, cls: 0};
  new PerformanceObserver(l => { for (const e of l.getEntries()) out.lcp = e.startTime; }).observe({type:'largest-contentful-paint', buffered:true});
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value; }).observe({type:'layout-shift', buffered:true});
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  out.fcp = fcp ? fcp.startTime : null;
  setTimeout(() => { out.lcp = Math.round(out.lcp); out.cls = Math.round(out.cls*1000)/1000; out.fcp = out.fcp && Math.round(out.fcp); res(out); }, 2500);
})
"""

async def setup(ctx):
    async def img(route):
        await route.fulfill(status=200, body=PLACEHOLDER, headers={"content-type": "image/jpeg", "cache-control": "max-age=3600"})
    await ctx.route("**/picsum.photos/**", img)
    await ctx.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    await ctx.route("**/fonts.gstatic.com/**", lambda r: r.abort())

async def content_visible_ms(page):
    # time until the main content is actually visible (curtain gone / opacity)
    return await page.evaluate("""() => new Promise(res => { const t0 = performance.now();
      const check = () => { const c = document.querySelector('.curtain');
        const r = c && c.getBoundingClientRect(); const hidden = !c || getComputedStyle(c).display==='none' || r.bottom <= 1 || r.top >= innerHeight - 1;
        if (hidden) res(Math.round(performance.timeOrigin ? performance.now() : 0)); else requestAnimationFrame(check); };
      check(); setTimeout(() => res(-1), 8000); })""")

async def keyboard_check(page):
    await page.keyboard.press("Tab")
    first = await page.evaluate("document.activeElement && (document.activeElement.className||document.activeElement.tagName)")
    problems, outlines = [], 0
    for _ in range(25):
        info = await page.evaluate("""() => { const a = document.activeElement; if (!a || a===document.body) return null;
          const r = a.getBoundingClientRect(); const s = getComputedStyle(a);
          const hidden = !!a.closest('[hidden]') || s.visibility==='hidden' || r.width===0;
          const ring = s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>0;
          return {hidden, ring, name:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,25)} }""")
        if info:
            if info["hidden"]: problems.append(info["name"])
            if info["ring"]: outlines += 1
        await page.keyboard.press("Tab")
    return {"firstTab": first, "focusOnHidden": problems[:5], "visibleFocusRings": outlines}

# ── scripted user tasks ─────────────────────────────────────────────────
async def task(name, fn, page):
    t0 = time.perf_counter()
    try:
        steps = await fn(page)
        ok = True
    except Exception as e:  # noqa
        steps, ok = str(e)[:120], False
    return {"task": name, "ok": ok, "seconds": round(time.perf_counter() - t0, 2), "actions": steps}

async def t_latest_issue(page):
    # first-time visitor: open the newest issue from the home page and flip to page 3
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    n = 0
    link = page.locator("a[href*='/magazine/issue-']").first
    await link.scroll_into_view_if_needed(); await link.click(); n += 1
    await page.wait_for_url("**/issue-*/")
    nxt = page.locator(".reader-next, [data-reader-next]").first
    for _ in range(2):
        await nxt.click(); n += 1
    return n

async def t_zoom(page):
    await page.goto(BASE + "/magazine/issue-012/", wait_until="domcontentloaded")
    await page.locator(".reader-open").first.click(); await page.wait_for_selector(".lightbox.is-open")
    await page.click(".lb-zin"); await page.click(".lb-zin")
    assert (await page.locator(".lb-zval").inner_text()) != "100%"
    await page.keyboard.press("Escape")
    return 4

async def t_instagram(page):
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    link = page.locator("a[href*='instagram.com/triad.closet']").first
    await link.scroll_into_view_if_needed()
    assert await link.is_visible()
    return 1

async def t_find_article(page):
    await page.goto(BASE + "/magazine/", wait_until="domcontentloaded")
    a = page.locator("a[href*='three-forces']").first
    await a.scroll_into_view_if_needed(); await a.click()
    await page.wait_for_url("**/three-forces-the-first-shoot/**")
    return 1

async def t_archive_keyboard(page):
    await page.goto(BASE + "/archive/", wait_until="domcontentloaded")
    presses = 0
    for _ in range(60):
        await page.keyboard.press("Tab"); presses += 1
        if await page.evaluate("document.activeElement.matches('[data-lightbox]')"): break
    await page.keyboard.press("Enter"); await page.wait_for_selector(".lightbox.is-open")
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("Escape")
    assert not await page.locator(".lightbox.is-open").count()
    return presses + 3

async def t_menu_nav(page):
    await page.goto(BASE + "/magazine/", wait_until="domcontentloaded")
    await page.locator(".menu-toggle").click()
    await page.locator(".menu-list a", has_text="Archive").click()
    await page.wait_for_url("**/archive/")
    return 2

async def t_about_keyboard(page):
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    presses = 0
    for _ in range(40):
        await page.keyboard.press("Tab"); presses += 1
        if await page.evaluate("(document.activeElement.innerText||'').trim().toLowerCase().endsWith('about')"): break
    await page.keyboard.press("Enter"); await page.wait_for_url("**/about/")
    return presses + 1

async def t_finder(page):
    await page.goto(BASE + "/finder/", wait_until="domcontentloaded")
    await page.fill("#finder-q", "Carhartt Detroit Jacke")
    await page.keyboard.press("Enter")
    await page.wait_for_selector(".market a")
    assert await page.locator(".market a").count() >= 5
    return 2

async def t_darkroom_submit(page):
    import glob
    await page.goto(BASE + "/darkroom/", wait_until="domcontentloaded")
    await page.get_by_role("link", name="Submit photos").click()
    await page.set_input_files("[data-dr-files]", sorted(glob.glob("/tmp/drimg/*.jpg"))[:2])
    await page.fill("input[name=name]", "Audit Tester")
    await page.check("input[name=consent]")
    await page.click("[data-dr-send]")
    await page.wait_for_selector(".dr-status.is-ok", timeout=15000)
    return 5

async def t_darkroom_react(page):
    await page.goto(BASE + "/darkroom/", wait_until="domcontentloaded")
    btn = page.locator(".dr-react[data-kind=delta]").first
    await btn.wait_for(timeout=5000)
    await btn.scroll_into_view_if_needed(); await btn.click()
    await page.wait_for_function("document.querySelector('.dr-react[data-kind=delta]').getAttribute('aria-pressed')==='true'")
    return 1

TASKS = {
    "desktop": [("Neueste Ausgabe öffnen + 2x blättern", t_latest_issue), ("Bild öffnen und zoomen", t_zoom), ("Artikel aus Magazin öffnen", t_find_article),
                ("Archiv-Bild per Tastatur öffnen/blättern/schließen", t_archive_keyboard), ("About nur per Tastatur erreichen", t_about_keyboard),
                ("Finder: Text-Suche → Plattform-Links", t_finder), ("Darkroom: auf ein Foto reagieren", t_darkroom_react)],
    "mobile": [("Neueste Ausgabe öffnen + 2x blättern", t_latest_issue), ("Bild öffnen und zoomen", t_zoom), ("Instagram-Link auf Startseite finden", t_instagram),
               ("Über das Menü zum Archiv", t_menu_nav), ("Finder: Text-Suche → Plattform-Links", t_finder),
               ("Darkroom: 2 Fotos einreichen", t_darkroom_submit), ("Darkroom: auf ein Foto reagieren", t_darkroom_react)],
}

async def main():
    report = {"base": BASE, "pages": {}, "tasks": {}, "reducedMotion": {}}
    async with async_playwright() as p:
        exe = next((x for x in ["/usr/bin/google-chrome", "/usr/bin/chromium"] if pathlib.Path(x).exists()), None)
        browser = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        for prof, opts in PROFILES.items():
            ctx = await browser.new_context(**opts)
            await setup(ctx)
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            for name, path in PAGES:
                errors.clear()
                t0 = time.perf_counter()
                await page.goto(BASE + path, wait_until="domcontentloaded")
                vis = await content_visible_ms(page)
                perf = await page.evaluate(PERF_JS)
                await page.evaluate("document.querySelectorAll('[data-reveal],[data-split]').forEach(e=>e.classList.add('is-in'))")
                await page.wait_for_timeout(300)
                res = await page.evaluate(AUDIT_JS)
                res.update(perf); res["contentVisibleMs"] = vis; res["jsErrors"] = list(errors)
                if prof == "desktop":
                    await page.goto(BASE + path, wait_until="domcontentloaded"); await page.wait_for_timeout(600)
                    res["keyboard"] = await keyboard_check(page)
                report["pages"].setdefault(name, {})[prof] = res
            # navigation delay caused by page transition
            await page.goto(BASE + "/", wait_until="load")
            t0 = time.perf_counter()
            await page.locator(".nav a, .menu-list a", has_text="News").first.evaluate("a => a.click()")
            await page.wait_for_url("**/news/")
            report.setdefault("navDelaySeconds", {})[prof] = round(time.perf_counter() - t0, 2)
            report["tasks"][prof] = [await task(n, f, page) for n, f in TASKS[prof]]
            await ctx.close()
        # reduced motion
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        await setup(ctx); page = await ctx.new_page()
        await page.goto(BASE + "/", wait_until="domcontentloaded"); await page.wait_for_timeout(800)
        report["reducedMotion"] = await page.evaluate("""() => ({
          curtainShown: (()=>{const c=document.querySelector('.curtain');return !!c && getComputedStyle(c).display!=='none' && c.getBoundingClientRect().bottom>1})(),
          runningAnimations: document.getAnimations().filter(a=>a.playState==='running').length })""")
        await browser.close()

    # ── print summary ───────────────────────────────────────────────
    def line(*a): print(*a)
    line(f"\nTRIAD usability audit — {BASE}\n" + "=" * 72)
    for name, profs in report["pages"].items():
        for prof, r in profs.items():
            flags = []
            if r["jsErrors"]: flags.append(f"JS-Fehler {len(r['jsErrors'])}")
            if r["overflowX"]: flags.append("horizontaler Überlauf")
            if r["contrastFailCount"]: flags.append(f"Kontrast ✗{r['contrastFailCount']}/{r['contrastChecked']}")
            if r["targetsUnder24Count"]: flags.append(f"Ziele<24px ✗{r['targetsUnder24Count']}")
            if prof == "mobile" and r["targetsUnder44Count"]: flags.append(f"Ziele<44px {r['targetsUnder44Count']}")
            if prof == "mobile" and r["tinyFonts"]: flags.append(f"Schrift<12px {len(r['tinyFonts'])}")
            if r["h1"] != 1: flags.append(f"h1={r['h1']}")
            if r["headingSkips"]: flags.append(f"Überschrift-Sprünge {r['headingSkips']}")
            if r["imgNoAlt"] or r["unnamedControls"]: flags.append(f"ohne Alt/Name {r['imgNoAlt']}/{r['unnamedControls']}")
            if r["infiniteAnimations"] and not r["pauseControl"]: flags.append(f"Dauer-Animationen ohne Pause {r['infiniteAnimations']}")
            if r["cls"] > 0.1: flags.append(f"CLS {r['cls']}")
            ll = r["lineLength"]
            if ll and not (45 <= ll["avg"] <= 80): flags.append(f"Zeilenlänge Ø{ll['avg']}")
            kb = r.get("keyboard")
            if kb and kb["focusOnHidden"]: flags.append("Fokus auf Unsichtbarem")
            line(f"{name:<13} {prof:<8} sichtbar {r['contentVisibleMs']:>5} ms · LCP {r['lcp']:>5} ms · CLS {r['cls']:<5} | " + ("; ".join(flags) or "OK"))
    line("\nNavigation (Klick → neue Seite):", report["navDelaySeconds"])
    line("Reduced motion:", report["reducedMotion"])
    line("\nNutzeraufgaben:")
    for prof, ts in report["tasks"].items():
        for t in ts: line(f"  [{prof}] {'✓' if t['ok'] else '✗'} {t['task']:<48} {t['seconds']:>5}s  Aktionen: {t['actions']}")
    if OUT: pathlib.Path(OUT).write_text(json.dumps(report, indent=2, ensure_ascii=False))

asyncio.run(main())
