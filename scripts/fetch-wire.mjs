#!/usr/bin/env node
// TRIAD Wire — pulls headlines from public RSS/Atom feeds (no API keys) into content/wire.json.
// Only headline, source, date and link are stored: no foreign body text, no foreign images.
// Sources are managed in content/sources.json (editable in the CMS).
//
//   node scripts/fetch-wire.mjs            → writes content/wire.json and prints a report

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'content/sources.json');
const OUT = path.join(ROOT, 'content/wire.json');
const MAX_AGE_DAYS = 21;
const PER_SOURCE = 8;
const TOTAL = 80;

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? alt[1] : '';
    }
    if (!link) link = decode(tag(b, 'guid'));
    const date = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const d = new Date(date);
    if (title && /^https?:\/\//.test(link)) items.push({ title, link, date: isNaN(d) ? null : d.toISOString() });
  }
  return items;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'TRIAD-Wire/1.0 (+https://omarkullab59-alt.github.io/Triad-/; headline aggregator)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  const sources = (Array.isArray(raw) ? raw : raw.items || []).filter((s) => s.active !== false && s.url);
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const all = [];
  const report = [];

  await Promise.all(
    sources.map(async (s) => {
      try {
        const items = parseFeed(await fetchText(s.url))
          .filter((i) => !i.date || new Date(i.date).getTime() > cutoff)
          .slice(0, PER_SOURCE)
          .map((i) => ({ ...i, source: s.name, topic: s.topic || 'Culture' }));
        all.push(...items);
        report.push(`OK    ${s.name.padEnd(22)} ${String(items.length).padStart(2)} items  ${s.url}`);
      } catch (e) {
        report.push(`FAIL  ${s.name.padEnd(22)} ${e.name === 'AbortError' ? 'timeout' : e.message}  ${s.url}`);
      }
    })
  );

  const seen = new Set();
  const wire = all
    .filter((i) => (seen.has(i.link) ? false : seen.add(i.link)))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, TOTAL);

  console.log('TRIAD Wire — feed report\n' + report.sort().join('\n'));
  if (wire.length) {
    fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), items: wire }, null, 1));
    console.log(`→ ${wire.length} headlines written to content/wire.json`);
  } else {
    console.log('→ no headlines fetched; keeping previous wire.json (if any)');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
