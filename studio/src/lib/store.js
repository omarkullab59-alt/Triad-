// Everything stays on this device. Storage can be blocked (private mode, settings): every call is wrapped.
const KEY = 'triad-studio-designs';
const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const listDesigns = () => { const l = read(KEY, []); return Array.isArray(l) ? l : []; };
export function saveDesign({ name, type, hash }) {
  const list = listDesigns().filter((d) => d.hash !== hash);
  list.unshift({ id: Date.now().toString(36), name: String(name).slice(0, 60), type, hash, date: new Date().toISOString() });
  return write(KEY, list.slice(0, 40));
}
export function deleteDesign(id) { return write(KEY, listDesigns().filter((d) => d.id !== id)); }

// The Studio is a dark workspace by default; 'auto' (follow the system) and 'light' can be chosen and are remembered.
export function getMode() { try { const m = localStorage.getItem('triad-theme'); return ['auto', 'light', 'dark'].includes(m) ? m : 'dark'; } catch { return 'dark'; } }
export function setMode(m) { try { localStorage.setItem('triad-theme', m); } catch { /* not saved */ } }

// Draw → Pendant hand-over (same page, kept in memory)
let handoff = null;
export const setHandoff = (v) => { handoff = v; };
export const takeHandoff = () => { const v = handoff; handoff = null; return v; };
