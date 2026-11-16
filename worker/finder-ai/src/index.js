// TRIAD Finder AI — Cloudflare Worker
// Turns a photo and/or a short description into precise second-hand search terms.
// The Anthropic API key stays here on the server (Worker secret), never in the browser.
//
// POST /analyze   { text?: string, image?: base64-jpeg (no data: prefix) }
// → { item, brand, brandConfidence, color, material, era, details[], queryDe, queryEn, alternatives[], note, confidence }

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MAX_TEXT = 400;
const MAX_IMAGE_B64 = 2_000_000; // ≈1.5 MB JPEG

const TOOL = {
  name: 'search_terms',
  description: 'Return structured second-hand marketplace search terms for the described or pictured fashion item.',
  input_schema: {
    type: 'object',
    properties: {
      item: { type: 'string', description: 'Garment or object type in English, e.g. "leather biker jacket".' },
      brand: { type: ['string', 'null'], description: 'Brand only if a logo/label is visible or the user names it; otherwise null.' },
      brandConfidence: { type: 'number', minimum: 0, maximum: 1 },
      color: { type: ['string', 'null'] },
      material: { type: ['string', 'null'] },
      era: { type: ['string', 'null'], description: 'Decade or style era if evident, e.g. "90s".' },
      details: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Distinctive searchable details (e.g. "double zip", "cropped", "distressed").' },
      queryDe: { type: 'string', description: 'Best search query for German platforms (Vinted.de, Kleinanzeigen), 2–6 words, German garment words.' },
      queryEn: { type: 'string', description: 'Best search query for English platforms (Grailed, Depop), 2–6 words.' },
      alternatives: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Up to 3 alternative English queries (broader or style-adjacent).' },
      note: { type: 'string', description: 'One short sentence in English for the user explaining what was recognised and any uncertainty.' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['item', 'queryDe', 'queryEn', 'alternatives', 'note', 'confidence'],
  },
};

const SYSTEM = `You are TRIAD's second-hand fashion search assistant.
Goal: turn a photo and/or description into search terms that find the same or similar piece on resale platforms (Vinted, Grailed, eBay, Vestiaire Collective, Depop, Kleinanzeigen, Etsy).
Rules:
- Describe only clothing, shoes, bags and accessories. Never identify, name or describe people, faces or bodies.
- Name a brand only if a logo or label is clearly visible or the user states it. Otherwise brand = null. Never guess luxury brands from style alone.
- Queries are short (2–6 words), the way people actually search on resale apps: brand + item + one key detail.
- If the input is not a fashion item, set confidence to 0 and explain briefly in note.
Always answer by calling the search_terms tool.`;

const allowedOrigins = (env) => (env.ALLOWED_ORIGINS || 'https://omarkullab59-alt.github.io,http://localhost:4321').split(',').map((s) => s.trim());

function cors(origin, env) {
  const allowed = allowedOrigins(env);
  const ok = allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin : allowed[0],
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const h = cors(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health') return json({ ok: true, model: env.MODEL || DEFAULT_MODEL }, 200, h);
    if (url.pathname !== '/analyze' || request.method !== 'POST') return json({ error: 'not_found' }, 404, h);
    if (!allowedOrigins(env).includes(origin)) return json({ error: 'origin_not_allowed' }, 403, h);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503, h);

    // Per-IP rate limit (Cloudflare Rate Limiting binding, optional)
    if (env.LIMITER) {
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'rate_limited' }, 429, h);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400, h);
    }
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : '';
    const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : '';
    if (!text && !image) return json({ error: 'empty' }, 400, h);
    if (image && (image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))) return json({ error: 'image_invalid' }, 413, h);

    const content = [];
    if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
    content.push({ type: 'text', text: text ? `User description: ${text}` : 'Find this piece second-hand.' });

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL,
          max_tokens: 600,
          system: SYSTEM,
          tools: [TOOL],
          tool_choice: { type: 'tool', name: 'search_terms' },
          messages: [{ role: 'user', content }],
        }),
      });
    } catch {
      return json({ error: 'upstream_unreachable' }, 502, h);
    }
    if (!res.ok) {
      const status = res.status === 429 ? 429 : 502;
      return json({ error: status === 429 ? 'rate_limited' : 'upstream_error', upstreamStatus: res.status }, status, h);
    }
    const data = await res.json();
    const tool = (data.content || []).find((c) => c.type === 'tool_use' && c.name === 'search_terms');
    if (!tool) return json({ error: 'no_result' }, 502, h);

    const r = tool.input || {};
    const clean = (s, n = 80) => (typeof s === 'string' ? s.replace(/[<>]/g, '').trim().slice(0, n) : null);
    return json(
      {
        item: clean(r.item),
        brand: clean(r.brand),
        brandConfidence: Number(r.brandConfidence) || 0,
        color: clean(r.color),
        material: clean(r.material),
        era: clean(r.era),
        details: (r.details || []).map((d) => clean(d, 40)).filter(Boolean).slice(0, 5),
        queryDe: clean(r.queryDe) || clean(r.queryEn),
        queryEn: clean(r.queryEn) || clean(r.queryDe),
        alternatives: (r.alternatives || []).map((a) => clean(a)).filter(Boolean).slice(0, 3),
        note: clean(r.note, 240),
        confidence: Number(r.confidence) || 0,
      },
      200,
      h
    );
  },
};
