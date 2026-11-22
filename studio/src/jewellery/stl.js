// Binary STL writer for our parts list ({ geometry, instances?, matrix? }). Units: millimetres.
import * as THREE from 'three';

export function partsToSTL(parts, matrix = new THREE.Matrix4()) {
  let count = 0;
  for (const part of parts) {
    const g = part.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    count += tris * (part.instances?.length || 1);
  }
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  const header = 'TRIAD Studio - binary STL, units: mm';
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, count, true);
  let o = 84;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
  const m = new THREE.Matrix4();
  for (const part of parts) {
    const pos = part.geometry.attributes.position;
    const index = part.geometry.index;
    const tris = (index ? index.count : pos.count) / 3;
    for (const inst of part.instances || [null]) {
      m.copy(matrix);
      if (inst) m.multiply(inst);
      for (let t = 0; t < tris; t++) {
        const i0 = index ? index.getX(t * 3) : t * 3, i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1, i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m);
        n.subVectors(c, b).cross(e.subVectors(a, b)).normalize();
        for (const v of [n, a, b, c]) { view.setFloat32(o, v.x, true); view.setFloat32(o + 4, v.y, true); view.setFloat32(o + 8, v.z, true); o += 12; }
        view.setUint16(o, 0, true); o += 2;
      }
    }
  }
  return buf;
}
