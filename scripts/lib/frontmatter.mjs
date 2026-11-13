// Minimal, dependency-free YAML frontmatter parser.
// Supports the subset Decap CMS writes: scalars, quoted strings, booleans,
// numbers, inline arrays, block lists (strings or flat objects) and folded / literal blocks.

export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  return { data: parseYaml(m[1]), body: m[2] };
}

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return '';
  if (v.startsWith('"') && v.endsWith('"')) {
    try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(',').map((s) => parseScalar(s)) : [];
  }
  return v.replace(/\s+#.*$/, '');
}

export function parseYaml(text) {
  const lines = text.split(/\r?\n/);
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const km = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!km) { i++; continue; }
    const key = km[1];
    const val = km[2];

    if (/^[>|][-+]?$/.test(val.trim())) {
      const folded = val.trim().startsWith('>');
      const buf = [];
      i++;
      while (i < lines.length && (/^\s+/.test(lines[i]) || lines[i] === '')) {
        buf.push(lines[i].trim());
        i++;
      }
      out[key] = folded ? buf.join(' ').replace(/\s+/g, ' ').trim() : buf.join('\n').trim();
      continue;
    }

    if (val.trim() === '') {
      const items = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { i++; continue; }
        const lm = l.match(/^\s*-\s+(.*)$/);
        if (lm) {
          const kv = lm[1].match(/^([A-Za-z0-9_-]+):\s+(.*)$|^([A-Za-z0-9_-]+):$/);
          if (kv && !/^https?:/.test(lm[1])) items.push({ [kv[1] || kv[3]]: parseScalar(kv[2] || '') });
          else items.push(parseScalar(lm[1]));
          i++;
          continue;
        }
        if (/^\s+\S/.test(l) && items.length && typeof items[items.length - 1] === 'object') {
          const kv = l.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
          if (kv) items[items.length - 1][kv[1]] = parseScalar(kv[2]);
          i++;
          continue;
        }
        break;
      }
      out[key] = items;
      continue;
    }

    out[key] = parseScalar(val);
    i++;
  }
  return out;
}
