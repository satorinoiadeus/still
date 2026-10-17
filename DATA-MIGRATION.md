# Existing Still data: explicit compatibility boundary

The old Still release (`26a23200da1fde7c6684db49d09f82c85c681463`) used Tauri, SQLite and Still JSON backups. This rebuild uses HamsterBase's Loro model and `.hbTask` snapshots. They are different formats. There is **no automatic old-Still importer** in this branch. Do not rename JSON files to `.hbTask`.

1. Open the old Still app and export its JSON backup through Settings & backups. Keep a second copy outside the app directory.
2. Keep the original app installed. Record its version and retain its installer/signing key where applicable.
3. Install this rebuild as a separate application (`app.still.next` on Android; `app.still.next.desktop` / `StillNext` on Windows). It does not read, replace or delete the old database.
4. Start with an empty testing workspace. Old JSON cannot currently be imported safely. Keep using the old app for existing data until a separately tested converter is available.
5. Native HamsterBase `.hbTask` exports can be imported through this application's existing import flow. Export the current workspace before importing any file. Import merges CRDT history; it is not a previewable replace operation.
6. Test your backup in a disposable workspace before depending on it. Browser storage can be cleared by the browser; install files alone are not backups.

The old SQLite, old JSON, encryption keys, native accounts and sync configurations are never migrated implicitly. Main is deliberately not merged while this migration limitation and native runtime verification remain unresolved.
