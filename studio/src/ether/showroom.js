// ETHER — showroom: architecture, editable objects, lighting rig, mirror floor, fog and light shafts.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { makeMaterial, applySpec } from './materials.js';

/** Geometry for an editable environment object (unit size, standing on y = 0). */
export function objectGeometry(type) {
  switch (type) {
    case 'cube': { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }
    case 'sphere': { const g = new THREE.SphereGeometry(1, 48, 32); g.translate(0, 1, 0); return g; }
    case 'cylinder': { const g = new THREE.CylinderGeometry(0.6, 0.6, 1.6, 48); g.translate(0, 0.8, 0); return g; }
    case 'cone': { const g = new THREE.ConeGeometry(0.7, 1.8, 48); g.translate(0, 0.9, 0); return g; }
    case 'torus': { const g = new THREE.TorusGeometry(1, 0.06, 24, 128); return g; }
    case 'pillar': { const g = new THREE.CylinderGeometry(0.28, 0.32, 7, 48); g.translate(0, 3.5, 0); return g; }
    case 'monolith': { const g = new THREE.BoxGeometry(1.1, 4.2, 0.35); g.translate(0, 2.1, 0); return g; }
    case 'platform': {
      const pts = [[0, 0], [1.75, 0], [1.8, 0.04], [1.8, 0.2], [1.72, 0.26], [0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheGeometry(pts, 96);
    }
    case 'arch': {
      const s = new THREE.Shape(); s.moveTo(-2.4, 0); s.lineTo(-2.4, 3); s.absarc(0, 3, 2.4, Math.PI, 0, true); s.lineTo(2.4, 0); s.lineTo(1.8, 0); s.lineTo(1.8, 3); s.absarc(0, 3, 1.8, 0, Math.PI, false); s.lineTo(-1.8, 0); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 48 });
      g.translate(0, 0, -0.25); return g;
    }
    case 'stairs': {
      const parts = []; for (let i = 0; i < 7; i++) { const b = new THREE.BoxGeometry(2.4, 0.22, 0.42); b.translate(0, 0.11 + i * 0.22, -i * 0.42); parts.push(b); }
      return mergeBoxes(parts);
    }
    case 'blob': {
      const g = new THREE.IcosahedronGeometry(1, 24); const p = g.attributes.position; const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.22 * Math.sin(v.x * 3.1 + 1) * Math.sin(v.y * 2.7) + 0.12 * Math.sin(v.z * 4.3); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); g.translate(0, 1.1, 0); return g;
    }
    case 'panel': { const g = new THREE.BoxGeometry(1, 1, 1); return g; }
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}
function mergeBoxes(list) {
  const pos = [], nor = [], uv = [], idx = []; let o = 0;
  for (const g of list) { const n = g.attributes.position.count; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array); idx.push(...g.index.array.map((i) => i + o)); o += n; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

export function createShowroom(scene, renderer) {
  const root = new THREE.Group(); root.name = 'showroom';
  scene.add(root);
  const objects = new Map(); // id → mesh
  // room shell: a huge soft white cyclorama (curved floor-to-wall), so there are no hard corners
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 22, 96, 1, true), new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.95, side: THREE.BackSide }));
  cyc.position.y = 11; cyc.receiveShadow = false; root.add(cyc);
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(26, 64), new THREE.MeshStandardMaterial({ color: '#f6f7f8', roughness: 1, side: THREE.BackSide }));
  ceiling.rotation.x = -Math.PI / 2; ceiling.position.y = 22; root.add(ceiling);
  // floor: glossy, receives shadows; an optional mirror (Reflector) lies under it and shows through
  const floorMat = new THREE.MeshPhysicalMaterial({ color: '#f4f5f6', roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.86 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(26, 96), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.y = 0.001; root.add(floor);
  let mirror = null;
  function setMirror(on) {
    if (on && !mirror) {
      const size = new THREE.Vector2(); renderer.getSize(size);
      mirror = new Reflector(new THREE.CircleGeometry(26, 96), { textureWidth: Math.min(1024, size.x * renderer.getPixelRatio()), textureHeight: Math.min(1024, size.y * renderer.getPixelRatio()), color: 0xb9bcc0 });
      mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.002; root.add(mirror);
    }
    if (!on && mirror) { root.remove(mirror); mirror.dispose(); mirror = null; }
    floorMat.opacity = on ? 0.7 : 1; floorMat.transparent = on; floorMat.needsUpdate = true;
  }
  // lighting rig
  const hemi = new THREE.HemisphereLight('#ffffff', '#7d868e', 0.6);
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 40 });
  const fill = new THREE.DirectionalLight('#dfeaf2', 0.7); fill.position.set(-6, 4, 6);
  const rim = new THREE.SpotLight('#cfe6f2', 3, 30, 0.45, 0.6, 1.2); rim.position.set(0, 9, -7); rim.target.position.set(0, 1.2, 0);
  const top = new THREE.SpotLight('#ffffff', 2.5, 25, 0.35, 0.8, 1.2); top.position.set(0, 12, 0.5); top.target.position.set(0, 0, 0);
  root.add(hemi, key, key.target, fill, rim, rim.target, top, top.target);
  // fake volumetric light shafts (additive cones under the spotlights)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color('#ffffff') }, strength: { value: 0.16 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); gl_FragColor = vec4(color * strength * edge * smoothstep(0.0, 1.0, vY), 1.0); }',
  });
  const shafts = new THREE.Group();
  const shaft = (pos, len, r) => { const g = new THREE.ConeGeometry(r, len, 48, 1, true); g.translate(0, -len / 2, 0); const m = new THREE.Mesh(g, shaftMat); m.position.copy(pos); m.renderOrder = 5; shafts.add(m); return m; };
  shaft(new THREE.Vector3(0, 12, 0.5), 12, 3.2);
  shaft(new THREE.Vector3(-5, 11, -4), 11, 1.4);
  shaft(new THREE.Vector3(5, 11, -4), 11, 1.4);
  root.add(shafts);

  function setLight(l, env) {
    const a = THREE.MathUtils.degToRad(l.angle);
    key.position.set(Math.sin(a) * 7, 9, Math.cos(a) * 7);
    key.intensity = l.key; key.color.set(l.keyColor);
    fill.intensity = l.fill; rim.intensity = l.rim; rim.color.set(l.rimColor); top.intensity = l.key * 0.9;
    hemi.intensity = l.ambient;
    const q = l.shadows === 'high' ? 4096 : 2048;
    key.castShadow = l.shadows !== 'off';
    if (key.shadow.mapSize.x !== q) { key.shadow.mapSize.set(q, q); key.shadow.map?.dispose(); key.shadow.map = null; }
    key.shadow.radius = l.shadows === 'high' ? 3 : 6;
    shaftMat.uniforms.color.value.set(l.rimColor).lerp(new THREE.Color('#ffffff'), 0.5);
    shaftMat.uniforms.strength.value = (env?.preset === 'void' || env?.preset === 'ice' ? 0.22 : 0.06);
  }
  function setEnv(e) {
    scene.background = new THREE.Color(e.bg);
    scene.fog = e.fogDensity > 0 ? new THREE.FogExp2(e.fog, e.fogDensity) : null;
    cyc.material.color.set(e.bg); ceiling.material.color.set(e.bg).offsetHSL(0, 0, 0.02);
    floorMat.color.set(e.floor);
    setMirror(e.reflect);
    shafts.visible = e.cones;
  }
  /** Sync editable objects with the state list (add, update, remove). */
  function setObjects(list) {
    const keep = new Set(list.map((o) => o.id));
    for (const [id, m] of objects) if (!keep.has(id)) { root.remove(m); m.geometry.dispose(); m.material.dispose(); objects.delete(id); }
    for (const o of list) {
      let m = objects.get(o.id);
      if (!m || m.userData.type !== o.type) {
        if (m) { root.remove(m); m.geometry.dispose(); m.material.dispose(); }
        m = new THREE.Mesh(objectGeometry(o.type), makeMaterial(o.mat));
        m.castShadow = o.type !== 'panel'; m.receiveShadow = true;
        m.userData = { type: o.type, id: o.id, editable: true };
        objects.set(o.id, m); root.add(m);
      }
      m.position.fromArray(o.pos); m.rotation.set(o.rot[0], o.rot[1], o.rot[2]); m.scale.fromArray(o.scale);
      applySpec(m.material, o.mat);
      m.name = o.name || o.type;
    }
  }
  return {
    root, objects, setLight, setEnv, setObjects,
    get mirror() { return mirror; },
    dispose() {
      setMirror(false);
      root.traverse((x) => { x.geometry?.dispose(); if (x.material && x.material !== shaftMat) x.material.dispose?.(); });
      shaftMat.dispose();
      scene.remove(root);
    },
  };
}
