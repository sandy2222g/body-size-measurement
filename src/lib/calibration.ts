// Per-user calibration: learns correction factors from tape-measured values so the
// fixed-ratio circumference estimates (chest/waist/hips) are adjusted for this person.

export type CalibrationKey = 'chest' | 'waist' | 'hips';
export type Calibration = Partial<Record<CalibrationKey, number>>;

export const CALIBRATION_KEYS: CalibrationKey[] = ['chest', 'waist', 'hips'];
const MIN_FACTOR = 0.7;
const MAX_FACTOR = 1.4;
const STORAGE_KEY = 'measurementCalibration';

/** factor = tape / estimate, clamped so a typo can't wreck future results. */
export function computeCalibration(
  estimated: Record<CalibrationKey, number>,
  tape: Partial<Record<CalibrationKey, number>>,
): Calibration {
  const out: Calibration = {};
  for (const k of CALIBRATION_KEYS) {
    const t = tape[k];
    const e = estimated[k];
    if (typeof t === 'number' && Number.isFinite(t) && t > 0 && e > 0) {
      out[k] = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, t / e));
    }
  }
  return out;
}

export function applyCalibration<T extends Record<CalibrationKey, number>>(body: T, cal: Calibration): T {
  const out = { ...body };
  for (const k of CALIBRATION_KEYS) {
    const f = cal[k];
    if (typeof f === 'number') out[k] = Math.round(body[k] * f * 10) / 10 as T[CalibrationKey];
  }
  return out;
}

export function loadCalibration(): Calibration {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const cal: Calibration = {};
    for (const k of CALIBRATION_KEYS) {
      if (typeof raw?.[k] === 'number' && raw[k] >= MIN_FACTOR && raw[k] <= MAX_FACTOR) cal[k] = raw[k];
    }
    return cal;
  } catch {
    return {};
  }
}

export function saveCalibration(cal: Calibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
  } catch { /* storage unavailable */ }
}

export function clearCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable */ }
}
