// Instagram poster (1080 × 1350) and the info card for the jeweller.
import { makeCanvas } from '../lib/dom.js';

const W = 1080, H = 1350;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

async function fontsReady() {
  try {
    await Promise.all(['400 100px Anton', 'italic 400 60px "Instrument Serif"', '500 24px "JetBrains Mono"', '400 30px "Inter Tight"'].map((f) => document.fonts.load(f)));
  } catch { /* fallback fonts */ }
}

function fog(c, night) {
  const g = c.createRadialGradient(W / 2, H * 0.32, 60, W / 2, H * 0.45, H * 0.85);
  if (night) { g.addColorStop(0, '#2a2f33'); g.addColorStop(0.55, '#15181a'); g.addColorStop(1, '#090a0b'); }
  else { g.addColorStop(0, '#f7f8f7'); g.addColorStop(0.55, '#dde2e4'); g.addColorStop(1, '#c3cacd'); }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // film grain
  const n = c.createImageData(W, H);
  for (let i = 0; i < n.data.length; i += 4) { const v = Math.random() * 255; n.data[i] = n.data[i + 1] = n.data[i + 2] = v; n.data[i + 3] = 10; }
  const t = makeCanvas(W, H); t.getContext('2d').putImageData(n, 0, 0);
  c.drawImage(t, 0, 0);
}

function glyph(c, x, y, s, color) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
  c.strokeStyle = color; c.lineWidth = 7; c.lineCap = 'square';
  for (const [px, py] of [[50, 22], [79, 72], [21, 72]]) { c.beginPath(); c.moveTo(px - 13, py); c.lineTo(px + 13, py); c.moveTo(px, py - 13); c.lineTo(px, py + 13); c.stroke(); }
  c.restore();
}

function tape(c, text, x, y) {
  c.save();
  c.font = '500 26px "JetBrains Mono", monospace';
  const w = c.measureText(text).width + 32;
  c.translate(x, y); c.rotate(-0.026);
  c.fillStyle = '#c4ef2f'; c.fillRect(0, -30, w, 46);
  c.fillStyle = '#0a0a0a'; c.fillText(text, 16, 2);
  c.restore();
}

export async function renderPoster(viewer, { mark = true, title = '', material = '' } = {}) {
  await fontsReady();
  const night = document.documentElement.classList.contains('night');
  const out = makeCanvas(W, H);
  const c = out.getContext('2d');
  fog(c, night);
  const shot = viewer.snapshot(W, mark ? 1100 : H, { fill: 0.6 });
  c.drawImage(shot, 0, mark ? 20 : 0);
  if (mark) {
    const ink = night ? '#ece9e2' : '#0a0a0a';
    glyph(c, 56, 56, 92, ink);
    c.fillStyle = ink;
    c.font = '500 22px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText('DESIGNED IN TRIAD STUDIO', W - 60, 112);
    c.textAlign = 'left';
    c.font = '400 190px Anton, Impact, sans-serif';
    c.fillText('TRIAD', 52, H - 74);
    c.font = 'italic 400 72px "Instrument Serif", Georgia, serif';
    c.fillText('studio', 560, H - 82);
    if (title || material) tape(c, `${title}${material ? ` · ${material}` : ''}`.toUpperCase().slice(0, 52), 58, H - 300);
  }
  return out;
}

export async function renderInfoCard(viewer, { name, result, materialLabel, weights, url }) {
  await fontsReady();
  const out = makeCanvas(W, H);
  const c = out.getContext('2d');
  c.fillStyle = '#fbfaf8'; c.fillRect(0, 0, W, H);
  // picture on a misty panel
  const g = c.createLinearGradient(0, 0, 0, 560);
  g.addColorStop(0, '#f2f4f3'); g.addColorStop(1, '#d6dcde');
  c.fillStyle = g; c.fillRect(0, 0, W, 560);
  c.drawImage(viewer.snapshot(W, 560, { fill: 0.7 }), 0, 0);
  glyph(c, 48, 40, 70, '#0a0a0a');
  c.fillStyle = '#0a0a0a';
  c.font = '500 20px "JetBrains Mono", monospace';
  c.textAlign = 'right'; c.fillText('TRIAD STUDIO · INFO CARD', W - 52, 82); c.textAlign = 'left';

  let y = 640;
  c.font = '400 78px Anton, Impact, sans-serif';
  c.font = `400 78px Anton, ${'"Noto Sans JP", "Noto Naskh Arabic", "Noto Sans"'}, Impact, sans-serif`;
  c.fillText(String(name).toUpperCase().slice(0, 26), 52, y);
  y += 30;
  c.fillStyle = '#c4ef2f'; c.fillRect(52, y, 140, 10);
  y += 64;
  const rows = [
    ...result.dims,
    ['Material', materialLabel],
    ['Weight', weights.map(([l, w]) => `${l.split(' (')[0]} ≈ ${w}`).join('   ')],
    ['Thinnest', `${result.minWall.toFixed(2)} mm ${result.minWall < 0.8 ? '— below 0.8 mm!' : '(min. 0.8 mm ok)'}`],
  ];
  const wrap = (text, maxW) => {
    const words = String(text).split(' '); const lines = []; let line = '';
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  };
  for (const [k, v] of rows) {
    c.fillStyle = '#5f6064'; c.font = '500 21px "JetBrains Mono", monospace';
    c.fillText(k.toUpperCase(), 52, y);
    c.fillStyle = '#0a0a0a'; c.font = '400 30px "Inter Tight", Arial, sans-serif';
    for (const line of wrap(v, W - 330)) { c.fillText(line, 280, y); y += 40; }
    y += 14;
    if (y > H - 200) break;
  }
  for (const w of result.warnings.slice(0, 2)) {
    c.font = '400 26px "Inter Tight", Arial, sans-serif';
    const lines = wrap(`! ${w}`, W - 140);
    c.fillStyle = '#fff4d6'; c.fillRect(52, y - 34, W - 104, lines.length * 36 + 22);
    c.fillStyle = '#5c3c00';
    for (const line of lines) { c.fillText(line, 70, y); y += 36; }
    y += 30;
    if (y > H - 160) break;
  }
  c.fillStyle = '#0a0a0a'; c.fillRect(0, H - 96, W, 96);
  c.fillStyle = '#ece9e2'; c.font = '500 19px "JetBrains Mono", monospace';
  c.fillText(`${new Date().toISOString().slice(0, 10)} · STL in mm · weights are estimates`, 52, H - 56);
  c.fillStyle = '#c4ef2f';
  c.fillText(url.length > 70 ? url.replace(/^https?:\/\//, '').slice(0, 66) + '…' : url.replace(/^https?:\/\//, ''), 52, H - 26);
  return out;
}
