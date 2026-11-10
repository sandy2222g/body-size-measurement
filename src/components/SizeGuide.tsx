import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, FileDown, Info } from 'lucide-react';
import {
  BUNDLES, bundleToCsv, parseCustomChart, recommendFromCustomChart, bundleToText, isValidBody, recommendBra, recommendBundle,
  type BodyMeasurements, type Fit, type Gender,
} from '../lib/sizing';

interface Props {
  body: BodyMeasurements;
  gender: Gender;
  fit: Fit;
  onUnderbustChange: (value: number | undefined) => void;
}

const SizeGuide: React.FC<Props> = ({ body, gender, fit, onUnderbustChange }) => {
  const bundles = BUNDLES.filter((b) => !b.includesBra || gender === 'female');
  const [bundleId, setBundleId] = useState(bundles[0].id);
  const [copied, setCopied] = useState(false);
  const [chartText, setChartText] = useState('');
  const bundle = bundles.find((b) => b.id === bundleId) ?? bundles[0];

  const valid = isValidBody(body);
  const results = useMemo(() => (valid ? recommendBundle(bundle, body, gender, fit) : []), [valid, bundle, body, gender, fit]);
  const custom = useMemo(() => {
    if (!valid || !chartText.trim()) return null;
    const { rows, errors } = parseCustomChart(chartText);
    return { errors, result: rows.length ? recommendFromCustomChart(rows, body, fit) : null };
  }, [valid, chartText, body, fit]);
  const bra = valid && bundle.includesBra ? recommendBra(body) : null;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(bundleToText(bundle, results, bra));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([bundleToCsv(bundle, results, bra)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sizes-${bundle.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!valid) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mt-8"
      aria-label="Size guide"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-semibold">Your Size Guide</h2>
        <div className="flex gap-2">
          <button onClick={copyText} className="btn-secondary flex items-center text-sm">
            <Copy size={16} className="mr-1" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={downloadCsv} className="btn-secondary flex items-center text-sm">
            <FileDown size={16} className="mr-1" />
            CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Wardrobe bundles">
        {bundles.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={b.id === bundle.id}
            onClick={() => setBundleId(b.id)}
            className={`px-4 py-2 rounded-full text-sm border ${
              b.id === bundle.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>
      <p className="text-gray-600 mb-4">{bundle.description} · {gender === 'female' ? "Women's" : "Men's"} chart · {fit} fit</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r) => (
          <div key={r.garment.id} className="border border-gray-200 rounded-lg p-4" data-testid={`size-${r.garment.id}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{r.garment.icon} {r.garment.name}</span>
              <span className="text-2xl font-bold text-primary-600" aria-label={`${r.garment.name} size`}>{r.size}</span>
            </div>
            {(r.length || r.alternate) && (
              <p className="text-sm text-gray-600 mt-1">
                {r.length && <>Length: <strong>{r.length}</strong></>}
                {r.length && r.alternate && ' · '}
                {r.alternate && <>Also consider <strong>{r.alternate}</strong></>}
              </p>
            )}
            <p className={`text-xs mt-2 ${r.outOfRange ? 'text-red-700' : 'text-gray-500'}`}>{r.note}</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded" aria-hidden="true">
              <div className="h-1.5 rounded bg-green-500" style={{ width: `${Math.round(r.confidence * 100)}%` }} />
            </div>
          </div>
        ))}

        {bra && (
          <div className="border border-gray-200 rounded-lg p-4 sm:col-span-2" data-testid="size-bra">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">🎀 Bra</span>
              <span className="text-2xl font-bold text-primary-600">
                {bra.bandEU}{bra.cup ?? ''} <span className="text-sm font-normal text-gray-500">EU</span>
                {' / '}{bra.bandUS}{bra.cup ?? ''} <span className="text-sm font-normal text-gray-500">US</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{bra.note}</p>
            <label htmlFor="underbust" className="block text-sm text-gray-700 mt-3 mb-1">Underbust (cm, optional)</label>
            <input
              id="underbust"
              type="number"
              inputMode="decimal"
              min={55}
              max={140}
              step="0.5"
              defaultValue={body.underbust ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                onUnderbustChange(e.target.value && Number.isFinite(n) && n >= 55 && n <= 140 ? n : undefined);
              }}
              className="input-field max-w-[10rem]"
              placeholder="e.g. 78"
            />
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6" data-testid="custom-chart">
        <h3 className="text-lg font-semibold mb-1">Check a specific brand's size chart</h3>
        <p className="text-sm text-gray-600 mb-3">
          Paste the size chart from the product page, one size per line: <code>label chest waist hips</code> in cm,
          e.g. <code>M 94-102 78-86 -</code> (use <code>-</code> for a column the brand doesn't list).
        </p>
        <label htmlFor="brand-chart" className="sr-only">Brand size chart</label>
        <textarea
          id="brand-chart"
          value={chartText}
          onChange={(e) => setChartText(e.target.value)}
          rows={5}
          className="input-field font-mono text-sm"
          placeholder={'S 84-90 66-72 -\nM 90-98 72-80 96-104\nL 98-106 80-88 104-112'}
        />
        {custom?.errors.map((err) => (
          <p key={err} className="text-sm text-red-700 mt-2">{err}</p>
        ))}
        {custom?.result && (
          <p className="mt-3 text-gray-800" data-testid="custom-result">
            Your size in this chart: <strong className="text-2xl text-primary-600">{custom.result.size}</strong>
            {custom.result.alternate && <> (or {custom.result.alternate})</>}
            <span className="block text-sm text-gray-600">{custom.result.note}</span>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-6 flex items-start">
        <Info size={14} className="mr-1 mt-0.5 flex-shrink-0" />
        Sizes follow generic charts and vary between brands — always check the brand's own size chart,
        especially for fitted garments and bras.
      </p>
    </motion.section>
  );
};

export default SizeGuide;
