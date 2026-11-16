# End-to-end Darkroom flow against the local worker (scripts/dev-worker.mjs on :8787).
#   node scripts/dev-worker.mjs & AI_ENDPOINT=http://localhost:8787 npm run build && npm run serve & python3 tests/darkroom_e2e.py
import asyncio, glob, time
from playwright.async_api import async_playwright
IMGS=sorted(glob.glob('/tmp/drimg/*.jpg'))
async def main():
    res={}
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
        ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route("**/fonts.g*/**", lambda r: r.abort()); await ctx.route("**/picsum.photos/**", lambda r: r.abort())
        pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:4321/darkroom/"); await pg.wait_for_timeout(700)
        res['empty state shown']=await pg.locator('[data-dr-empty]').is_visible()
        res['open call banner']=await pg.locator('.dr-call-title').inner_text() if await pg.locator('.dr-call').count() else None
        res['countdown']=await pg.locator('[data-dr-countdown]').inner_text() if await pg.locator('[data-dr-countdown]').count() else None
        res['no-AI promise visible']=await pg.locator('.noai').is_visible()
        await pg.screenshot(path='/tmp/dr_m_top.png')
        # Task 1: submit without consent → clear error
        await pg.locator('[data-dr-join]').click(); await pg.wait_for_timeout(500)
        res['call preselected']=await pg.input_value('[data-dr-callselect]')
        await pg.set_input_files('[data-dr-files]', IMGS[:4])
        await pg.fill('input[name=name]','Lena K.'); await pg.fill('input[name=instagram]','@lena.shoots')
        await pg.fill('input[name=title]','Hof, 6 Uhr'); await pg.fill('input[name=camera]','Contax T2 · Portra 400'); await pg.fill('input[name=location]','Berlin-Wedding')
        await pg.click('[data-dr-send]'); await pg.wait_for_timeout(300)
        res['no-consent message']=await pg.locator('[data-dr-status]').inner_text()
        await pg.check('input[name=consent]')
        t=time.time(); await pg.click('[data-dr-send]')
        try: await pg.wait_for_selector('.dr-status.is-ok', timeout=20000)
        except Exception: print('STATUS:', await pg.locator('[data-dr-status]').inner_text(), errs); raise
        res['upload 4 photos (s)']=round(time.time()-t,1)
        res['success message']=await pg.locator('[data-dr-status]').inner_text()
        await pg.evaluate("document.querySelector('#submit').scrollIntoView()"); await pg.screenshot(path='/tmp/dr_m_sent.png')
        await pg.reload(); await pg.wait_for_timeout(600)
        res['pending NOT public']=await pg.locator('.dr-card').count()==0
        res['name remembered']=await pg.input_value('input[name=name]')
        # Task 2: moderation
        a=await ctx.new_page(); await a.goto("http://localhost:4321/darkroom/admin/")
        await a.fill('input[name=token]','wrong-key-wrong-key'); await a.click('.dr-login button'); await a.wait_for_timeout(400)
        res['wrong key']=await a.locator('.dr-login p').inner_text()
        await a.fill('input[name=token]','local-admin-key-123456'); await a.click('.dr-login button'); await a.wait_for_timeout(800)
        res['queue size']=await a.locator('.dr-q').count()
        await a.screenshot(path='/tmp/dr_admin.png', full_page=False)
        for _ in range(3):
            await a.locator('[data-act=approve]').first.click(); await a.wait_for_timeout(350)
        await a.locator('[data-act=reject]').first.click(); await a.wait_for_timeout(350)
        # Task 3: wall + react + report
        await pg.reload(); await pg.wait_for_timeout(900)
        res['cards on wall']=await pg.locator('.dr-card').count()
        imgs=await pg.evaluate("[...document.querySelectorAll('.dr-card img')].map(i=>[i.naturalWidth,i.naturalHeight])")
        res['thumb sizes']=imgs
        await pg.locator('.dr-react[data-kind=fire]').first.click(); await pg.wait_for_timeout(400)
        res['fire after tap']=await pg.locator('.dr-react[data-kind=fire]').first.inner_text()
        await pg.locator('.dr-react[data-kind=fire]').first.click(); await pg.wait_for_timeout(400)
        res['fire after 2nd tap (undo)']=await pg.locator('.dr-react[data-kind=fire]').first.inner_text()
        await pg.locator('.dr-react[data-kind=chord]').nth(1).click(); await pg.wait_for_timeout(300)
        await pg.locator('[data-report]').last.click(); res['report step 1']=await pg.locator('[data-report]').last.inner_text()
        await pg.locator('[data-report]').last.click(); await pg.wait_for_timeout(400); res['report step 2']=await pg.locator('[data-report]').last.inner_text()
        await pg.evaluate("window.scrollTo(0, document.querySelector('[data-dr-wall]').offsetTop-80)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/dr_m_wall.png')
        await pg.locator('.dr-photo').first.click(); await pg.wait_for_timeout(700)
        res['lightbox opens']=await pg.locator('.lightbox').count()>0
        await pg.screenshot(path='/tmp/dr_m_lightbox.png'); await pg.keyboard.press('Escape')
        # target sizes
        small=await pg.evaluate("""[...document.querySelectorAll('.dr-react,.dr-report,.chip,.btn,input,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.height<24||r.width<24)&&!e.closest('.dr-hp')&&e.type!=='file'}).map(e=>e.className||e.name)""")
        res['targets <24px']=small
        # desktop
        d=await b.new_page(viewport={"width":1440,"height":900}); await d.route("**/fonts.g*/**", lambda r: r.abort()); await d.route("**/picsum.photos/**", lambda r: r.abort())
        await d.goto("http://localhost:4321/darkroom/"); await d.wait_for_timeout(900); await d.screenshot(path='/tmp/dr_d_top.png')
        await d.evaluate("window.scrollTo(0, document.querySelector('[data-dr-wall]').offsetTop-140)"); await d.wait_for_timeout(500); await d.screenshot(path='/tmp/dr_d_wall.png')
        await d.evaluate("document.querySelector('#submit').scrollIntoView()"); await d.wait_for_timeout(400); await d.screenshot(path='/tmp/dr_d_form.png')
        # Photographer page via name link + open-call filter
        await pg.goto("http://localhost:4321/darkroom/"); await pg.wait_for_timeout(800)
        await pg.locator('[data-dr-by]').first.click(); await pg.wait_for_timeout(700)
        res['profile url']=pg.url.split('4321')[1]
        res['profile']=[await pg.locator('[data-dr-pname]').inner_text(), await pg.locator('[data-dr-pstats]').inner_text()]
        await pg.screenshot(path='/tmp/dr_m_profile.png')
        await pg.goto("http://localhost:4321/darkroom/?call=night"); await pg.wait_for_timeout(800)
        res['call filter cards / tag']=[await pg.locator('.dr-card').count(), await pg.locator('.dr-calltag').first.inner_text()]
        await pg.goto("http://localhost:4321/darkroom/?by=lena.shoots"); await pg.wait_for_timeout(800)
        res['direct profile link works']=await pg.locator('[data-dr-pname]').inner_text()
        res['js errors']=errs
    for k,v in res.items(): print(f'{k}: {v}')
asyncio.run(main())
