// Unit tests for the Finder AI worker (Workers AI + optional Anthropic), all upstreams mocked.
//   node tests/worker.test.mjs
import assert from 'node:assert/strict';
import worker, { extractJson } from '../worker/finder-ai/src/index.js';

const ORIGIN = 'https://omarkullab59-alt.github.io';
const RESULT = {
  item: 'leather biker jacket', brand: null, brandConfidence: 0, color: 'black', material: 'leather', era: '90s',
  details: ['double zip', '<script>'], queryDe: 'schwarze Lederjacke 90er', queryEn: 'black leather biker jacket 90s',
  alternatives: ['vintage biker jacket', 'leather moto jacket', 'black leather jacket', 'extra one'],
  note: 'Black leather biker jacket, no visible label.', confidence: 0.82,
};
let calls = [];
const AI = (behaviour = 'ok') => ({
  async run(model, input) {
    calls.push({ model, input });
    if (behaviour === 'quota') throw new Error('4006: you have used up your daily free allocation of 10,000 neurons');
    if (behaviour === 'first-fails' && calls.length === 1) throw new Error('unsupported content type');
    return { response: 'Here you go:\n```json\n' + JSON.stringify(RESULT) + '\n```' };
  },
});
const env = (ai = AI()) => ({ AI: ai, ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4321` });
let ipN = 0;
const req = (body, origin = ORIGIN, method = 'POST', path = '/analyze') =>
  new Request(`https://w.example${path}`, { method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': `10.0.0.${++ipN}` }, body: method === 'POST' ? JSON.stringify(body) : undefined });

let n = 0;
const check = (cond, msg) => { assert.ok(cond, msg); n++; };

let r = await worker.fetch(req(null, ORIGIN, 'OPTIONS'), env());
check(r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGIN, 'CORS preflight');

r = await worker.fetch(req({ text: 'jacke' }, 'https://evil.example'), env());
check(r.status === 403, 'foreign origin blocked');

r = await worker.fetch(req({}), env());
check(r.status === 400, 'empty input rejected');

r = await worker.fetch(req({ text: 'x' }), { ALLOWED_ORIGINS: ORIGIN });
check(r.status === 503, 'no AI binding → not configured');

r = await worker.fetch(req({ image: 'A'.repeat(2_100_000) }), env());
check(r.status === 413, 'oversized image rejected');

calls = [];
r = await worker.fetch(req({ text: 'schwarze lederjacke 90er', image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }), env());
let out = await r.json();
check(r.status === 200 && out.queryEn === 'black leather biker jacket 90s', 'Workers AI result parsed from fenced JSON');
check(out.alternatives.length === 3 && !out.details.some((d) => d.includes('<')), 'limits + html stripped');
check(calls[0].model === '@cf/mistralai/mistral-small-3.1-24b-instruct', 'default model is Mistral Small 3.1');
check(calls[0].input.messages[0].content[1].image_url.url.startsWith('data:image/jpeg;base64,/9j/'), 'image sent as data URI');

calls = [];
r = await worker.fetch(req({ text: 'boots', image: '/9j/4AAQ' }), env(AI('first-fails')));
check(r.status === 200 && calls.length === 2 && calls[1].input.image.startsWith('data:image/jpeg'), 'falls back to image field format');

r = await worker.fetch(req({ text: 'boots' }), env(AI('quota')));
out = await r.json();
check(r.status === 429 && out.error === 'rate_limited', 'free allocation exhausted → graceful 429');

// per-IP limit
const sameIp = () => new Request('https://w.example/analyze', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' }, body: JSON.stringify({ text: 'x' }) });
let last;
for (let i = 0; i < 11; i++) last = await worker.fetch(sameIp(), env());
check(last.status === 429, 'per-IP rate limit (10/min)');

// optional Anthropic provider
globalThis.fetch = async (url, init) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(RESULT) }] }), { status: 200 });
r = await worker.fetch(req({ text: 'jacket' }), { ALLOWED_ORIGINS: ORIGIN, PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' });
out = await r.json();
check(r.status === 200 && out.queryDe === 'schwarze Lederjacke 90er', 'Anthropic provider works when configured');

check(extractJson('no json here') === null && extractJson('{"a":1}').a === 1, 'JSON extraction');

console.log(`worker tests: all ${n} checks passed`);
