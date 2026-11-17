// Price alerts: Web Push crypto (round-trip decrypt as a browser would), VAPID signature, HTTP API, scheduled eBay check.
//   node tests/alerts.test.mjs
import assert from 'node:assert/strict';
import { d1 } from './lib/d1-sqlite.mjs';
import worker, { _resetRateLimit } from '../worker/finder-ai/src/index.js';
import { encryptPayload, vapidAuth, generateVapid, validSubscription, b64u, unb64u } from '../worker/finder-ai/src/webpush.js';
import { runAlerts, _resetAlertsMigration, MAX_ALERTS_PER_DEVICE } from '../worker/finder-ai/src/alerts.js';

let n = 0;
const check = (c, m) => { assert.ok(c, m); n++; };
const enc = new TextEncoder();
const concat = (...p) => { const o = new Uint8Array(p.reduce((a, b) => a + b.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const hkdf = async (salt, ikm, info, bytes) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));

// A fake browser: its own key pair + auth secret, and the RFC 8291 receiver side.
async function browser() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: `https://fcm.googleapis.com/fcm/send/${b64u(crypto.getRandomValues(new Uint8Array(12)))}`, keys: { p256dh: b64u(pub), auth: b64u(auth) } };
  const decrypt = async (body) => {
    const salt = body.slice(0, 16); const idlen = body[20]; const asPub = body.slice(21, 21 + idlen); const cipher = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, kp.privateKey, 256));
    const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), pub, asPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
    assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
    return JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
  };
  return { sub, decrypt };
}

/* crypto */
const B = await browser();
const body = await encryptPayload(B.sub, { title: 'Hi', body: 'Ünïcode €' });
check((await B.decrypt(body)).body === 'Ünïcode €', 'payload decrypts in the browser (RFC 8291)');
check(new DataView(body.buffer).getUint32(16) === 4096 && body[20] === 65, 'aes128gcm header: rs=4096, keyid=65 bytes');

const vapid = await generateVapid();
const hdr = await vapidAuth(B.sub.endpoint, vapid, 'mailto:x@y.z');
const [, jwt, k] = hdr.match(/^vapid t=([^,]+), k=(.+)$/);
const [h64, c64, s64] = jwt.split('.');
const claims = JSON.parse(new TextDecoder().decode(unb64u(c64)));
const pubKey = await crypto.subtle.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
check(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64u(s64), enc.encode(`${h64}.${c64}`)), 'VAPID JWT signature verifies');
check(claims.aud === 'https://fcm.googleapis.com' && claims.exp > Date.now() / 1000, 'VAPID audience = push service origin');

check(validSubscription(B.sub), 'real push service accepted');
check(!validSubscription({ ...B.sub, endpoint: 'https://evil.example/hook' }), 'foreign endpoint rejected (no SSRF)');
check(!validSubscription({ ...B.sub, keys: { p256dh: 'abc', auth: 'x' } }), 'broken keys rejected');

/* HTTP */
const ORIGIN = 'https://omarkullab59-alt.github.io';
const env = { DB: d1(), ALLOWED_ORIGINS: ORIGIN, EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret' };
_resetAlertsMigration();
const call = (path, b, { method = b ? 'POST' : 'GET', origin = ORIGIN } = {}) => {
  _resetRateLimit();
  return worker.fetch(new Request(`https://w.example${path}`, { method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '1.1.1.1' }, body: b ? JSON.stringify(b) : undefined }), env);
};
let r = await call('/alerts/vapid');
const key1 = (await r.json()).publicKey;
r = await call('/alerts/vapid');
check(key1 && key1 === (await r.json()).publicKey && unb64u(key1).length === 65, 'VAPID key created once and kept');

r = await call('/alerts/subscribe', { subscription: B.sub, query: 'x' });
check(r.status === 400, 'too-short query rejected');
r = await call('/alerts/subscribe', { subscription: B.sub, query: 'Carhartt Detroit Jacket' }, { origin: 'https://evil.example' });
check(r.status === 403, 'foreign site cannot create alerts');
r = await call('/alerts/subscribe', { subscription: B.sub, query: 'Carhartt Detroit Jacket', maxPrice: 80 });
const a1 = await r.json();
check(r.status === 201 && a1.id, 'alert created');
r = await call('/alerts/mine', { endpoint: B.sub.endpoint });
let mine = (await r.json()).items;
check(mine.length === 1 && mine[0].maxPrice === 80 && mine[0].query === 'Carhartt Detroit Jacket', 'device sees its alert');
r = await call('/alerts/mine', { endpoint: 'https://fcm.googleapis.com/fcm/send/other' });
check((await r.json()).items.length === 0, 'other devices see nothing');
for (let i = 1; i < MAX_ALERTS_PER_DEVICE; i++) await call('/alerts/subscribe', { subscription: B.sub, query: `search ${i}` });
r = await call('/alerts/subscribe', { subscription: B.sub, query: 'one too many' });
check(r.status === 429, `max ${MAX_ALERTS_PER_DEVICE} alerts per device`);
mine = (await (await call('/alerts/mine', { endpoint: B.sub.endpoint })).json()).items;
for (const m of mine.filter((m) => m.id !== a1.id)) await call('/alerts/delete', { endpoint: B.sub.endpoint, id: m.id });
r = await call('/alerts/delete', { endpoint: 'https://fcm.googleapis.com/fcm/send/other', id: a1.id });
check(r.status === 404, 'nobody else can delete your alert');
check((await (await call('/alerts/mine', { endpoint: B.sub.endpoint })).json()).items.length === 1, 'delete works');

