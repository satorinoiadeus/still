# Rebuild scope

Base branch: `things3-1to1`, containing the user's earlier task-list selectors and Things shell. The rebuild stays in the same repository and preserves that branch's ancestry. Original files removed from the active tree remain recoverable from Git history.

| Decision | Implementation |
| --- | --- |
| Keep | Git history, license, UUID generation, local-calendar date selectors, Area ordering, Tauri desktop foundation |
| Adapt | Existing Still interface/domain in `apps/desktop`; shared pure helpers renamed `@still/core`; native host reduced to local SQLite and backup dialogs |
| Keep features | Areas, projects, tasks, checklists, capture, scheduling, deadlines, daily/weekly/monthly recurrence, search, Logbook, Trash, Undo, themes, import/export |
| Remove | Original alternate shells and settings, AI, sync, WebDAV, cloud, email capture, audio/transcription, telemetry, MCP/API servers, attachments, calendars, notifications, Pomodoro, widgets, store publishing and unused platforms |
| Android | Same responsive Still app through Tauri Android; old React Native/native clients are removed |
| Windows | Tauri NSIS installer, Still window name and icons |
| Data | Separate identifier from original app; import JSON with explicit preview, validation, and warnings; source files remain untouched |

## List and recurrence rules

Inbox holds unfiled tasks; a scheduled Inbox task can also appear in Today or Upcoming. Today is scheduled work today or earlier. A deadline alone never schedules work. Upcoming holds future scheduled actions. Anytime holds filed, unscheduled actions. Someday overrides schedule lists. Completed work goes to Logbook. Archived/completed/deleted projects hide unfinished tasks from active lists. Search includes completed and archived work but excludes Trash.

Completion creates at most one future recurring occurrence; skipped dates do not create a backlog. Monthly recurrence preserves the original day and clamps in short months. Reopening/re-completing does not duplicate its successor. Undo restores the whole prior workspace.

Native saves validate the full graph and atomically replace one SQLite snapshot with optimistic revision checking. Failed writes do not update displayed data. There is no fallback to browser storage on native database failure.

## Repository name

The connected GitHub tools do not expose repository renaming. The code, installed app, package names and build artifacts are Still; the remote repository URL remains unchanged until renamed through GitHub repository settings. No repository is created or history force-pushed.
