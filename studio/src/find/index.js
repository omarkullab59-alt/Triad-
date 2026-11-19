// Search index for the Finder: every tool, starting point, motif, pattern, pose, font and material,
// with words for cultures, eras, styles and moods (English + German).
import { TYPES } from '../jewellery/app.js';
import { MOTIFS, MOTIF_TAGS } from '../lib/motifs.js';
import { FONTS } from '../lib/fonts.js';
import { SUBJECTS } from '../sculpt/sculpture.js';
import { COUTURE_STYLES } from '../sculpt/couture.js';
import { HOME, METALS } from '../lib/sizes.js';

const TOOL_TAGS = {
  ring: 'ring jewellery schmuck band signet siegelring wedding ehering engraving gravur', pendant: 'pendant anhänger charm necklace kette amulet',
  lettering: 'name lettering schrift text word wort calligraphy kalligrafie script language sprache', earrings: 'earrings ohrringe studs stecker hoops creolen',
  bangle: 'bangle armreif cuff bracelet armband', chain: 'chain kette necklace link glied', wearable: 'crown krone tiara diadem mask maske headpiece kopfschmuck royal costume kostüm',
  plate: 'plate teller tableware geschirr ceramic keramik dinner', vessel: 'bowl schale cup tasse mug becher vase pottery töpfern ceramic keramik',
  cutlery: 'cutlery besteck fork gabel knife messer spoon löffel', cabinet: 'cabinet schrank furniture möbel sideboard wardrobe kleiderschrank shelf regal dresser kommode',
  sculpture: 'sculpture skulptur statue figure figur art kunst bronze marble marmor pose', sketch3d: 'sketch skizze 3d relief vase turned drawing zeichnung',
  model: 'upload hochladen stl obj glb fbx 3mf blender model modell 3d file datei', couture: 'couture mask maske avant-garde avantgarde headpiece kopfschmuck runway laufsteg fashion mode high fashion editorial face gesicht veil schleier',
  draw: 'draw zeichnen sketch skizze ai ki render',
  garment: 'clothing kleidung garment hoodie t-shirt tee shirt jacket jacke coat mantel trousers hose pants shorts skirt rock tech pack schnitt flats fashion mode avantgarde drop crotch',
  belt: 'belt gürtel buckle schnalle leather leder accessory accessoire',
  hat: 'hat hut mütze beanie cap kappe bucket hat fischerhut balaclava sturmhaube knit strick headwear',
  tape: 'tape band absperrband barrier caution warning trim borte ribbon wristband armband merch',
  designs: 'my designs upload hochladen logo artwork eigene designs grafik svg png', symbol: 'symbol logo sign zeichen design emblem own eigen',
};
const SCRIPT_SAMPLES = { 'Noto Sans JP': '東京', 'Noto Naskh Arabic': 'حب', 'Reem Kufi': 'نور', 'Noto Sans': 'Москва', 'Ruslan Display': 'Сила', 'Noto Sans SC': '龍', 'Noto Sans KR': '서울', 'Noto Sans Hebrew': 'אור', 'Noto Sans Devanagari': 'शक्ति', 'Noto Sans Thai': 'ไทย', 'Noto Sans Armenian': 'Հայ', 'Noto Sans Georgian': 'ქართ' };
const FONT_TAGS = {
  UnifrakturMaguntia: 'gothic gotisch blackletter fraktur medieval mittelalter metal', 'Pirata One': 'gothic gotisch blackletter tattoo', 'Rubik Glitch': 'glitch broken kaputt digital cyber y2k', 'Rubik Wet Paint': 'drip dripping tropfen horror graffiti',
  'Special Elite': 'typewriter schreibmaschine rough grunge vintage', 'Permanent Marker': 'marker hand handwriting handschrift graffiti', Anton: 'bold condensed poster', 'Instrument Serif': 'serif elegant editorial', 'JetBrains Mono': 'mono code technical',
  'Noto Sans JP': 'japanese japanisch japan kanji kana', 'Noto Naskh Arabic': 'arabic arabisch naskh calligraphy', 'Reem Kufi': 'arabic arabisch kufi geometric', 'Noto Sans': 'russian russisch cyrillic kyrillisch greek griechisch', 'Ruslan Display': 'russian russisch cyrillic kyrillisch slavic slawisch',
  'Noto Sans SC': 'chinese chinesisch hanzi mandarin', 'Noto Sans KR': 'korean koreanisch hangul', 'Noto Sans Hebrew': 'hebrew hebräisch', 'Noto Sans Devanagari': 'hindi indian indisch devanagari sanskrit', 'Noto Sans Thai': 'thai thailand', 'Noto Sans Armenian': 'armenian armenisch', 'Noto Sans Georgian': 'georgian georgisch',
};

const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)])).toString();

