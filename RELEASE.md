# Still v0.3.2 — Quiet Power Update

This release adds **more than 50 distinct task-view options and workflow improvements**, with most of the work in pure, tested filtering/sorting, data integrity and drag-and-drop logic. This is not a claim of 50 new standalone screens.

## One expandable corner
- The toolbar now contains a compact **Filter & sort** button. Expand it only when needed.
- **33 filter choices**: overdue, due today, scheduled today, next 7/30 days, future, scheduled/unscheduled, deadline/no deadline, no dates, three priorities, labels/no labels, notes/no notes, checklist/no checklist, unfinished/finished checklists, recurring/one-time, in/not in project, in/no area, someday/actionable, completed/incomplete and all.
- **13 sort choices**: manual, scheduled date, deadline, priority, title, project, area, labels, checklist progress, description length, recurrence, completion date and section.
- Combine filters with priority, specific label, project, area and text search. Reverse sort, toggle compact rows and switch project List/Board layouts.
- Controls are validated before loading, safely fall back after corrupted preferences, persist locally and reset in one tap. No account or cloud needed.

## Drag and arrange
- Touch/pointer drag handles for task lists and project boards; drag between board sections, including empty columns.
- Drag project cards inside an Area; drag Area headings in the sidebar; drag named project sections in List or Board.
- Drag tasks from the main list onto sidebar Projects, Areas or Inbox. Cross-destination moves preserve task details while clearing obsolete section assignments.
- Keyboard arrow keys reorder tasks, projects, Areas and sections. Drag is disabled while filtered/auto-sorted to prevent unexpected hidden-item reorder.

## Behind the scenes
- Pure deterministic selectors; project/area lookup indexes avoid repeated O(tasks × projects) scans.
- Stable sorting, undated items last, Unicode-normalized case-insensitive search, combined predicates and safe settings parsing.
- Trim and validate task/project edits; deduplicate labels case-insensitively, normalize sections, reject blank checklist items and duplicate checklist IDs.
- Protect against missing Area/Project references and dual ownership; preserve existing data format.
- Duplicate a task with new IDs and reset checklist/completion state. Self-drops are no-ops.
- Large-workspace recurrence and duplication order assignment avoids argument-stack overflow.
- Unit tests cover filter positive/negative cases, all sorts, persistence, area/section reordering, destination moves, validation, duplication and large collections.
- Offline storage and JSON backups remain compatible with v0.3.1.

## Installation
GitHub Actions verify tests and builds Windows EXE and Android APK before publishing. Export a backup before upgrading. The Windows installer is unsigned and Android CI uses development signing unless a persistent key is configured; changing the Android signing key may prevent in-place upgrades.

## Limitations
Pointer dragging is built for touch and mouse, but CI cannot fully reproduce every physical Android gesture or device-specific WebView. Filtered views intentionally cannot be manually dragged until filters and automatic sorting are cleared. This remains a local-first, single-device app without sync.
