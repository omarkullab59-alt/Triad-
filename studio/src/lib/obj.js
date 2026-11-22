// Wavefront OBJ + MTL writer for our parts list ({ geometry, instances? }). Units: millimetres.
// OBJ is the format Bryce, Blender, Cinema 4D, Maya, ZBrush, Daz Studio and most 3D apps import.
// Material groups (0 metal, 1 accent, 2 engraving fill, 3 print) become separate `usemtl` sections.
import * as THREE from 'three';

const NAMES = ['triad_main', 'triad_accent', 'triad_fill', 'triad_print'];
const f = (n) => (Math.abs(n) < 1e-7 ? '0' : Number(n.toFixed(5)).toString());

/**
 * @param parts    [{ geometry, instances? }]
 * @param matrix   world matrix applied to every part (centring)
 * @param looks    per material group: { color: '#rrggbb', metalness, roughness } (index = group)
 * @param name     base name (used for the .mtl reference and the object name)
 */
export function partsToOBJ(parts, { matrix = new THREE.Matrix4(), looks = [], name = 'triad' } = {}) {
  const safe = String(name).replace(/[^\w-]+/g, '_').slice(0, 60) || 'triad';
  const out = [`# TRIAD Studio — units: millimetres`, `mtllib ${safe}.mtl`];
  const used = new Set();
  let vBase = 1, obj = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  for (const part of parts) {
    const g = part.geometry;
    const pos = g.attributes.position, nor = g.attributes.normal, index = g.index;
    if (!pos) continue;
    const count = index ? index.count : pos.count;
    const groups = g.groups?.length ? g.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const inst of part.instances || [null]) {
      m.copy(matrix); if (inst) m.multiply(inst);
      nm.getNormalMatrix(m);
      out.push(`o ${safe}_${++obj}`);
      const lines = [];
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); lines.push(`v ${f(v.x)} ${f(v.y)} ${f(v.z)}`); }
      if (nor) for (let i = 0; i < nor.count; i++) { n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); lines.push(`vn ${f(n.x)} ${f(n.y)} ${f(n.z)}`); }
      out.push(lines.join('\n'));
      for (const grp of groups) {
        const end = Math.min(count, grp.start + (Number.isFinite(grp.count) ? grp.count : count));
        if (end <= grp.start) continue;
        const mi = Math.min(3, Math.max(0, grp.materialIndex || 0));
        used.add(mi);
        const faces = [`usemtl ${NAMES[mi]}`];
        for (let t = grp.start; t + 2 < end; t += 3) {
          const a = (index ? index.getX(t) : t) + vBase, b = (index ? index.getX(t + 1) : t + 1) + vBase, c = (index ? index.getX(t + 2) : t + 2) + vBase;
          faces.push(nor ? `f ${a}//${a} ${b}//${b} ${c}//${c}` : `f ${a} ${b} ${c}`);
        }
        out.push(faces.join('\n'));
      }
      vBase += pos.count;
    }
  }
  const rgb = (hex) => { const c = new THREE.Color(hex || '#cccccc'); return `${f(c.r)} ${f(c.g)} ${f(c.b)}`; };
  const mtl = ['# TRIAD Studio materials'];
  for (const mi of [...used].sort()) {
    const l = looks[mi] || looks[0] || {};
    const metal = (l.metalness || 0) > 0.5;
    const shine = Math.round((1 - Math.min(1, l.roughness ?? 0.5)) * 900 + 10);
    mtl.push(`newmtl ${NAMES[mi]}`, `Kd ${rgb(l.color)}`, `Ka 0 0 0`, `Ks ${metal ? rgb(l.color) : '0.2 0.2 0.2'}`, `Ns ${shine}`, `illum 2`, `d 1`, '');
  }
  return { obj: `${out.join('\n')}\n`, mtl: `${mtl.join('\n')}\n`, base: safe };
}
