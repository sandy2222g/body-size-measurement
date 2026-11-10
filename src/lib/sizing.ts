// Pure sizing engine: maps body measurements (cm) to garment sizes.
// No React / DOM dependencies so it can be unit-tested with `node --test`.

export type Gender = 'female' | 'male';
export type Fit = 'slim' | 'regular' | 'relaxed';
export type Range = [number, number];
export type MeasureKey = 'chest' | 'waist' | 'hips';

export interface BodyMeasurements {
  chest: number;
  waist: number;
  hips: number;
  shoulder_width: number;
  arm_length: number;
  inseam: number;
  /** Optional manually measured underbust (cm); improves bra sizing. */
  underbust?: number;
}

export interface SizeRow {
  label: string;
  chest?: Range;
  waist?: Range;
  hips?: Range;
}

export type LengthKind = 'sleeve' | 'leg';

export interface Garment {
  id: string;
  name: string;
  icon: string;
  genders: Gender[];
  /** Weight of each body measurement when scoring a size. */
  weights: Partial<Record<MeasureKey, number>>;
  charts: Partial<Record<Gender, SizeRow[]>>;
  length?: LengthKind;
}

export interface SizeResult {
  garment: Garment;
  size: string;
  alternate: string | null;
  /** True when the second-best size is almost as good (user sits between sizes). */
  between: boolean;
  /** True when a measurement lies outside the whole chart. */
  outOfRange: boolean;
  /** 0..1 */
  confidence: number;
  length: 'Short' | 'Regular' | 'Long' | null;
  note: string;
}

const R = (rows: Array<[string, Range?, Range?, Range?]>): SizeRow[] =>
  rows.map(([label, chest, waist, hips]) => ({ label, chest, waist, hips }));

const WOMEN_TOPS = R([
  ['XS', [78, 84], [60, 65], [85, 91]],
  ['S', [84, 90], [65, 71], [91, 97]],
  ['M', [90, 98], [71, 79], [97, 105]],
  ['L', [98, 106], [79, 87], [105, 113]],
  ['XL', [106, 114], [87, 95], [113, 121]],
  ['XXL', [114, 124], [95, 105], [121, 131]],
]);

const MEN_TOPS = R([
  ['XS', [81, 89], [66, 74], undefined],
  ['S', [89, 97], [74, 82], undefined],
  ['M', [97, 105], [82, 90], undefined],
  ['L', [105, 113], [90, 98], undefined],
  ['XL', [113, 121], [98, 106], undefined],
  ['XXL', [121, 131], [106, 116], undefined],
]);

const WOMEN_BOTTOMS = R([
  ['XS', undefined, [60, 65], [85, 91]],
  ['S', undefined, [65, 71], [91, 97]],
  ['M', undefined, [71, 79], [97, 105]],
  ['L', undefined, [79, 87], [105, 113]],
  ['XL', undefined, [87, 95], [113, 121]],
  ['XXL', undefined, [95, 105], [121, 131]],
]);

const MEN_BOTTOMS = R([
  ['XS', undefined, [66, 74], [84, 92]],
  ['S', undefined, [74, 82], [92, 100]],
  ['M', undefined, [82, 90], [100, 108]],
  ['L', undefined, [90, 98], [108, 116]],
  ['XL', undefined, [98, 106], [116, 124]],
  ['XXL', undefined, [106, 116], [124, 134]],
]);

const WOMEN_JEANS = R([
  ['W26', undefined, [64, 68], [90, 94]],
  ['W28', undefined, [68, 72], [94, 98]],
  ['W30', undefined, [72, 76], [98, 102]],
  ['W32', undefined, [76, 80], [102, 106]],
  ['W34', undefined, [80, 85], [106, 111]],
  ['W36', undefined, [85, 90], [111, 116]],
]);

const MEN_JEANS = R([
  ['W28', undefined, [71, 76], [90, 95]],
  ['W30', undefined, [76, 81], [95, 100]],
  ['W32', undefined, [81, 86], [100, 105]],
  ['W34', undefined, [86, 91], [105, 110]],
  ['W36', undefined, [91, 97], [110, 116]],
  ['W38', undefined, [97, 102], [116, 121]],
  ['W40', undefined, [102, 107], [121, 126]],
]);

const BOTH: Gender[] = ['female', 'male'];

