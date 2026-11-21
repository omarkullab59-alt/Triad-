// WORLD — sky (gradient, sun, haze, stars, nebula, aurora), clouds, planets & moons, sun light, animated water.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { makeNoise, fbm } from './terrain.js';

const deg = THREE.MathUtils.degToRad;
export const sunDir = (s) => new THREE.Vector3().setFromSphericalCoords(1, deg(90 - s.sunEl), deg(s.sunAz));

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }';
const SKY_FS = `
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunColor; uniform vec3 sunDir;
uniform float sunSize; uniform float haze; uniform float stars; uniform float nebula; uniform float aurora; uniform float time;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = y > 0.0 ? mix(horizon, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(horizon, ground, pow(clamp(-y * 3.0, 0.0, 1.0), 0.6));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 8.0) * 0.25 * haze + pow(s, 64.0) * 0.6 * haze);
  col = mix(col, sunColor, smoothstep(1.0 - 0.00035 * sunSize, 1.0 - 0.00012 * sunSize, s));
  // haze band at the horizon
  col = mix(col, horizon * 1.05, haze * 0.6 * (1.0 - smoothstep(0.0, 0.18, abs(y))));
  if (y > 0.0) {
    float up = smoothstep(0.0, 0.25, y);
    // stars
    if (stars > 0.001) { vec3 q = d * 420.0; float st = hash(floor(q)); st = smoothstep(0.996, 1.0, st) * (0.6 + 0.4 * sin(time * 2.0 + st * 80.0)); col += vec3(st) * stars * up; }
    // nebula
    if (nebula > 0.001) { float n = fbm3(d * 3.0 + vec3(1.7, 0.0, 4.2)); vec3 neb = mix(vec3(0.35, 0.12, 0.55), vec3(0.1, 0.45, 0.7), fbm3(d * 5.0)); col += neb * smoothstep(0.45, 0.85, n) * nebula * up * 0.9; }
    // aurora curtains
    if (aurora > 0.001) { float a = fbm3(vec3(d.x * 3.0, time * 0.05, d.z * 3.0)); float band = smoothstep(0.08, 0.25, y) * (1.0 - smoothstep(0.35, 0.7, y)); float curtain = pow(abs(sin((d.x + d.z * 0.6) * 9.0 + a * 6.0 + time * 0.2)), 6.0); col += mix(vec3(0.1, 0.9, 0.55), vec3(0.45, 0.25, 0.9), smoothstep(0.2, 0.6, y)) * curtain * band * aurora * 0.9; }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function planetTexture(p, seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d'), img = x.createImageData(512, 256), noise = makeNoise(seed);
  const a = new THREE.Color(p.color), b = new THREE.Color(p.color2);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 512; i++) {
    const u = i / 512 * Math.PI * 2, v = j / 256;
    const n = fbm(noise, Math.cos(u) * 2 + 5, Math.sin(u) * 2 + v * 6, { octaves: 5 }) * 0.5 + 0.5;
    const band = 0.5 + 0.5 * Math.sin(v * 22 + n * 5);
    const t = Math.min(1, Math.max(0, n * 0.7 + band * 0.3));
    const k = (j * 512 + i) * 4;
    img.data[k] = (a.r + (b.r - a.r) * t) * 255; img.data[k + 1] = (a.g + (b.g - a.g) * t) * 255; img.data[k + 2] = (a.b + (b.b - a.b) * t) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function cloudTexture(seed) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), noise = makeNoise(seed);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    // tileable: sample noise on a torus
    const u = (i / S) * Math.PI * 2, v = (j / S) * Math.PI * 2;
    const n = fbm(noise, Math.cos(u) * 1.6 + Math.cos(v) * 0.3, Math.sin(u) * 1.6 + Math.sin(v) * 1.6, { octaves: 6, gain: 0.55 }) * 0.5 + 0.5;
    const k = (j * S + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(n * 255);
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function waterNormals() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), noise = makeNoise(42);
  const h = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const u = (i / S) * Math.PI * 2, v = (j / S) * Math.PI * 2; h[j * S + i] = fbm(noise, Math.cos(u) * 2 + Math.cos(v), Math.sin(u) * 2 + Math.sin(v) * 2, { octaves: 4 }); }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i - 1 + S) % S)], dy = h[((j + 1) % S) * S + i] - h[((j - 1 + S) % S) * S + i];
    const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize(); const k = (j * S + i) * 4;
    img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function createEnvironment(scene, renderer, size) {
  const root = new THREE.Group(); root.name = 'environment'; scene.add(root);
  /* sky */
  const skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunSize: { value: 1 }, haze: { value: 0.3 }, stars: { value: 0 }, nebula: { value: 0 }, aurora: { value: 0 }, time: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(size * 4, 48, 24), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'Sky'; sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
  /* sun + ambient */
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true; sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
  Object.assign(sun.shadow.camera, { left: -size * 0.6, right: size * 0.6, top: size * 0.6, bottom: -size * 0.6, near: 1, far: size * 4 });
  const hemi = new THREE.HemisphereLight('#bcd4e6', '#4a4f45', 0.9);
  root.add(sun, sun.target, hemi);
  /* clouds */
  const cloudTex = cloudTexture(5);
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', alphaMap: cloudTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8, fog: true });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(size * 5, size * 5), cloudMat);
  clouds.rotation.x = -Math.PI / 2; clouds.name = 'Clouds'; root.add(clouds);
  cloudTex.repeat.set(3, 3);
  /* planets */
  const planets = new THREE.Group(); planets.name = 'Planets'; root.add(planets);
  let planetKey = '';
  function setPlanets(list) {
    const key = JSON.stringify(list); if (key === planetKey) return; planetKey = key;
    planets.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); planets.clear();
    const dist = size * 3.2;
    list.forEach((p, i) => {
      const g = new THREE.Group(); g.name = `Planet ${i + 1}`;
      const r = (p.size / 100) * size;
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.MeshStandardMaterial({ map: planetTexture(p, 11 + i * 7), roughness: 0.9, fog: false, emissive: new THREE.Color(p.color), emissiveIntensity: p.glow * 0.35 }));
      body.rotation.z = 0.35; g.add(body);
      if (p.ring) { const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.35, r * 2.2, 96), new THREE.MeshBasicMaterial({ color: p.ringColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false })); ring.rotation.x = Math.PI / 2 - 0.4; ring.rotation.y = 0.25; g.add(ring); }
      g.position.setFromSphericalCoords(dist, deg(90 - p.el), deg(p.az));
      planets.add(g);
    });
  }
  /* water */
  const waterGeo = new THREE.PlaneGeometry(size * 3, size * 3, 200, 200); waterGeo.rotateX(-Math.PI / 2);
  const wU = { uTime: { value: 0 }, uAmp: { value: 0.5 } };
  const normals = waterNormals(); normals.repeat.set(24, 24);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: '#1f5f7a', roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.82, normalMap: normals, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  // waves run on the GPU (vertex shader), the normal map scrolls for the small ripples
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wU);
    sh.vertexShader = `uniform float uTime; uniform float uAmp;\n${sh.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += uAmp * (sin(position.x * 0.045 + uTime * 1.3) * 0.6 + sin(position.z * 0.06 - uTime * 1.1) * 0.4 + sin((position.x + position.z) * 0.13 + uTime * 2.1) * 0.15);`);
  };
  const water = new THREE.Mesh(waterGeo, waterMat); water.name = 'Water'; water.receiveShadow = true; root.add(water);
  let mirror = null;
  function setMirror(on, level) {
    if (on && !mirror) { const s = renderer.getSize(new THREE.Vector2()); mirror = new THREE.Group(); const m = new Reflector(new THREE.PlaneGeometry(size * 3, size * 3), { textureWidth: Math.min(1024, s.x), textureHeight: Math.min(1024, s.y), color: 0x9aa3a8, clipBias: 0.003 }); m.rotation.x = -Math.PI / 2; mirror.add(m); root.add(mirror); }
    if (!on && mirror) { mirror.children[0].dispose(); root.remove(mirror); mirror = null; }
    if (mirror) mirror.position.y = level - 0.05;
  }
  let W = null;
  const clock = new THREE.Clock();
  return {
    root, sun, hemi, sky, water, clouds, planets,
    apply(state) {
      const s = state.sky, w = state.water;
      W = w;
      skyU.top.value.set(s.top); skyU.horizon.value.set(s.horizon); skyU.ground.value.set(s.ground); skyU.sunColor.value.set(s.sunColor);
      const sd = sunDir(s); skyU.sunDir.value.copy(sd);
      skyU.sunSize.value = s.sunSize; skyU.haze.value = s.haze; skyU.stars.value = s.stars; skyU.nebula.value = s.nebula; skyU.aurora.value = s.aurora;
      sun.position.copy(sd).multiplyScalar(size * 1.5); sun.color.set(s.sunColor);
      sun.intensity = s.sunEl < 0 ? 0.15 : 0.4 + Math.min(1, s.sunEl / 25) * (state.light?.sun ?? 3) * 0.6;
      hemi.color.set(s.top).lerp(new THREE.Color(s.horizon), 0.5); hemi.groundColor.set(s.ground); hemi.intensity = state.light?.ambient ?? 0.55;
      sun.castShadow = (state.light?.shadows ?? true) !== false; sun.shadow.needsUpdate = true;
      scene.fog = s.fog > 0 ? new THREE.FogExp2(new THREE.Color(s.horizon), s.fog) : null;
      clouds.visible = s.clouds > 0.01; clouds.position.y = s.cloudHeight; cloudMat.color.set(s.cloudColor); cloudMat.opacity = Math.min(1, s.clouds * 1.3);
      cloudTex.offset.set(0, 0); cloudMat.alphaTest = 0; cloudTex.repeat.set(3 - s.clouds, 3 - s.clouds);
      setPlanets(s.planets || []);
      water.visible = w.on; water.position.y = w.level; waterMat.color.set(w.color); waterMat.opacity = w.opacity; waterMat.normalScale.setScalar(0.2 + w.waves * 0.9);
      setMirror(w.on && w.mirror, w.level);
    },
    /** Animate water, clouds, stars. Returns true while something moves. */
    tick(animate) {
      const dt = Math.min(0.05, clock.getDelta());
      if (!animate || !W) return false;
      skyU.time.value += dt;
      cloudTex.offset.x += dt * 0.004; cloudTex.offset.y += dt * 0.0015;
      if (W.on) {
        wU.uTime.value += dt * W.speed; wU.uAmp.value = W.waves * 0.9;
        normals.offset.x += dt * 0.012 * W.speed; normals.offset.y += dt * 0.007 * W.speed;
      }
      return true;
    },
    dispose() {
      setMirror(false);
      root.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose?.(); } });
      cloudTex.dispose(); normals.dispose();
      scene.remove(root);
    },
  };
}
