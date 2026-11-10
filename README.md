# SmartMeasure — body measurements to a size across your whole wardrobe

Get body measurements from a photo (pose estimation) or a tape measure, then get the
right size for **T-shirts, shirts, jackets, dresses, skirts, trousers, jeans, leggings and bras**,
grouped into wardrobe bundles (Everyday, Workwear, Activewear, Intimates).

## Why it is useful
Sizes differ between garments and fits. Instead of one "M", you get a per-garment answer,
a "between sizes" hint (with the alternate size), a sleeve/leg length category, and a
fit preference (slim / regular / relaxed). Results can be copied, exported as CSV, or saved
to a profile to track over time.

## Features
- **Photo measurement** – up to 3 photos, MediaPipe pose landmarks + OpenCV; per-metric median across photos.
- **Manual entry** – tape-measure input with range validation (no photo / camera needed).
- **Size engine** (`src/lib/sizing.ts`) – pure, unit-tested TypeScript: weighted chart matching, fit ease, between-size detection, out-of-chart warnings.
- **Bra sizing** – band estimate from bust; cup size once an underbust is entered.
- **Brand chart check** – paste any product's size chart and get your size in it (no brand data is invented).
- **Profile & history** – save results to a profile (Express + SQLite, single source of truth).
- **Plausibility guard** – photos that don't look like a straight full-body pose are rejected instead of returning a made-up size.
- **CI** – type-check, unit tests, build, and backend tests on every push.

## Architecture
```
React + Vite + Tailwind (src/)  ──/api──▶  Express gateway (server.cjs, SQLite)
                                                   │ /api/measure
                                                   ▼
                                  Flask + MediaPipe + OpenCV (app.py)
```

## Run
```bash
npm ci
pip install -r requirements.txt   # use Python 3.9-3.11 (verified on 3.11); pinned mediapipe has no 3.12+ wheels
python app.py                     # stateless measurement service :5001 (PORT / HOST / FLASK_DEBUG)
npm run server                    # gateway :5000 (MEASURE_SERVICE_URL)
npm run dev                       # frontend
```
Manual entry and the size guide work without the Python service.

## Test
```bash
npm run typecheck && npm test && npx vite build
python -m unittest discover -s tests      # MediaPipe is faked; Node tests cover the gateway
```

## Limitations (honest)
- Photo-based circumferences are estimated from 2D widths; accuracy has **not** been validated against ground truth. Prefer manual entry for fitted garments.
- Size charts are generic, not brand-specific. Cup size needs a manual underbust.
- The real pose pipeline was smoke-tested on a handful of public sample photos (it runs; implausible poses are rejected), but accuracy has not been benchmarked against tape measurements.
- Chest/hip circumference use fixed ratios from 2D widths.