export const GARMENTS: Garment[] = [
  { id: 'tshirt', name: 'T-Shirt', icon: '👕', genders: BOTH, weights: { chest: 3, waist: 1 },
    charts: { female: WOMEN_TOPS, male: MEN_TOPS } },
  { id: 'shirt', name: 'Shirt / Blouse', icon: '👔', genders: BOTH, weights: { chest: 3, waist: 1.5 },
    charts: { female: WOMEN_TOPS, male: MEN_TOPS }, length: 'sleeve' },
  { id: 'jacket', name: 'Jacket / Blazer', icon: '🧥', genders: BOTH, weights: { chest: 3, waist: 1 },
    charts: { female: WOMEN_TOPS, male: MEN_TOPS }, length: 'sleeve' },
  { id: 'dress', name: 'Dress', icon: '👗', genders: ['female'], weights: { chest: 2, waist: 2, hips: 2 },
    charts: { female: WOMEN_TOPS } },
  { id: 'skirt', name: 'Skirt', icon: '🩱', genders: ['female'], weights: { waist: 3, hips: 2 },
    charts: { female: WOMEN_BOTTOMS } },
  { id: 'trousers', name: 'Trousers', icon: '👖', genders: BOTH, weights: { waist: 3, hips: 1.5 },
    charts: { female: WOMEN_BOTTOMS, male: MEN_BOTTOMS }, length: 'leg' },
  { id: 'jeans', name: 'Jeans', icon: '🧵', genders: BOTH, weights: { waist: 3, hips: 2 },
    charts: { female: WOMEN_JEANS, male: MEN_JEANS }, length: 'leg' },
  { id: 'leggings', name: 'Leggings / Activewear', icon: '🏃', genders: BOTH, weights: { waist: 2, hips: 2, chest: 0.5 },
    charts: { female: WOMEN_BOTTOMS, male: MEN_BOTTOMS }, length: 'leg' },
];

export interface Bundle {
  id: string;
  name: string;
  description: string;
  garmentIds: string[];
  /** Bundle includes the bra estimate. */
  includesBra?: boolean;
}

export const BUNDLES: Bundle[] = [
  { id: 'casual', name: 'Everyday Casual', description: 'Daily basics', garmentIds: ['tshirt', 'jeans', 'jacket'] },
  { id: 'work', name: 'Workwear', description: 'Office & formal', garmentIds: ['shirt', 'trousers', 'jacket', 'dress', 'skirt'] },
  { id: 'active', name: 'Activewear', description: 'Gym & sport', garmentIds: ['tshirt', 'leggings'] },
  { id: 'intimates', name: 'Intimates', description: 'Bra band estimate', garmentIds: [], includesBra: true },
];

const EASE_CM: Record<Fit, number> = { slim: -2, regular: 0, relaxed: 3 };

function rangeDistance(v: number, [min, max]: Range): number {
  if (v < min) return min - v;
  if (v > max) return v - max;
  return 0;
}

function centerDistance(v: number, [min, max]: Range): number {
  return Math.abs(v - (min + max) / 2);
}

function lengthCategory(kind: LengthKind, body: BodyMeasurements): 'Short' | 'Regular' | 'Long' {
  // arm_length: shoulder -> wrist; inseam: hip -> ankle (as produced by the measurement service).
  const [lo, hi] = kind === 'sleeve' ? [58, 64] : [76, 83];
  const v = kind === 'sleeve' ? body.arm_length : body.inseam;
  return v < lo ? 'Short' : v > hi ? 'Long' : 'Regular';
}

export function isValidBody(body: Partial<BodyMeasurements> | null | undefined): body is BodyMeasurements {
  if (!body) return false;
  return (['chest', 'waist', 'hips', 'shoulder_width', 'arm_length', 'inseam'] as const)
    .every((k) => typeof body[k] === 'number' && Number.isFinite(body[k]) && (body[k] as number) > 0);
}

