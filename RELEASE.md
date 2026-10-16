# Still v0.3.1 — Quick Capture & Quality of Life

Repository: https://github.com/satorinoiadeus/still

## Highlights

- Todoist-inspired **Quick add** composer with keyboard-first capture, date suggestions, project/Area/section destination, priority and label chips.
- Smart entry: `today`, `tomorrow`, weekdays, `next week`, `weekend`, `in 3 days`, `@label`, `#project`, `!high`, `!low`, `p1`–`p4` (mapped to Still's high/low priority).
- Enter to add, Shift+Enter for a newline, and Keep adding for repeated capture. N and Q shortcuts open the composer when not typing.
- **Rename and delete sections** without losing tasks; deleting a section moves its tasks to No section.
- Project **List/Board** views, priority filters, sort by date/priority/title, compact density, and persistent layout preference.
- Clickable labels on tasks, sidebar label search/counts, dedicated label views, rename and remove labels across tasks without deleting tasks.
- Existing touch drag-to-reorder remains available in List view, with Undo and offline persistence.

## Installation

GitHub Actions `.github/workflows/still-release.yml` verifies source, builds Windows NSIS EXE and Android APK, then publishes a prerelease only when both native builds succeed. Windows installers are unsigned. Android CI builds use development signing unless a persistent signing key is configured. Export a JSON backup before updating. The new APK may not install over an older APK if the signing key differs. This release retains the app identifier `app.still.tasks` and workspace format.

## Limitations

Board columns are currently a viewing layout, not a full Kanban workflow; touch drag-to-reorder is supported in List view. The quick-add date parser handles common English phrases but is not a full natural-language calendar parser. Still's existing three-level priority storage remains none/high/low. No network account or cloud sync has been added. Device-specific runtime testing remains separate from CI packaging.
