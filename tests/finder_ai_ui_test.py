# End-to-end test of the Finder photo/AI flow with a mocked worker.
# Build with content/site.json aiEndpoint = "https://ai.test.local", serve on :4321, then run.
import asyncio, json, pathlib
from playwright.async_api import async_playwright
PH=pathlib.Path(__file__).parent / 'placeholder.jpg'
seen={}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
        ctx=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2)
        await ctx.route("**/fonts.g*/**", lambda r: r.abort())
        mode={'v':'ok'}
        async def ai(route):
            req=route.request
            if req.method=='OPTIONS': return await route.fulfill(status=204, headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST'})
            body=json.loads(req.post_data); seen['img_len']=len(body.get('image') or ''); seen['text']=body.get('text')
            if mode['v']=='limit': return await route.fulfill(status=429, body=json.dumps({'error':'rate_limited'}), headers={'access-control-allow-origin':'*','content-type':'application/json'})
            await asyncio.sleep(0.6)
            await route.fulfill(status=200, headers={'access-control-allow-origin':'*','content-type':'application/json'}, body=json.dumps({
              'item':'leather biker jacket','brand':None,'brandConfidence':0,'color':'black','material':'leather','era':'90s','details':['double zip'],
              'queryDe':'schwarze Lederjacke Biker 90er','queryEn':'black leather biker jacket 90s','alternatives':['vintage biker jacket','leather moto jacket','black leather jacket'],
              'note':'Black leather biker jacket with double zip; no visible label, so no brand was guessed.','confidence':0.82}))
        await ctx.route("https://ai.test.local/**", ai)
        pg=await ctx.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:4321/finder/"); await pg.wait_for_timeout(500)
        print('ai controls visible:', await pg.locator('[data-ai-controls]').is_visible())
        await pg.set_input_files('[data-photo-input]', str(PH))
        await pg.wait_for_timeout(250); await pg.screenshot(path='/tmp/ai1.png')
        await pg.wait_for_selector('[data-ai-result]:not([hidden])', timeout=5000)
        await pg.wait_for_timeout(900)
        print('sent image chars:', seen['img_len'], '| recognised:', await pg.locator('[data-ai-recognised]').inner_text())
        hrefs=[await a.get_attribute('href') for a in await pg.locator('.market a').all()]
        print('vinted:', hrefs[0]); print('grailed:', hrefs[1])
        await pg.evaluate("document.querySelector('[data-ai-result]').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ai2.png')
        await pg.locator('[data-alt]').first.click(); await pg.wait_for_timeout(400)
        print('after alt click query:', await pg.locator('[data-finder-query]').inner_text())
        mode['v']='limit'
        await pg.click('[data-photo-remove]'); await pg.fill('#finder-q','Rick Owens boots'); await pg.click('[data-ai-go]'); await pg.wait_for_timeout(800)
        print('rate-limit hint:', await pg.locator('[data-finder-hint]').inner_text(), '| fallback query:', await pg.locator('[data-finder-query]').inner_text())
        print('errors', errs)
        await b.close()
asyncio.run(main())
