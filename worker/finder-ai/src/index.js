// TRIAD Finder AI — Cloudflare Worker
// Turns a photo and/or a short description into precise second-hand search terms.
//
// Default provider: Cloudflare Workers AI (free daily allocation, no credit card)
//   with Mistral Small 3.1 (open model, vision, usable in the EU).
// Optional provider: Anthropic Claude (set PROVIDER="anthropic" + ANTHROPIC_API_KEY secret).
//
// Darkroom (photographers' uploads + reactions): see darkroom.js — routes under /darkroom/
//
// POST /analyze   { text?: string, image?: base64-jpeg (no data: prefix) }
// → { item, brand, brandConfidence, color, material, era, details[], queryDe, queryEn, alternatives[], note, confidence }

import { handleDarkroom } from './darkroom.js';
import { handleAlerts, runAlerts } from './alerts.js';

export const AI_BOTS = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'CCBot', 'Google-Extended', 'Applebot-Extended',
  'Bytespider', 'PerplexityBot', 'meta-externalagent', 'FacebookBot', 'Amazonbot', 'cohere-ai', 'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Timpibot', 'img2dataset'];
const AI_ROBOTS = `${AI_BOTS.map((b) => `User-agent: ${b}`).join('\n')}\nDisallow: /\n\nUser-agent: *\nDisallow: /darkroom/admin/\n`;

const WORKERS_AI_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const MAX_TEXT = 400;
const MAX_IMAGE_B64 = 2_000_000; // ≈1.5 MB JPEG
const PER_MINUTE = 10; // per IP, per Worker instance (best effort)

const FIELDS = `{
  "item": string (garment/object type in English, e.g. "leather biker jacket"),
  "brand": string or null (ONLY if a logo/label is clearly visible or the user names it),
  "brandConfidence": number 0-1,
  "color": string or null,
  "material": string or null,
  "era": string or null (e.g. "90s"),
  "details": array of up to 5 short searchable details,
  "queryDe": string (best 2-6 word search for German platforms like Vinted.de/Kleinanzeigen, German garment words),
  "queryEn": string (best 2-6 word search for English platforms like Grailed/Depop),
  "alternatives": array of up to 3 alternative English searches,
  "note": string (one short English sentence for the user: what was recognised, any uncertainty),
  "confidence": number 0-1 (0 if no fashion item)
}`;

const RULES = `You are TRIAD's second-hand fashion search assistant.
Turn a photo and/or description into search terms that find the same or a similar piece on resale platforms (Vinted, Grailed, eBay, Vestiaire Collective, Depop, Kleinanzeigen, Etsy).
Rules:
- Describe only clothing, shoes, bags and accessories. Never identify, name or describe people, faces or bodies.
- Name a brand only if a logo or label is clearly visible or the user states it. Otherwise brand = null. Never guess luxury brands from style alone.
- Queries are short (2-6 words), the way people search on resale apps: brand + item + one key detail.
- If the input is not a fashion item, set confidence to 0 and explain briefly in note.`;

/* ── helpers ─────────────────────────────────────────────────── */
const allowedOrigins = (env) => (env.ALLOWED_ORIGINS || 'https://omarkullab59-alt.github.io,http://localhost:4321').split(',').map((s) => s.trim());

function cors(origin, env) {
  const allowed = allowedOrigins(env);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0],
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const hits = new Map();
function rateLimited(key, limit = PER_MINUTE) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}
export const _resetRateLimit = () => hits.clear();

