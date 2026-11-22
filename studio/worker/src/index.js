// TRIAD Studio AI — Cloudflare Worker (free plan)
//
//   POST /render  { image: "data:image/jpeg;base64,…" (sketch, ≤ 512 px), style, prompt?, closeness 0..1, seed? }
//                 → image/png (the jewellery render)
//   GET  /health  → { ok, model }
//
// Privacy: nothing is stored. The sketch is only passed to Workers AI and the answer streamed back.
// Cloudflare does not use Workers AI inputs or outputs to train models.
// Protection: own-domain only (Origin + Referer), rate limit per IP, size limits, friendly "quota" error.

export const STYLES = {
  silver: 'polished sterling silver 925',
  chrome: 'mirror-polished chrome, high reflections',
  gold: 'polished 18k yellow gold',
  lime: 'brushed silver with glossy lime green enamel inlay (#C4EF2F)',
  frost: 'frosted matte silver with icy texture, misty Icelandic landscape background, cold blue light',
  skin: 'silver piece worn on skin, close-up on a hand or neck, soft natural light',
};
const BASE = 'professional jewellery product photo, single piece of fine jewellery, studio lighting, soft shadows, cool foggy grey background, sharp focus, high detail, macro';
const NEGATIVE = 'text, watermark, logo, letters, blurry, lowres, deformed, extra objects, cartoon, drawing, sketch lines, paper, pencil, people faces, nsfw';

const MAX_IMAGE_B64 = 600_000; // ≈ 450 KB
const MAX_PROMPT = 120;

const list = (s, fallback = '') => (s || fallback).split(',').map((x) => x.trim()).filter(Boolean);

export function cors(origin, env) {
  const allowed = list(env.ALLOWED_ORIGINS);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

export function allowedCaller(request, env) {
  const origin = request.headers.get('origin') || '';
  if (!list(env.ALLOWED_ORIGINS).includes(origin)) return false;
  const refs = list(env.ALLOWED_REFERERS);
  if (!refs.length) return true;
  const ref = request.headers.get('referer') || '';
  // The Studio sends its full page address (referrerPolicy). Browsers that strip it to "https://host/" are let through,
  // because the Origin check above already passed.
  return refs.some((r) => ref.startsWith(r)) || ref === `${origin}/`;
}

// Best-effort per-instance limits (the LIMITER binding is the real, global one).
const minute = new Map();
const day = new Map();
export function localLimit(ip, perMinute, perDay) {
  const now = Date.now();
  const m = (minute.get(ip) || []).filter((t) => now - t < 60_000);
  m.push(now); minute.set(ip, m);
  const today = new Date().toISOString().slice(0, 10);
  const d = day.get(ip);
  const count = d?.day === today ? d.n + 1 : 1;
  day.set(ip, { day: today, n: count });
  if (minute.size > 5000) minute.clear();
  if (day.size > 20000) day.clear();
  return m.length > perMinute || count > perDay;
}
export const _reset = () => { minute.clear(); day.clear(); };

export function buildPrompt(style, extra) {
  const s = STYLES[style] || STYLES.silver;
  const e = typeof extra === 'string' ? extra.replace(/[^\p{L}\p{N} ,.'#-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT) : '';
  return `${BASE}, ${s}${e ? `, ${e}` : ''}`;
}
/** closeness 1 = keep my lines (low strength), 0 = free interpretation (high strength) */
export const strengthFor = (closeness) => {
  const c = Math.min(1, Math.max(0, Number.isFinite(Number(closeness)) ? Number(closeness) : 0.6));
  return Math.round((0.32 + (1 - c) * 0.5) * 100) / 100;
};

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const isQuota = (e) => /4006|daily free allocation|neurons|quota|capacity|429/i.test(String(e?.message || e));

async function runModel(env, input, bytes) {
  try {
    return await env.AI.run(env.MODEL, input);
  } catch (e) {
    if (isQuota(e)) throw e;
    // older schema: image as byte array
    const { image_b64, ...rest } = input;
    return env.AI.run(env.MODEL, { ...rest, image: [...bytes] });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const h = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain' } });
    if (url.pathname === '/health') return json({ ok: true, model: env.MODEL, ai: Boolean(env.AI) }, 200, h);
    if (url.pathname !== '/render' || request.method !== 'POST') return json({ error: 'not_found' }, 404, h);

    if (!allowedCaller(request, env)) return json({ error: 'origin_not_allowed' }, 403, h);
    if (!env.AI) return json({ error: 'not_configured' }, 503, h);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (env.LIMITER) {
      try { const { success } = await env.LIMITER.limit({ key: ip }); if (!success) return json({ error: 'rate_limited' }, 429, { ...h, 'retry-after': '20' }); }
      catch { /* binding unavailable: fall back to the local limit */ }
    }
    if (localLimit(ip, Number(env.PER_MINUTE) || 8, Number(env.PER_DAY) || 120)) return json({ error: 'rate_limited' }, 429, { ...h, 'retry-after': '20' });

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, h); }
    const b64 = typeof body.image === 'string' ? body.image.replace(/^data:image\/(jpeg|png|webp);base64,/, '') : '';
    if (!b64 || b64.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) return json({ error: 'image_invalid' }, 413, h);
    let bytes;
    try { bytes = b64ToBytes(b64); } catch { return json({ error: 'image_invalid' }, 413, h); }

    const input = {
      prompt: buildPrompt(body.style, body.prompt),
      negative_prompt: NEGATIVE,
      image_b64: b64,
      strength: strengthFor(body.closeness),
      guidance: 7.5,
      num_steps: 20,
      width: 512,
      height: 512,
    };
    if (Number.isInteger(body.seed) && body.seed >= 0) input.seed = body.seed % 4294967295;

    try {
      const out = await runModel(env, input, bytes);
      const headers = { ...h, 'content-type': 'image/png', 'cache-control': 'no-store', 'x-robots-tag': 'noai, noimageai' };
      if (out instanceof ReadableStream || out instanceof Uint8Array || out instanceof ArrayBuffer) return new Response(out, { status: 200, headers });
      if (typeof out?.image === 'string') return new Response(b64ToBytes(out.image), { status: 200, headers });
      return json({ error: 'no_result' }, 502, h);
    } catch (e) {
      if (isQuota(e)) return json({ error: 'quota' }, 429, h);
      return json({ error: 'ai_unavailable' }, 502, h);
    }
  },
};
