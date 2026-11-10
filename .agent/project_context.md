# Project context
Smart Body Measurement System.
- Frontend: React 18 + Vite + Tailwind + TS (`src/`), dev proxy `/api` -> Node (:5000).
- `server.cjs` (Express + sqlite3): users/measurements CRUD; `/api/measure` proxies to Flask (`MEASURE_SERVICE_URL`, default http://127.0.0.1:5001).
- `app.py` (Flask + MediaPipe + OpenCV + SQLAlchemy): real pose-based measurement, also users/measurements API; port from `PORT` (default 5001).
- Run: `python app.py` (:5001), `npm run server` (:5000), `npm run dev`.
- Tests: `python -m unittest discover -s tests` (MediaPipe faked); `npx tsc -p .`; `npm run build`.
