// WORLD — heightfield core (no three.js, runs in tests): seeded noise, procedural generators,
// hydraulic + thermal erosion, sculpt brushes and layers. Heights are in metres; the grid is n × n.

/* ── seeded random + 2D gradient noise ── */
export function rng(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export function makeNoise(seed = 1) {
  const r = rng(seed), p = new Uint8Array(512), g = new Float32Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) { p[i] = perm[i & 255]; g[i] = r() * Math.PI * 2; }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (h, x, y) => { const a = g[h]; return Math.cos(a) * x + Math.sin(a) * y; };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const x1 = dot(aa, xf, yf) + u * (dot(ba, xf - 1, yf) - dot(aa, xf, yf));
    const x2 = dot(ab, xf, yf - 1) + u * (dot(bb, xf - 1, yf - 1) - dot(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.42; // ≈ −1 … 1
  };
}
export function fbm(noise, x, y, { octaves = 6, lacunarity = 2.02, gain = 0.5, ridged = 0 } = {}) {
  let sum = 0, amp = 1, f = 1, norm = 0, prev = 1;
  for (let o = 0; o < octaves; o++) {
    let v = noise(x * f + o * 17.3, y * f - o * 9.1);
    if (ridged) { const r = 1 - Math.abs(v); v = (r * r * prev) * 2 - 1; prev = Math.min(1, r * 1.6); v = v * ridged + noise(x * f + o * 17.3, y * f - o * 9.1) * (1 - ridged); }
    sum += v * amp; norm += amp; amp *= gain; f *= lacunarity;
  }
  return sum / norm;
}
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/* ── generators ── */
export const GEN_DEFAULTS = { seed: 7, scale: 1, height: 60, octaves: 6, roughness: 0.5, ridged: 0.4, warp: 0.3, terraces: 0, island: 0, craters: 0, plateau: 0, dunes: 0, canyon: 0, offset: 0, spikes: 0 };

/** Procedural terrain. size = world width in metres; returns Float32Array n × n (row = z, column = x). */
export function generate(n, size, params = {}) {
  const P = { ...GEN_DEFAULTS, ...params };
  const noise = makeNoise(P.seed), warpN = makeNoise(P.seed + 101), r = rng(P.seed + 7);
  const h = new Float32Array(n * n);
  const craters = Array.from({ length: Math.round(P.craters * 14) }, () => ({ x: (r() - 0.5) * 0.85, z: (r() - 0.5) * 0.85, rad: 0.03 + r() * 0.12 }));
  const base = 2.4 / P.scale;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5, v = j / (n - 1) - 0.5; // −0.5 … 0.5
    let x = u * base, y = v * base;
    if (P.warp) { x += warpN(x * 0.9 + 3, y * 0.9) * P.warp; y += warpN(x * 0.9, y * 0.9 - 5) * P.warp; }
    let e = fbm(noise, x, y, { octaves: P.octaves, gain: P.roughness, ridged: P.ridged }) * 0.5 + 0.5; // 0 … 1
    if (P.dunes) { const d = Math.abs(Math.sin((x * 3.2 + noise(x * 0.6, y * 0.6) * 1.4) * Math.PI)); e = e * (1 - P.dunes) + (0.35 + 0.3 * d ** 1.5 + 0.15 * e) * P.dunes; }
    if (P.canyon) { const c = Math.abs(fbm(warpN, x * 0.7 + 9, y * 0.7, { octaves: 3 })); e -= P.canyon * (1 - smooth(0.02, 0.12, c)) * 0.55; }
    if (P.spikes) { const s = Math.max(0, noise(x * 4.5 + 30, y * 4.5) - 0.55); e += s * s * 6 * P.spikes; }
    if (P.terraces) { const steps = 4 + Math.round(P.terraces * 10); const t = e * steps; const f = Math.floor(t); e = e * (1 - P.terraces) + ((f + smooth(0.75, 1, t - f)) / steps) * P.terraces; }
    if (P.plateau) e = e * (1 - P.plateau) + Math.min(e, 0.62) * P.plateau;
    for (const c of craters) {
      const d = Math.hypot(u - c.x, v - c.z) / c.rad;
      if (d < 1.6) e += d < 1 ? -0.22 * (1 - d * d) * c.rad * 6 : 0.08 * (1 - smooth(1, 1.6, d)) * c.rad * 6;
    }
    if (P.island) { const d = Math.hypot(u, v) * 2; e = e * (1 - P.island) + (e * (1 - smooth(0.35, 1, d)) - 0.22 * smooth(0.6, 1.05, d)) * P.island; }
    h[j * n + i] = (e + P.offset) * P.height;
  }
  return h;
}

