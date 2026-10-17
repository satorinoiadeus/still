Still 1.1 adds:

- Sentence-case **Projects** and **Tasks** headings inside areas, on mobile and desktop.
- Mobile **Select tasks** mode: select individual/all visible tasks, complete, reopen, move, schedule, clear schedule and confirm deletion. Changes use the existing transaction/undo engine.
- WebDAV and Dropbox sync providers, inspired by Mindwtr, with encrypted Still snapshots (AES-256-GCM, PBKDF2-SHA256). Use the same provider, dedicated folder and passphrase on each device. Credentials stay in device settings and are not included in task backups. Existing HamsterBase sync remains available.
- Todoist project CSV import/export. Import previews counts/warnings, requires saving a backup, and adds a new project without replacing existing tasks. Sections, four levels of task nesting, descriptions, notes, ISO dates and deadlines transfer. Unsupported metadata stays in descriptions/notes with visible warnings. Export excludes completed/canceled tasks and archived sections; use `.hbTask` backups for lossless Still backups. This is CSV transfer, not Todoist account sync.

Verification includes type checking, lint, engine/transfer/adapter tests, browser workflows, installed Windows task persistence and Android emulator installation/launch. The accompanying verification ZIP contains screenshots and native/browser results.

Testing prerelease: Android uses a development signing key; Windows is unsigned. **Before installing over 1.0, export a `.hbTask` backup.** The original 1.0 Android signing key was generated on an ephemeral build runner and cannot be recovered. Android will reject an in-place update signed with the new key: after saving your backup, uninstall the 1.0 testing build, install 1.1, then import the backup. Future builds cache the development key, but production distribution still needs a durable private signing key. Do not uninstall before saving a verified backup.

WebDAV/Dropbox were verified against controlled HTTP responses and Still CRDT replicas; no live provider account credentials were supplied for certification. WebDAV requires an existing HTTPS root collection and permission to create a dedicated child folder. Browser builds require CORS support; Windows and Android use native networking. Dropbox uses a user-supplied app access token; OAuth sign-in/token refresh, filesystem/Syncthing and iCloud are not implemented. These providers do not interoperate with Mindwtr's JSON data or encryption format. Attachments are not transferred by this task-snapshot provider feature.

Original Still Tauri JSON/SQLite data remains incompatible with this rebuild. Separate app identity protects that installation; see DATA-MIGRATION.md. Main remains unchanged.
