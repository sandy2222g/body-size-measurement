# Decisions
- Flask is the single measurement engine; Node kept as API gateway (frontend unchanged) and proxies. Flask moved to :5001 to avoid clashing with Node :5000.
- Untracked (git rm --cached) node_modules and DBs; files stay on disk.
- Multi-photo: per-metric median across photos.
- Tests fake MediaPipe; they verify plumbing, not accuracy.
