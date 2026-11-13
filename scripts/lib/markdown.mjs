// Small editorial Markdown renderer (no dependencies).
// Blocks: ## / ### headings, paragraphs, > pull quotes, - lists, --- breaks,
// standalone images (figures), and :::gallery fenced galleries.

import { resolveImage, imgTag } from './images.mjs';

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(text, ctx) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
    const ext = /^https?:/.test(href);
    const url = ext ? href : ctx.url(href);
    return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  return s;
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;

export function renderMarkdown(md, ctx) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];
  let list = null;
  let figIndex = 0;

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '), ctx)}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`<ul>${list.map((li) => `<li>${inline(li, ctx)}</li>`).join('')}</ul>`);
      list = null;
    }
  };
  const flush = () => { flushPara(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith(':::gallery')) {
      flush();
      const imgs = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(':::')) {
        const m = lines[i].trim().match(IMG_RE);
        if (m) imgs.push({ alt: m[1], src: m[2], caption: m[3] || m[1] });
        i++;
      }
      html.push(renderGallery(imgs, ctx));
      continue;
    }
    if (!line) { flush(); continue; }
    if (line === '---') {
      flush();
      html.push('<div class="art-break" aria-hidden="true"><i class="plus"></i><i class="plus"></i><i class="plus"></i></div>');
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flush();
      const tag = h[1].length === 2 ? 'h2' : 'h3';
      html.push(`<${tag} data-reveal>${inline(h[2], ctx)}</${tag}>`);
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      const q = [line.replace(/^>\s?/, '')];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i++;
        q.push(lines[i].trim().replace(/^>\s?/, ''));
      }
      const text = q.join(' ');
      const cite = text.match(/\s+—\s+([^—]+)$/);
      const body = cite ? text.slice(0, cite.index) : text;
      html.push(`<blockquote class="pullquote" data-reveal><p>${inline(body, ctx)}</p>${cite ? `<cite>— ${escapeHtml(cite[1])}</cite>` : ''}</blockquote>`);
      continue;
    }
    const img = line.match(IMG_RE);
    if (img) {
      flush();
      figIndex++;
      const src = resolveImage(img[2], ctx);
      html.push(`<figure class="art-figure ${figIndex % 2 ? 'art-figure--bleed' : 'art-figure--offset'}" data-reveal>
  <div class="frame">${imgTag({ src, alt: img[1], sizes: '100vw', w: 1800, h: 1200 })}<span class="frame-code">FIG. ${String(figIndex).padStart(2, '0')}</span></div>
  ${img[3] ? `<figcaption>${inline(img[3], ctx)}</figcaption>` : ''}
</figure>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!list) list = [];
      list.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }
    flushList();
    para.push(line);
  }
  flush();
  return html.join('\n');
}

export function renderGallery(imgs, ctx) {
  if (!imgs.length) return '';
  return `<div class="gallery gallery--${Math.min(imgs.length, 4)}" data-gallery data-reveal>
${imgs
  .map((im, n) => {
    const src = resolveImage(im.src, ctx);
    return `<figure class="gallery-item">
  <button class="frame gallery-open" type="button" data-lightbox="${escapeHtml(src)}" data-caption="${escapeHtml(im.caption || '')}" aria-label="Open image ${n + 1}: ${escapeHtml(im.alt || im.caption || '')}">
    ${imgTag({ src, alt: im.alt || '', sizes: '(max-width: 760px) 100vw, 40vw', w: 900, h: 1200 })}
    <span class="frame-code">PL. ${String(n + 1).padStart(2, '0')}</span>
  </button>
  ${im.caption ? `<figcaption>${escapeHtml(im.caption)}</figcaption>` : ''}
</figure>`;
  })
  .join('\n')}
</div>`;
}

export function wordCount(md) {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length;
}
