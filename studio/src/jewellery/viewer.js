// three.js stage: cool, misty studio light, turntable controls, pinch / double-tap zoom, snapshots.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const MATERIALS = {
  silver: { label: 'Silver 925', swatch: '#d9dadc', color: '#f1efea', roughness: 0.2, metalness: 1 },
  chrome: { label: 'Chrome', swatch: '#b7bcc2', color: '#d4d8dc', roughness: 0.04, metalness: 1 },
  gold: { label: 'Gold', swatch: '#e2bb63', color: '#f2c867', roughness: 0.16, metalness: 1 },
  black: { label: 'Black silver', swatch: '#3a3b3d', color: '#47494c', roughness: 0.42, metalness: 1 },
};
export const ACCENT = { label: 'Lime enamel', swatch: '#c4ef2f' };

function makeMaterial(key) {
  const m = MATERIALS[key] || MATERIALS.silver;
  return new THREE.MeshPhysicalMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness, envMapIntensity: 1.15 });
}
function makeEnamel() {
  return new THREE.MeshPhysicalMaterial({ color: '#9fd10f', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 });
}

export function createViewer(container, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xeef4ff, 1.4);
  key.position.set(-40, 80, 60);
  scene.add(key, new THREE.HemisphereLight(0xe8eef2, 0x30343a, 0.5));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 5000);
  camera.position.set(30, 22, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.12;
  controls.rotateSpeed = 0.9;

  const root = new THREE.Group();
  scene.add(root);
  let mats = [makeMaterial('silver'), makeEnamel()];
  let radius = 20;
  let frames = 2;
  let raf = 0;

  const tick = () => {
    raf = 0;
    if (controls.update() || frames > 0) render();
    if (frames-- > 0 || controls.enableDamping) raf = requestAnimationFrame(tick);
  };
  const wake = (n = 40) => { frames = Math.max(frames, n); if (!raf) raf = requestAnimationFrame(tick); };
  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', () => wake(2));
  // idle: stop the loop when nothing moves (saves battery)
  controls.addEventListener('end', () => wake(30));

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wake(2);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // double-tap / double-click: zoom in on that spot, again to zoom back out
  let lastTap = 0, zoomed = false, baseDist = 0;
  function animateTo(dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    const from = camera.position.distanceTo(controls.target);
    if (reducedMotion) { camera.position.copy(controls.target).addScaledVector(dir, dist); wake(2); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 380);
      const e = 1 - (1 - k) ** 3;
      camera.position.copy(controls.target).addScaledVector(dir, from + (dist - from) * e);
      render();
      if (k < 1) requestAnimationFrame(step); else wake(2);
    };
    requestAnimationFrame(step);
  }
  function toggleZoom() {
    const d = camera.position.distanceTo(controls.target);
    if (!zoomed) { baseDist = d; animateTo(d * 0.45); } else animateTo(baseDist || d / 0.45);
    zoomed = !zoomed;
  }
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    const now = performance.now();
    if (now - lastTap < 300) { toggleZoom(); lastTap = 0; } else lastTap = now;
  });
  renderer.domElement.addEventListener('dblclick', toggleZoom);

  function clear() {
    for (const child of [...root.children]) { root.remove(child); child.geometry?.dispose(); child.dispose?.(); }
  }

  return {
    renderer, scene, camera, controls,
    setMaterial(metal, accentOn) {
      mats.forEach((m) => m.dispose());
      const main = makeMaterial(metal);
      mats = [main, accentOn ? makeEnamel() : main];
      for (const m of root.children) m.material = mats;
      wake(2);
    },
    setParts(parts) {
      clear();
      for (const part of parts) {
        // only our own builders mark metal (0) / enamel (1) groups; anything else is all metal
        if (!part.geometry.userData.groups) { part.geometry.clearGroups(); part.geometry.addGroup(0, Infinity, 0); part.geometry.userData.groups = true; }
        const mesh = part.instances
          ? new THREE.InstancedMesh(part.geometry, mats, part.instances.length)
          : new THREE.Mesh(part.geometry, mats);
        if (part.instances) part.instances.forEach((m, i) => mesh.setMatrixAt(i, m));
        root.add(mesh);
      }
      // centre the piece
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) { wake(2); return; }
      const c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);
      root.updateMatrixWorld(true);
      radius = box.getSize(new THREE.Vector3()).length() / 2;
      wake(2);
    },
    /** Matrix that maps part coordinates to centred world coordinates (for STL export). */
    exportMatrix: () => root.matrixWorld.clone(),
    fit() {
      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius / Math.sin(fov / 2)) * (camera.aspect < 1 ? 1.25 / Math.max(camera.aspect, 0.55) : 1.15);
      controls.target.set(0, 0, 0);
      const dir = new THREE.Vector3(0.42, 0.34, 1).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.near = Math.max(0.1, dist / 100); camera.far = dist * 20;
      camera.updateProjectionMatrix();
      controls.minDistance = radius * 0.6; controls.maxDistance = dist * 4;
      zoomed = false;
      wake(2);
    },
    nudge(dx, dy) {
      // keyboard / button rotation around the piece
      const offset = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(offset);
      sph.theta += dx; sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + dy));
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
      camera.lookAt(controls.target);
      wake(2);
    },
    zoom(f) { animateTo(camera.position.distanceTo(controls.target) * f); },
    /** Render at an exact pixel size (transparent background), return a canvas. */
    snapshot(w, h, { fill = 0.62 } = {}) {
      const size = new THREE.Vector2(); renderer.getSize(size);
      const pr = renderer.getPixelRatio();
      const aspect = camera.aspect;
      const pos = camera.position.clone();
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // frame the piece to fill the image nicely
      const fov = (camera.fov * Math.PI) / 180;
      const dist = radius / Math.sin(fov / 2) / fill * (camera.aspect < 1 ? 1 / camera.aspect * 0.8 : 1);
      camera.position.copy(controls.target).add(pos.clone().sub(controls.target).normalize().multiplyScalar(dist));
      camera.updateProjectionMatrix();
      render();
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      out.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h);
      renderer.setPixelRatio(pr);
      renderer.setSize(size.x, size.y, false);
      camera.aspect = aspect;
      camera.position.copy(pos);
      camera.updateProjectionMatrix();
      render();
      return out;
    },
    render,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      clear();
      mats.forEach((m) => m.dispose());
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
