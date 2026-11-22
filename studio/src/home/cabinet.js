import { box, cylinder } from '../jewellery/solid.js';
import { geometryVolume } from '../jewellery/revolve.js';

const MATS = ['oak', 'walnut', 'black', 'steel', 'concrete', 'ceramic', 'brass'];

export const cabinet = {
  id: 'cabinet', label: 'Cabinet', category: 'home', materials: MATS, defaultMaterial: 'oak', minWall: 12,
  params: [
    { key: 'width', type: 'range', label: 'Width', help: 'Outside width.', min: 200, max: 2600, step: 10, unit: 'mm', default: 900 },
    { key: 'height', type: 'range', label: 'Height', help: 'Outside height, legs included.', min: 200, max: 2600, step: 10, unit: 'mm', default: 1000 },
    { key: 'depth', type: 'range', label: 'Depth', help: 'From front to wall. Wardrobes need about 60 cm.', min: 150, max: 800, step: 10, unit: 'mm', default: 420 },
    { key: 'front', type: 'select', label: 'Front', help: 'Open shelves, doors, drawers, or doors over drawers.', default: 'doors', options: [['open', 'Open shelf'], ['doors', 'Doors'], ['drawers', 'Drawers'], ['mixed', 'Doors + drawers']] },
    { key: 'shelves', type: 'range', label: 'Shelves inside', help: 'Number of shelves between top and bottom.', min: 0, max: 10, step: 1, unit: '', default: 2 },
    // more
    { key: 'doors', type: 'range', more: true, show: (p) => p.front === 'doors' || p.front === 'mixed', label: 'Doors', help: 'Number of doors side by side.', min: 1, max: 6, step: 1, unit: '', default: 2 },
    { key: 'drawers', type: 'range', more: true, show: (p) => p.front === 'drawers' || p.front === 'mixed', label: 'Drawers', help: 'Number of drawers stacked.', min: 1, max: 8, step: 1, unit: '', default: 3 },
    { key: 'panel', type: 'range', more: true, label: 'Board thickness', help: 'Wood boards are 18–25 mm, steel 1.5–3 mm.', min: 2, max: 40, step: 1, unit: 'mm', default: 19 },
    { key: 'legs', type: 'select', more: true, label: 'Legs', help: 'Stand on the floor, on short or tall legs.', default: 'short', options: [['none', 'No legs'], ['short', 'Short legs'], ['tall', 'Tall legs'], ['plinth', 'Plinth']] },
    { key: 'handles', type: 'select', more: true, label: 'Handles', help: 'Shape of the handles.', default: 'bar', options: [['none', 'Push to open'], ['bar', 'Bar'], ['knob', 'Knob'], ['tri', 'TRIAD triangle']] },
  ],
  templates: [
    { label: 'Sideboard', p: { width: 1600, height: 760, depth: 450, front: 'mixed', doors: 2, drawers: 2, shelves: 1, legs: 'tall' } },
    { label: 'Wardrobe', p: { width: 1000, height: 2000, depth: 600, front: 'doors', doors: 2, shelves: 4, legs: 'plinth' } },
    { label: 'Bookshelf', p: { width: 800, height: 1800, depth: 300, front: 'open', shelves: 5, legs: 'none' } },
    { label: 'Dresser', p: { width: 900, height: 900, depth: 480, front: 'drawers', drawers: 4, legs: 'short' } },
    { label: 'TRIAD locker', p: { width: 450, height: 1700, depth: 450, front: 'doors', doors: 1, shelves: 3, legs: 'plinth', handles: 'tri', accent: true } },
  ],
  build(p) {
    const W = p.width, D = p.depth, t = p.panel;
    const legH = { none: 0, short: Math.min(120, p.height * 0.12), tall: Math.min(300, p.height * 0.3), plinth: Math.min(90, p.height * 0.1) }[p.legs];
    const H = p.height - legH, y0 = legH;
    const parts = [];
    const add = (g) => parts.push({ geometry: g });
    // carcass
    add(box(t, H, D, -W / 2 + t / 2, y0 + H / 2, 0));
    add(box(t, H, D, W / 2 - t / 2, y0 + H / 2, 0));
    add(box(W - 2 * t, t, D, 0, y0 + H - t / 2, 0));
    add(box(W - 2 * t, t, D, 0, y0 + t / 2, 0));
    add(box(W - 2 * t, H - 2 * t, Math.max(3, t / 3), 0, y0 + H / 2, -D / 2 + Math.max(3, t / 3) / 2));
    const inner = H - 2 * t;
    for (let i = 1; i <= p.shelves; i++) add(box(W - 2 * t - 2, t, D - t - 20, 0, y0 + t + (inner * i) / (p.shelves + 1), 10));
    // legs
    if (p.legs === 'plinth') add(box(W - 40, legH, D - 60, 0, legH / 2, -10));
    else if (legH) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(cylinder(Math.max(12, t), legH, x * (W / 2 - 40), legH / 2, z * (D / 2 - 40)));
    // fronts
    const gap = 3, fz = D / 2 + t / 2 + 1;
    const fronts = []; // [x, y, w, h, kind]
    const drawerZone = p.front === 'drawers' ? H : p.front === 'mixed' ? Math.min(H * 0.4, p.drawers * 180) : 0;
    if (p.front === 'drawers' || p.front === 'mixed') {
      const n = Math.max(1, Math.round(p.drawers)), h = drawerZone / n;
      for (let i = 0; i < n; i++) fronts.push([0, y0 + H - h * (i + 0.5), W, h, 'drawer']);
    }
    if (p.front === 'doors' || p.front === 'mixed') {
      const n = Math.max(1, Math.round(p.doors)), w = W / n, h = H - drawerZone;
      for (let i = 0; i < n; i++) fronts.push([-W / 2 + w * (i + 0.5), y0 + h / 2, w, h, n > 1 ? (i < n / 2 ? 'doorR' : 'doorL') : 'doorR']);
    }
    for (const [x, y, w, h, kind] of fronts) {
      add(box(w - gap, h - gap, t, x, y, fz));
      if (p.handles === 'none') continue;
      const hx = kind === 'drawer' ? x : kind === 'doorR' ? x + w / 2 - 50 : x - w / 2 + 50;
      const hy = kind === 'drawer' ? y : Math.min(y + h / 2 - 100, Math.max(y - h / 2 + 100, 1000)); // doors: handle at ~1 m or near the top
      const hz = fz + t / 2;
      if (p.handles === 'bar') add(kind === 'drawer' ? box(Math.min(220, w * 0.4), 12, 24, hx, hy, hz + 12, true) : box(12, Math.min(260, h * 0.3), 24, hx, hy, hz + 12, true));
      else if (p.handles === 'knob') add(cylinder(14, 26, 0, 0, 0, true, 24).rotateX(Math.PI / 2).translate(hx, hy, hz + 13));
      else { const tri = cylinder(28, 14, 0, 0, 0, true, 3); tri.rotateX(Math.PI / 2); tri.rotateZ(Math.PI / 2); tri.translate(hx, hy, hz + 7); add(tri); }
    }
    let volume = 0;
    for (const { geometry } of parts) volume += geometryVolume(geometry);
    return {
      parts, volume, minWall: t,
      warnings: [
        ...(t < 12 ? ['Wooden boards under 12 mm sag. Thin boards only work in steel.'] : []),
        ...(p.height > 1200 && p.depth < 300 ? ['Tall and shallow: fix it to the wall so it cannot tip over.'] : []),
      ],
      dims: [['Outside', `${(W / 10).toFixed(0)} × ${(p.height / 10).toFixed(0)} × ${(D / 10).toFixed(0)} cm (W × H × D)`], ['Boards', `${t} mm`], ['Inside', `${p.shelves} shelves · ${fronts.length} fronts`]],
      title: { open: 'Shelf', doors: 'Cabinet', drawers: 'Chest of drawers', mixed: 'Sideboard' }[p.front],
    };
  },
};
