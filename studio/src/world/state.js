// WORLD — editable project state (everything except heightfield data and binary assets),
// world creation from a type, node helpers and safe loading.
import { WORLDS, N, SIZE } from './worlds.js';
import { GEN_DEFAULTS, TOOLS, FALLOFFS, SHAPES } from './terrain.js';
import { OBJECTS, SCATTER } from './objects.js';

let seq = 0;
export const uid = (p = 'n') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function newNode(type, extra = {}) {
  const d = OBJECTS[type] || OBJECTS.cube;
  return { id: uid(), name: d.label, type, parent: null, visible: true, locked: false, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], p: clone(d.p), mat: { preset: d.mat[0], color: d.mat[1] }, ...extra };
}

export function worldState(type = 'mountains', seed = 7) {
  const W = WORLDS[type] || WORLDS.mountains;
  return {
    v: 1, name: W.label, world: type,
    gen: { ...GEN_DEFAULTS, ...W.gen, seed }, erosion: W.erosion ?? 0.5,
    pal: clone(W.pal), water: clone(W.water), sky: clone(W.sky),
    light: { sun: 3.2, ambient: 0.55, shadows: true, exposure: 0.95 },
    scatter: Object.fromEntries(Object.keys(SCATTER).map((k) => [k, W.scatter?.[k] || 0])), scatterSeed: seed,
    nodes: [], layers: [{ id: 'base', name: 'Generated terrain', visible: true, opacity: 1, locked: false }, { id: 'sculpt', name: 'Sculpt', visible: true, opacity: 1, locked: false }], active: 'sculpt',
    hidden: {}, brush: { tool: 'raise', size: 30, strength: 0.5, softness: 0.5, shape: 'circle', falloff: 'smooth', pressure: true },
    camera: { mode: 'persp', fov: 40, keys: [], duration: 8 }, render: { ao: false, dof: false, focus: 300, aperture: 0.5 },
  };
}

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v));
const num = (v, d, lo = -1e6, hi = 1e6) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
/** Keep only keys known in `def`, with the same kind of value. */
function shape(def, v) {
  if (v === undefined || v === null) return clone(def);
  if (typeof def === 'number') return num(v, def);
  if (typeof def === 'boolean') return !!v;
  if (typeof def === 'string') return isHex(def) ? (isHex(v) ? String(v).toLowerCase() : def) : String(v).slice(0, 80);
  if (Array.isArray(def)) return Array.isArray(v) ? v : clone(def);
  if (typeof def === 'object') { const out = {}; for (const k of Object.keys(def)) out[k] = shape(def[k], v[k]); return out; }
  return def;
}

/** Load anything (an old save, a hand-edited file) into a valid state. */
export function sanitize(input) {
  const s = input && typeof input === 'object' ? input : {};
  const d = worldState(WORLDS[s.world] ? s.world : 'mountains');
  const out = shape(d, s);
  out.world = WORLDS[s.world] ? s.world : 'mountains';
  out.sky.planets = (Array.isArray(s.sky?.planets) ? s.sky.planets : d.sky.planets).slice(0, 8).map((p) => shape({ color: '#d9b38c', color2: '#8a5a3a', size: 18, az: 0, el: 20, ring: false, ringColor: '#e8dccb', glow: 0.3 }, p));
  out.layers = (Array.isArray(s.layers) && s.layers.length ? s.layers : d.layers).slice(0, 16).map((l, i) => ({ id: /^[\w-]{1,40}$/.test(l?.id) ? l.id : `l${i}`, name: String(l?.name || `Layer ${i + 1}`).slice(0, 40), visible: l?.visible !== false, opacity: num(l?.opacity, 1, 0, 2), locked: !!l?.locked }));
  if (!out.layers.some((l) => l.id === out.active)) out.active = out.layers[out.layers.length - 1].id;
  const ids = new Set();
  out.nodes = (Array.isArray(s.nodes) ? s.nodes : []).slice(0, 500).filter((n) => n && OBJECTS[n.type]).map((n) => {
    const base = newNode(n.type);
    const o = { ...base, id: /^[\w-]{1,48}$/.test(n.id) ? n.id : base.id, name: String(n.name || base.name).slice(0, 60), parent: typeof n.parent === 'string' ? n.parent : null, visible: n.visible !== false, locked: !!n.locked };
    for (const k of ['pos', 'rot', 'scale']) o[k] = Array.isArray(n[k]) && n[k].length === 3 ? n[k].map((x, i) => num(x, base[k][i], k === 'scale' ? 0.001 : -1e5, 1e5)) : base[k];
    o.p = shape(base.p, n.p || {});
    o.mat = { preset: /^[a-z]{2,12}$/.test(n.mat?.preset) ? n.mat.preset : base.mat.preset, color: isHex(n.mat?.color) ? n.mat.color : base.mat.color };
    for (const k of ['roughness', 'metalness', 'transmission', 'iridescence', 'opacity']) if (n.mat?.[k] !== undefined) o.mat[k] = num(n.mat[k], 0, 0, 1);
    if (typeof n.asset === 'string') o.asset = n.asset.slice(0, 60);
    ids.add(o.id);
    return o;
  });
  for (const n of out.nodes) if (n.parent && (!ids.has(n.parent) || n.parent === n.id)) n.parent = null;
  out.brush.tool = TOOLS.some(([k]) => k === out.brush.tool) ? out.brush.tool : 'raise';
  out.brush.shape = SHAPES.some(([k]) => k === out.brush.shape) ? out.brush.shape : 'circle';
  out.brush.falloff = FALLOFFS.some(([k]) => k === out.brush.falloff) ? out.brush.falloff : 'smooth';
  out.camera.keys = (Array.isArray(s.camera?.keys) ? s.camera.keys : []).slice(0, 200).filter((k) => k && Array.isArray(k.pos) && Array.isArray(k.target)).map((k) => ({ t: num(k.t, 0, 0, 600), pos: k.pos.slice(0, 3).map((x) => num(x, 0)), target: k.target.slice(0, 3).map((x) => num(x, 0)) }));
  return out;
}

/** Children of a node (or of the root for null) in order. */
export const childrenOf = (nodes, id) => nodes.filter((n) => (n.parent || null) === id);
/** All descendants of id. */
export function descendants(nodes, id) { const out = []; const walk = (p) => { for (const c of childrenOf(nodes, p)) { out.push(c); walk(c.id); } }; walk(id); return out; }

/** Base64 helpers for project files. */
export function f32ToB64(a) { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
export function b64ToF32(s, len = N * N) { const bin = atob(s); if (bin.length !== len * 4) throw new Error('layer size'); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new Float32Array(b.buffer); }
export function bytesToB64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
export function b64ToBytes(s) { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; }
export { N, SIZE };
