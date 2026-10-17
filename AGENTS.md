# Still engineering agent instructions

## Mission
Continue the existing Still application. Do not replace the codebase or rewrite it from scratch. Keep the application fast, accessible, offline-first and safe for existing user data.

## Architecture
- Workspace: npm workspaces; desktop app under `apps/desktop`.
- UI: React and TypeScript; Tauri packages Android and Windows.
- Persistence: local SQLite on native, browser-local preview on web.
- Preserve the existing Workspace schema and import validation unless a versioned migration is explicitly added.
- Existing Still JSON backups must remain restorable.

## Required feature work
1. Area headings must display `Projects` and `Tasks` (never all caps).
2. Mobile-friendly multi-select tasks with accessible checkboxes and batch complete / move-to-trash; integrate the existing `BatchSelect.tsx` into `main.tsx`.
3. Todoist CSV import/export: integrate `todoist-csv.ts` into Settings, show an import preview, and avoid silent replacement of current tasks.
4. Optional sync options informed by Mindwtr: research source implementation and licensing before reuse; start with interoperable WebDAV/shared-folder flows. Do not claim Dropbox or iCloud support until authenticated end-to-end sync works. Avoid overwriting newer remote/local workspaces.

## Change protocol
- Work in a feature branch; never push directly to main.
- Commit focused changes and include tests.
- Run `npm ci`, `npm run verify`, Windows and Android CI builds.
- Preserve attribution and applicable source licenses.
- No fabricated success: report actual run links, failing logs and artifacts.
- Never publish a release without both installer artifacts and successful verification.
- For any schema/sync changes, add migration, conflict, backup and rollback tests.

## Definition of done
Functionality is wired into the UI, tested on mobile-sized viewports, verified in CI, and shipped with working download links. A utility file alone is not a completed feature.
