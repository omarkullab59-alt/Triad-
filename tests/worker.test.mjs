// Unit tests for the Finder AI worker with a mocked Anthropic API.  node tests/worker.test.mjs
import assert from 'node:assert/strict';
import worker from '../worker/finder-ai/src/index.js';

const ORIGIN = 'https://omarkullab59-alt.github.io';
const env = { ANTHROPIC_API_KEY: 'test-key', ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4321` };
let lastUpstream = null;
globalThis.fetch = async (url, init) => {
  lastUpstream = { url, init, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'search_terms', input: {
    item: 'leather biker jacket', brand: null, brandConfidence: 0, color: 'black', material: 'leather', era: '90s',
    details: ['double zip', '<script>'], queryDe: 'schwarze Lederjacke 90er', queryEn: 'black leather biker jacket 90s',
    alternatives: ['vintage biker jacket', 'leather moto jacket', 'black leather jacket', 'extra one'], note: 'Black leather biker jacket, no visible label.', confidence: 0.82 } }] }), { status: 200 });
};
const req = (body, origin = ORIGIN, method = 'POST', path = '/analyze') =>
  new Request(`https://w.example${path}`, { method, headers: { origin, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });

let r = await worker.fetch(req(null, ORIGIN, 'OPTIONS'), env);
assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);

r = await worker.fetch(req({ text: 'jacke' }, 'https://evil.example'), env);
assert.equal(r.status, 403, 'foreign origin blocked');

r = await worker.fetch(req({}), env);
assert.equal(r.status, 400, 'empty input rejected');

r = await worker.fetch(req({ text: 'x' }), { ...env, ANTHROPIC_API_KEY: '' });
assert.equal(r.status, 503, 'missing key → not configured');

r = await worker.fetch(req({ image: 'A'.repeat(2_100_000) }), env);
assert.equal(r.status, 413, 'oversized image rejected');

r = await worker.fetch(req({ text: 'schwarze lederjacke 90er', image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }), env);
assert.equal(r.status, 200);
const out = await r.json();
assert.equal(out.queryEn, 'black leather biker jacket 90s');
assert.equal(out.alternatives.length, 3, 'max 3 alternatives');
assert.ok(!out.details.some((d) => d.includes('<')), 'html stripped');
assert.equal(lastUpstream.init.headers['x-api-key'], 'test-key');
assert.equal(lastUpstream.body.tool_choice.name, 'search_terms');
assert.equal(lastUpstream.body.messages[0].content[0].type, 'image');
assert.equal(lastUpstream.body.messages[0].content[0].source.data, '/9j/4AAQSkZJRg==', 'data: prefix stripped');

const limited = { ...env, LIMITER: { limit: async () => ({ success: false }) } };
r = await worker.fetch(req({ text: 'x' }), limited);
assert.equal(r.status, 429, 'rate limit respected');

console.log('worker tests: all 11 checks passed');