export function extractJson(text) {
  if (text && typeof text === 'object') return text;
  if (typeof text !== 'string') return null;
  const s = text.replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

function sanitize(r) {
  const clean = (s, n = 80) => (typeof s === 'string' && s.trim() ? s.replace(/[<>]/g, '').trim().slice(0, n) : null);
  const num = (x) => Math.max(0, Math.min(1, Number(x) || 0));
  const list = (a, n, len) => (Array.isArray(a) ? a.map((d) => clean(d, len)).filter(Boolean).slice(0, n) : []);
  const queryEn = clean(r.queryEn) || clean(r.queryDe);
  const queryDe = clean(r.queryDe) || queryEn;
  return {
    item: clean(r.item),
    brand: clean(r.brand),
    brandConfidence: num(r.brandConfidence),
    color: clean(r.color),
    material: clean(r.material),
    era: clean(r.era),
    details: list(r.details, 5, 40),
    queryDe,
    queryEn,
    alternatives: list(r.alternatives, 3, 80),
    note: clean(r.note, 240),
    confidence: queryEn ? num(r.confidence) : 0,
  };
}

/* ── providers ───────────────────────────────────────────────── */
async function viaWorkersAI(env, text, image) {
  const instruction = `${RULES}\n\nReply with ONLY a JSON object with these fields:\n${FIELDS}\n\n${text ? `User description: ${text}` : 'Find this piece second-hand.'}`;
  const dataUri = image ? `data:image/jpeg;base64,${image}` : null;
  const model = env.MODEL || WORKERS_AI_MODEL;
  const opts = { max_tokens: 500, temperature: 0.2 };

  // Preferred: OpenAI-style multimodal message. Fallback: separate `image` field (older vision API style).
  const attempts = [
    { ...opts, messages: [{ role: 'user', content: dataUri ? [{ type: 'text', text: instruction }, { type: 'image_url', image_url: { url: dataUri } }] : instruction }] },
  ];
  if (dataUri) attempts.push({ ...opts, messages: [{ role: 'user', content: instruction }], image: dataUri });

  let lastErr;
  for (const input of attempts) {
    try {
      const out = await env.AI.run(model, input);
      const raw = out?.response ?? out?.choices?.[0]?.message?.content ?? out?.result?.response ?? out;
      const parsed = extractJson(raw);
      if (parsed) return parsed;
      lastErr = new Error('unparseable');
    } catch (e) {
      lastErr = e;
      if (/quota|neuron|allocation|429/i.test(String(e?.message))) break;
    }
  }
  throw lastErr || new Error('ai_failed');
}

async function viaAnthropic(env, text, image) {
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: `${text ? `User description: ${text}` : 'Find this piece second-hand.'}\n\nReply with ONLY a JSON object with these fields:\n${FIELDS}` });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL || ANTHROPIC_MODEL, max_tokens: 600, system: RULES, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw Object.assign(new Error('upstream ' + res.status), { status: res.status });
  const data = await res.json();
  return extractJson((data.content || []).map((c) => c.text || '').join(''));
}

/* ── handler ─────────────────────────────────────────────────── */
export default {
  // Price alerts: Cloudflare cron (wrangler.toml [triggers]) checks saved searches in small batches.
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runAlerts(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const h = cors(origin, env);
    const provider = env.PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY ? 'anthropic' : 'workers-ai';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    // No AI training on anything this Worker serves (images included)
    if (url.pathname === '/robots.txt') return new Response(AI_ROBOTS, { headers: { 'content-type': 'text/plain' } });
    if (url.pathname === '/health') return json({ ok: true, provider, darkroom: Boolean(env.DB) }, 200, h);

    if (url.pathname.startsWith('/alerts/')) {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      if (request.method === 'POST' && !allowedOrigins(env).includes(origin)) return json({ error: 'origin_not_allowed' }, 403, h);
      if (rateLimited(`al:${ip}`, 30)) return json({ error: 'rate_limited' }, 429, h);
      try {
        return await handleAlerts(request, env, url, (data, status, extra) => json(data, status, { ...h, ...extra }));
      } catch (e) {
        return json({ error: 'alerts_error' }, 500, h);
      }
    }

    if (url.pathname.startsWith('/darkroom/')) {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const write = request.method === 'POST';
      if (write && !allowedOrigins(env).includes(origin)) return json({ error: 'origin_not_allowed' }, 403, h);
      if (rateLimited(`dr:${write ? 'w' : 'r'}:${ip}`, write ? 30 : 120)) return json({ error: 'rate_limited' }, 429, h);
      try {
        return await handleDarkroom(request, env, url, (data, status, extra) => json(data, status, { ...h, ...extra }));
      } catch (e) {
        return json({ error: 'darkroom_error' }, 500, h);
      }
    }
    if (url.pathname !== '/analyze' || request.method !== 'POST') return json({ error: 'not_found' }, 404, h);
    if (!allowedOrigins(env).includes(origin)) return json({ error: 'origin_not_allowed' }, 403, h);
    if (provider === 'workers-ai' && !env.AI) return json({ error: 'not_configured' }, 503, h);
    if (rateLimited(request.headers.get('cf-connecting-ip') || 'unknown')) return json({ error: 'rate_limited' }, 429, h);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, h); }
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
    if (!text && !image) return json({ error: 'empty' }, 400, h);
    if (image && (image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))) return json({ error: 'image_invalid' }, 413, h);

    try {
      const raw = provider === 'anthropic' ? await viaAnthropic(env, text, image) : await viaWorkersAI(env, text, image);
      if (!raw) return json({ error: 'no_result' }, 502, h);
      return json(sanitize(raw), 200, h);
    } catch (e) {
      // Free daily allocation used up, or provider error → the site falls back to normal search
      const msg = String(e?.message || '');
      const quota = /quota|limit|neuron|allocation|429|capacity/i.test(msg) || e?.status === 429;
      return json({ error: quota ? 'rate_limited' : 'ai_unavailable' }, quota ? 429 : 502, h);
    }
  },
};
