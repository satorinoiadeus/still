# Verification

Local environment: Linux, Node 24.19.0. pnpm 11 installed frozen upstream lockfile with lifecycle scripts disabled; CI pins upstream pnpm 10.15.0 and enables the upstream approved Electron/esbuild lifecycle scripts.

Passed locally:
- TypeScript project check and ESLint (zero errors/warnings after fixing one inherited hook dependency).
- Production Vite build with relative asset URLs.
- Electron main/preload bundle compilation.
- Eight engine tests: create/edit/complete/delete/undo; hierarchy and ordering; snapshot round trip/idempotent import; damaged/legacy input rejection; two-replica CRDT merge; recurrence parser and generation; AES round trip/wrong-key rejection.

Fourteen browser checks pass locally, including mobile search, in-session offline capture, task completion, IndexedDB reload persistence, appearance preference persistence, sidebar collapse, dark mode, desktop search, and phone/tablet widths. Browser checks and screenshots are recorded by `tests/ui.mjs` in `verification/ui-results.json`. Do not treat source inspection or compilation as proof of native runtime behavior.

Not certified yet: installing/running Android and Windows binaries, notifications, paid cloud accounts, live self-hosted sync, attachment upload and AI endpoints. Local Android sync succeeds; Gradle compilation stops at `services.gradle.org` with `java.net.SocketException: Network is unreachable`, and no Android SDK is installed. Local Windows packaging downloads Electron successfully, then stops because Wine is required for Windows executable resource editing on Linux. GitHub Actions is responsible for platform compilation. CI artifacts must be checked against the exact run/commit before distribution. Windows code signing and stable Android release signing are not configured.

Known upstream build warnings: large main web chunk and a Zod circular dependency during Electron compilation. These are retained rather than stripping upstream capabilities to make the bundle look smaller. The old Still JSON/SQLite format has no safe converter; see DATA-MIGRATION.md.
