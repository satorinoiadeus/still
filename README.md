# Still

A little space for your next action. A modern, local-first task manager built from the actual **HamsterBase Tasks** application, with warm neutral surfaces, sage accents, light/dark/e-ink themes, keyboard access, resizable/collapsible desktop navigation, mobile navigation, and adjustable task spacing and accent colors.

This development branch replaces the old Still application. **It is not a compatible upgrade of the old SQLite database.** Main and its release history remain unchanged. Read [DATA-MIGRATION.md](DATA-MIGRATION.md) before installing.

## Foundation

Upstream commit `5cebe7b4dd8464f5187a932a85785bf6c68eb206` is imported, not reimplemented. The Loro CRDT task model, scheduling, recurrence, areas, projects, headings, subtasks, ordering, saved views, command palette, local database adapters, import/export and synchronization implementations are retained. The only core adjustment is standard default imports for CryptoJS CommonJS/ESM interoperability; formats and algorithms are unchanged.

Cloud accounts, payments, AI, attachment endpoints, self-hosted sync and native reminders are upstream integrations. Their source is preserved; availability and cross-device interoperability have **not** been certified for this derivative. No Still-hosted service is provided. Offline storage is supported; first-ever loading of the web app still requires its files. This is not an installable offline PWA.

## Run and check

Node.js 22+, pnpm 10.15.0:

```sh
pnpm install --frozen-lockfile
npm run dev
npm run check
npm test
npm run web:build
npm run electron:build
```

Serve `dist` with SPA fallback. Use `/desktop/inbox` for the desktop interface; Android user agents and narrow initial viewports open the mobile interface. Mobile and desktop retain their upstream routing behavior; reload after changing between phone and desktop emulation.

Browser workflow verification and screenshots:

```sh
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install --with-deps chromium
npm run test:ui
```

Tests launch a local production preview themselves. See [VERIFICATION.md](VERIFICATION.md) for actual results and limits.

## Windows installer

On Windows x64 with Node 22 and pnpm:

```sh
pnpm install --frozen-lockfile
npm run web:build -- --use-relative-base
npm run electron:build
npm run electron:pack
```

Electron-builder produces an unsigned NSIS installer in `release/`. Identity: `app.still.next.desktop`; data directory: `StillNext`. This intentionally coexists with the older Still app.

## Android APK

Use JDK 21, Android SDK API 35 and build-tools 35.0.0. Set `ANDROID_HOME` and accept the SDK licenses.

```sh
pnpm install --frozen-lockfile
npm run web:build
pnpm exec cap sync android
cd android
./gradlew assembleStandardDebug
```

Output: `android/app/build/outputs/apk/standard/debug/*.apk`. Identity: `app.still.next`. These APKs use a development signing key. A fresh GitHub runner generates a fresh key, so subsequent CI APKs may require a backup and uninstall of this testing app. Never uninstall your original Still app to install this rebuild. Production signing is not configured.

## Automated artifacts

[Still verified builds](https://github.com/satorinoiadeus/still/actions/workflows/still-build.yml) runs checks, engine tests, production build and browser workflows before Android/Windows packaging. Download artifacts from a **successful run for the exact commit**. An artifact is not proof of native device testing. No workflow merges main or publishes a public release automatically.

## Source, reuse and attribution

AGPL-3.0-only. Still is an independent derivative, not affiliated with HamsterBase. Keep LICENSE and [UPSTREAM.md](UPSTREAM.md) with distributed source. Original notices and MIT licenses for vendored VSCF/VS Code-derived infrastructure and build tooling remain in `src/packages`. Lucide supplies the existing icon system. Still's presentation changes are documented in [DESIGN.md](DESIGN.md). Optional third-party service names remain accurate in service-related screens.
