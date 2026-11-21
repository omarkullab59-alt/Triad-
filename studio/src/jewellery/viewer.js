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
// Home objects (same keys as HOME in lib/sizes.js; 'silver' is shared)
export const HOME_LOOKS = {
  ceramic: { label: 'White ceramic', swatch: '#f2f0ea', color: '#f4f2ec', roughness: 0.25, metalness: 0, clearcoat: 0.6 },
  stoneware: { label: 'Dark stoneware', swatch: '#3b3833', color: '#45413b', roughness: 0.7, metalness: 0 },
  oak: { label: 'Oak', swatch: '#c9a26b', color: '#c49a62', roughness: 0.65, metalness: 0 },
  walnut: { label: 'Walnut', swatch: '#5d4030', color: '#5e3f2c', roughness: 0.6, metalness: 0 },
  steel: { label: 'Stainless steel', swatch: '#b9bcbf', color: '#c9ccce', roughness: 0.28, metalness: 1 },
  silver: MATERIALS.silver,
  brass: { label: 'Brass', swatch: '#c8a24a', color: '#d6b25a', roughness: 0.3, metalness: 1 },
  black: { label: 'Black lacquer', swatch: '#151515', color: '#1a1a1a', roughness: 0.35, metalness: 0, clearcoat: 0.8 },
  concrete: { label: 'Concrete', swatch: '#9c9b97', color: '#a3a29d', roughness: 0.95, metalness: 0 },
  bronze: { label: 'Bronze', swatch: '#8a6a3e', color: '#a07a45', roughness: 0.38, metalness: 1 },
  marble: { label: 'Marble', swatch: '#ece9e3', color: '#efece6', roughness: 0.18, metalness: 0, clearcoat: 0.7 },
  plaster: { label: 'Plaster', swatch: '#f4f1ea', color: '#f2efe8', roughness: 0.92, metalness: 0 },
  terracotta: { label: 'Terracotta', swatch: '#b5603a', color: '#b45f3b', roughness: 0.85, metalness: 0 },
  resin: { label: 'Black resin', swatch: '#1c1c1c', color: '#202020', roughness: 0.3, metalness: 0, clearcoat: 1 },
  gold: MATERIALS.gold,
  knit_grey: { label: 'Grey knit', swatch: '#8a8d90', color: '#8c8f92', roughness: 0.97, metalness: 0, sheen: 1 },
  knit_black: { label: 'Black knit', swatch: '#1c1c1c', color: '#222222', roughness: 0.97, metalness: 0, sheen: 1 },
  knit_cream: { label: 'Cream knit', swatch: '#e9e3d6', color: '#e6e0d2', roughness: 0.97, metalness: 0, sheen: 1 },
  cotton: { label: 'Cotton twill', swatch: '#efeee9', color: '#ecebe5', roughness: 0.92, metalness: 0, sheen: 0.6 },
  denim: { label: 'Denim', swatch: '#3b4a63', color: '#3e4d66', roughness: 0.93, metalness: 0, sheen: 0.5 },
  nylon: { label: 'Black nylon', swatch: '#202020', color: '#242424', roughness: 0.55, metalness: 0, clearcoat: 0.2 },
  leather_black: { label: 'Black leather', swatch: '#151515', color: '#181818', roughness: 0.48, metalness: 0, clearcoat: 0.35 },
  leather_brown: { label: 'Brown leather', swatch: '#5a3a24', color: '#5e3c26', roughness: 0.5, metalness: 0, clearcoat: 0.3 },
  film: { label: 'Tape film (PE)', swatch: '#ffffff', color: '#ffffff', roughness: 0.32, metalness: 0, clearcoat: 0.6 },
};
export const ACCENT = { label: 'Lime enamel', swatch: '#c4ef2f' };