/* scheduled eBay check with a mocked network */
let listings = [
  { itemId: 'v1|111|0', title: 'Carhartt Detroit Jacket Brown M', price: { value: '75.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.de/itm/111', image: { imageUrl: 'https://i.ebayimg.com/1.jpg' } },
  { itemId: 'v1|222|0', title: 'Carhartt Detroit Jacket Black L', price: { value: '60.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.de/itm/222' },
];
const pushes = []; const calls = { token: 0, search: 0 }; let pushStatus = 201;
const fetchImpl = async (url, opts = {}) => {
  if (url.includes('/oauth2/token')) { calls.token++; check(opts.headers.authorization === `Basic ${btoa('id:secret')}`, 'eBay app token via client credentials'); return new Response(JSON.stringify({ access_token: 'T', expires_in: 7200 })); }
  if (url.includes('/item_summary/search')) {
    calls.search++;
    const u = new URL(url);
    if (calls.search === 1) check(u.searchParams.get('sort') === 'newlyListed' && u.searchParams.get('filter').includes('price:[..80]') && opts.headers['x-ebay-c-marketplace-id'] === 'EBAY_DE', 'eBay query: newest first, max price, eBay.de');
    return new Response(JSON.stringify({ itemSummaries: listings }));
  }
  if (url.startsWith('https://fcm.googleapis.com/')) { pushes.push({ url, opts }); return new Response('', { status: pushStatus }); }
  throw new Error(`unexpected fetch ${url}`);
};
let t = Date.now();
let rep = await runAlerts(env, { fetchImpl, now: t });
check(rep.checked === 1 && pushes.length === 0, 'first check = baseline, no notification spam');
rep = await runAlerts(env, { fetchImpl, now: t + 5 * 60_000 });
check(rep.checked === 0, 'not checked again before its interval');
listings = [{ itemId: 'v1|333|0', title: 'Carhartt Detroit Jacket Navy M', price: { value: '70.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.de/itm/333', image: { imageUrl: 'https://i.ebayimg.com/3.jpg' } },
  { itemId: 'v1|444|0', title: 'Carhartt Detroit Jacket — too expensive', price: { value: '150.00', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.de/itm/444' }, ...listings];
t += 61 * 60_000;
rep = await runAlerts(env, { fetchImpl, now: t });
check(rep.notified === 1 && pushes.length === 1, 'new listing → one push');
check(calls.token === 1, 'eBay token cached between runs');
const p = pushes[0];
check(p.opts.headers['content-encoding'] === 'aes128gcm' && p.opts.headers.authorization.startsWith('vapid t='), 'push is encrypted + VAPID-signed');
const msg = await B.decrypt(new Uint8Array(p.opts.body));
check(msg.title === 'New on eBay: Carhartt Detroit Jacket' && msg.body.includes('Navy') && msg.body.includes('70') && msg.url === 'https://www.ebay.de/itm/333', `push content: ${msg.title} / ${msg.body}`);
check(!msg.body.includes('too expensive'), 'over-limit listing ignored');
t += 61 * 60_000;
rep = await runAlerts(env, { fetchImpl, now: t });
check(rep.notified === 0 && pushes.length === 1, 'same listings → no repeat notification');
listings = [{ itemId: 'v1|555|0', title: 'Carhartt Detroit Jacket Olive S', price: { value: '50', currency: 'EUR' }, itemWebUrl: 'https://www.ebay.de/itm/555' }, ...listings];
pushStatus = 410; t += 61 * 60_000;
rep = await runAlerts(env, { fetchImpl, now: t });
check(rep.gone === 1, 'unsubscribed phone (410) → alert switched off');
check((await (await call('/alerts/mine', { endpoint: B.sub.endpoint })).json()).items.length === 0, 'gone alerts no longer listed');

rep = await runAlerts({ ...env, EBAY_CLIENT_ID: '' }, { fetchImpl, now: t + 1e8 });
check(rep.checked === 0, 'without eBay keys the job does nothing (no errors)');

console.log(`✓ alerts: ${n} checks passed`);
