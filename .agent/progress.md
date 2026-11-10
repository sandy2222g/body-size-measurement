# Progress
Iteration 1: items 1-6 above. Tests: unittest 8/8 pass (fake MediaPipe); tsc OK; vite build OK; Node smoke: health OK, /api/measure -> 503 when Flask down, 400 on empty, user create OK.
Not tested: real MediaPipe inference, browser camera, Flask<->Node proxy with live Flask.
Iteration 2 (enhancement): Results page "Save to Profile" button -> POST /api/measurements for the saved profile user (links to /profile if none). Verified: tsc + vite build OK; Node save/list API round-trip via curl. UI click-through not browser-tested.
