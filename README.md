# Smart Body Measurement System

Estimate body measurements and a clothing size from 1–3 photos.

## Architecture
- `src/` – React + Vite + Tailwind frontend (dev server proxies `/api` to port 5000).
- `server.cjs` – Express/SQLite API gateway (users, saved measurements). `/api/measure` is forwarded to the Flask service.
- `app.py` – Flask + MediaPipe + OpenCV measurement service (default port 5001).

## Run
```bash
npm ci
pip install -r requirements.txt     # needs a Python version supported by the pinned mediapipe
python app.py                       # measurement service, :5001 (PORT, HOST, FLASK_DEBUG=1 to override)
npm run server                      # API gateway, :5000 (MEASURE_SERVICE_URL to override)
npm run dev                         # frontend
```

## Checks
```bash
npx tsc -p . && npm run build
python -m unittest discover -s tests   # MediaPipe is faked; accuracy is not tested
```

Measurements are estimates (circumferences are derived from 2D widths); see `accuracy_improvement_guide.md`.
