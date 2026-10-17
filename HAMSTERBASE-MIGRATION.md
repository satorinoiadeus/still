# Still — HamsterBase migration

Source: https://github.com/hamsterbase/tasks (AGPL-3.0-only)
Destination: https://github.com/satorinoiadeus/still

This branch is isolated from main. Existing Still user data and release builds must not be overwritten without migration tests.

## Implementation rules
1. Use the actual HamsterBase Tasks application source, not a mock or a reimplementation.
2. Preserve the task engine, offline storage, encryption and synchronization behavior; do not claim interoperability with Still's existing SQLite or JSON format without tests.
3. Redesign presentation only: Still identity, quiet neutral/green palette, typography, spacing, accessible controls, desktop sidebar and mobile navigation.
4. Keep the original AGPL license, attribution, and source obligations.
5. Validate web, Electron/Windows and Capacitor/Android builds independently.
6. Do not publish an APK/EXE or migrate existing users until tested.

## Local import (on a machine with GitHub network access)

```bash
git clone https://github.com/satorinoiadeus/still.git
cd still
git switch feat/hamsterbase-still-rebuild
git clone --depth 1 https://github.com/hamsterbase/tasks.git /tmp/hamsterbase-tasks
# Review source, license, and dependencies before replacing the app.
```

The source application is a pnpm/React/Vite project with Electron and Capacitor targets. Existing Still is a separate npm/Tauri application. Therefore importing the source is an application replacement, not a safe drop-in CSS change. Preserve the old app in Git history and test data migration before release.
