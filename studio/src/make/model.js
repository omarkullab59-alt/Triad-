// Upload an existing 3D design (STL, OBJ, GLB/GLTF, PLY) and keep working on it: size, turn, material, destroy, export.
import * as THREE from 'three';
import { geometryVolume } from '../jewellery/revolve.js';

export async function loadModelFile(file) {
  if (file.size > 60e6) throw new Error('Files up to 60 MB, please.');
  const ext = file.name.split('.').pop().toLowerCase();
  const buf = await file.arrayBuffer();
  let geometries = [];
  if (ext === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    geometries = [new STLLoader().parse(buf)];
  } else if (ext === 'ply') {
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    geometries = [new PLYLoader().parse(buf)];
  } else if (ext === 'obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    geometries = collect(new OBJLoader().parse(new TextDecoder().decode(buf)));
  } else if (ext === 'glb' || ext === 'gltf') {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    geometries = collect(gltf.scene);
  } else if (ext === 'fbx') {
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    geometries = collect(new FBXLoader().parse(buf, ''));
  } else if (ext === '3mf') {
    const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
    geometries = collect(new ThreeMFLoader().parse(buf));
  } else if (ext === 'dae') {
    const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
    geometries = collect(new ColladaLoader().parse(new TextDecoder().decode(buf), '').scene);
  } else throw new Error('Please choose an STL, OBJ, GLB/GLTF, FBX, 3MF, DAE or PLY file.');
  if (!geometries.length) throw new Error('No 3D shape found in this file.');
  // merge into one position-only geometry
  const arrays = geometries.map((g) => (g.index ? g.toNonIndexed() : g).attributes.position.array);
  const total = arrays.reduce((s, a) => s + a.length, 0);
  if (total / 9 > 1.5e6) throw new Error('This model has too many triangles (max 1.5 million).');
  const pos = new Float32Array(total);
  let o = 0;
  for (const a of arrays) { pos.set(a, o); o += a.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeBoundingBox();
  g.translate(...g.boundingBox.getCenter(new THREE.Vector3()).negate().toArray());
  return { geometry: g, name: file.name };
}

function collect(root) {
  const out = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh && o.geometry?.attributes.position) out.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  return out;
}

export const model = {
  id: 'model',
  label: 'Upload a 3D model',
  category: 'make',
  materials: ['silver', 'gold', 'chrome', 'black', 'ceramic', 'stoneware', 'oak', 'walnut', 'steel', 'brass', 'concrete'],
  defaultMaterial: 'silver',
  minWall: 0.8,
  params: [
    { key: 'file', type: 'model', label: 'Your model', help: 'From Blender or any 3D app: GLB/GLTF, STL, OBJ, FBX, 3MF, DAE or PLY. It stays on your device.', default: '' },
    { key: 'size', type: 'range', label: 'Size', help: 'Longest side of the model.', min: 2, max: 2000, step: 0.5, unit: 'mm', default: 30 },
    { key: 'rx', type: 'select', label: 'Turn forward', help: 'Tip the model over if it lies the wrong way.', default: '0', options: [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']] },
    { key: 'ry', type: 'select', label: 'Turn around', help: 'Spin the model around its upright axis.', default: '0', options: [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']] },
    { key: 'wall', type: 'range', more: true, label: 'Thinnest wall (your estimate)', help: 'We can’t measure every model. Tell us the thinnest part so the warnings and destroy mode fit.', min: 0.3, max: 30, step: 0.1, unit: 'mm', default: 1.5 },
  ],
  templates: [],
  build(p, ctx) {
    if (!ctx.model) return { parts: [], volume: 0, minWall: 0, empty: true, warnings: ['Upload a model to start.'], dims: [], title: 'Your model' };
    const g = ctx.model.geometry.clone();
    g.rotateX((Number(p.rx) * Math.PI) / 180);
    g.rotateY((Number(p.ry) * Math.PI) / 180);
    g.computeBoundingBox();
    const s = g.boundingBox.getSize(new THREE.Vector3());
    g.scale(...Array(3).fill(p.size / Math.max(s.x, s.y, s.z, 1e-6)));
    g.computeVertexNormals();
    g.computeBoundingBox();
    const sz = g.boundingBox.getSize(new THREE.Vector3());
    const volume = geometryVolume(g);
    return {
      parts: [{ geometry: g }], volume, minWall: p.wall,
      warnings: [...(p.wall < 0.8 ? ['Parts under 0.8 mm are hard to cast or print.'] : []), 'Weight is only right if the model is closed (watertight).'],
      dims: [['File', ctx.model.name], ['Size', `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm`], ['Triangles', (g.attributes.position.count / 3).toLocaleString('en')]],
      title: ctx.model.name.replace(/\.\w+$/, ''),
    };
  },
};
