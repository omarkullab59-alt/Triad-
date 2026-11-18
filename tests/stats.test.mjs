// Visitor counter tests — node tests/stats.test.mjs
import assert from 'node:assert/strict';
import { d1 } from './lib/d1-sqlite.mjs';
import worker, { _resetRateLimit } from '../worker/finder-ai/src/index.js';
import { _resetStats, sourceOf, cleanPath } from '../worker/finder-ai/src/stats.js';

const ORIGIN = 'https://omarkullab59-alt.github.io';
const TOKEN = 'test-admin-token-0123456789';
const env = { DB: d1(), ADMIN_TOKEN: TOKEN, ALLOWED_ORIGINS: ORIGIN };
_resetStats();
let n = 0;
const check = (c, m) => { assert.ok(c, m); n++; };
const hit = (body, { origin = ORIGIN, ua = 'Mozilla/5.0 (iPhone)' } = {}) => { _resetRateLimit(); return worker.fetch(new Request('https://w.example/stats/hit', { method: 'POST', headers: { origin, 'user-agent': ua, 'content-type': 'text/plain', 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify(body) }), env); };
const summary = (auth = TOKEN) => { _resetRateLimit(); return worker.fetch(new Request('https://w.example/stats/summary?days=7', { headers: auth ? { authorization: `Bearer ${auth}` } : {} }), env); };

check(sourceOf('l.instagram.com') === 'instagram', 'instagram referrer');
check(sourceOf('www.google.de') === 'google', 'google referrer');
check(sourceOf('', '') === 'direct', 'no referrer = direct');
check(sourceOf('self') === 'internal', 'own site = internal');
check(sourceOf('l.instagram.com', 'ig_bio') === 'ig_bio', 'utm wins');
check(cleanPath('/Triad-/magazine/?x=1') === '/magazine/', 'path cleaned');

check((await hit({ p: '/Triad-/', r: 'l.instagram.com' })).status === 204, 'hit counted');
await hit({ p: '/Triad-/', r: 'l.instagram.com' });
await hit({ p: '/Triad-/magazine/', r: 'self' });
await hit({ p: '/Triad-/', r: '' });
check((await hit({ p: '/' }, { origin: 'https://evil.example' })).status === 403, 'foreign origin refused');
await hit({ p: '/' }, { ua: 'Googlebot/2.1' });
check((await summary(false)).status === 401, 'summary needs key');
const d = await (await summary()).json();
check(d.total === 4, `total 4 (bots skipped), got ${d.total}`);
check(d.sources[0].src === 'instagram' && Number(d.sources[0].n) === 2, 'instagram top source');
check(!d.sources.some((s) => s.src === 'internal'), 'internal clicks not shown as source');
check(d.pages[0].path === '/' && Number(d.pages[0].n) === 3, 'home top page');
console.log(`✓ stats: ${n} checks passed`);