export const lookOf = (key, home) => (home ? HOME_LOOKS[key] : MATERIALS[key]) || MATERIALS[key] || HOME_LOOKS[key] || MATERIALS.silver;
function makeMaterial(key, home, vertexColors = false, color) {
  const m = lookOf(key, home);
  // a custom colour on metal = coloured plating / anodising look; on other materials = paint, glaze or dye
  return new THREE.MeshPhysicalMaterial({ color: color || m.color, roughness: m.roughness, metalness: color && m.metalness ? 0.85 : m.metalness, clearcoat: m.clearcoat || 0, sheen: m.sheen || 0, sheenRoughness: 0.8, envMapIntensity: 1.15, vertexColors });
}
function makeEnamel(vertexColors = false, color = '#9fd10f') {
  return new THREE.MeshPhysicalMaterial({ vertexColors, color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 });
}

/* One renderer for the whole session: switching tools reuses the WebGL context, the studio
   environment and every compiled shader (a new renderer per tool froze the page for 1–2 s). */
let shared = null;
function sharedRenderer() {
  if (shared && !shared.lost) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const s = { renderer, env, lost: false };
  renderer.domElement.addEventListener('webglcontextlost', () => { s.lost = true; });
  shared = s;
  return s;
}

const VIEWS = {
  persp: [0.42, 0.34, 1], front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], land: [0.62, 0.13, 1],
};
export const VIEW_NAMES = Object.keys(VIEWS).filter((k) => k !== 'land');

