# Decisions
- Flask is the single measurement engine; Node kept as API gateway (frontend unchanged) and proxies. Flask moved to :5001 to avoid clashing with Node :5000.
- Untracked (git rm --cached) node_modules and DBs; files stay on disk.
- Multi-photo: per-metric median across photos.
- Tests fake MediaPipe; they verify plumbing, not accuracy.
- Sizing lives in the frontend as a pure TS module (testable with node --test type stripping, no new deps). Bra cup only with measured underbust (pose can't see it).
- Manual entry added because it is the most reliable input and is real functionality, not a mock.
- Brand charts: no fabricated brand data; user pastes a chart instead.
- Flask is stateless; persistence only in Node.
- Scale: nose-ankle/0.90 and hip-ankle/0.49 ratios (anthropometric approximations).
