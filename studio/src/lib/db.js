// Tiny key-value store on IndexedDB (fonts, symbols, models can be megabytes — too big for localStorage).
// Everything stays on this device. If the browser blocks storage, it silently keeps things in memory.
const memory = new Map();
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open('triad-studio', 5);
      req.onupgradeneeded = () => { for (const s of ['fonts', 'symbols', 'designs', 'projects', 'collections', 'scenes', 'worlds']) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r?.result ?? true);
      t.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
export async function put(store, key, value) {
  memory.set(`${store}/${key}`, value);
  return (await tx(store, 'readwrite', (s) => s.put(value, key))) !== null;
}
export async function del(store, key) {
  memory.delete(`${store}/${key}`);
  return tx(store, 'readwrite', (s) => s.delete(key));
}
export async function all(store) {
  const db = await open();
  if (!db) return [...memory].filter(([k]) => k.startsWith(`${store}/`)).map(([k, v]) => ({ key: k.slice(store.length + 1), value: v }));
  return new Promise((resolve) => {
    try {
      const out = [];
      const req = db.transaction(store).objectStore(store).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out); };
      req.onerror = () => resolve(out);
    } catch { resolve([]); }
  });
}
export async function get(store, key) {
  const db = await open();
  if (!db) return memory.get(`${store}/${key}`) ?? null;
  return new Promise((resolve) => {
    try { const req = db.transaction(store).objectStore(store).get(key); req.onsuccess = () => resolve(req.result ?? null); req.onerror = () => resolve(null); } catch { resolve(null); }
  });
}
