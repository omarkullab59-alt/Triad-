import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { buildPrompt, strengthFor, _reset } from '../worker/src/index.js';

const env = (ai) => ({
  ALLOWED_ORIGINS: 'https://omarkullab59-alt.github.io,http://localhost:5173',
  ALLOWED_REFERERS: 'https://omarkullab59-alt.github.io/Triad-/studio/',
  MODEL: '@cf/runwayml/stable-diffusion-v1-5-img2img', PER_MINUTE: '3', PER_DAY: '100', AI: ai,
});
const png = new Uint8Array([137, 80, 78, 71]);
const okAI = { calls: [], async run(model, input) { this.calls.push(input); return png; } };
const req = (body, { origin = 'https://omarkullab59-alt.github.io', referer = 'https://omarkullab59-alt.github.io/Triad-/studio/#/draw', ip = '1.1.1.1' } = {}) =>
  new Request('https://w.example/render', { method: 'POST', headers: { origin, referer, 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const img = 'data:image/jpeg;base64,' + btoa('fake-jpeg-bytes');

test('renders a sketch and returns a PNG', async () => {
  _reset();
  const res = await worker.fetch(req({ image: img, style: 'gold', closeness: 1 }), env(okAI));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const input = okAI.calls.at(-1);
  assert.match(input.prompt, /18k yellow gold/);
  assert.equal(input.strength, 0.32);
});

test('only our own pages may call it', async () => {
  _reset();
  assert.equal((await worker.fetch(req({ image: img }, { origin: 'https://evil.example' }), env(okAI))).status, 403);
  assert.equal((await worker.fetch(req({ image: img }, { referer: 'https://omarkullab59-alt.github.io/other-repo/' }), env(okAI))).status, 403);
  assert.equal((await worker.fetch(req({ image: img }, { referer: 'https://omarkullab59-alt.github.io/' }), env(okAI))).status, 200);
});

test('rate limit per IP', async () => {
  _reset();
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await worker.fetch(req({ image: img }, { ip: '9.9.9.9' }), env(okAI))).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  assert.equal((await worker.fetch(req({ image: img }, { ip: '8.8.8.8' }), env(okAI))).status, 200);
});

test('used-up free allocation becomes a friendly "quota" error', async () => {
  _reset();
  const res = await worker.fetch(req({ image: img }), env({ run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } }));
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'quota');
});

test('bad input is refused; prompts are cleaned', async () => {
  _reset();
  assert.equal((await worker.fetch(req({ image: 'data:image/jpeg;base64,***' }), env(okAI))).status, 413);
  assert.equal((await worker.fetch(req({}), env(okAI))).status, 413);
  assert.doesNotMatch(buildPrompt('silver', '<script>alert(1)</script>'), /[<>()]/);
  assert.equal(strengthFor(0), 0.82);
});
