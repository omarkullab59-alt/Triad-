import * as THREE from 'three';
import { revolve, makeProfile, hammerDepth, textMask, canvasMask, smoothstep, angleDiff, geometryVolume } from '../revolve.js';
import { sizeSummary, MIN_WALL } from '../../lib/sizes.js';

const TOP = -Math.PI / 2; // after the display rotation this angle points up
const BOTTOM = Math.PI / 2;

export const ring = {
  id: 'ring',
  label: 'Ring',
  params: [
    { key: 'size', type: 'ringsize', label: 'Ring size', help: 'Pick EU, US or the inside width in mm. We show the other sizes for you.', default: 17.2 },
    { key: 'profile', type: 'select', label: 'Shape of the band', help: 'How the band looks if you cut through it.', default: 'flat',
      options: [['flat', 'Flat'], ['round', 'Round'], ['d', 'D-shape (flat inside, round outside)'], ['hammered', 'Hammered']] },
    { key: 'width', type: 'range', label: 'Width', help: 'How wide the band sits on your finger.', min: 1.5, max: 14, step: 0.1, unit: 'mm', default: 4 },
    { key: 'thick', type: 'range', label: 'Thickness', help: 'Metal from inside to outside. 1.6 mm or more feels solid.', min: 1, max: 3.5, step: 0.1, unit: 'mm', default: 1.8 },
    { key: 'style', type: 'select', label: 'Top', help: 'Add a flat signet plate or the TRIAD three peaks on top.', default: 'plain',
      options: [['plain', 'Plain band'], ['signet', 'Signet plate'], ['peaks', 'TRIAD three peaks']] },
    // more
    { key: 'plateL', type: 'range', more: true, show: (p) => p.style === 'signet', label: 'Plate length', help: 'Size of the flat top along the finger’s round side.', min: 6, max: 18, step: 0.5, unit: 'mm', default: 11 },
    { key: 'plateW', type: 'range', more: true, show: (p) => p.style === 'signet', label: 'Plate width', help: 'Size of the flat top along the finger.', min: 4, max: 16, step: 0.5, unit: 'mm', default: 10 },
    { key: 'plateH', type: 'range', more: true, show: (p) => p.style === 'signet', label: 'Plate height', help: 'How far the plate stands up from the band.', min: 0.5, max: 4, step: 0.1, unit: 'mm', default: 1.6 },
    { key: 'peakH', type: 'range', more: true, show: (p) => p.style === 'peaks', label: 'Peak height', help: 'How tall the three points are.', min: 1, max: 8, step: 0.1, unit: 'mm', default: 3.5 },
    { key: 'peakGap', type: 'range', more: true, show: (p) => p.style === 'peaks', label: 'Peak spacing', help: 'Distance between the three points.', min: 2, max: 9, step: 0.1, unit: 'mm', default: 4.5 },
    { key: 'hammer', type: 'range', more: true, show: (p) => p.profile === 'hammered', label: 'Hammer depth', help: 'How deep the little hammer dents are.', min: 0.05, max: 0.4, step: 0.01, unit: 'mm', default: 0.18 },
    { key: 'textIn', type: 'text', more: true, label: 'Engraving inside', help: 'Hidden text on the inside. Up to 24 letters.', default: '', max: 24 },
    { key: 'textOut', type: 'text', more: true, label: 'Engraving outside', help: 'Visible text on top (or on the signet plate).', default: '', max: 24 },
    { key: 'font', type: 'font', more: true, label: 'Engraving font', help: 'Any style or script (Japanese, Arabic, Cyrillic …) or your own font.', default: 'Inter Tight' },
    { key: 'mark', type: 'symbol', more: true, label: 'Your symbol on top', help: 'Engrave one of your own symbols on top (make them in “Symbol”).', default: '' },
    { key: 'depth', type: 'range', more: true, label: 'Engraving depth', help: 'How deep letters are cut. 0.3 mm reads well.', min: 0.1, max: 0.6, step: 0.05, unit: 'mm', default: 0.3 },
  ],
  templates: [
    { label: 'Classic band', p: { profile: 'flat', width: 4, thick: 1.8, style: 'plain' } },
    { label: 'Wedding D', p: { profile: 'd', width: 3, thick: 1.8, style: 'plain' } },
    { label: 'Signet', p: { profile: 'd', width: 4, thick: 2, style: 'signet', plateL: 11, plateW: 10, plateH: 1.6, textOut: 'T' } },
    { label: 'TRIAD peaks', p: { profile: 'flat', width: 3.5, thick: 1.8, style: 'peaks', peakH: 3.5, peakGap: 4.5, accent: true } },
    { label: 'Hammered wide', p: { profile: 'hammered', width: 8, thick: 1.6, style: 'plain', hammer: 0.2 } },
    { label: 'Thin stacker', p: { profile: 'round', width: 1.6, thick: 1.6, style: 'plain' } },
  ],

  fontsFor: (p) => [[p.font, `${p.textIn}${p.textOut}`]],
  build(p, { makeCanvas, symbolCanvas }) {
    const R = p.size / 2;
    const T = p.thick, W = p.width;
    const outerR = R + T;
    const hammered = p.profile === 'hammered';
    const textIn = (p.textIn || '').trim(), textOut = (p.textOut || '').trim();
    const engraveH = Math.min(W * 0.55, 3.2);
    const font = p.font || 'Inter Tight';
    const maskIn = textIn ? textMask(textIn, engraveH, makeCanvas, font) : null;
    const sym = p.mark && symbolCanvas ? symbolCanvas(p.mark) : null;
    const topH = p.style === 'signet' ? Math.min(p.plateW, p.plateL) * (sym ? 0.8 : 0.55) : sym ? W * 0.85 : engraveH;
    const maskOut = sym ? canvasMask(sym, topH, { useAlpha: true }) : textOut ? textMask(textOut, topH, makeCanvas, font) : null;
    const fine = maskIn || maskOut || hammered;
    const profile = makeProfile(hammered ? 'flat' : p.profile, W, T, { innerStep: maskIn ? 0.1 : 0.6, outerStep: maskOut || hammered ? 0.12 : 0.6 });

    // signet plate
    const P = outerR + p.plateH;
    const dMax = Math.atan(p.plateL / 2 / P);
    const fade = 0.45;
    const edgeE = P / Math.cos(dMax) - outerR;
    const widen = Math.max(1, p.plateW / W);
    // peaks
    const alpha = p.peakGap / outerR;
    const half = Math.max(0.8, p.peakGap * 0.55);

    const modify = (t, pt) => {
      let { u, v } = pt;
      const k = u / T; // 0 inside … 1 outside
      let accent = false;
      const dTop = angleDiff(t, TOP);
      if (p.style === 'signet') {
        const ad = Math.abs(dTop);
        if (ad <= dMax) {
          const Rt = P / Math.cos(dTop);
          u = pt.tag === 'outer' ? Rt - R : u * ((Rt - R) / T);
          v *= widen;
          accent = pt.tag === 'outer';
        } else {
          const f = 1 - smoothstep(dMax, dMax + fade, ad);
          u += edgeE * f * k;
          v *= 1 + (widen - 1) * f;
        }
      } else if (p.style === 'peaks') {
        for (const [c, h] of [[-1, 0.78], [0, 1], [1, 0.78]]) {
          const a = 1 - Math.abs(angleDiff(t, TOP + c * alpha)) * outerR / half;
          if (a > 0) {
            u += p.peakH * h * a * k;
            v *= 1 - 0.82 * a * k;
            if (a > 0.25 && pt.tag !== 'inner') accent = true;
          }
        }
      }
      if (hammered && pt.tag === 'outer') u -= hammerDepth(t * outerR, v, p.hammer, 2 * Math.PI * outerR);
      if (maskIn && pt.tag === 'inner') {
        const s = angleDiff(t, BOTTOM) * R;
        u += p.depth * maskIn.sample(-s, -pt.v);
      }
      if (maskOut && pt.tag === 'outer') {
        const s = dTop * outerR;
        u -= p.depth * maskOut.sample(s, -v);
      }
      return { u, v, accent };
    };

    const geometry = revolve({ profile, rx: R, segments: fine ? 520 : 160, modify });
    geometry.rotateX(Math.PI / 2);
    const volume = geometryVolume(geometry);

    let minWall = T;
    if (hammered) minWall = Math.min(minWall, T - p.hammer);
    if (maskIn || (maskOut && p.style !== 'signet')) minWall = Math.min(minWall, T - p.depth);
    if (maskOut && p.style === 'signet') minWall = Math.min(minWall, T + p.plateH - p.depth);
    const warnings = [];
    if (minWall < MIN_WALL) warnings.push(`Thinnest wall is ${minWall.toFixed(2)} mm. Most casters need at least ${MIN_WALL} mm: make it thicker or engrave less deep.`);
    if (W > 10 && p.size < 16) warnings.push('A very wide band on a small size can be hard to put on. Consider one size up.');

    const dims = [
      ['Size', sizeSummary(p.size)],
      ['Band', `${W} mm wide · ${T} mm thick`],
    ];
    if (p.style === 'signet') dims.push(['Signet plate', `${p.plateL} × ${p.plateW} mm, +${p.plateH} mm`]);
    if (p.style === 'peaks') dims.push(['Peaks', `${p.peakH} mm high, ${p.peakGap} mm apart`]);
    if (textIn) dims.push(['Inside', `“${textIn}”`]);
    if (textOut) dims.push(['Outside', `“${textOut}”`]);
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    const sz = box.getSize(new THREE.Vector3());
    dims.push(['Outer size', `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm`]);

    return { parts: [{ geometry }], volume, minWall, warnings, dims, title: `Ring ${sizeSummary(p.size).split(' · ')[0]}` };
  },
};
