// ETHER — material library. Every surface in the showroom and on the character is built from one
// of these presets plus adjustable properties (colour, roughness, metalness, transmission, iridescence, opacity).
import * as THREE from 'three';

export const PALETTE = [
  ['#ffffff', 'Pure white'], ['#c9ccd1', 'Metallic silver'], ['#e8ebee', 'Chrome'], ['#cfe6f2', 'Ice blue'],
  ['#d9dadc', 'Pale grey'], ['#8e9399', 'Graphite'], ['#0b0b0c', 'Black'],
];

/** Preset → base properties. Values the editor can change: color, roughness, metalness, transmission, iridescence, opacity. */
export const PRESETS = {
  chrome:   { label: 'Chrome', color: '#f2f4f6', roughness: 0.04, metalness: 1, clearcoat: 0 },
  brushed:  { label: 'Brushed metal', color: '#c9ccd1', roughness: 0.32, metalness: 1, anisotropy: 0.8, brushed: true },
  silver:   { label: 'Metallic silver', color: '#d4d7db', roughness: 0.18, metalness: 0.95 },
  plastic:  { label: 'Glossy plastic', color: '#f4f5f6', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 },
  glass:    { label: 'Transparent glass', color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.02, ior: 1.5 },
  frosted:  { label: 'Frosted glass', color: '#eef5f8', roughness: 0.45, metalness: 0, transmission: 0.95, thickness: 0.05, ior: 1.45 },
  fabric:   { label: 'Fabric', color: '#f1f1ef', roughness: 0.95, metalness: 0, sheen: 1, sheenRoughness: 0.6, sheenColor: '#ffffff' },
  satin:    { label: 'Satin', color: '#e9ebee', roughness: 0.45, metalness: 0, sheen: 1, sheenRoughness: 0.25, sheenColor: '#ffffff', clearcoat: 0.2 },
  leather:  { label: 'Leather', color: '#111112', roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35 },
  latex:    { label: 'Latex', color: '#0c0c0d', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 },
  holo:     { label: 'Holographic', color: '#e6edf2', roughness: 0.12, metalness: 0.65, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [120, 900] },
  mesh:     { label: 'Mesh (net)', color: '#f2f2f2', roughness: 0.8, metalness: 0, mesh: true },
  skin:     { label: 'Skin', color: '#e8cdb8', roughness: 0.55, metalness: 0, sheen: 0.4, sheenRoughness: 0.8, sheenColor: '#ffe9dd' },
  hair:     { label: 'Hair', color: '#f2f2f0', roughness: 0.4, metalness: 0.1, sheen: 1, sheenRoughness: 0.3, sheenColor: '#ffffff' },
  emissive: { label: 'Light (emissive)', color: '#ffffff', roughness: 0.4, metalness: 0, emissive: true },
  concrete: { label: 'White concrete', color: '#eceae6', roughness: 0.92, metalness: 0 },
};
export const PRESET_OPTIONS = Object.entries(PRESETS).map(([k, v]) => [k, v.label]);

/** A material spec as stored in scenes. */
export const spec = (preset, extra = {}) => ({ preset, color: PRESETS[preset]?.color || '#ffffff', ...extra });

let netTex = null, brushTex = null;
function netTexture() {
  if (netTex) return netTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#fff'; x.lineWidth = 10;
  for (let i = -128; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); }
  netTex = new THREE.CanvasTexture(c); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(10, 14);
  return netTex;
}
function brushTexture() {
  if (brushTex) return brushTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const y = Math.random() * 256; x.strokeStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0.05)`; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y + Math.random() * 2); x.stroke(); }
  brushTex = new THREE.CanvasTexture(c); brushTex.wrapS = brushTex.wrapT = THREE.RepeatWrapping; brushTex.repeat.set(3, 3);
  return brushTex;
}

const clamp01 = (v, d) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Spec → MeshPhysicalMaterial. */
export function makeMaterial(s = {}) {
  const base = PRESETS[s.preset] || PRESETS.fabric;
  const m = new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.2 });
  applySpec(m, s, base);
  return m;
}
/** Update an existing material in place (no shader rebuild unless features switch on or off). */
export function applySpec(m, s = {}, base = PRESETS[s.preset] || PRESETS.fabric) {
  m.color.set(s.color || base.color);
  m.roughness = clamp01(s.roughness, base.roughness);
  m.metalness = clamp01(s.metalness, base.metalness);
  m.clearcoat = base.clearcoat || 0; m.clearcoatRoughness = base.clearcoatRoughness ?? 0.1;
  m.sheen = base.sheen || 0; m.sheenRoughness = base.sheenRoughness ?? 0.5; m.sheenColor.set(base.sheenColor || '#000000');
  m.transmission = clamp01(s.transmission, base.transmission || 0);
  m.thickness = base.thickness || 0; m.ior = base.ior || 1.5;
  m.iridescence = clamp01(s.iridescence, base.iridescence || 0);
  m.iridescenceIOR = base.iridescenceIOR || 1.3; m.iridescenceThicknessRange = base.iridescenceThicknessRange || [100, 400];
  m.anisotropy = base.anisotropy || 0;
  m.roughnessMap = base.brushed ? brushTexture() : null;
  const opacity = clamp01(s.opacity, 1);
  m.alphaMap = base.mesh ? netTexture() : null;
  m.transparent = opacity < 1 || !!base.mesh;
  m.opacity = opacity;
  m.alphaTest = base.mesh ? 0.5 : 0;
  m.side = base.mesh || m.transmission > 0 ? THREE.DoubleSide : THREE.FrontSide;
  m.envMapIntensity = m.metalness > 0.5 || m.transmission > 0 ? 1.15 : 0.45; // fabrics and skin take shape from the lights, not the room
  m.emissive.set(base.emissive ? s.color || base.color : '#000000');
  m.emissiveIntensity = base.emissive ? 2.2 : 0;
  m.needsUpdate = true;
  return m;
}
