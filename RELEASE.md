# Still v0.2.2 — independent repository

Repository: `satorinoiadeus/still`. The earlier `Mindwtr` repository is preserved separately.

## Build and publish

- `.github/workflows/still-release.yml` verifies source, builds a Windows NSIS `.exe` and Android `.apk`, then publishes a GitHub prerelease if every job succeeds.
- The first commit on `main` with a message beginning `release:` publishes `v0.2.2`. Future tags `v*` or manual workflow dispatch can also trigger a release.
- `.github/workflows/still-build.yml` is available for manual builds and pull-request verification.
- Android uses development signing unless `STILL_ANDROID_DEBUG_KEYSTORE_BASE64` is configured. Windows installers are unsigned. Treat these as experimental builds; back up data before updating.

## What's new

- Create named sections inside projects, including empty sections, and add tasks directly into them.
- Drag tasks by the handle on desktop and touch devices. The floating card, insertion indicators, and smooth layout animations show where a task will land.
- Move tasks between project sections by dropping on a task or section heading.
- The previous keyboard-friendly up/down controls remain, and reduced-motion preferences are honored.
- Existing tasks, headings, backups, storage and design remain compatible. No new runtime dependencies.
