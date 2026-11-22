// Undo / redo for editor state. Stores serialised snapshots; quick successive changes
// (a slider drag, typing) are merged into one step so undo jumps back a whole gesture.
export function createHistory({ limit = 150, mergeMs = 700, now = () => Date.now() } = {}) {
  let past = [];   // snapshots up to and including the current one
  let future = [];
  let lastAt = 0;
  let lastKeys = '';
  return {
    /** Record a state. `keys` names what changed (merging only happens for the same control). */
    push(snapshot, keys = '') {
      if (past.length && past[past.length - 1] === snapshot) return false;
      const t = now();
      if (past.length > 1 && keys && keys === lastKeys && t - lastAt < mergeMs) past[past.length - 1] = snapshot;
      else past.push(snapshot);
      if (past.length > limit) past = past.slice(past.length - limit);
      future = [];
      lastAt = t; lastKeys = keys;
      return true;
    },
    undo() {
      if (past.length < 2) return null;
      future.push(past.pop());
      lastKeys = '';
      return past[past.length - 1];
    },
    redo() {
      if (!future.length) return null;
      const s = future.pop();
      past.push(s);
      lastKeys = '';
      return s;
    },
    reset(snapshot) { past = snapshot === undefined ? [] : [snapshot]; future = []; lastKeys = ''; },
    get canUndo() { return past.length > 1; },
    get canRedo() { return future.length > 0; },
    get size() { return past.length; },
  };
}

/** Which top-level keys differ between two plain objects (used to merge steps of one gesture). */
export function changedKeys(a, b) {
  if (!a || !b) return '*';
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (x && y && typeof x === 'object' && typeof y === 'object') { const inner = changedKeys(x, y); if (inner) out.push(`${k}.${inner}`); }
    else if (x !== y) out.push(k);
  }
  return out.join(',');
}
