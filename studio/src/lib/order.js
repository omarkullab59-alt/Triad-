// SALES: order / price request. Shows an estimate from public/pricing.json (editable by TRIAD, no code),
// lets the customer pick finish and quantity, and sends the request by e-mail or Instagram DM.
// Nothing is stored: the request leaves the device only when the customer sends it.
import { esc, toast } from './dom.js';
import { INSTAGRAM } from './config.js';

let pricesP = null;
export function loadPrices() {
  if (!pricesP) pricesP = fetch(new URL('pricing.json', document.baseURI)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return pricesP;
}

export function estimate(prices, { grams, material, category, typeId, engraved, destroyed, enamel, finish = 0, qty = 1 }) {
  const per = prices.perGram?.[material] ?? 0.1;
  const base = prices.base?.[typeId] ?? prices.base?.[category] ?? 60;
  const x = prices.extras || {};
  const one = base + grams * per + (engraved ? x.engraving || 0 : 0) + (destroyed ? x.destroy || 0 : 0) + (enamel ? x.enamel || 0 : 0) + finish;
  const total = one * qty;
  const r = prices.range ?? 0.2;
  const round = (n) => (n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 50) * 50);
  return { low: round(total * (1 - r)), high: round(total * (1 + r)) };
}

/**
 * @param o.summary   [[label, value], …] of the configured piece
 * @param o.materials [[key, label, grams], …]  o.material current key
 * @param o.category  'jewel' | 'home' | 'sculpture' | 'make'
 * @param o.url       link to exactly this design
 */
export async function openOrderDialog(o) {
  const prices = (await loadPrices()) || { currency: 'EUR', perGram: {}, base: {}, extras: {}, finishes: {}, contact: { instagram: 'triad.closet' } };
  const cur = prices.currency || 'EUR';
  const fmt = (n) => new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  const finishes = prices.finishes?.[o.category] || prices.finishes?.jewel || [['standard', 'Standard', 0]];
  const dlg = document.createElement('dialog');
  dlg.setAttribute('aria-labelledby', 'ord-h');
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <div class="dlg-head"><h2 id="ord-h" class="section-title">Order this piece</h2><button class="icon-btn" value="cancel" aria-label="Close">×</button></div>
    <dl class="order-sum">${o.summary.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="field"><label for="o-mat">Material</label><select id="o-mat" class="input">${o.materials.map(([k, l]) => `<option value="${esc(k)}"${k === o.material ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="field"><label for="o-fin">Finish</label><select id="o-fin" class="input">${finishes.map(([k, l, p]) => `<option value="${esc(k)}" data-p="${Number(p) || 0}">${esc(l)}${p ? ` (${p > 0 ? '+' : ''}${fmt(p)})` : ''}</option>`).join('')}</select></div>
    <div class="field"><label for="o-qty">How many</label><input id="o-qty" class="input" type="number" min="1" max="500" value="1" inputmode="numeric"></div>
    <p class="price" aria-live="polite"><span class="label muted">Estimate</span><br><b data-price></b></p>
    <p class="muted" style="font-size:13px">${esc(prices.note || 'Estimate only.')} ${esc(prices.delivery || '')}</p>
    <div class="field"><label for="o-name">Your name</label><input id="o-name" type="text" maxlength="60" autocomplete="name" required></div>
    <div class="field"><label for="o-contact">E-mail or Instagram</label><input id="o-contact" type="text" maxlength="80" autocomplete="email" required placeholder="you@mail.com or @you"></div>
    <div class="field"><label for="o-note">Anything else? (optional)</label><textarea id="o-note" rows="3" maxlength="600" class="input"></textarea></div>
    <div class="btn-row">
      ${prices.contact?.email ? '<button class="btn btn--lime" value="mail" data-mail>Send request by e-mail</button>' : ''}
      <button class="btn ${prices.contact?.email ? '' : 'btn--lime'}" value="ig" data-ig>Copy &amp; open Instagram</button>
    </div>
    <p class="muted" style="font-size:13px">Nothing is sent until you press a button. No payment here: TRIAD answers you first.</p>
  </form>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  const $ = (s) => dlg.querySelector(s);
  const state = () => {
    const mat = $('#o-mat').value;
    const fin = $('#o-fin').selectedOptions[0];
    const qty = Math.max(1, Math.min(500, Number($('#o-qty').value) || 1));
    const grams = o.materials.find(([k]) => k === mat)?.[2] || 0;
    const e = estimate(prices, { grams, material: mat, category: o.category, typeId: o.typeId, engraved: o.engraved, destroyed: o.destroyed, enamel: o.enamel, finish: Number(fin.dataset.p) || 0, qty });
    return { mat, matLabel: $('#o-mat').selectedOptions[0].textContent, fin: fin.textContent, qty, e, grams };
  };
  const update = () => { const s = state(); $('[data-price]').textContent = `${fmt(s.e.low)} – ${fmt(s.e.high)}${s.qty > 1 ? ` for ${s.qty}` : ''}`; };
  for (const id of ['#o-mat', '#o-fin', '#o-qty']) $(id).addEventListener('input', update);
  update();
  const message = () => {
    const s = state();
    return [`Hi TRIAD, I'd like to order this piece from TRIAD Studio:`, '',
      ...o.summary.map(([k, v]) => `${k}: ${v}`),
      `Material: ${s.matLabel}`, `Finish: ${s.fin}`, `Quantity: ${s.qty}`, `Estimate shown: ${fmt(s.e.low)} – ${fmt(s.e.high)}`, '',
      `Design: ${o.url}`, '', `Name: ${$('#o-name').value}`, `Contact: ${$('#o-contact').value}`,
      ...($('#o-note').value.trim() ? ['', $('#o-note').value.trim()] : [])].join('\n');
  };
  const valid = () => dlg.querySelector('form').reportValidity();
  $('[data-mail]')?.addEventListener('click', (e) => {
    e.preventDefault(); if (!valid()) return;
    location.href = `mailto:${prices.contact.email}?subject=${encodeURIComponent(`Order request: ${o.title}`)}&body=${encodeURIComponent(message())}`;
    dlg.close(); toast('Your e-mail app opens with the request. Press send there.', 5000);
  });
  $('[data-ig]').addEventListener('click', async (e) => {
    e.preventDefault(); if (!valid()) return;
    try { await navigator.clipboard.writeText(message()); } catch { prompt('Copy this message:', message()); }
    window.open(prices.contact?.instagram ? `https://ig.me/m/${prices.contact.instagram}` : INSTAGRAM, '_blank', 'noopener');
    dlg.close(); toast('Message copied. Paste it into the Instagram chat with TRIAD.', 6000);
  });
}