/* ── erosion ── */
export function erodeHydraulic(h, n, { drops = 40000, seed = 3, strength = 1, cell = 1, region = null } = {}) {
  const r = rng(seed);
  const inertia = 0.05, capacity = 4, deposit = 0.3, erodeK = 0.3 * strength, evap = 0.02, minSlope = 0.01, gravity = 4, life = 30;
  const at = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, k = j * n + i; const a = h[k], b = h[k + 1], c = h[k + n], d = h[k + n + 1]; return { hgt: a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz, gx: ((b - a) * (1 - fz) + (d - c) * fz) / cell, gz: ((c - a) * (1 - fx) + (d - b) * fx) / cell }; };
  for (let k = 0; k < drops; k++) {
    let x, z;
    if (region) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * region.r; x = region.x + Math.cos(a) * d; z = region.z + Math.sin(a) * d; } else { x = 1 + r() * (n - 3); z = 1 + r() * (n - 3); }
    let dx = 0, dz = 0, speed = 1, water = 1, sed = 0;
    for (let t = 0; t < life; t++) {
      if (x < 1 || z < 1 || x >= n - 2 || z >= n - 2) break;
      const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
      const cur = at(x, z);
      dx = dx * inertia - cur.gx * (1 - inertia); dz = dz * inertia - cur.gz * (1 - inertia);
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      const nx = x + dx, nz = z + dz;
      if (nx < 1 || nz < 1 || nx >= n - 2 || nz >= n - 2) break;
      const dh = at(nx, nz).hgt - cur.hgt;
      const cap = Math.max(-dh * cell, minSlope) * speed * water * capacity;
      const idx = [j * n + i, j * n + i + 1, (j + 1) * n + i, (j + 1) * n + i + 1], w = [(1 - fx) * (1 - fz), fx * (1 - fz), (1 - fx) * fz, fx * fz];
      if (sed > cap || dh > 0) {
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * deposit;
        sed -= amt; for (let q = 0; q < 4; q++) h[idx[q]] += amt * w[q];
      } else {
        const amt = Math.min((cap - sed) * erodeK, -dh);
        for (let q = 0; q < 4; q++) h[idx[q]] -= amt * w[q];
        sed += amt;
      }
      speed = Math.sqrt(Math.max(0, speed * speed + dh * -gravity * 0.1));
      water *= 1 - evap; x = nx; z = nz;
    }
  }
  return h;
}
export function erodeThermal(h, n, { iterations = 20, talus = 0.8, cell = 1 } = {}) {
  const lim = talus * cell, out = new Float32Array(h.length);
  for (let it = 0; it < iterations; it++) {
    out.fill(0);
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      for (const o of [1, -1, n, -n]) { const d = h[k] - h[k + o]; if (d > lim) { const m = (d - lim) * 0.25; out[k] -= m; out[k + o] += m; } }
    }
    for (let k = 0; k < h.length; k++) h[k] += out[k];
  }
  return h;
}

/* ── layers ── */
export function combine(layers, n) {
  const out = new Float32Array(n * n);
  for (const l of layers) if (l.visible !== false && l.opacity !== 0) { const o = l.opacity ?? 1; const d = l.data; for (let k = 0; k < out.length; k++) out[k] += d[k] * o; }
  return out;
}
export function heightAt(h, n, size, x, z) {
  const gx = (x / size + 0.5) * (n - 1), gz = (z / size + 0.5) * (n - 1);
  const i = Math.min(n - 2, Math.max(0, Math.floor(gx))), j = Math.min(n - 2, Math.max(0, Math.floor(gz)));
  const fx = Math.min(1, Math.max(0, gx - i)), fz = Math.min(1, Math.max(0, gz - j)), k = j * n + i;
  return h[k] * (1 - fx) * (1 - fz) + h[k + 1] * fx * (1 - fz) + h[k + n] * (1 - fx) * fz + h[k + n + 1] * fx * fz;
}

/* ── sculpt brushes ── */
export const TOOLS = [
  ['draw', 'Draw'], ['raise', 'Raise'], ['lower', 'Lower'], ['smooth', 'Smooth'], ['flatten', 'Flatten'], ['inflate', 'Inflate'],
  ['push', 'Push'], ['pull', 'Pull'], ['carve', 'Carve'], ['erode', 'Erode'], ['detail', 'Add detail'], ['undetail', 'Remove detail'],
];
export const FALLOFFS = [['smooth', 'Smooth'], ['linear', 'Linear'], ['sharp', 'Sharp'], ['constant', 'Constant']];
export const SHAPES = [['circle', 'Circle'], ['square', 'Square'], ['noise', 'Rough'], ['star', 'Star']];

/** Brush weight 0 … 1 at normalised offset (dx, dz in −1 … 1). */
export function brushWeight(dx, dz, { shape = 'circle', falloff = 'smooth', softness = 0.5 } = {}, noise) {
  let d = shape === 'square' ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
  if (shape === 'star') { const a = Math.atan2(dz, dx); d /= 0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)); }
  if (d >= 1) return 0;
  const inner = 1 - Math.min(0.999, Math.max(0, softness));
  let w = d <= inner ? 1 : 1 - (d - inner) / (1 - inner);
  if (falloff === 'smooth') w = w * w * (3 - 2 * w);
  else if (falloff === 'sharp') w = w ** 3;
  else if (falloff === 'constant') w = d < 1 ? 1 : 0;
  if (shape === 'noise' && noise) w *= 0.55 + 0.45 * noise(dx * 3.1, dz * 3.1);
  return Math.max(0, w);
}

