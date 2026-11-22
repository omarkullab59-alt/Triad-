// Small, accessible popup menu (context menu on the viewport, dropdowns in toolbars).
// items: { label, hint?, action, checked?, disabled? } or '-' for a divider.
import { esc } from '../lib/dom.js';

let open = null;

export function closeMenu() {
  if (!open) return;
  const { el, cleanup, returnFocus } = open;
  open = null;
  cleanup();
  el.remove();
  returnFocus?.focus?.({ preventScroll: true });
}

export function showMenu(items, { x, y, label = 'Menu', returnFocus = document.activeElement } = {}) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', label);
  el.innerHTML = items.map((it, i) => (it === '-'
    ? '<div class="menu-sep" role="separator"></div>'
    : `<button type="button" class="menu-item" role="${it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}" data-i="${i}" tabindex="-1"${it.checked !== undefined ? ` aria-checked="${!!it.checked}"` : ''}${it.disabled ? ' aria-disabled="true"' : ''}>
        <span class="menu-check" aria-hidden="true">${it.checked ? '✓' : ''}</span><span class="menu-label">${esc(it.label)}</span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`)).join('');
  document.body.append(el);
  // keep it on screen
  const r = el.getBoundingClientRect();
  el.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  el.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  const btns = [...el.querySelectorAll('.menu-item')];
  const enabled = btns.filter((b) => b.getAttribute('aria-disabled') !== 'true');
  const run = (b) => {
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const it = items[Number(b.dataset.i)];
    closeMenu();
    it.action?.();
  };
  el.addEventListener('click', (e) => run(e.target.closest('.menu-item')));
  el.addEventListener('keydown', (e) => {
    const i = enabled.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); enabled[(i + 1) % enabled.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); enabled[(i - 1 + enabled.length) % enabled.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); enabled[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); enabled[enabled.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
  });
  const outside = (e) => { if (!el.contains(e.target)) closeMenu(); };
  const away = () => closeMenu();
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  window.addEventListener('resize', away);
  window.addEventListener('blur', away);
  open = { el, returnFocus, cleanup: () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', away); window.removeEventListener('blur', away); } };
  enabled[0]?.focus({ preventScroll: true });
  return el;
}

/** Modal list of keyboard shortcuts. rows: [keys, description][] */
export function showShortcuts(rows) {
  const dlg = document.createElement('dialog');
  dlg.setAttribute('aria-labelledby', 'sc-h');
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <div class="dlg-head"><h2 id="sc-h" class="section-title">Keyboard shortcuts</h2><button class="icon-btn" value="x" aria-label="Close">×</button></div>
    <dl class="shortcuts">${rows.map(([k, d]) => `<dt>${k.split(' · ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
    <p class="muted" style="font-size:13px">On a Mac use ⌘ instead of Ctrl. Shortcuts are off while you type in a field.</p>
  </form>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
