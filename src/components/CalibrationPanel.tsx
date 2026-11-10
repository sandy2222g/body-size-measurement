import React, { useState } from 'react';
import {
  CALIBRATION_KEYS, clearCalibration, computeCalibration, loadCalibration, saveCalibration,
  type CalibrationKey,
} from '../lib/calibration';

interface Props {
  raw: Record<CalibrationKey, number>;
  /** Called with the factors that were saved (or {} after a reset). */
  onChange: (factors: Partial<Record<CalibrationKey, number>>) => void;
}

const LABELS: Record<CalibrationKey, string> = { chest: 'Chest / bust', waist: 'Waist', hips: 'Hips' };

const CalibrationPanel: React.FC<Props> = ({ raw, onChange }) => {
  const [tape, setTape] = useState<Partial<Record<CalibrationKey, string>>>({});
  const [active, setActive] = useState(() => Object.keys(loadCalibration()).length > 0);
  const [message, setMessage] = useState<string | null>(null);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const values: Partial<Record<CalibrationKey, number>> = {};
    for (const k of CALIBRATION_KEYS) {
      const n = Number(tape[k]);
      if (tape[k] && Number.isFinite(n) && n >= 45 && n <= 190) values[k] = n;
    }
    const factors = computeCalibration(raw, values);
    if (Object.keys(factors).length === 0) {
      setMessage('Enter at least one tape measurement in cm (45–190).');
      return;
    }
    // Merge with any earlier factors so calibrating one metric doesn't erase the others.
    const merged = { ...loadCalibration(), ...factors };
    saveCalibration(merged);
    setActive(true);
    setMessage('Saved. Future photo measurements will be adjusted for you.');
    onChange(merged);
  };

  const reset = () => {
    clearCalibration();
    setActive(false);
    setMessage('Calibration cleared.');
    onChange({});
  };

  return (
    <details className="card mt-8" data-testid="calibration">
      <summary className="cursor-pointer font-semibold text-lg">
        Improve accuracy with a tape measure {active && <span className="text-green-600 text-sm">(calibrated)</span>}
      </summary>
      <p className="text-sm text-gray-600 my-3">
        Photo circumferences are estimated from 2D widths. Enter what a tape measure says for this person and the
        app learns a correction (stored only in this browser) that is applied to future photo measurements.
      </p>
      <form onSubmit={save} className="grid sm:grid-cols-3 gap-3" noValidate>
        {CALIBRATION_KEYS.map((k) => (
          <div key={k}>
            <label htmlFor={`cal-${k}`} className="block text-sm text-gray-700 mb-1">
              {LABELS[k]} (photo said {raw[k].toFixed(1)})
            </label>
            <input
              id={`cal-${k}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={tape[k] ?? ''}
              onChange={(e) => setTape((prev) => ({ ...prev, [k]: e.target.value }))}
              className="input-field"
              placeholder="cm"
            />
          </div>
        ))}
        <div className="sm:col-span-3 flex gap-3">
          <button type="submit" className="btn-primary">Save calibration</button>
          {active && <button type="button" onClick={reset} className="btn-secondary">Reset</button>}
        </div>
      </form>
      {message && <p className="text-sm mt-3" role="status">{message}</p>}
    </details>
  );
};

export default CalibrationPanel;
