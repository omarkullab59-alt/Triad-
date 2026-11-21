// ETHER — scene state: defaults, character presets, catalogues and validation.
// Everything the user can change lives in one plain object, so it can be undone, saved, loaded and shared.

export const TOPS = [
  ['none', 'None'], ['longsleeve', 'Fitted long sleeve'], ['graphic', 'Graphic shirt'], ['layered', 'Layered top'],
  ['mesh', 'Mesh top'], ['jacket', 'Futuristic jacket'], ['hoodie', 'Oversized hoodie'],
];
export const BOTTOMS = [
  ['none', 'None'], ['slim', 'Slim trousers'], ['flared', 'Flared jeans'], ['cargo', 'Futuristic cargos'],
  ['layered', 'Layered trousers'], ['balloon', 'Balloon trousers'], ['wrap', 'Wrap skirt over leggings'],
];
export const SHOES = [['none', 'Barefoot'], ['sneaker', 'Futuristic sneakers'], ['boot', 'Slim boots'], ['platform', 'Split-toe platforms'], ['spike', 'Blade heels']];
export const ACCESSORIES = [
  ['necklace', 'Chrome necklace'], ['chains', 'Hanging chains'], ['rings', 'Silver rings'], ['glasses', 'Wrap sunglasses'],
  ['belt', 'Belt'], ['earrings', 'Earrings'], ['gloves', 'Gloves'], ['wings', 'Chrome wings'], ['orbit', 'Orbit ring'],
  ['spine', 'Spine piece'], ['cuffs', 'Arm cuffs'], ['choker', 'Choker'],
];
export const HAIR = [
  ['bald', 'Shaved'], ['buzz', 'Buzz cut'], ['bob', 'Sharp bob'], ['long', 'Long straight'], ['spikes', 'Spikes'],
  ['mohawk', 'Fin'], ['buns', 'Twin buns'], ['braids', 'Long braids'], ['tails', 'High twin tails'],
];
export const POSES = [['stand', 'Standing'], ['contra', 'Contrapposto'], ['walk', 'Walking'], ['open', 'Arms open']];
export const SKIN = [
  ['#f3e2d6', 'Porcelain'], ['#e8cdb8', 'Light'], ['#d6ae8e', 'Warm beige'], ['#b8875f', 'Tan'], ['#8d5a3b', 'Brown'],
  ['#5e3a25', 'Deep'], ['#d5d9dd', 'Silver avatar'], ['#f6f7f8', 'White avatar'],
];
export const HAIR_COLORS = [['#f4f3ef', 'Platinum'], ['#c9ccd1', 'Silver'], ['#bfe0f0', 'Ice blue'], ['#d9dadc', 'Pale grey'], ['#121214', 'Black'], ['#8e9399', 'Ash']];
export const ENV_OBJECTS = [
  ['cube', 'Cube'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['torus', 'Ring'], ['arch', 'Arch'], ['pillar', 'Pillar'],
  ['monolith', 'Monolith'], ['platform', 'Platform'], ['stairs', 'Stairs'], ['blob', 'Soft blob'], ['panel', 'Light panel'], ['cone', 'Cone'],
];
export const ENV_PRESETS = [['ether', 'Ether white'], ['ice', 'Ice night'], ['chrome', 'Chrome noon'], ['void', 'Black void']];
export const LIGHT_PRESETS = [['soft', 'Soft gallery'], ['cinema', 'Cinematic'], ['rim', 'Rim & fog'], ['cold', 'Cold blue']];

const m = (preset, color, extra = {}) => ({ preset, color, ...extra });

export function defaultState() {
  return {
    v: 1,
    character: { height: 1.78, build: 0.85, shoulders: 1, waist: 0.9, hips: 1, legs: 1.06, head: 1, pose: 'contra', skin: '#e8cdb8', hair: 'spikes', hairColor: '#f4f3ef' },
    wardrobe: { top: 'mesh', bottom: 'flared', shoes: 'platform', graphic: 'ETHER' },
    accessories: { necklace: true, chains: true, rings: true, glasses: true, belt: false, earrings: true, gloves: false, wings: false, orbit: false, spine: false, cuffs: true, choker: false },
    materials: {
      top: m('mesh', '#f2f2f2'), under: m('satin', '#e9ebee'), bottom: m('fabric', '#cfe6f2'), shoes: m('plastic', '#f4f5f6'),
      metal: m('chrome', '#f2f4f6'), glass: m('glass', '#cfe6f2', { transmission: 0.85, roughness: 0.05 }), hair: m('hair', '#f4f3ef'),
    },
    env: {
      preset: 'ether', bg: '#c3cad0', fog: '#cfd5da', fogDensity: 0.03, floor: '#e4e8eb', reflect: true, cones: true,
      objects: defaultObjects(),
    },
    light: { preset: 'soft', key: 3.4, fill: 0.3, rim: 4, ambient: 0.28, keyColor: '#ffffff', rimColor: '#cfe6f2', angle: 58, shadows: 'soft' },
    camera: { fov: 32, auto: false, ao: false, dof: false, focus: 4.5, aperture: 0.6 },
  };
}

let seq = 0;
export const newId = () => `o${Date.now().toString(36)}${(seq++).toString(36)}`;
export const obj = (type, pos, extra = {}) => ({ id: newId(), type, pos, rot: [0, 0, 0], scale: [1, 1, 1], mat: m('chrome', '#f2f4f6'), ...extra });

export function defaultObjects() {
  return [
    obj('platform', [0, 0, 0], { scale: [1, 1, 1], mat: m('plastic', '#f6f7f8'), name: 'Centre platform' }),
    obj('arch', [0, 0, -7], { scale: [1.6, 1.6, 1.6], mat: m('concrete', '#eceae6'), name: 'Back arch' }),
    obj('pillar', [-5, 0, -4], { mat: m('chrome', '#f2f4f6'), name: 'Chrome pillar' }),
    obj('pillar', [5, 0, -4], { mat: m('chrome', '#f2f4f6'), name: 'Chrome pillar' }),
    obj('monolith', [-7.5, 0, 1], { rot: [0, 0.5, 0], mat: m('frosted', '#eef5f8'), name: 'Frosted monolith' }),
    obj('torus', [6.5, 2.4, 0.5], { rot: [0.2, -0.7, 0], scale: [1.4, 1.4, 1.4], mat: m('chrome', '#f2f4f6'), name: 'Chrome ring' }),
    obj('sphere', [4, 0.6, 3], { scale: [0.6, 0.6, 0.6], mat: m('holo', '#e6edf2'), name: 'Holo sphere' }),
    obj('panel', [0, 4.2, -2.5], { rot: [0.5, 0, 0], scale: [3, 0.06, 0.5], mat: m('emissive', '#ffffff'), name: 'Light bar' }),
    obj('stairs', [-3.5, 0, -6], { rot: [0, 0.3, 0], mat: m('concrete', '#eceae6'), name: 'Stairs' }),
  ];
}

/** Character presets (only the character, not the room). */
export const CHARACTERS = {
  ether: { label: 'Ether', character: { pose: 'contra', hair: 'spikes', hairColor: '#f4f3ef', skin: '#e8cdb8', build: 0.85 }, wardrobe: { top: 'mesh', bottom: 'flared', shoes: 'platform' }, accessories: { necklace: true, chains: true, rings: true, glasses: true, earrings: true, cuffs: true }, materials: { top: m('mesh', '#f2f2f2'), bottom: m('fabric', '#cfe6f2'), shoes: m('plastic', '#f4f5f6') } },
  seraph: { label: 'Seraph', character: { pose: 'open', hair: 'long', hairColor: '#f4f3ef', skin: '#f3e2d6', build: 0.8 }, wardrobe: { top: 'layered', bottom: 'wrap', shoes: 'spike' }, accessories: { wings: true, orbit: true, choker: true, earrings: true }, materials: { top: m('satin', '#ffffff'), bottom: m('frosted', '#eef5f8', { transmission: 0.7 }), shoes: m('chrome', '#f2f4f6') } },
  frost: { label: 'Frost', character: { pose: 'stand', hair: 'braids', hairColor: '#bfe0f0', skin: '#8d5a3b', build: 0.9 }, wardrobe: { top: 'jacket', bottom: 'cargo', shoes: 'boot' }, accessories: { glasses: true, belt: true, gloves: true, chains: true, rings: true }, materials: { top: m('holo', '#e6edf2'), bottom: m('brushed', '#c9ccd1'), shoes: m('leather', '#111112') } },
  void: { label: 'Void', character: { pose: 'walk', hair: 'mohawk', hairColor: '#121214', skin: '#d5d9dd', build: 0.75 }, wardrobe: { top: 'longsleeve', bottom: 'slim', shoes: 'sneaker' }, accessories: { spine: true, choker: true, cuffs: true, glasses: true }, materials: { top: m('latex', '#0c0c0d'), bottom: m('leather', '#111112'), shoes: m('chrome', '#f2f4f6') } },
  drift: { label: 'Drift', character: { pose: 'contra', hair: 'buns', hairColor: '#c9ccd1', skin: '#d6ae8e', build: 1 }, wardrobe: { top: 'hoodie', bottom: 'balloon', shoes: 'sneaker' }, accessories: { necklace: true, earrings: true, rings: true }, materials: { top: m('fabric', '#d9dadc'), bottom: m('satin', '#ffffff'), shoes: m('silver', '#d4d7db') } },
};
export const CHARACTER_OPTIONS = Object.entries(CHARACTERS).map(([k, v]) => [k, v.label]);

export function applyCharacterPreset(state, key) {
  const pr = CHARACTERS[key];
  if (!pr) return state;
  const s = structuredCloneSafe(state);
  Object.assign(s.character, pr.character);
  Object.assign(s.wardrobe, pr.wardrobe);
  s.accessories = Object.fromEntries(ACCESSORIES.map(([k]) => [k, !!pr.accessories[k]]));
  Object.assign(s.materials, pr.materials);
  return s;
}

const structuredCloneSafe = (o) => JSON.parse(JSON.stringify(o));
const num = (v, min, max, d) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : d);
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : d);
const pick = (v, list, d) => (list.some(([k]) => k === v) ? v : d);
const vec = (v, d, min = -100, max = 100) => (Array.isArray(v) && v.length === 3 ? v.map((x, i) => num(x, min, max, d[i])) : [...d]);