export function recommendSize(
  garment: Garment,
  body: BodyMeasurements,
  gender: Gender,
  fit: Fit = 'regular',
): SizeResult | null {
  const chart = garment.charts[gender];
  if (!chart || !garment.genders.includes(gender)) return null;

  const ease = EASE_CM[fit];
  const keys = Object.keys(garment.weights) as MeasureKey[];
  const totalWeight = keys.reduce((s, k) => s + (garment.weights[k] ?? 0), 0);

  const scored = chart.map((row) => {
    let penalty = 0;
    let tieBreak = 0;
    for (const k of keys) {
      const range = row[k];
      if (!range) continue;
      const w = garment.weights[k] ?? 0;
      const v = body[k] + ease;
      penalty += w * rangeDistance(v, range);
      tieBreak += w * centerDistance(v, range) * 0.01;
    }
    return { label: row.label, penalty, score: penalty + tieBreak };
  }).sort((a, b) => a.score - b.score);

  const best = scored[0];
  const second = scored[1] ?? null;
  const outOfRange = best.penalty > totalWeight * 1.0;
  const between = !!second && second.penalty - best.penalty <= totalWeight * 1.0 && second.penalty <= totalWeight * 1.0 + best.penalty;
  const confidence = Math.max(0, Math.min(1, 1 - best.penalty / (totalWeight * 6)));

  let note: string;
  if (outOfRange) note = 'Your measurements are outside the standard chart; check the brand\'s extended sizes.';
  else if (between && second) note = `Between ${best.label} and ${second.label}: choose ${best.label} for a closer fit or ${second.label} for more room.`;
  else note = `${best.label} fits your measurements well.`;

  return {
    garment,
    size: best.label,
    alternate: between && second ? second.label : null,
    between,
    outOfRange,
    confidence,
    length: garment.length ? lengthCategory(garment.length, body) : null,
    note,
  };
}

export function recommendBundle(
  bundle: Bundle,
  body: BodyMeasurements,
  gender: Gender,
  fit: Fit = 'regular',
): SizeResult[] {
  return bundle.garmentIds
    .map((id) => GARMENTS.find((g) => g.id === id))
    .filter((g): g is Garment => !!g)
    .map((g) => recommendSize(g, body, gender, fit))
    .filter((r): r is SizeResult => r !== null);
}

// ---------------------------------------------------------------- Bra sizing

export interface BraResult {
  bandEU: number;
  bandUS: number;
  /** Cup letter; null unless an underbust was supplied by the user. */
  cup: string | null;
  underbustEstimated: boolean;
  note: string;
}

// EU convention: each cup step is 2 cm of bust-underbust difference (10-11 = AA, 12-13 = A, ...).
const CUP_STEPS = ['AA', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Bra size from bust (`chest`) and underbust. Pose estimation cannot see the
 * underbust, so without a manual value only an approximate band is returned.
 */
export function recommendBra(body: BodyMeasurements): BraResult {
  const estimated = !(typeof body.underbust === 'number' && body.underbust > 0);
  const underbust = estimated ? body.chest * 0.87 : (body.underbust as number);
  const bandEU = Math.max(60, Math.min(120, Math.round(underbust / 5) * 5));
  // US band = underbust in inches rounded to an even number (+0 for modern fit guides)
  const bandUS = Math.max(28, Math.min(48, Math.round(underbust / 2.54 / 2) * 2));

  let cup: string | null = null;
  if (!estimated) {
    const diff = body.chest - underbust;
    const idx = Math.max(0, Math.min(CUP_STEPS.length - 1, Math.floor((diff - 10) / 2)));
    cup = CUP_STEPS[idx];
  }

  return {
    bandEU,
    bandUS,
    cup,
    underbustEstimated: estimated,
    note: estimated
      ? 'Band is estimated from your bust size. Enter your underbust (measured snugly under the bust) to get a cup size.'
      : 'Calculated from your bust and underbust measurements. Try the sister sizes if the fit is off.',
  };
}

// ------------------------------------------------------------------- Exports

export function bundleToText(bundle: Bundle, results: SizeResult[], bra: BraResult | null): string {
  const lines = [`${bundle.name} sizes`];
  for (const r of results) {
    const extras = [r.length ? `length: ${r.length}` : null, r.alternate ? `or ${r.alternate}` : null]
      .filter(Boolean).join(', ');
    lines.push(`${r.garment.name}: ${r.size}${extras ? ` (${extras})` : ''}`);
  }
  if (bra) lines.push(`Bra: ${bra.bandEU}${bra.cup ?? ''} EU / ${bra.bandUS}${bra.cup ?? ''} US${bra.underbustEstimated ? ' (band estimate)' : ''}`);
  return lines.join('\n');
}

export function bundleToCsv(bundle: Bundle, results: SizeResult[], bra: BraResult | null): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['bundle', 'garment', 'size', 'alternate', 'length', 'confidence']];
  for (const r of results) {
    rows.push([bundle.name, r.garment.name, r.size, r.alternate ?? '', r.length ?? '', r.confidence.toFixed(2)]);
  }
  if (bra) rows.push([bundle.name, 'Bra', `${bra.bandEU}${bra.cup ?? ''} EU`, `${bra.bandUS}${bra.cup ?? ''} US`, '', bra.underbustEstimated ? 'estimated' : 'measured']);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export const cmToInches = (cm: number): number => cm / 2.54;
