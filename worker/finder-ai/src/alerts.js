// TRIAD price alerts — saved secondhand searches, checked on a schedule, push to the phone when something new appears.
//
// eBay is checked by the server through eBay's official, free Browse API (5,000 calls/day per app).
// Vinted, Kleinanzeigen, Grailed & co. have no public search API and forbid bots — the site links to
// their own "save search" alerts instead. No scraping.
//
//   GET  /alerts/vapid                      public push key (created on first use, stored in D1)
//   POST /alerts/subscribe {subscription, query, maxPrice?, minPrice?}
//   POST /alerts/mine      {endpoint}       the alerts of this device
//   POST /alerts/delete    {endpoint, id}
//   POST /alerts/test      {endpoint}       sends a test notification
//   scheduled → runAlerts()                 checks the oldest alerts in small batches (free-plan limits)

import { generateVapid, sendPush, validSubscription } from './webpush.js';

export const MAX_ALERTS_PER_DEVICE = 10;
export const BATCH = 12;               // ≤ 50 subrequests and little CPU per run on the free plan
export const INTERVAL_MIN = 60;        // each alert is checked about once an hour
const SUBJECT = 'mailto:alerts@triad.invalid';
const EBAY = 'https://api.ebay.com';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, sub TEXT NOT NULL, query TEXT NOT NULL,
    max_price REAL, min_price REAL, created INTEGER NOT NULL, last_checked INTEGER NOT NULL DEFAULT 0,
    seen TEXT, hits INTEGER NOT NULL DEFAULT 0, last_hit INTEGER, status TEXT NOT NULL DEFAULT 'active')`,
  'CREATE INDEX IF NOT EXISTS alerts_due ON alerts(status, last_checked)',
  'CREATE INDEX IF NOT EXISTS alerts_endpoint ON alerts(endpoint)',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
];
let migrated = false;
async function migrate(db) {
  if (migrated) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  migrated = true;
}
export const _resetAlertsMigration = () => { migrated = false; };

async function setting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? JSON.parse(row.value) : null;
}
const saveSetting = (db, key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, JSON.stringify(value)).run();

export async function vapidKeys(db) {
  let v = await setting(db, 'vapid');
  if (!v) { v = await generateVapid(); await saveSetting(db, 'vapid', v); }
  return v;
}

const cleanQuery = (q) => (typeof q === 'string' ? q.replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '');
const price = (n) => { const x = Number(n); return Number.isFinite(x) && x > 0 && x < 100000 ? Math.round(x * 100) / 100 : null; };
export const ebaySearchUrl = (q, max) => `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}&_sop=10${max ? `&_udhi=${max}` : ''}`;
const view = (r) => ({ id: r.id, query: r.query, maxPrice: r.max_price, minPrice: r.min_price, created: r.created, lastChecked: r.last_checked || null, hits: r.hits, lastHit: r.last_hit, status: r.status });

/* ── HTTP ──────────────────────────────────────────────────────── */
export async function handleAlerts(request, env, url, json) {
  const db = env.DB;
  if (!db) return json({ error: 'not_configured' }, 503);
  await migrate(db);
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/alerts/vapid' && request.method === 'GET') {
    return json({ publicKey: (await vapidKeys(db)).publicKey, ebay: Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET) }, 200);
  }
  if (request.method !== 'POST') return json({ error: 'not_found' }, 404);
  let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const endpoint = typeof b.endpoint === 'string' ? b.endpoint : b.subscription?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return json({ error: 'bad_request' }, 400);

  if (path === '/alerts/subscribe') {
    if (!validSubscription(b.subscription || {})) return json({ error: 'bad_subscription' }, 400);
    const query = cleanQuery(b.query);
    if (query.length < 2) return json({ error: 'query_required' }, 400);
    const n = await db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE endpoint = ? AND status = 'active'").bind(endpoint).first();
    if (Number(n?.n) >= MAX_ALERTS_PER_DEVICE) return json({ error: 'too_many_alerts' }, 429);
    const sub = { endpoint, keys: { p256dh: b.subscription.keys.p256dh, auth: b.subscription.keys.auth } };
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await db.prepare('INSERT INTO alerts (id, endpoint, sub, query, max_price, min_price, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, endpoint, JSON.stringify(sub), query, price(b.maxPrice), price(b.minPrice), Date.now()).run();
    return json({ ok: true, id, ebay: Boolean(env.EBAY_CLIENT_ID) }, 201);
  }
  if (path === '/alerts/mine') {
    const rows = (await db.prepare("SELECT * FROM alerts WHERE endpoint = ? AND status = 'active' ORDER BY created DESC").bind(endpoint).all()).results || [];
    return json({ items: rows.map(view) }, 200);
  }
  if (path === '/alerts/delete') {
    const r = await db.prepare('DELETE FROM alerts WHERE id = ? AND endpoint = ?').bind(String(b.id || ''), endpoint).run();
    return json({ ok: Boolean(r.meta?.changes) }, r.meta?.changes ? 200 : 404);
  }
  if (path === '/alerts/test') {
    const row = await db.prepare("SELECT sub FROM alerts WHERE endpoint = ? AND status = 'active' LIMIT 1").bind(endpoint).first();
    if (!row) return json({ error: 'not_found' }, 404);
    const status = await sendPush(JSON.parse(row.sub), { title: 'TRIAD alerts are on', body: 'This is how a new find will look.', url: '/finder/' }, await vapidKeys(db), SUBJECT);
    return json({ ok: status < 300, status }, 200);
  }
  return json({ error: 'not_found' }, 404);
}

/* ── eBay (official Browse API, app token via client credentials) ── */
async function ebayToken(env, db, fetchImpl) {
  const cached = await setting(db, 'ebay_token');
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetchImpl(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!res.ok) throw new Error(`ebay_token_${res.status}`);
  const d = await res.json();
  await saveSetting(db, 'ebay_token', { token: d.access_token, exp: Date.now() + (d.expires_in || 7200) * 1000 });
  return d.access_token;
}

export async function ebaySearch(alert, token, fetchImpl, marketplace = 'EBAY_DE') {
  const filter = [];
  if (alert.max_price || alert.min_price) filter.push(`price:[${alert.min_price || ''}..${alert.max_price || ''}]`, 'priceCurrency:EUR');
  const qs = new URLSearchParams({ q: alert.query, sort: 'newlyListed', limit: '20' });
  if (filter.length) qs.set('filter', filter.join(','));
  const res = await fetchImpl(`${EBAY}/buy/browse/v1/item_summary/search?${qs}`, {
    headers: { authorization: `Bearer ${token}`, 'x-ebay-c-marketplace-id': marketplace, 'accept-language': 'de-DE' },
  });
  if (!res.ok) throw new Error(`ebay_search_${res.status}`);
  const d = await res.json();
  return (d.itemSummaries || []).map((i) => ({
    id: i.itemId, title: String(i.title || '').slice(0, 120), price: Number(i.price?.value), currency: i.price?.currency || 'EUR',
    url: i.itemWebUrl, image: i.image?.imageUrl || i.thumbnailImages?.[0]?.imageUrl || null,
  })).filter((i) => i.id && (!alert.max_price || !(i.price > alert.max_price)));
}

/* ── Scheduled check ───────────────────────────────────────────── */
export async function runAlerts(env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const db = env.DB;
  const report = { checked: 0, notified: 0, gone: 0, errors: 0 };
  if (!db || !env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return report;
  await migrate(db);
  const due = (await db.prepare("SELECT * FROM alerts WHERE status = 'active' AND last_checked < ? ORDER BY last_checked ASC LIMIT ?")
    .bind(now - INTERVAL_MIN * 60_000 + 60_000, BATCH).all()).results || [];
  if (!due.length) return report;
  let token;
  try { token = await ebayToken(env, db, fetchImpl); } catch { report.errors++; return report; }
  const vapid = await vapidKeys(db);
  const deadEndpoints = new Set();

  for (const a of due) {
    if (deadEndpoints.has(a.endpoint)) continue;
    report.checked++;
    try {
      const items = await ebaySearch(a, token, fetchImpl);
      const seen = a.seen ? JSON.parse(a.seen) : null;
      const fresh = seen ? items.filter((i) => !seen.includes(i.id)) : []; // first run = baseline, no spam
      const nextSeen = [...new Set([...items.map((i) => i.id), ...(seen || [])])].slice(0, 120);
      if (fresh.length) {
        const top = fresh[0];
        const status = await sendPush(JSON.parse(a.sub), {
          title: fresh.length === 1 ? `New on eBay: ${a.query}` : `${fresh.length} new on eBay: ${a.query}`,
          body: `${top.title}${Number.isFinite(top.price) ? ` — ${top.price.toLocaleString('de-DE', { minimumFractionDigits: 0 })} ${top.currency === 'EUR' ? '€' : top.currency}` : ''}`,
          url: fresh.length === 1 ? top.url : ebaySearchUrl(a.query, a.max_price),
          image: top.image, tag: `alert-${a.id}`,
        }, vapid, SUBJECT, fetchImpl);
        if (status === 404 || status === 410) { deadEndpoints.add(a.endpoint); continue; }
        if (status < 300) report.notified++;
        await db.prepare('UPDATE alerts SET seen = ?, last_checked = ?, hits = hits + ?, last_hit = ? WHERE id = ?').bind(JSON.stringify(nextSeen), now, fresh.length, now, a.id).run();
      } else {
        await db.prepare('UPDATE alerts SET seen = ?, last_checked = ? WHERE id = ?').bind(JSON.stringify(nextSeen), now, a.id).run();
      }
    } catch {
      report.errors++;
      await db.prepare('UPDATE alerts SET last_checked = ? WHERE id = ?').bind(now, a.id).run();
    }
  }
  for (const ep of deadEndpoints) {
    const r = await db.prepare("UPDATE alerts SET status = 'gone' WHERE endpoint = ?").bind(ep).run();
    report.gone += r.meta?.changes || 0;
  }
  return report;
}
