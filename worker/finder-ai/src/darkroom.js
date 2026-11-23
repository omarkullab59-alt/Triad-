// TRIAD Darkroom — photographers upload, the crew approves, everyone reacts.
// Storage: Cloudflare D1 (free: 500 MB per database, 5 GB per account, 5M reads/day, 100k writes/day). Images live in D1 as BLOBs
// (client sends a ~1600px JPEG + a ~600px thumb; canvas re-encoding strips EXIF/GPS).
//
// Public
//   GET  /darkroom/feed?sort=new|top&before=<ts>&by=<handle>&call=<slug>
//                                                  approved photos + reaction counts (+ photographer profile)
//   GET  /darkroom/img/<id>/<full|thumb>           image bytes (approved only)
//   POST /darkroom/submit                          new upload → status "pending"
//   POST /darkroom/react   {id, kind}              toggle a reaction (one per kind per visitor)
//   POST /darkroom/report  {id, reason}            report; 3 reports hide a photo until reviewed
// Admin (Authorization: Bearer <ADMIN_TOKEN>)
//   GET  /darkroom/admin/queue?status=pending|flagged|approved|rejected
//   GET  /darkroom/img/<id>/<size>                 any status
//   POST /darkroom/admin/decide {id, action: approve|reject|delete}
//
// Ready for login later: photos.account_id stays NULL until accounts exist.