let cache = null;
export function buildIndex() {
  if (cache) return cache;
  const items = [];
  for (const [id, T] of Object.entries(TYPES)) {
    items.push({ kind: 'Tool', label: T.label, text: `${T.label} ${TOOL_TAGS[id] || ''}`, href: `#/${id}`, icon: id });
    if (id !== 'couture') for (const tpl of T.templates || []) items.push({ kind: 'Starting point', label: tpl.label, sub: T.label, text: `${tpl.label} ${T.label} ${TOOL_TAGS[id] || ''} ${Object.values(tpl.p).join(' ')}`, href: `#/${id}?${q(tpl.p)}`, icon: id });
  }
  for (const id of ['draw', 'symbol']) items.push({ kind: 'Tool', label: id === 'draw' ? 'Draw' : 'Symbol', text: `${id} ${TOOL_TAGS[id]}`, href: `#/${id}`, icon: id });
  for (const [id, m] of Object.entries(MOTIFS)) {
    items.push({
      kind: m.pattern ? 'Pattern' : 'Motif', label: m.label, text: `${m.label} ${MOTIF_TAGS[id] || ''} ${m.pattern ? 'pattern muster print druck' : 'motif motiv'}`, motif: id,
      actions: [
        ['Engrave on a ring', `#/ring?${q({ width: 8, ek: 'motif', em: id, eside: 'top', esz: 95, efill: true })}`],
        ['Print on a plate', `#/plate?${q({ pk: 'motif', pm: id, pside: 'top', psz: m.pattern ? 100 : 60, ptile: m.pattern })}`],
        ...(m.pattern ? [['Print around a vase', `#/vessel?${q({ kind: 'vase', diameter: 110, height: 280, belly: 40, base: 70, neck: 55, pk: 'motif', pm: id, pside: 'around', psz: 100, ptile: true })}`]]
          : [['Pendant', `#/pendant?${q({ shape: `m:${id}` })}`], ['Crown pattern', `#/wearable?${q({ kind: 'crown', pattern: `m:${id}` })}`]]),
        ['On a sculpture base', `#/sculpture?${q({ ek: 'motif', em: id, eside: 'front', esz: 30, ey: -80, ed: 1, efill: true })}`],
      ],
    });
  }
  for (const [sid, S] of Object.entries(SUBJECTS)) for (const [pose, label] of S.poses) items.push({ kind: 'Pose', label: `${S.label}: ${label}`, text: `${S.label} ${label} pose ${sid} sculpture skulptur ${TOOL_TAGS.sculpture}`, href: `#/sculpture?${q({ subject: sid, pose })}`, icon: 'sculpture' });
  for (const [sid, st] of Object.entries(COUTURE_STYLES)) items.push({ kind: 'Couture', label: st.label, text: `${st.label} ${st.tags} ${TOOL_TAGS.couture}`, href: `#/couture?${q(st.p)}`, icon: 'couture' });
  for (const [family, label] of FONTS) {
    const sample = SCRIPT_SAMPLES[family] || 'TRIAD';
    items.push({ kind: 'Font', label, text: `${label} ${family} ${FONT_TAGS[family] || ''} font schrift`, href: `#/lettering?${q({ text: sample, font: family })}`, font: family, sample });
  }
  for (const [k, m] of Object.entries({ ...HOME, ...METALS })) items.push({ kind: 'Material', label: m.label, text: `${m.label} ${k} material werkstoff`, href: null });
  cache = items;
  return items;
}

export const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

/** Every word of the query must match a word (start) in the item; better matches first. */
export function search(query, items = buildIndex()) {
  const words = normalize(query).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  if (!words.length) return [];
  const out = [];
  for (const it of items) {
    const hay = normalize(`${it.label} ${it.text}`).split(/[^\p{L}\p{N}]+/u);
    const label = normalize(it.label);
    let score = 0, all = true;
    for (const w of words) {
      let best = 0;
      for (const h of hay) { if (h === w) { best = 3; break; } if (h.startsWith(w)) best = Math.max(best, 2); else if (w.length > 3 && h.includes(w)) best = Math.max(best, 1); }
      if (!best) { all = false; break; }
      score += best + (label.includes(w) ? 2 : 0);
    }
    if (all) out.push({ ...it, score: score + ({ Motif: 0.6, Pattern: 0.5, Couture: 0.5, 'Starting point': 0.4, Tool: 0.3 }[it.kind] || 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Inspiration from museum collections and the wider web (opens in a new tab, nothing is copied). */
export const ELSEWHERE = [
  ['The Met collection', 'https://www.metmuseum.org/art/collection/search?q='],
  ['V&A collections', 'https://collections.vam.ac.uk/search/?q='],
  ['Cooper Hewitt design', 'https://collection.cooperhewitt.org/search/collection?query='],
  ['Google Arts & Culture', 'https://artsandculture.google.com/search?q='],
  ['Rijksmuseum', 'https://www.rijksmuseum.nl/en/search?q='],
  ['Pinterest', 'https://www.pinterest.com/search/pins/?q='],
];
