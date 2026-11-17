# Price-alert UI flow in a real browser against the local worker (scripts/dev-worker.mjs).
# The push service itself is stubbed (headless Chrome can't reach FCM); crypto + delivery are covered by tests/alerts.test.mjs.
import asyncio
from playwright.async_api import async_playwright
STUB = """
(() => {
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  let sub = null;
  const make = async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const p256dh = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    const auth = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e-' + Math.random().toString(36).slice(2);
    return { endpoint, toJSON: () => ({ endpoint, keys: { p256dh, auth } }), unsubscribe: async () => { sub = null; return true; } };
  };
  PushManager.prototype.subscribe = async function () { sub = sub || await make(); return sub; };
  PushManager.prototype.getSubscription = async function () { return sub; };
})();
"""
async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        for name, vp, mob in [("desktop", {"width": 1440, "height": 900}, False), ("mobile", {"width": 390, "height": 844}, True)]:
            ctx = await b.new_context(viewport=vp, is_mobile=mob, has_touch=mob, device_scale_factor=2 if mob else 1)
            await ctx.grant_permissions(["notifications"], origin="http://localhost:4321")
            await ctx.add_init_script(STUB)
            await ctx.route("**/fonts.g*/**", lambda r: r.abort())
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://localhost:4321/finder/"); await pg.wait_for_timeout(600)
            await pg.fill("#finder-q", "Carhartt Detroit Jacke unter 80€"); await pg.keyboard.press("Enter")
            await pg.wait_for_selector("[data-alert-box]"); await pg.wait_for_timeout(500)
            res[f"{name}: query"] = await pg.locator("[data-alert-query]").inner_text()
            res[f"{name}: price prefilled"] = await pg.input_value("[data-alert-form] [name=max]")
            res[f"{name}: native links"] = await pg.locator("[data-alert-native] a").all_inner_texts()
            await pg.locator("[data-alert-box]").scroll_into_view_if_needed()
            await pg.screenshot(path=f"/tmp/alert_{name}_1.png")
            await pg.click("[data-alert-go]")
            await pg.wait_for_selector(".alert-status.is-ok, .alert-status.is-error", timeout=8000)
            res[f"{name}: status"] = await pg.locator("[data-alert-status]").inner_text()
            await pg.wait_for_selector("[data-my-alerts]:not([hidden]) .my-alert", timeout=5000)
            res[f"{name}: my alerts"] = await pg.locator(".my-alert").all_inner_texts()
            await pg.locator("[data-my-alerts]").scroll_into_view_if_needed(); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"/tmp/alert_{name}_2.png")
            await pg.click("[data-alert-del]"); await pg.wait_for_timeout(700)
            res[f"{name}: after delete hidden"] = await pg.locator("[data-my-alerts]").get_attribute("hidden") is not None
            res[f"{name}: js errors"] = errs
    for k, v in res.items(): print(f"{k}: {v}")
asyncio.run(main())
