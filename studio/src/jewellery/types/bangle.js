import * as THREE from 'three';
import { revolve, makeProfile, hammerDepth, textMask, angleDiff, geometryVolume } from '../revolve.js';
import { braceletShape, MIN_WALL } from '../../lib/sizes.js';

const BOTTOM = Math.PI / 2; // after the display rotation: underside of the wrist (where a cuff opens)

export const bangle = {
  id: 'bangle',
  label: 'Bangle / Cuff',
  params: [
    { key: 'wrist', type: 'range', label: 'Wrist size', help: 'Measure around your wrist bone with a strip of paper.', min: 120, max: 230, step: 1, unit: 'mm', default: 160 },
    { key: 'open', type: 'select', label: 'Open or closed', help: 'A cuff is open and slips on from the side. A closed bangle slides over the hand.', default: 'cuff', options: [['cuff', 'Open cuff'], ['closed', 'Closed bangle']] },
    { key: 'width', type: 'range', label: 'Width', help: 'How wide it is on your arm.', min: 2, max: 45, step: 0.5, unit: 'mm', default: 12 },
    { key: 'thick', type: 'range', label: 'Thickness', help: 'Metal thickness. Cuffs need 1.5 mm or more to keep their shape.', min: 0.8, max: 5, step: 0.1, unit: 'mm', default: 1.8 },
    { key: 'profile', type: 'select', label: 'Shape of the band', help: 'How the band looks if you cut through it.', default: 'flat', options: [['flat', 'Flat'], ['round', 'Round'], ['d', 'D-shape'], ['hammered', 'Hammered']] },
    // more
    { key: 'gap', type: 'range', more: true, show: (p) => p.open === 'cuff', label: 'Opening', help: 'Gap under the wrist. 25–30 mm lets most wrists slip in.', min: 10, max: 45, step: 1, unit: 'mm', default: 26 },
    { key: 'hammer', type: 'range', more: true, show: (p) => p.profile === 'hammered', label: 'Hammer depth', help: 'How deep the little hammer dents are.', min: 0.05, max: 0.5, step: 0.01, unit: 'mm', default: 0.22 },
    { key: 'textIn', type: 'text', more: true, label: 'Engraving inside', help: 'Hidden text on the inside. Up to 32 letters.', default: '', max: 32 },
    { key: 'font', type: 'font', more: true, label: 'Engraving font', help: 'Any style or script, or your own font.', default: 'Inter Tight' },
    { key: 'depth', type: 'range', more: true, label: 'Engraving depth', help: 'How deep letters are cut.', min: 0.1, max: 0.6, step: 0.05, unit: 'mm', default: 0.3 },
  ],
  templates: [
    { label: 'Wide cuff', p: { open: 'cuff', width: 22, thick: 1.8, profile: 'flat' } },
    { label: 'Hammered cuff', p: { open: 'cuff', width: 14, thick: 1.8, profile: 'hammered', hammer: 0.25 } },
    { label: 'Slim bangle', p: { open: 'closed', width: 4, thick: 3, profile: 'round' } },
    { label: 'D bangle', p: { open: 'closed', width: 8, thick: 2.5, profile: 'd' } },
  ],

  fontsFor: (p) => [[p.font, p.textIn]],
  build(p, { makeCanvas }) {
    const { rx, rz } = braceletShape(p.wrist, p.open === 'cuff');
    const T = p.thick, W = p.width;
    const hammered = p.profile === 'hammered';
    const text = (p.textIn || '').trim();
    const mask = text ? textMask(text, Math.min(W * 0.55, 5), makeCanvas, p.font) : null;
    const profile = makeProfile(hammered ? 'flat' : p.profile, W, T, { innerStep: mask ? 0.12 : 0.8, outerStep: hammered ? 0.15 : 0.8 });
    const gapA = p.open === 'cuff' ? 2 * Math.asin(Math.min(0.95, p.gap / 2 / rx)) : 0;
    const per = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)));
    const modify = (t, pt) => {
      let u = pt.u;
      if (hammered && pt.tag === 'outer') u -= hammerDepth(t * (per / (2 * Math.PI)), pt.v, p.hammer, per);
      if (mask && pt.tag === 'inner') u += p.depth * mask.sample(angleDiff(t, -Math.PI / 2) * rx, -pt.v);
      return { u, v: pt.v };
    };
    const fine = hammered || mask;
    const geometry = gapA
      ? revolve({ profile, rx, rz, segments: fine ? 900 : 200, start: BOTTOM + gapA / 2, end: BOTTOM + Math.PI * 2 - gapA / 2, modify })
      : revolve({ profile, rx, rz, segments: fine ? 900 : 200, modify });
    geometry.rotateX(Math.PI / 2);
    const volume = geometryVolume(geometry);

    let minWall = T;
    if (hammered) minWall -= p.hammer;
    if (mask) minWall = Math.min(minWall, T - p.depth);
    const warnings = [];
    if (minWall < MIN_WALL) warnings.push(`Thinnest wall is ${minWall.toFixed(2)} mm. Most casters need at least ${MIN_WALL} mm.`);
    if (p.open === 'cuff' && T < 1.4 && W > 8) warnings.push('A thin, wide cuff bends easily. 1.5 mm or more holds its shape.');
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    const sz = box.getSize(new THREE.Vector3());
    return {
      parts: [{ geometry }], volume, minWall, warnings,
      dims: [
        ['Wrist', `${p.wrist} mm around`],
        ['Inside', `${(rx * 2).toFixed(1)} × ${(rz * 2).toFixed(1)} mm${p.open === 'cuff' ? ` · opening ${p.gap} mm` : ' (slides over the hand)'}`],
        ['Band', `${W} mm wide · ${T} mm thick`],
        ['Outer size', `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm`],
      ],
      title: p.open === 'cuff' ? 'Cuff' : 'Bangle',
    };
  },
};
