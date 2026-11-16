// Darkroom tests — the Worker runs against a real SQLite database through a small D1-compatible shim.
//   node tests/darkroom.test.mjs
import assert from 'node:assert/strict';
import { d1 } from './lib/d1-sqlite.mjs';
import worker, { _resetRateLimit } from '../worker/finder-ai/src/index.js';
import { _resetMigration } from '../worker/finder-ai/src/darkroom.js';

const ORIGIN = 'https://omarkullab59-alt.github.io';
const TOKEN = 'test-admin-token-0123456789';
const env = { DB: d1(), ADMIN_TOKEN: TOKEN, HASH_SALT: 'salt', ALLOWED_ORIGINS: ORIGIN };
_resetMigration();

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(64).fill(7), 0xff, 0xd9]).toString('base64');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(32).fill(1)]).toString('base64');

const call = (path, { method = 'GET', body, ip = '1.1.1.1', origin = ORIGIN, admin = false } = {}) => {
  _resetRateLimit();
  const headers = { 'cf-connecting-ip': ip, origin, 'content-type': 'application/json' };
  if (admin) headers.authorization = `Bearer ${admin === true ? TOKEN : admin}`;
  return worker.fetch(new Request(`https://w.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
};
const post = (path, body, opts = {}) => call(path, { ...opts, method: 'POST', body });

let n = 0;
const check = (cond, msg) => { assert.ok(cond, msg); n++; };
const upload = (extra = {}, ip) => post('/darkroom/submit', { name: 'Lena K.', instagram: '@lena.shoots', title: 'Hof, 6 Uhr', camera: 'Contax T2', consent: true, image: jpeg, thumb: jpeg, width: 1600, height: 1067, ...extra }, { ip });

let r = await upload({ consent: false });
check(r.status === 400 && (await r.json()).error === 'consent_required', 'consent is required');

r = await upload({ name: '  ' });
check(r.status === 400, 'name is required');

r = await upload({ image: png });
check(r.status === 413, 'non-JPEG/WebP rejected');

r = await upload({ website: 'http://spam' });
check(r.status === 202, 'honeypot answers like success…');

r = await post('/darkroom/submit', { name: 'x', consent: true, image: jpeg }, { origin: 'https://evil.example' });
check(r.status === 403, 'uploads from foreign sites blocked');

r = await upload();
const up = await r.json();
check(r.status === 202 && up.status === 'pending' && up.id, 'upload lands in the queue');
const id = up.id;

r = await call('/darkroom/feed');
check((await r.json()).items.length === 0, '…and is NOT public before approval (honeypot stored nothing public either)');

r = await call(`/darkroom/img/${id}/full`);
check(r.status === 404, 'image hidden before approval');

r = await call('/darkroom/admin/queue');
check(r.status === 401, 'queue needs the admin token');
r = await call('/darkroom/admin/queue', { admin: 'wrong-token-wrong-token-xx' });
check(r.status === 401, 'wrong token rejected');

r = await call('/darkroom/admin/queue', { admin: true });
let q = await r.json();
check(q.items.length === 1 && q.items[0].instagram === 'lena.shoots' && q.totals.pending === 1, 'admin sees the queue (honeypot upload not stored)');

r = await call(`/darkroom/img/${id}/thumb`, { admin: true });
check(r.status === 200 && r.headers.get('cache-control').includes('no-store'), 'admin can preview a pending image');

r = await post('/darkroom/admin/decide', { id, action: 'approve' }, { admin: true });
check((await r.json()).status === 'approved', 'admin approves');

r = await call('/darkroom/feed');
let feed = await r.json();
check(feed.items.length === 1 && feed.items[0].title === 'Hof, 6 Uhr' && !('voter' in feed.items[0]), 'approved photo is public, no visitor hash leaked');

r = await call(`/darkroom/img/${id}/full`);
check(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && r.headers.get('cache-control').includes('immutable'), 'image served + cached');

r = await post('/darkroom/react', { id, kind: 'fire' });
let re = await r.json();
check(re.reactions.fire === 1 && re.mine.includes('fire'), 'reaction counted');
r = await post('/darkroom/react', { id, kind: 'fire' }, { ip: '2.2.2.2' });
check((await r.json()).reactions.fire === 2, 'second visitor counts separately');
r = await post('/darkroom/react', { id, kind: 'fire' });
re = await r.json();
check(re.reactions.fire === 1 && !re.mine.includes('fire'), 'same visitor again = undo (no double votes)');
r = await post('/darkroom/react', { id, kind: 'heart' });
check(r.status === 400, 'only TRIAD reactions allowed');

r = await call('/darkroom/feed', { ip: '2.2.2.2' });
feed = await r.json();
check(feed.items[0].reactions.fire === 1 && feed.items[0].mine[0] === 'fire', 'feed shows counts + own reactions');

r = await call('/darkroom/feed?sort=top');
check((await r.json()).items.length === 1, 'top sort works');

for (const ip of ['3.3.3.3', '3.3.3.3', '4.4.4.4']) await post('/darkroom/report', { id, reason: 'not theirs' }, { ip });
r = await call('/darkroom/feed');
check((await r.json()).items.length === 1, 'double reports from one visitor count once');
await post('/darkroom/report', { id }, { ip: '5.5.5.5' });
r = await call('/darkroom/feed');
check((await r.json()).items.length === 0, '3 reports hide the photo until reviewed');
r = await call('/darkroom/admin/queue?status=flagged', { admin: true });
check((await r.json()).items[0]?.reports === 3, 'flagged photo appears for review');

for (let i = 0; i < 6; i++) await upload({}, '9.9.9.9');
r = await upload({}, '9.9.9.9');
check(r.status === 429, 'daily upload limit per visitor');

r = await post('/darkroom/admin/decide', { id, action: 'delete' }, { admin: true });
check((await r.json()).status === 'deleted', 'admin deletes');
r = await call(`/darkroom/img/${id}/full`, { admin: true });
check(r.status === 404, 'deleted image is gone');

r = await worker.fetch(new Request('https://w.example/darkroom/feed'), { ALLOWED_ORIGINS: ORIGIN });
check(r.status === 503, 'no database → not configured (site shows fallback)');

r = await worker.fetch(new Request('https://w.example/health'), env);
check((await r.json()).darkroom === true, 'health reports darkroom');

console.log(`✓ darkroom: ${n} checks passed`);
