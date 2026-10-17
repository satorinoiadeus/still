# Contributing to Still

Still is an independent AGPL-3.0 derivative of HamsterBase Tasks. See UPSTREAM.md for the imported revision and retained notices.

Use Node 22+ and pnpm 10.15.0. Clone https://github.com/satorinoiadeus/still and switch to feat/hamsterbase-still-rebuild. Install with `pnpm install --frozen-lockfile`, start with `npm run dev`, and run `npm run check`, `npm test`, `npm run web:build` and `npm run test:ui` before a pull request. Playwright requires `npx playwright install --with-deps chromium`.

Keep changes modular. Preserve the upstream task model, CRDT formats, encryption algorithm, storage adapters and service behavior unless a separately tested fix is needed. Keep platform presentation separate from task logic. Retain all license and source notices.

Do not migrate or overwrite old Still JSON/SQLite data without explicit, tested conversion. Read DATA-MIGRATION.md and README.md for native build requirements. Changes stay on the development branch until verification and data compatibility are resolved.
