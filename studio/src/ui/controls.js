// Accessible controls: every slider has a label, a one-sentence help, −/+ buttons and a number field.
import { esc, id as uid } from '../lib/dom.js';
import { SIZE_SYSTEMS, sizeSummary } from '../lib/sizes.js';

const decimals = (step) => (String(step).split('.')[1] || '').length;
const fmt = (v, step) => Number(v).toFixed(decimals(step));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const snap = (v, step, min) => Math.round((v - min) / step) * step + min;

function setPct(range) {
  const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
  range.style.setProperty('--pct', `${pct}%`);
}

/** Slider with − / + and a number box. onInput(value) fires on every change. */
export function slider({ label, help, min, max, step, unit = '', value, onInput, name }) {
  const i = uid('c'), h = uid('h');
  const el = document.createElement('div');
  el.className = 'ctl';
  el.dataset.key = name || '';
  el.innerHTML = `
    <div class="ctl-head"><label for="${i}">${esc(label)}</label><output for="${i}" aria-hidden="true"></output></div>
    <p class="ctl-help" id="${h}">${esc(help)}</p>
    <div class="ctl-row">
      <button type="button" data-d="-1" aria-label="Less ${esc(label)}">−</button>
      <input type="range" id="${i}" min="${min}" max="${max}" step="${step}" aria-describedby="${h}">
      <button type="button" data-d="1" aria-label="More ${esc(label)}">+</button>
      <input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" aria-label="${esc(label)}${unit ? ` in ${esc(unit)}` : ''}, exact value">
    </div>`;
  const range = el.querySelector('input[type=range]');
  const num = el.querySelector('input[type=number]');
  const out = el.querySelector('output');
  const set = (v, fire = true) => {
    v = clamp(snap(Number(v), step, min), min, max);
    if (!Number.isFinite(v)) return;
    const s = fmt(v, step);
    range.value = s; num.value = s; out.textContent = `${s}${unit && unit !== '×' ? ` ${unit}` : unit}`;
    range.setAttribute('aria-valuetext', out.textContent);
    setPct(range);
    if (fire) onInput(Number(s));
  };
  range.addEventListener('input', () => set(range.value));
  num.addEventListener('change', () => set(num.value === '' ? range.value : num.value));
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); set(num.value); } });
  // press-and-hold on −/+ repeats
  for (const b of el.querySelectorAll('button[data-d]')) {
    let t1, t2;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    const once = () => set(Number(range.value) + Number(b.dataset.d) * step);
    b.addEventListener('click', (e) => { if (e.detail === 0) once(); }); // keyboard
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); once(); t1 = setTimeout(() => { t2 = setInterval(once, 70); }, 380); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  }
  set(value, false);
  el.setValue = (v) => set(v, false);
  return el;
}

/** Radio group shown as chips (≤ 5 options) or a select. */
export function choice({ label, help, options, value, onInput, name }) {
  const el = document.createElement('div');
  el.className = 'ctl';
  el.dataset.key = name || '';
  const h = uid('h'), l = uid('l');
  if (options.length <= 5) {
    el.innerHTML = `<div class="ctl-head"><span class="ctl-name" id="${l}">${esc(label)}</span></div><p class="ctl-help" id="${h}">${esc(help)}</p>
      <div class="seg" role="radiogroup" aria-labelledby="${l}" aria-describedby="${h}">
      ${options.map(([v, t]) => `<button type="button" class="chip" role="radio" data-v="${esc(v)}" aria-checked="${v === value}" tabindex="${v === value ? 0 : -1}">${esc(t)}</button>`).join('')}</div>`;
    const btns = [...el.querySelectorAll('[role=radio]')];
    const pick = (b, focus) => {
      btns.forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      if (focus) b.focus();
      onInput(b.dataset.v);
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => pick(b));
      b.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); pick(btns[(i + d + btns.length) % btns.length], true); }
      });
    });
  } else {
    const i = uid('c');
    el.innerHTML = `<div class="ctl-head"><label for="${i}">${esc(label)}</label></div><p class="ctl-help" id="${h}">${esc(help)}</p>
      <select class="input" id="${i}" aria-describedby="${h}">${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    el.querySelector('select').addEventListener('change', (e) => onInput(e.target.value));
  }
  return el;
}

export function toggle({ label, help, value, onInput, name }) {
  const el = document.createElement('div');
  el.className = 'ctl';
  el.dataset.key = name || '';
  const h = uid('h');
  el.innerHTML = `<button type="button" class="switch" role="switch" aria-checked="${!!value}" aria-describedby="${h}"><span class="ctl-name">${esc(label)}</span><span class="track" aria-hidden="true"></span></button>
    <p class="ctl-help" id="${h}" style="margin-bottom:0">${esc(help)}</p>`;
  const b = el.querySelector('button');
  b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onInput(v); });
  return el;
}

export function textField({ label, help, value, max = 24, onInput, name }) {
  const el = document.createElement('div');
  el.className = 'ctl';
  el.dataset.key = name || '';
  const i = uid('c'), h = uid('h');
  el.innerHTML = `<div class="ctl-head"><label for="${i}">${esc(label)}</label></div><p class="ctl-help" id="${h}">${esc(help)}</p>
    <input type="text" id="${i}" maxlength="${max}" autocomplete="off" spellcheck="false" aria-describedby="${h}" value="${esc(value)}">`;
  let t;
  el.querySelector('input').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => onInput(e.target.value), 250); });
  return el;
}

/** Ring size: choose EU / US / mm, then one slider; all three are always shown. Value is the inside diameter in mm. */
export function ringSize({ label, help, value, onInput, name, system = 'eu', onSystem }) {
  const el = document.createElement('div');
  el.dataset.key = name || '';
  const sys = SIZE_SYSTEMS[system] || SIZE_SYSTEMS.eu;
  const summary = document.createElement('p');
  summary.className = 'label';
  summary.style.margin = '0 0 4px';
  summary.setAttribute('aria-live', 'polite');
  const sysPick = choice({
    label: 'Size system', help: 'EU = inside circumference in mm. US = American sizes. mm = inside width.',
    options: Object.entries(SIZE_SYSTEMS).map(([k, s]) => [k, s.label]), value: system,
    onInput: (k) => onSystem(k),
  });
  sysPick.style.borderBottom = '0';
  sysPick.style.paddingBottom = '0';
  const s = slider({
    label, help, min: sys.min, max: sys.max, step: sys.step, unit: sys.unit, value: Number(sys.fromD(value).toFixed(2)), name,
    onInput: (v) => { const d = sys.toD(v); summary.textContent = sizeSummary(d); onInput(Math.round(d * 100) / 100); },
  });
  summary.textContent = sizeSummary(value);
  s.querySelector('.ctl-help').after(summary);
  el.append(s, sysPick);
  return el;
}
