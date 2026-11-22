// Ring and bracelet size maths. All lengths in millimetres.
// EU size = inner circumference in mm (ISO 8653). US size: Ø = 11.63 + 0.8128 × size (US/Canada standard).

export const euFromDiameter = (d) => Math.PI * d;
export const diameterFromEu = (eu) => eu / Math.PI;
export const usFromDiameter = (d) => (d - 11.63) / 0.8128;
export const diameterFromUs = (us) => 11.63 + 0.8128 * us;

export const SIZE_SYSTEMS = {
  eu: { label: 'EU', min: 41, max: 76, step: 1, toD: diameterFromEu, fromD: euFromDiameter, unit: '' },
  us: { label: 'US', min: 2, max: 16, step: 0.25, toD: diameterFromUs, fromD: usFromDiameter, unit: '' },
  mm: { label: 'mm', min: 13, max: 24.2, step: 0.1, toD: (d) => d, fromD: (d) => d, unit: 'mm' },
};

const r1 = (n) => Math.round(n * 10) / 10;
const quarter = (n) => Math.round(n * 4) / 4;

/** "EU 54 · US 6.9 · Ø 17.2 mm" */
export function sizeSummary(d) {
  return `EU ${Math.round(euFromDiameter(d))} · US ${quarter(usFromDiameter(d))} · Ø ${r1(d)} mm`;
}

// Wrist circumference (mm) → inner shape of a bracelet.
// Cuff (open): oval, about 1 cm room. Closed bangle: round, must slide over the hand (≈ +14 mm Ø).
export function braceletShape(wrist, open) {
  if (open) {
    const perimeter = wrist + 10;
    const ratio = 0.78; // wrists are oval: depth ≈ 0.78 × width
    // Ramanujan: P ≈ π (3(a+b) − √((3a+b)(a+3b)))  → solve for a with b = ratio·a
    const k = Math.PI * (3 * (1 + ratio) - Math.sqrt((3 + ratio) * (1 + 3 * ratio)));
    const a = perimeter / k;
    return { rx: a, rz: a * ratio };
  }
  const r = (wrist / Math.PI + 14) / 2;
  return { rx: r, rz: r };
}

// Densities in g/cm³ (= mg/mm³).
export const METALS = {
  silver: { label: 'Silver 925', density: 10.36 },
  chrome: { label: 'Chrome (rhodium-plated silver)', density: 10.4 },
  gold: { label: 'Gold 18k', density: 15.6 },
  black: { label: 'Black silver (oxidised 925)', density: 10.36 },
};
// Home objects
export const HOME = {
  ceramic: { label: 'White ceramic', density: 2.4 },
  stoneware: { label: 'Dark stoneware', density: 2.3 },
  oak: { label: 'Oak', density: 0.72 },
  walnut: { label: 'Walnut', density: 0.64 },
  steel: { label: 'Stainless steel', density: 7.9 },
  silver: METALS.silver,
  brass: { label: 'Brass', density: 8.5 },
  black: { label: 'Black lacquer', density: 0.75 },
  concrete: { label: 'Concrete', density: 2.3 },
  bronze: { label: 'Bronze', density: 8.8 },
  marble: { label: 'Marble', density: 2.7 },
  plaster: { label: 'Plaster', density: 1.2 },
  terracotta: { label: 'Terracotta', density: 1.9 },
  resin: { label: 'Black resin', density: 1.15 },
  gold: METALS.gold,
  // textiles & leather (effective densities incl. air in knits)
  knit_grey: { label: 'Grey knit', density: 0.35 }, knit_black: { label: 'Black knit', density: 0.35 }, knit_cream: { label: 'Cream knit', density: 0.35 },
  cotton: { label: 'Cotton twill', density: 0.6 }, denim: { label: 'Denim', density: 0.7 }, nylon: { label: 'Black nylon', density: 1.1 },
  leather_black: { label: 'Black leather', density: 0.9 }, leather_brown: { label: 'Brown leather', density: 0.9 },
  film: { label: 'Tape film (PE)', density: 0.92 },
};
export const ALL_MATERIALS = { ...HOME, ...METALS };
/** "4.4 g" / "1.25 kg" */
export const weightLabel = (g) => (g >= 1000 ? `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg` : `${g < 10 ? g.toFixed(1) : Math.round(g)} g`);

/** volume in mm³ → grams */
export const grams = (volume, density) => (volume / 1000) * density;

export const MIN_WALL = 0.8;
