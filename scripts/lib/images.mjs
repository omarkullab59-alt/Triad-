// Image helpers: responsive srcset for placeholder images (picsum),
// base-path handling for local uploads, lazy loading everywhere.

const PICSUM = /^https:\/\/picsum\.photos\/seed\/([^/]+)\/(\d+)\/(\d+)(\?.*)?$/;

export function resolveImage(src, ctx) {
  if (!src) return '';
  if (/^https?:\/\//.test(src) || src.startsWith('data:')) return src;
  return ctx.url(src);
}

function picsumAt(src, w) {
  const m = src.match(PICSUM);
  if (!m) return src;
  const [, seed, ow, oh, q = ''] = m;
  const h = Math.round((Number(oh) / Number(ow)) * w);
  return `https://picsum.photos/seed/${seed}/${w}/${h}${q}`;
}

export function aspect(src, fallbackW = 4, fallbackH = 5) {
  const m = src && src.match(PICSUM);
  return m ? [Number(m[2]), Number(m[3])] : [fallbackW, fallbackH];
}

export function imgTag({ src, alt = '', sizes = '100vw', cls = '', eager = false, w, h }) {
  const m = src.match(PICSUM);
  const [aw, ah] = m ? [Number(m[2]), Number(m[3])] : [w || 1200, h || 1500];
  const attrs = [
    `src="${m ? picsumAt(src, Math.min(aw, 1200)) : src}"`,
    `alt="${String(alt).replace(/"/g, '&quot;')}"`,
    `width="${aw}"`,
    `height="${ah}"`,
    eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
  ];
  if (m) {
    const widths = [480, 800, 1200, 1800].filter((x) => x <= Math.max(aw, 800));
    attrs.push(`srcset="${widths.map((x) => `${picsumAt(src, x)} ${x}w`).join(', ')}"`);
    attrs.push(`sizes="${sizes}"`);
  }
  if (cls) attrs.push(`class="${cls}"`);
  return `<img ${attrs.join(' ')}>`;
}
