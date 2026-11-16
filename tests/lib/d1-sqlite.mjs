// Minimal Cloudflare D1 stand-in backed by Node's built-in SQLite (tests + local dev only).
import { DatabaseSync } from 'node:sqlite';
export function d1(file = ':memory:') {
  const db = new DatabaseSync(file);
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    first: async (col) => { const row = db.prepare(sql).get(...params); return row ? (col ? row[col] : { ...row }) : null; },
    all: async () => ({ results: db.prepare(sql).all(...params).map((r) => ({ ...r })) }),
    run: async () => { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { db.exec('BEGIN'); try { const out = []; for (const s of list) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}
