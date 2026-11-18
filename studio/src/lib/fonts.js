// Fonts for engravings, lettering and symbols: TRIAD fonts, rough/gothic display fonts,
// scripts from all over the world (loaded only when used) and the user's own font files.
import * as db from './db.js';

// [family, label, Google Fonts query]  (no query = already loaded by the page)
export const FONTS = [
  ['Inter Tight', 'Clean · Inter Tight', null],
  ['Anton', 'Bold condensed · Anton', null],
  ['Instrument Serif', 'Serif · Instrument', null],
  ['JetBrains Mono', 'Mono · JetBrains', null],
  ['UnifrakturMaguntia', 'Gothic blackletter', 'UnifrakturMaguntia'],
  ['Pirata One', 'Gothic display', 'Pirata+One'],
  ['Rubik Glitch', 'Glitch (broken)', 'Rubik+Glitch'],
  ['Rubik Wet Paint', 'Dripping', 'Rubik+Wet+Paint'],
  ['Special Elite', 'Typewriter (rough)', 'Special+Elite'],
  ['Permanent Marker', 'Marker (hand)', 'Permanent+Marker'],
  ['Noto Sans JP', '日本語 · Japanese', 'Noto+Sans+JP:wght@700'],
  ['Noto Naskh Arabic', 'العربية · Arabic Naskh', 'Noto+Naskh+Arabic:wght@700'],
  ['Reem Kufi', 'العربية · Arabic Kufi', 'Reem+Kufi:wght@700'],
  ['Noto Sans', 'Русский · Ελληνικά · Latin', 'Noto+Sans:wght@700'],
  ['Ruslan Display', 'Русский · Display', 'Ruslan+Display'],
  ['Noto Sans SC', '中文 · Chinese', 'Noto+Sans+SC:wght@700'],
  ['Noto Sans KR', '한국어 · Korean', 'Noto+Sans+KR:wght@700'],
  ['Noto Sans Hebrew', 'עברית · Hebrew', 'Noto+Sans+Hebrew:wght@700'],
  ['Noto Sans Devanagari', 'हिन्दी · Hindi', 'Noto+Sans+Devanagari:wght@700'],
  ['Noto Sans Thai', 'ไทย · Thai', 'Noto+Sans+Thai:wght@700'],
  ['Noto Sans Armenian', 'Հայերեն · Armenian', 'Noto+Sans+Armenian:wght@700'],
  ['Noto Sans Georgian', 'ქართული · Georgian', 'Noto+Sans+Georgian:wght@700'],
];

// Script → fallback font, so text in any language renders even in a Latin-only font.
const SCRIPTS = [
  [/[぀-ヿㇰ-ㇿ]/, 'Noto Sans JP'],
  [/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/, 'Noto Naskh Arabic'],
  [/[가-힯ᄀ-ᇿ]/, 'Noto Sans KR'],
  [/[一-鿿㐀-䶿]/, 'Noto Sans SC'],
  [/[Ѐ-ӿͰ-Ͽ]/, 'Noto Sans'],
  [/[֐-׿]/, 'Noto Sans Hebrew'],
  [/[ऀ-ॿ]/, 'Noto Sans Devanagari'],
  [/[฀-๿]/, 'Noto Sans Thai'],
  [/[԰-֏]/, 'Noto Sans Armenian'],
  [/[Ⴀ-ჿ]/, 'Noto Sans Georgian'],
];
export const isRTL = (t) => /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(t || '');

const custom = new Map(); // family → label (user uploads)
const loaded = new Set(['Inter Tight', 'Anton', 'Instrument Serif', 'JetBrains Mono']);

export function fontOptions() {
  return [...FONTS.map(([f, l]) => [f, l]), ...[...custom].map(([f, l]) => [f, `★ ${l} (yours)`])];
}

function cssLoad(query) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve();
    const href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return resolve();
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = l.onerror = () => resolve();
    document.head.append(l);
  });
}

/** Make sure `family` (and fallbacks for every script in `text`) can be drawn on a canvas. */
export async function ensureFont(family, text = '') {
  if (typeof document === 'undefined') return;
  const needed = new Set([family]);
  for (const [re, f] of SCRIPTS) if (re.test(text)) needed.add(f);
  await Promise.all([...needed].map(async (f) => {
    const q = FONTS.find(([n]) => n === f)?.[2];
    if (q && !loaded.has(f)) { await cssLoad(q); loaded.add(f); }
    try { await document.fonts.load(`700 48px "${f}"`, text || 'Aa'); } catch { /* fallback */ }
  }));
}

/** Canvas font string with script fallbacks. */
export function fontStack(family, px, text = '') {
  const fall = SCRIPTS.filter(([re]) => re.test(text)).map(([, f]) => `"${f}"`);
  return `700 ${px}px "${family}", ${fall.length ? `${fall.join(', ')}, ` : ''}"Inter Tight", Arial, sans-serif`;
}

/** Upload a TTF/OTF/WOFF(2). Kept on this device (IndexedDB). */
export async function addFontFile(file) {
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || file.size > 15e6) throw new Error('Please choose a .ttf, .otf, .woff or .woff2 file (max 15 MB).');
  const data = await file.arrayBuffer();
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').slice(0, 40);
  const family = `Studio ${label}`;
  const face = new FontFace(family, data);
  await face.load();
  document.fonts.add(face);
  custom.set(family, label);
  loaded.add(family);
  await db.put('fonts', family, { label, data });
  return family;
}
export async function removeFont(family) { custom.delete(family); await db.del('fonts', family); }
export const customFonts = () => [...custom].map(([family, label]) => ({ family, label }));

let initP = null;
/** Load the user's saved fonts once. */
export function initFonts() {
  if (initP || typeof document === 'undefined') return initP || Promise.resolve();
  initP = db.all('fonts').then(async (rows) => {
    for (const { key, value } of rows) {
      try { const face = new FontFace(key, value.data); await face.load(); document.fonts.add(face); custom.set(key, value.label); loaded.add(key); } catch { /* broken file */ }
    }
  });
  return initP;
}
