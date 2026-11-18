// TRIAD — privacy-friendly visitor counter (no cookies, no IPs, no user IDs).
// Every page view adds +1 to a counter for (day, page, source). Nothing else is stored,
// so a single visitor can never be followed across pages or days.
//
// POST /stats/hit      body {p: "/magazine/", r: "instagram.com", u: "ig_story"}  (sendBeacon, text/plain)
// GET  /stats/summary?days=30   (Authorization: Bearer <ADMIN_TOKEN>)  → totals, pages, sources

const TABLE = `CREATE TABLE IF NOT EXISTS hits (day TEXT NOT NULL, path TEXT NOT NULL, src TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path, src))`;
let ready = false;
export const _resetStats = () => { ready = false; };

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse|curl|wget|python|node-fetch/i;

// Map a referrer host / utm tag to a short, readable source name.
export function sourceOf(ref, utm) {
  const u = String(utm || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30);
  if (u) return u;
  const h = String(ref || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '').slice(0, 60);
  if (!h) return 'direct';
  const map = [
    [/(^|\.)instagram\.com$|^l\.instagram\.com$/, 'instagram'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)google\./, 'google'],
    [/(^|\.)bing\.com$|duckduckgo\.com$|ecosia\.org$|qwant\.com$/, 'search'], [/(^|\.)(facebook\.com|fb\.me)$/, 'facebook'],
    [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'], [/(^|\.)youtube\.com$|youtu\.be$/, 'youtube'], [/(^|\.)pinterest\./, 'pinterest'],
    [/(^|\.)reddit\.com$/, 'reddit'], [/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai)$/, 'ai-search'],
    [/linktr\.ee$/, 'linktree'], [/^self$|(^|\.)github\.io$/, 'internal'],
  ];
  for (const [re, name] of map) if (re.test(h)) return name;
  return h;
}

export const cleanPath = (p) => {
  let s = String(p || '/').split(/[?#]/)[0].slice(0, 120);
  s = s.replace(/^\/Triad-(?=\/)/, '');
  if (!s.startsWith('/')) s = '/' + s;
  return s.replace(/[^a-zA-Z0-9/_.-]/g, '');
};

async function setup(db) {
  if (ready) return;
  await db.prepare(TABLE).run();
  ready = true;
}

export async function handleStats(request, env, url, json, isAdmin) {
  const db = env.DB;
  if (!db) return json({ error: 'not_configured' }, 503);
  await setup(db);

  if (url.pathname === '/stats/hit' && request.method === 'POST') {
    if (BOT.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
    let body = {};
    try { body = JSON.parse((await request.text()).slice(0, 600)); } catch { return json({ error: 'bad_request' }, 400); }
    const day = new Date().toISOString().slice(0, 10);
    const path = cleanPath(body.p);
    const src = sourceOf(body.r, body.u);
    await db.prepare('INSERT INTO hits (day, path, src, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, path, src) DO UPDATE SET n = n + 1').bind(day, path, src).run();
    return new Response(null, { status: 204 });
  }

  if (url.pathname === '/stats/summary' && request.method === 'GET') {
    if (!env.ADMIN_TOKEN) return json({ error: 'admin_disabled' }, 503);
    if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
    const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const q = (sql) => db.prepare(sql).bind(since).all().then((r) => r.results || []);
    const [byDay, pages, sources] = await Promise.all([
      q('SELECT day, SUM(n) AS n FROM hits WHERE day >= ? GROUP BY day ORDER BY day'),
      q('SELECT path, SUM(n) AS n FROM hits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 20'),
      q("SELECT src, SUM(n) AS n FROM hits WHERE day >= ? AND src <> 'internal' GROUP BY src ORDER BY n DESC LIMIT 20"),
    ]);
    const total = byDay.reduce((s, r) => s + Number(r.n), 0);
    return json({ days, since, total, byDay, pages, sources });
  }

  return json({ error: 'not_found' }, 404);
}