export const KINDS = ['fire', 'chord', 'delta'];
const MAX_FULL_B64 = 2_600_000; // ≈1.9 MB — D1 rows are capped at 2 MB
const MAX_THUMB_B64 = 600_000;
const UPLOADS_PER_DAY = 6; // per visitor
const REPORTS_TO_HIDE = 3;
const PAGE = 24;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    name TEXT NOT NULL, instagram TEXT, title TEXT, location TEXT, camera TEXT, caption TEXT,
    width INTEGER, height INTEGER, voter TEXT, account_id TEXT, reports INTEGER NOT NULL DEFAULT 0, decided INTEGER, open_call TEXT)`,
  `CREATE INDEX IF NOT EXISTS photos_status ON photos(status, created)`,
  `CREATE TABLE IF NOT EXISTS images (photo_id TEXT NOT NULL, size TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (photo_id, size))`,
  `CREATE TABLE IF NOT EXISTS reactions (photo_id TEXT NOT NULL, kind TEXT NOT NULL, voter TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (photo_id, kind, voter))`,
  `CREATE TABLE IF NOT EXISTS reports (photo_id TEXT NOT NULL, voter TEXT NOT NULL, reason TEXT, created INTEGER NOT NULL, PRIMARY KEY (photo_id, voter))`,
];

let migrated = false;
async function migrate(db) {
  if (migrated) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // Columns added after the first release (no-op error if they already exist)
  for (const sql of ['ALTER TABLE photos ADD COLUMN open_call TEXT']) {
    try { await db.prepare(sql).run(); } catch { /* exists */ }
  }
  migrated = true;
}
export const _resetMigration = () => { migrated = false; };

/* ── helpers ─────────────────────────────────────────────────── */
const clean = (s, n) => (typeof s === 'string' ? s.replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '') || null;
const slug = (s) => (typeof s === 'string' && /^[a-z0-9-]{1,40}$/.test(s) ? s : null);
// Photographer key for /darkroom/?by=…: Instagram handle if given, otherwise the name in lowercase.
export const byKey = (p) => (p.instagram || p.name || '').toLowerCase();
// No AI training: machine-readable reservation (§ 44b UrhG / EU TDM opt-out) on every image and response.
export const NO_AI = { 'x-robots-tag': 'noai, noimageai', 'tdm-reservation': '1' };
const handle = (s) => { const h = clean(s, 40)?.replace(/^@/, '').replace(/[^\w.]/g, ''); return h || null; };

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
// Pseudonymous visitor id: salted hash of the IP — the IP itself is never stored.
const visitor = (request, env) => sha(`${env.HASH_SALT || 'triad-darkroom'}|${request.headers.get('cf-connecting-ip') || 'local'}`);

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}
function decodeImage(raw, max) {
  if (typeof raw !== 'string') return null;
  const b64 = raw.replace(/^data:image\/\w+;base64,/, '');
  if (!b64 || b64.length > max || !/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  try { const bytes = b64ToBytes(b64); return imageType(bytes) ? bytes : null; } catch { return null; }
}

export function isAdmin(request, env) {
  const token = env.ADMIN_TOKEN;
  if (!token || token.length < 16) return false;
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (got.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= got.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

const publicPhoto = (r, counts = {}, mine = []) => ({
  id: r.id, created: r.created, name: r.name, instagram: r.instagram, title: r.title, location: r.location,
  camera: r.camera, caption: r.caption, width: r.width, height: r.height, call: r.open_call || null, by: byKey(r),
  reactions: Object.fromEntries(KINDS.map((k) => [k, counts[k] || 0])), mine,
});

async function countsFor(db, ids, voter) {
  const counts = {}; const mine = {};
  if (!ids.length) return { counts, mine };
  const q = ids.map(() => '?').join(',');
  const rows = (await db.prepare(`SELECT photo_id, kind, COUNT(*) AS n, SUM(voter = ?) AS me FROM reactions WHERE photo_id IN (${q}) GROUP BY photo_id, kind`).bind(voter, ...ids).all()).results || [];
  for (const r of rows) {
    (counts[r.photo_id] ||= {})[r.kind] = Number(r.n);
    if (Number(r.me) > 0) (mine[r.photo_id] ||= []).push(r.kind);
  }
  return { counts, mine };
}

/* ── routes ──────────────────────────────────────────────────── */
export async function handleDarkroom(request, env, url, json) {
  const db = env.DB;
  if (!db) return json({ error: 'not_configured' }, 503);
  await migrate(db);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  // Feed
  if (path === '/darkroom/feed' && method === 'GET') {
    const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
    const before = Number(url.searchParams.get('before')) || 9e15;
    const by = (url.searchParams.get('by') || '').toLowerCase().replace(/^@/, '').slice(0, 60);
    const call = slug(url.searchParams.get('call'));
    const where = ["p.status = 'approved'"]; const args = [];
    if (by) { where.push('(lower(p.instagram) = ? OR (p.instagram IS NULL AND lower(p.name) = ?))'); args.push(by, by); }
    if (call) { where.push('p.open_call = ?'); args.push(call); }
    if (sort === 'new') { where.push('p.created < ?'); args.push(before); }
    const order = sort === 'top' ? 'score DESC, p.created DESC' : 'p.created DESC';
    const rows = (await db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM reactions r WHERE r.photo_id = p.id) AS score FROM photos p WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${PAGE}`).bind(...args).all()).results || [];
    const { counts, mine } = await countsFor(db, rows.map((r) => r.id), await visitor(request, env));
    let profile = null;
    if (by) {
      const pw = ['p.status = \'approved\'', '(lower(p.instagram) = ? OR (p.instagram IS NULL AND lower(p.name) = ?))'];
      const agg = await db.prepare(`SELECT COUNT(*) AS photos, MIN(p.created) AS since, (SELECT COUNT(*) FROM reactions r JOIN photos q ON q.id = r.photo_id WHERE q.status = 'approved' AND (lower(q.instagram) = ? OR (q.instagram IS NULL AND lower(q.name) = ?))) AS reactions FROM photos p WHERE ${pw.join(' AND ')}`).bind(by, by, by, by).first();
      const latest = await db.prepare(`SELECT name, instagram FROM photos p WHERE ${pw.join(' AND ')} ORDER BY created DESC LIMIT 1`).bind(by, by).first();
      if (latest) profile = { name: latest.name, instagram: latest.instagram, photos: Number(agg.photos), reactions: Number(agg.reactions), since: agg.since };
    }
    return json({
      items: rows.map((r) => publicPhoto(r, counts[r.id], mine[r.id] || [])),
      next: sort === 'new' && rows.length === PAGE ? rows[rows.length - 1].created : null,
      profile,
    }, 200, { 'cache-control': 'no-store', ...NO_AI });
  }

  // Images
  const img = path.match(/^\/darkroom\/img\/([\w-]{8,40})\/(full|thumb)$/);
  if (img && method === 'GET') {
    const [, id, size] = img;
    const photo = await db.prepare('SELECT status FROM photos WHERE id = ?').bind(id).first();
    if (!photo) return json({ error: 'not_found' }, 404);
    const admin = isAdmin(request, env);
    if (photo.status !== 'approved' && !admin) return json({ error: 'not_found' }, 404);
    const row = await db.prepare('SELECT data FROM images WHERE photo_id = ? AND size = ?').bind(id, size).first();
    if (!row) return json({ error: 'not_found' }, 404);
    const bytes = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
    return new Response(bytes, { status: 200, headers: {
      'content-type': imageType(bytes) || 'application/octet-stream',
      'cache-control': admin || photo.status !== 'approved' ? 'private, no-store' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      ...NO_AI,
    } });
  }

  if (method !== 'POST' && !path.startsWith('/darkroom/admin')) return json({ error: 'not_found' }, 404);

  // Upload
  if (path === '/darkroom/submit') {
    let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (b.website) return json({ ok: true, status: 'pending' }, 202); // honeypot: bots fill hidden fields
    if (b.consent !== true) return json({ error: 'consent_required' }, 400);
    const name = clean(b.name, 60);
    if (!name) return json({ error: 'name_required' }, 400);
    const full = decodeImage(b.image, MAX_FULL_B64);
    const thumb = decodeImage(b.thumb, MAX_THUMB_B64) || full;
    if (!full) return json({ error: 'image_invalid' }, 413);

    const voter = await visitor(request, env);
    const since = Date.now() - 86_400_000;
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM photos WHERE voter = ? AND created > ?').bind(voter, since).first();
    if (Number(recent?.n) >= UPLOADS_PER_DAY) return json({ error: 'daily_limit' }, 429);

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const w = Math.min(10000, Math.max(0, Number(b.width) || 0)) || null;
    const h = Math.min(10000, Math.max(0, Number(b.height) || 0)) || null;
    await db.batch([
      db.prepare(`INSERT INTO photos (id, created, status, name, instagram, title, location, camera, caption, width, height, voter, open_call)
                  VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, Date.now(), name, handle(b.instagram), clean(b.title, 80), clean(b.location, 60), clean(b.camera, 60), clean(b.caption, 280), w, h, voter, slug(b.call)),
      db.prepare('INSERT INTO images (photo_id, size, data) VALUES (?, ?, ?)').bind(id, 'full', full),
      db.prepare('INSERT INTO images (photo_id, size, data) VALUES (?, ?, ?)').bind(id, 'thumb', thumb),
    ]);
    return json({ ok: true, id, status: 'pending' }, 202);
  }

  // Reactions (toggle)
  if (path === '/darkroom/react') {
    let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (!KINDS.includes(b.kind) || typeof b.id !== 'string') return json({ error: 'bad_request' }, 400);
    const photo = await db.prepare("SELECT id FROM photos WHERE id = ? AND status = 'approved'").bind(b.id).first();
    if (!photo) return json({ error: 'not_found' }, 404);
    const voter = await visitor(request, env);
    const del = await db.prepare('DELETE FROM reactions WHERE photo_id = ? AND kind = ? AND voter = ?').bind(b.id, b.kind, voter).run();
    if (!del.meta?.changes) await db.prepare('INSERT INTO reactions (photo_id, kind, voter, created) VALUES (?, ?, ?, ?)').bind(b.id, b.kind, voter, Date.now()).run();
    const { counts, mine } = await countsFor(db, [b.id], voter);
    return json({ id: b.id, reactions: Object.fromEntries(KINDS.map((k) => [k, counts[b.id]?.[k] || 0])), mine: mine[b.id] || [] }, 200);
  }

  // Reports
  if (path === '/darkroom/report') {
    let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (typeof b.id !== 'string') return json({ error: 'bad_request' }, 400);
    const photo = await db.prepare("SELECT id FROM photos WHERE id = ? AND status = 'approved'").bind(b.id).first();
    if (!photo) return json({ error: 'not_found' }, 404);
    const voter = await visitor(request, env);
    const ins = await db.prepare('INSERT OR IGNORE INTO reports (photo_id, voter, reason, created) VALUES (?, ?, ?, ?)').bind(b.id, voter, clean(b.reason, 200), Date.now()).run();
    if (ins.meta?.changes) {
      await db.prepare(`UPDATE photos SET reports = reports + 1, status = CASE WHEN reports + 1 >= ${REPORTS_TO_HIDE} THEN 'flagged' ELSE status END WHERE id = ?`).bind(b.id).run();
    }
    return json({ ok: true }, 200);
  }

  // Admin
  if (path.startsWith('/darkroom/admin')) {
    if (!env.ADMIN_TOKEN) return json({ error: 'admin_disabled' }, 503);
    if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);

    if (path === '/darkroom/admin/queue' && method === 'GET') {
      const status = ['pending', 'flagged', 'approved', 'rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';
      const rows = (await db.prepare('SELECT * FROM photos WHERE status = ? ORDER BY created DESC LIMIT 100').bind(status).all()).results || [];
      const totals = (await db.prepare('SELECT status, COUNT(*) AS n FROM photos GROUP BY status').all()).results || [];
      return json({
        items: rows.map((r) => ({ ...publicPhoto(r), status: r.status, reports: r.reports })),
        totals: Object.fromEntries(totals.map((t) => [t.status, Number(t.n)])),
      }, 200);
    }
    if (path === '/darkroom/admin/decide' && method === 'POST') {
      let b; try { b = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
      if (typeof b.id !== 'string') return json({ error: 'bad_request' }, 400);
      if (b.action === 'delete') {
        await db.batch([
          db.prepare('DELETE FROM images WHERE photo_id = ?').bind(b.id),
          db.prepare('DELETE FROM reactions WHERE photo_id = ?').bind(b.id),
          db.prepare('DELETE FROM reports WHERE photo_id = ?').bind(b.id),
          db.prepare('DELETE FROM photos WHERE id = ?').bind(b.id),
        ]);
        return json({ ok: true, id: b.id, status: 'deleted' }, 200);
      }
      const status = { approve: 'approved', reject: 'rejected' }[b.action];
      if (!status) return json({ error: 'bad_action' }, 400);
      const res = await db.prepare('UPDATE photos SET status = ?, decided = ?, reports = CASE WHEN ? = \'approved\' THEN 0 ELSE reports END WHERE id = ?').bind(status, Date.now(), status, b.id).run();
      if (status === 'approved') await db.prepare('DELETE FROM reports WHERE photo_id = ?').bind(b.id).run();
      if (!res.meta?.changes) return json({ error: 'not_found' }, 404);
      return json({ ok: true, id: b.id, status }, 200);
    }
    return json({ error: 'not_found' }, 404);
  }

  return json({ error: 'not_found' }, 404);
}