function cleanMat(x, d) {
  if (!x || typeof x !== 'object') return { ...d };
  const out = { preset: typeof x.preset === 'string' && /^[a-z]{2,12}$/.test(x.preset) ? x.preset : d.preset, color: hex(x.color, d.color) };
  for (const k of ['roughness', 'metalness', 'transmission', 'iridescence', 'opacity']) if (x[k] !== undefined) out[k] = num(x[k], 0, 1, undefined);
  return out;
}

/** Turn anything (an old save, a hand-edited JSON file) into a valid state. Unknown keys are dropped. */
export function sanitize(input) {
  const d = defaultState();
  const s = input && typeof input === 'object' ? input : {};
  const c = s.character || {}, w = s.wardrobe || {}, a = s.accessories || {}, e = s.env || {}, l = s.light || {}, cam = s.camera || {};
  return {
    v: 1,
    character: {
      height: num(c.height, 1.5, 2.1, d.character.height), build: num(c.build, 0.6, 1.4, d.character.build),
      shoulders: num(c.shoulders, 0.75, 1.35, 1), waist: num(c.waist, 0.7, 1.3, d.character.waist), hips: num(c.hips, 0.75, 1.35, 1),
      legs: num(c.legs, 0.85, 1.2, d.character.legs), head: num(c.head, 0.85, 1.2, 1),
      pose: pick(c.pose, POSES, d.character.pose), skin: hex(c.skin, d.character.skin), hair: pick(c.hair, HAIR, d.character.hair), hairColor: hex(c.hairColor, d.character.hairColor),
    },
    wardrobe: { top: pick(w.top, TOPS, d.wardrobe.top), bottom: pick(w.bottom, BOTTOMS, d.wardrobe.bottom), shoes: pick(w.shoes, SHOES, d.wardrobe.shoes), graphic: String(w.graphic ?? d.wardrobe.graphic).slice(0, 16) },
    accessories: Object.fromEntries(ACCESSORIES.map(([k]) => [k, a[k] === undefined ? d.accessories[k] : !!a[k]])),
    materials: Object.fromEntries(Object.entries(d.materials).map(([k, dv]) => [k, cleanMat(s.materials?.[k], dv)])),
    env: {
      preset: pick(e.preset, ENV_PRESETS, d.env.preset), bg: hex(e.bg, d.env.bg), fog: hex(e.fog, d.env.fog), fogDensity: num(e.fogDensity, 0, 0.2, d.env.fogDensity),
      floor: hex(e.floor, d.env.floor), reflect: e.reflect === undefined ? d.env.reflect : !!e.reflect, cones: e.cones === undefined ? d.env.cones : !!e.cones,
      objects: Array.isArray(e.objects) ? e.objects.slice(0, 120).filter((o) => o && ENV_OBJECTS.some(([k]) => k === o.type)).map((o) => ({
        id: typeof o.id === 'string' && o.id.length < 40 ? o.id : newId(), type: o.type, name: typeof o.name === 'string' ? o.name.slice(0, 40) : undefined,
        pos: vec(o.pos, [0, 0, 0]), rot: vec(o.rot, [0, 0, 0], -7, 7), scale: vec(o.scale, [1, 1, 1], 0.02, 40), mat: cleanMat(o.mat, { preset: 'chrome', color: '#f2f4f6' }),
      })) : d.env.objects,
    },
    light: {
      preset: pick(l.preset, LIGHT_PRESETS, d.light.preset), key: num(l.key, 0, 10, d.light.key), fill: num(l.fill, 0, 5, d.light.fill), rim: num(l.rim, 0, 12, d.light.rim),
      ambient: num(l.ambient, 0, 3, d.light.ambient), keyColor: hex(l.keyColor, d.light.keyColor), rimColor: hex(l.rimColor, d.light.rimColor), angle: num(l.angle, -180, 180, d.light.angle),
      shadows: pick(l.shadows, [['off'], ['soft'], ['high']], d.light.shadows),
    },
    camera: { fov: num(cam.fov, 15, 75, d.camera.fov), auto: !!cam.auto, ao: !!cam.ao, dof: !!cam.dof, focus: num(cam.focus, 0.5, 30, d.camera.focus), aperture: num(cam.aperture, 0, 3, d.camera.aperture) },
  };
}

export const ENV_LOOKS = {
  ether: { bg: '#c3cad0', fog: '#cfd5da', fogDensity: 0.03, floor: '#e4e8eb' },
  ice: { bg: '#1b2630', fog: '#22323e', fogDensity: 0.05, floor: '#d8e6ee' },
  chrome: { bg: '#f4f5f6', fog: '#ffffff', fogDensity: 0.02, floor: '#c9ccd1' },
  void: { bg: '#060607', fog: '#0b0b0c', fogDensity: 0.06, floor: '#141416' },
};
export const LIGHT_LOOKS = {
  soft: { key: 3.4, fill: 0.3, rim: 4, ambient: 0.28, keyColor: '#ffffff', rimColor: '#cfe6f2', angle: 58 },
  cinema: { key: 4.2, fill: 0.25, rim: 6, ambient: 0.2, keyColor: '#fff4ea', rimColor: '#bfe0f0', angle: 60 },
  rim: { key: 1.2, fill: 0.3, rim: 9, ambient: 0.35, keyColor: '#ffffff', rimColor: '#ffffff', angle: 150 },
  cold: { key: 2.8, fill: 0.9, rim: 5, ambient: 0.5, keyColor: '#dcefff', rimColor: '#8fd0ff', angle: -40 },
};
