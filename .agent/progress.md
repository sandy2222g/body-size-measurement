# Progress
Iteration 1: items 1-6 above. Tests: unittest 8/8 pass (fake MediaPipe); tsc OK; vite build OK; Node smoke: health OK, /api/measure -> 503 when Flask down, 400 on empty, user create OK.
Not tested: real MediaPipe inference, browser camera, Flask<->Node proxy with live Flask.
Iteration 2 (enhancement): Results page "Save to Profile" button -> POST /api/measurements for the saved profile user (links to /profile if none). Verified: tsc + vite build OK; Node save/list API round-trip via curl. UI click-through not browser-tested.
Iteration 3 (goal: resume-worthy app bundle): sizing engine (8 garments + bra, women/men, fit ease, between-size, lengths) + bundles; manual entry; gender/fit prefs (persisted); SizeGuide UI w/ copy+CSV; removed dead "Shop Now"; engine-driven chart reference; softened unverified accuracy claims; CI workflow; README rewritten.
Tests: node --test 13/13; tsc OK; vite build OK; Playwright e2e of manual flow (validation, bundles, bra underbust, prefs persisted, 0 console errors).
