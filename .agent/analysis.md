# Audit findings
Critical: C1 frontend sends `images[]` but Flask read `image` (real CV path unreachable); C2 Node `/api/measure` returned random mock numbers presented as real.
High: H1 node_modules + *.db committed, no .gitignore; H2 no tsconfig (npm run build failed) + TS errors; H3 camera never started (video ref null before render); H4 Flask debug=True on 0.0.0.0; H5 unvalidated inputs in Flask user/measurement routes (KeyError 500s, dup email 500).
Medium: bare excepts, debug prints, unused multer/uuid code in server.cjs, localStorage JSON.parse crash, leaked timers.
Low/open: pinned requirements (numpy 1.24/mediapipe 0.10.7) don't install on Python 3.13; Flask+Node duplicate user/measurement endpoints; chest/hip circumference are crude ratio heuristics (accuracy ~±3cm claimed, unverified); Results page not saving measurements to history; datetime.utcnow deprecation; empty README; npm audit warnings.