export function createViewer(container, { reducedMotion = false } = {}) {
  const { renderer, env } = sharedRenderer();
  const ac = new AbortController();
  const on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: ac.signal });
  renderer.domElement.style.visibility = '';
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');

  const scene = new THREE.Scene();
  scene.environment = env;
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
  let grid = null, gridOn = false, wire = false;
  let curView = 'persp';
  /* Landscape scene (Bryce-style): procedural terrain, water, misty sky and fog around the piece.
     Only for looking at and for images; never part of STL / OBJ / GLB exports. */
  let land = null, landOn = false, landSeed = 7;
  function hash2(x, y) { const h = Math.sin(x * 127.1 + y * 311.7 + landSeed * 74.7) * 43758.5453; return h - Math.floor(h); }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  const fbm = (x, y) => { let t = 0, amp = 0.55, fr = 1; for (let o = 0; o < 6; o++) { t += amp * vnoise(x * fr, y * fr); fr *= 2.03; amp *= 0.5; } return t; };
  function placeLand() {
    if (land) { scene.remove(land); land.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); land = null; scene.fog = null; }
    if (!landOn) return;
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const r = Math.max(radius, 1), y0 = box.min.y - r * 0.02;
    land = new THREE.Group();
    // terrain: a flat plateau under the piece, mountains rising further out, valleys below the water line
    const S = r * 130, N = 220;
    const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color('#2e3532'), cMid = new THREE.Color('#6d675d'), cHigh = new THREE.Color('#f2f3f4'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z) / r;
      const mask = THREE.MathUtils.smoothstep(d, 2.2, 10);
      const ridge = 1 - Math.abs(fbm(x / (r * 9) + 3.1, z / (r * 9) - 1.7));
      const h = mask * (fbm(x / (r * 7), z / (r * 7)) * r * 2.6 + ridge * ridge * r * 7 * THREE.MathUtils.smoothstep(d, 12, 34)) - (1 - mask) * 0;
      pos.setY(i, y0 + h);
      const k = THREE.MathUtils.clamp((h + r) / (r * 8.5), 0, 1);
      c.copy(cLow).lerp(cMid, Math.min(1, k * 1.8)); if (k > 0.62) c.lerp(cHigh, (k - 0.62) / 0.38);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    land.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.5 })));
    // water in the valleys
    const water = new THREE.Mesh(new THREE.CircleGeometry(S * 0.5, 64), new THREE.MeshPhysicalMaterial({ color: '#34434d', roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2; water.position.y = y0 - r * 0.45;
    land.add(water);
    // misty sky dome
    const skyGeo = new THREE.SphereGeometry(r * 80, 32, 16);
    const sky = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#4d6478') }, hor: { value: new THREE.Color('#cfd7dc') }, base: { value: y0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform float base; varying vec3 vP; void main(){ float h = clamp((normalize(vP - vec3(0.0, base, 0.0)).y) * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.7)), 1.0); }',
    }));
    sky.renderOrder = -1;
    land.add(sky);
    scene.fog = new THREE.Fog('#cfd7dc', r * 16, r * 75);
    scene.add(land);
  }
  function placeGrid() {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
    if (!gridOn) return;
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = Math.max(10, radius * 4);
    const step = 10 ** Math.floor(Math.log10(size / 8)); // 1, 10 or 100 mm cells
    const div = Math.max(2, Math.min(200, Math.round(size / step)));
    const night = document.documentElement.classList.contains('night');
    grid = new THREE.GridHelper(div * step, div, night ? 0x5a6066 : 0x8a9096, night ? 0x2c3034 : 0xc2c7cb);
    grid.material.transparent = true; grid.material.opacity = 0.7; grid.material.depthWrite = false;
    grid.position.y = box.min.y - 0.01;
    scene.add(grid);
  }
  let mats = [makeMaterial('silver'), makeEnamel(), makeEnamel(), makeEnamel()];
  let printCanvas = null, lastLook = null, printRepeat = false;
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
  on(renderer.domElement, 'pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    const now = performance.now();
    if (now - lastTap < 300) { toggleZoom(); lastTap = 0; } else lastTap = now;
  });
  on(renderer.domElement, 'dblclick', toggleZoom);

  function makePrint() {
    const m = lastLook?.m || MATERIALS.silver;
    if (!printCanvas) return new THREE.MeshPhysicalMaterial({ color: lastLook?.color || m.color, roughness: m.roughness, metalness: m.metalness });
    const tex = new THREE.CanvasTexture(printCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (printRepeat) tex.wrapS = THREE.RepeatWrapping;
    return new THREE.MeshPhysicalMaterial({ map: tex, roughness: Math.max(0.25, m.roughness), metalness: m.metalness * 0.6, clearcoat: 0.3, vertexColors: lastLook?.dirty || false });
  }
  function clear() {
    for (const child of [...root.children]) { root.remove(child); child.geometry?.dispose(); child.dispose?.(); }
  }

  return {
    renderer, scene, camera, controls,
    setMaterial(metal, accentOn, { home = false, dirty = false, color = '', accentColor = '', fillColor = '', partMaterial = '' } = {}) {
      new Set(mats).forEach((m) => { m.map?.dispose(); m.dispose(); });
      const main = makeMaterial(metal, home, dirty, color);
      // lime is shown a touch darker so it reads like lime under studio light
      const tone = (c) => (!c || c.toLowerCase() === '#c4ef2f' ? '#9fd10f' : c);
      const enamel = makeEnamel(dirty, tone(accentColor));
      const fill = makeEnamel(dirty, tone(fillColor || accentColor));
      lastLook = { m: lookOf(metal, home), dirty, color };
      // a second real material for one part (e.g. the metal buckle of a leather belt); lime accent still wins
      mats = [main, accentOn ? enamel : partMaterial ? makeMaterial(partMaterial, false, dirty) : main, fill, makePrint()];
      for (const m of mats) m.wireframe = wire;
      for (const m of root.children) m.material = mats;
      wake(2);
    },
    /** Texture for printed areas (group 3); null removes it. */
    setPrint(canvas, { repeat = false } = {}) {
      printCanvas = canvas;
      printRepeat = repeat;
      mats[3]?.map?.dispose(); mats[3]?.dispose();
      mats[3] = makePrint();
      mats[3].wireframe = wire;
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
      placeGrid();
      placeLand();
      wake(2);
    },
    /** Bryce-style landscape around the piece (terrain, water, sky, fog); `seed` makes a new landscape. */
    setLandscape(v, seed) {
      landOn = !!v; if (seed !== undefined) landSeed = seed;
      if (landOn && gridOn) { gridOn = false; placeGrid(); }
      placeLand();
      if (landOn) this.setView('land', 1.8); // low camera, wider: shows horizon and mountains
      wake(2); return landOn;
    },
    get landscape() { return landOn; },
    /** Triangles and size (mm) of what is on screen. */
    stats() {
      let tris = 0;
      for (const m of root.children) {
        const g = m.geometry;
        const n = g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
        tris += n * (m.isInstancedMesh ? m.count : 1);
      }
      const box = new THREE.Box3().setFromObject(root);
      const size = box.isEmpty() ? [0, 0, 0] : box.getSize(new THREE.Vector3()).toArray();
      return { tris: Math.round(tris), size };
    },
    setWireframe(v) { wire = !!v; new Set(mats).forEach((m) => { m.wireframe = wire; }); wake(2); return wire; },
    get wireframe() { return wire; },
    setGrid(v) { gridOn = !!v; if (gridOn && landOn) { landOn = false; placeLand(); } placeGrid(); wake(2); return gridOn; },
    get grid() { return gridOn; },
    get view() { return curView; },
    /** Camera presets: persp, front, back, left, right, top, bottom. */
    setView(name, zoomOut = 1) {
      if (!VIEWS[name]) return;
      curView = name;
      const fov = (camera.fov * Math.PI) / 180;
      const dist = zoomOut * (radius / Math.sin(fov / 2)) * (camera.aspect < 1 ? 1.25 / Math.max(camera.aspect, 0.55) : 1.15);
      controls.target.set(0, 0, 0);
      const to = new THREE.Vector3(...VIEWS[name]).normalize().multiplyScalar(dist);
      if (reducedMotion) { camera.position.copy(to); camera.lookAt(controls.target); wake(2); return; }
      const from = camera.position.clone(), t0 = performance.now();
      const turn = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
      const q = new THREE.Quaternion();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 320), e = 1 - (1 - k) ** 3;
        q.identity().slerp(turn, e);
        camera.position.copy(from).normalize().applyQuaternion(q).multiplyScalar(from.length() + (dist - from.length()) * e);
        camera.lookAt(controls.target);
        render();
        if (k < 1) requestAnimationFrame(step); else wake(2);
      };
      requestAnimationFrame(step);
    },
    /** Colours / finish per material group, for OBJ / MTL export. */
    looks: () => mats.map((m) => ({ color: `#${m.color.getHexString()}`, metalness: m.metalness, roughness: m.roughness })),
    /** Matrix that maps part coordinates to centred world coordinates (for STL export). */
    exportMatrix: () => root.matrixWorld.clone(),
    fit(view) {
      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius / Math.sin(fov / 2)) * (camera.aspect < 1 ? 1.25 / Math.max(camera.aspect, 0.55) : 1.15);
      controls.target.set(0, 0, 0);
      const dir = (view === 'top' ? new THREE.Vector3(0.2, 1.3, 0.75) : new THREE.Vector3(0.42, 0.34, 1)).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      camera.near = Math.max(0.1, dist / 100); camera.far = Math.max(dist * 20, radius * 100);
      camera.updateProjectionMatrix();
      controls.minDistance = radius * 0.6; controls.maxDistance = dist * 4;
      zoomed = false;
      curView = view === 'top' ? 'top' : 'persp';
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
    /** Colour model for colour 3D printing / AR / other apps. */
    async exportGLB() {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
      const root2 = root.clone();
      root2.scale.setScalar(0.001); // glTF is in metres
      return new GLTFExporter().parseAsync(root2, { binary: true });
    },
    /** Listeners added with this signal are removed when the tool closes (the canvas is shared). */
    signal: ac.signal,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      ac.abort();
      gridOn = false; placeGrid();
      landOn = false; placeLand();
      clear();
      new Set(mats).forEach((m) => { m.map?.dispose(); m.dispose(); });
      renderer.domElement.remove();
      renderer.domElement.removeAttribute('aria-label');
    },
  };
}
