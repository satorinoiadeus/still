# Verification

Local environment: Linux, Node 24.19.0. pnpm 11 installed frozen upstream lockfile with lifecycle scripts disabled; CI pins upstream pnpm 10.15.0 and enables the upstream approved Electron/esbuild lifecycle scripts.

Passed locally:
- TypeScript project check and ESLint (zero errors/warnings after fixing one inherited hook dependency).
- Production Vite build with relative asset URLs.
- Electron main/preload bundle compilation.
- Eight engine tests: create/edit/complete/delete/undo; hierarchy and ordering; snapshot round trip/idempotent import; damaged/legacy input rejection; two-replica CRDT merge; recurrence parser and generation; AES round trip/wrong-key rejection.

Fifteen browser checks pass locally, including mobile search, in-session offline capture, task completion, IndexedDB reload persistence, appearance preference persistence, sidebar collapse, dark mode, desktop search, and phone/tablet widths. Browser checks and screenshots are recorded by `tests/ui.mjs` in `verification/ui-results.json`. Do not treat source inspection or compilation as proof of native runtime behavior.

Native CI validation installs the NSIS installer and exercises task creation/persistence in the installed Windows app. Android CI checks the APK signature and package identity, installs it in an API 35 emulator and requires the task navigation UI to appear without an app crash. Results and native screenshots are attached to the exact Actions run. Notifications, paid cloud accounts, live self-hosted sync, attachment upload, AI endpoints and physical-device behavior remain outside the verified scope. Local Android sync succeeds; Gradle compilation stops at `services.gradle.org` with `java.net.SocketException: Network is unreachable`, and no Android SDK is installed. Local Windows packaging downloads Electron successfully, then stops because Wine is required for Windows executable resource editing on Linux. GitHub Actions is responsible for platform compilation. CI artifacts must be checked against the exact run/commit before distribution. Windows code signing and stable Android release signing are not configured.

Known upstream build warnings: large main web chunk and a Zod circular dependency during Electron compilation. These are retained rather than stripping upstream capabilities to make the bundle look smaller. The old Still JSON/SQLite format has no safe converter; see DATA-MIGRATION.md.

## Still 1.1 verification

Release candidate: `d443cab9194f21eb7fbbcf2d819ade9086238644`.
Local results: TypeScript and ESLint pass without warnings; 16 engine/CSV/encryption/provider tests pass; 23 browser checks pass without uncaught exceptions. Production Vite and Electron bundles compile. The additional checks cover mobile multi-selection, completion, move, scheduling, deletion confirmation, Todoist preview/backup/import/export, sentence-case area headings and the real provider sync service over controlled WebDAV responses. Dropbox pagination, remote errors, encryption failures and two-replica CRDT convergence are exercised by adapter tests.

Native CI for this exact candidate: https://github.com/satorinoiadeus/still/actions/runs/39054737318
The workflow gates publication on the installed Windows persistence/native HTTPS sync check, Android APK install/launch, and two Android instrumentation regression tests for WebDAV verbs/request policy. Check the run's final conclusion before distributing its binaries. Live WebDAV/Dropbox credentials, Dropbox OAuth/refresh, attachment provider transfer and physical-device behavior are outside the verified scope.

Screenshots are actual running UI captures:

- [Area desktop](screenshots/still-area-desktop.png) and [area mobile](screenshots/still-area-mobile.png)
- [Mobile batch selection](screenshots/still-mobile-batch.png)
- [Todoist transfer](screenshots/still-todoist-mobile.png)
- [Sync configuration](screenshots/still-sync-mobile.png)

See [release notes](RELEASE-1.1.md), particularly the required Android 1.0 backup/reinstall/restore procedure.
