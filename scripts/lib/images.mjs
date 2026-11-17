// Image helpers: responsive srcset for placeholder images (picsum),
// base-path handling for local uploads, lazy loading everywhere.

import fs from 'node:fs';
import path from 'node:path';

const PICSUM = /^https:\/\/picsum\.photos\/seed\/([^/]+)\/(\d+)\/(\d+)(\?.*)?$/;

// Local uploads: real pixel size (from the JPEG/PNG header) + responsive variants (name.w800.jpg, name.w1400.jpg).
const media = new Map(); // public URL (with base) → { w, h, variants: [[url, w], …] }
function jpegSize(buf) {
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
export function indexMedia(dir, publicBase) {
  media.clear();
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      if (!/\.(jpe?g|png)$/i.test(f.name) || /\.w\d+\.(jpe?g|png)$/i.test(f.name)) continue;
      const size = jpegSize(fs.readFileSync(full));
      if (!size) continue;
      const url = publicBase + path.relative(dir, full).split(path.sep).join('/');
      const stem = f.name.replace(/\.(jpe?g|png)$/i, '');
      const variants = fs.readdirSync(d)
        .filter((v) => v.startsWith(`${stem}.w`))
        .map((v) => { const m = v.match(/\.w(\d+)\.(jpe?g|png)$/i); return m ? [url.replace(/[^/]+$/, v), Number(m[1])] : null; })
        .filter(Boolean);
      const info = { url, w: size[0], h: size[1], variants: [...variants, [url, size[0]]].sort((a, b) => a[1] - b[1]) };
      media.set(url, info);
      media.set(`/uploads/${path.relative(dir, full).split(path.sep).join('/')}`, info); // CMS-style path without base
    }
  };
  walk(dir);
  return media.size;
}
export const mediaInfo = (src) => media.get(src);

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
  const local = !m && mediaInfo(src);
  const [aw, ah] = m ? [Number(m[2]), Number(m[3])] : local ? [local.w, local.h] : [w || 1200, h || 1500];
  const attrs = [
    `src="${m ? picsumAt(src, Math.min(aw, 1200)) : local ? local.variants.find((v) => v[1] >= 1400)?.[0] || local.url : src}"`,
    `alt="${String(alt).replace(/"/g, '&quot;')}"`,
    `width="${aw}"`,
    `height="${ah}"`,
    eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"',
    'decoding="async"',
  ];
  if (local && local.variants.length > 1) {
    attrs.push(`srcset="${local.variants.map(([u, vw]) => `${u} ${vw}w`).join(', ')}"`);
    attrs.push(`sizes="${sizes}"`);
  }
  if (m) {
    const widths = [480, 800, 1200, 1800].filter((x) => x <= Math.max(aw, 800));
    attrs.push(`srcset="${widths.map((x) => `${picsumAt(src, x)} ${x}w`).join(', ')}"`);
    attrs.push(`sizes="${sizes}"`);
  }
  if (cls) attrs.push(`class="${cls}"`);
  return `<img ${attrs.join(' ')}>`;
}