/**
 * Apply one brush dab to layer `h` (active layer) using `full` (all layers combined) to read the surface.
 * x, z in metres; s = { size (m radius), strength 0…1, softness, shape, falloff, pressure, dir: [dx, dz], target, tool }
 * Returns the touched grid rectangle [i0, j0, i1, j1].
 */
export function dab(h, full, n, size, x, z, s, noise) {
  const cell = size / (n - 1), R = s.size / cell;
  const ci = (x / size + 0.5) * (n - 1), cj = (z / size + 0.5) * (n - 1);
  const i0 = Math.max(1, Math.floor(ci - R)), i1 = Math.min(n - 2, Math.ceil(ci + R)), j0 = Math.max(1, Math.floor(cj - R)), j1 = Math.min(n - 2, Math.ceil(cj + R));
  if (i0 > i1 || j0 > j1) return null;
  const k0 = (s.strength ?? 0.5) * (s.pressure ?? 1);
  const amp = k0 * Math.max(0.15, s.size * 0.06); // metres per dab, scales with brush size
  const tool = s.tool;
  const src = tool === 'smooth' || tool === 'undetail' || tool === 'push' || tool === 'pull' ? full.slice() : null;
  const avg = (k, r2 = 1) => { let t = 0, c = 0; for (let b = -r2; b <= r2; b++) for (let a = -r2; a <= r2; a++) { const q = k + b * n + a; if (q >= 0 && q < src.length) { t += src[q]; c++; } } return t / c; };
  const [ddx, ddz] = s.dir || [0, 0];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const w = brushWeight((i - ci) / R, (j - cj) / R, s, noise);
    if (!w) continue;
    const k = j * n + i, cur = full[k];
    let d = 0;
    switch (tool) {
      case 'draw': d = amp * w * 0.6; break; // gentle build-up while dragging
      case 'raise': d = amp * w; break;
      case 'lower': d = -amp * w; break;
      case 'inflate': { const lap = (full[k - 1] + full[k + 1] + full[k - n] + full[k + n]) / 4 - cur; d = amp * w * (0.6 + Math.max(0, -lap) / Math.max(0.2, s.size * 0.02)); break; }
      case 'smooth': d = (avg(k, 2) - cur) * Math.min(1, k0 * 1.5) * w; break;
      case 'undetail': d = (avg(k, 1) - cur) * Math.min(1, k0 * 2) * w; break;
      case 'flatten': d = ((s.target ?? cur) - cur) * Math.min(1, k0 * 0.9) * w; break;
      case 'carve': { const sharp = w ** 0.35; d = -amp * 1.4 * sharp * w; break; }
      case 'detail': d = (noise ? noise(i * 0.35, j * 0.35) + 0.5 * noise(i * 0.8 + 9, j * 0.8) : 0) * amp * 0.8 * w; break;
      case 'push': case 'pull': {
        // smear the surface along (push) or against (pull) the stroke direction
        const sgn = tool === 'push' ? -1 : 1, st = Math.min(R * 0.5, 3) * w * k0 * 2;
        const si = Math.min(n - 1, Math.max(0, Math.round(i + sgn * ddx * st))), sj = Math.min(n - 1, Math.max(0, Math.round(j + sgn * ddz * st)));
        d = (src[sj * n + si] - cur) * Math.min(1, w * k0 * 1.6);
        break;
      }
      default: d = 0;
    }
    h[k] += d;
    full[k] += d;
  }
  if (tool === 'erode') {
    const before = full.slice();
    erodeHydraulic(full, n, { drops: Math.round(60 + R * R * 3 * k0), seed: Math.floor(x * 13 + z * 7), strength: 1.5 * k0 + 0.3, cell, region: { x: ci, z: cj, r: R } });
    for (let k = 0; k < full.length; k++) { const dd = full[k] - before[k]; if (dd) h[k] += dd; }
  }
  return [i0, j0, i1, j1];
}

/* ── heightmap image in / out (8-bit grey) ── */
export function toGrey(h) {
  let lo = Infinity, hi = -Infinity; for (const v of h) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1, out = new Uint8ClampedArray(h.length);
  for (let k = 0; k < h.length; k++) out[k] = Math.round(((h[k] - lo) / span) * 255);
  return { grey: out, lo, hi };
}
export function fromGrey(grey, w, hgt, n, height) {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (w - 1), y = (j / (n - 1)) * (hgt - 1), a = Math.floor(x), b = Math.floor(y), fx = x - a, fy = y - b;
    const g = (xx, yy) => grey[Math.min(hgt - 1, yy) * w + Math.min(w - 1, xx)];
    out[j * n + i] = ((g(a, b) * (1 - fx) + g(a + 1, b) * fx) * (1 - fy) + (g(a, b + 1) * (1 - fx) + g(a + 1, b + 1) * fx) * fy) / 255 * height;
  }
  return out;
}
