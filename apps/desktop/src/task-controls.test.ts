import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, newTask, newProject, matches, type Task, type Workspace } from "./domain";
import {
    FILTERS, SORTS, DEFAULT_CONTROLS, applyTaskControls, canDragTasks,
    matchesTaskFilter, parseTaskControls, reorderNamedSections, reorderAreas,
    type FilterKind, type SortMode,
} from "./task-controls";
const today = "2026-10-16";
const task = (patch: Partial<Task> = {}): Task => ({ ...newTask("Task"), ...patch, id: patch.id ?? crypto.randomUUID() });
const w: Workspace = blank();
const project = { ...newProject("Alpha project"), id: "p1", areaId: "a1", sections: ["First", "Second", "Third"] };
w.areas = [{ id: "a1", title: "Work", order: 0 }, { id: "a2", title: "Home", order: 1 }, { id: "a3", title: "Fun", order: 2 }];
w.projects = [project];
const checklist = [{ id: "c1", title: "One", done: true }, { id: "c2", title: "Two", done: false }];
const positive: Record<FilterKind, Partial<Task>> = {
    all: {}, overdue: { scheduled: "2026-10-15" },
    scheduledToday: { scheduled: today }, dueToday: { deadline: today },
    next7: { scheduled: "2026-10-19" }, next30: { deadline: "2026-11-02" },
    future: { scheduled: "2026-12-01" }, unscheduled: { scheduled: null },
    scheduled: { scheduled: today }, noDate: { scheduled: null, deadline: null },
    hasDeadline: { deadline: today }, noDeadline: { deadline: null },
    high: { priority: "high" }, normal: { priority: "none" }, low: { priority: "low" },
    tagged: { tags: ["work"] }, untagged: { tags: [] },
    notes: { notes: "Something" }, noNotes: { notes: "  " },
    checklist: { checklist }, noChecklist: { checklist: [] },
    checklistOpen: { checklist }, checklistDone: { checklist: [{ id: "c3", title: "All", done: true }] },
    repeating: { repeat: "weekly" }, oneTime: { repeat: "none" },
    inProject: { projectId: "p1" }, noProject: { projectId: null },
    inArea: { areaId: "a1" }, noArea: { areaId: null, projectId: null },
    someday: { someday: true }, actionable: { someday: false },
    completed: { completedAt: "2026-10-16T12:00:00Z" }, incomplete: { completedAt: null },
};
test("every advertised filter has a working positive case", () => {
    assert.equal(FILTERS.length, 33);
    for (const [kind] of FILTERS) assert.equal(matchesTaskFilter(task(positive[kind]), kind, today), true, kind);
});
test("each filter rejects a representative opposite case", () => {
    const opposite: Record<FilterKind, Partial<Task>> = {
        all: {}, overdue: { scheduled: "2026-10-17" },
        scheduledToday: { scheduled: "2026-10-17" }, dueToday: { deadline: "2026-10-17" },
        next7: { scheduled: "2026-11-01" }, next30: { scheduled: "2026-12-01" },
        future: { scheduled: "2026-10-15" }, unscheduled: { scheduled: today },
        scheduled: { scheduled: null }, noDate: { deadline: today },
        hasDeadline: { deadline: null }, noDeadline: { deadline: today },
        high: { priority: "none" }, normal: { priority: "high" }, low: { priority: "none" },
        tagged: { tags: [] }, untagged: { tags: ["x"] },
        notes: { notes: "  " }, noNotes: { notes: "text" },
        checklist: { checklist: [] }, noChecklist: { checklist },
        checklistOpen: { checklist: [{ id: "c1", title: "Done", done: true }] },
        checklistDone: { checklist }, repeating: { repeat: "none" }, oneTime: { repeat: "daily" },
        inProject: { projectId: null }, noProject: { projectId: "p1" },
        inArea: { areaId: null, projectId: null }, noArea: { areaId: "a1" },
        someday: { someday: false }, actionable: { someday: true },
        completed: { completedAt: null }, incomplete: { completedAt: "2026-10-16T12:00:00Z" },
    };
    for (const [kind] of FILTERS) {
        if (kind !== "all") assert.equal(matchesTaskFilter(task(opposite[kind]), kind, today), false, kind);
    }
});
test("overdue never counts completed work", () => {
    assert.equal(matchesTaskFilter(task({ scheduled: "2026-10-15", completedAt: "2026-10-15T12:00:00Z" }), "overdue", today), false);
});
test("deadline-only tasks count in future windows", () => {
    assert.equal(matchesTaskFilter(task({ deadline: "2026-10-20" }), "next7", today), true);
});
test("next-7 and next-30 windows include their last date", () => {
    assert.equal(matchesTaskFilter(task({ scheduled: "2026-10-23" }), "next7", today), true);
    assert.equal(matchesTaskFilter(task({ scheduled: "2026-11-15" }), "next30", today), true);
});
test("every sort mode is selectable and stable", () => {
    assert.equal(SORTS.length, 13);
    const a = task({ id: "a", title: "Zulu", order: 1, scheduled: "2026-10-19", deadline: "2026-10-22", priority: "low", projectId: null, notes: "a", tags: ["z"], repeat: "monthly", heading: "Second" });
    const b = task({ id: "b", title: "Alpha", order: 0, scheduled: "2026-10-17", deadline: "2026-10-18", priority: "high", projectId: "p1", notes: "abcdef", tags: ["a"], repeat: "daily", heading: "First", checklist });
    const input = [a, b];
    for (const [sort] of SORTS) {
        const out = applyTaskControls(w, input, { ...DEFAULT_CONTROLS, sort }, today);
        assert.deepEqual(out.map((t) => t.id).sort(), ["a", "b"], sort);
        assert.deepEqual(input.map((t) => t.id), ["a", "b"], "input not mutated");
    }
    for (const sort of ["manual", "scheduled", "deadline", "priority", "title", "notes", "repeat", "section"] as SortMode[]) {
        const forward = applyTaskControls(w, input, { ...DEFAULT_CONTROLS, sort }, today);
        const reversed = applyTaskControls(w, input, { ...DEFAULT_CONTROLS, sort, reverse: true }, today);
        assert.deepEqual(reversed.map((t) => t.id), forward.map((t) => t.id).reverse(), sort);
    }
});
test("missing dates stay last in both date directions", () => {
    const a = task({ id: "a", scheduled: null });
    const b = task({ id: "b", scheduled: "2026-10-20" });
    for (const reverse of [false, true]) {
        assert.deepEqual(applyTaskControls(w, [a, b], { ...DEFAULT_CONTROLS, sort: "scheduled", reverse }, today).map((t) => t.id), ["b", "a"]);
    }
});
test("stable ties preserve source order", () => {
    const a = task({ id: "a", title: "same" }), b = task({ id: "b", title: "same" });
    assert.deepEqual(applyTaskControls(w, [b, a], { ...DEFAULT_CONTROLS, sort: "title" }, today).map((t) => t.id), ["b", "a"]);
});
test("search ignores case and normalizes unicode width", () => {
    const a = task({ title: "ＡＢＣ Client" });
    assert.equal(applyTaskControls(w, [a], { ...DEFAULT_CONTROLS, search: "abc" }, today).length, 1);
});
test("project and area selectors follow project ownership", () => {
    const a = task({ projectId: "p1" });
    assert.equal(applyTaskControls(w, [a], { ...DEFAULT_CONTROLS, area: "a1" }, today).length, 1);
    assert.equal(applyTaskControls(w, [a], { ...DEFAULT_CONTROLS, area: "a2" }, today).length, 0);
    assert.equal(applyTaskControls(w, [a], { ...DEFAULT_CONTROLS, project: "p1" }, today).length, 1);
});
test("filter combinations use AND, without changing source", () => {
    const a = task({ id: "a", priority: "high", tags: ["urgent"], notes: "call client" });
    const b = task({ id: "b", priority: "low", tags: ["urgent"] });
    const out = applyTaskControls(w, [a, b], { ...DEFAULT_CONTROLS, priority: "high", label: "URGENT", search: "client", filter: "notes" }, today);
    assert.deepEqual(out.map((t) => t.id), ["a"]);
});
test("invalid saved preferences safely fall back to defaults", () => {
    for (const value of [null, [], "", 123, {}, { sort: "invalid", filter: "bad", layout: "unknown", priority: "other", reverse: "true", search: 42, compact: 1 }]) {
        assert.deepEqual(parseTaskControls(value), DEFAULT_CONTROLS);
    }
});
test("preferences clamp lengths and ignore unknown fields", () => {
    const p = parseTaskControls({ sort: "deadline", filter: "notes", layout: "board", compact: true, reverse: true, search: "a".repeat(1000), label: "b".repeat(1000), secret: "x" });
    assert.equal(p.search.length, 300);
    assert.equal(p.label.length, 120);
    assert.equal("secret" in p, false);
    assert.equal(p.sort, "deadline");
    assert.equal(p.layout, "board");
});
test("dragging only allowed when manual unfiltered order is visible", () => {
    assert.equal(canDragTasks(DEFAULT_CONTROLS), true);
    for (const patch of [
        { sort: "title" }, { reverse: true }, { filter: "high" }, { priority: "low" },
        { label: "work" }, { project: "p1" }, { area: "a1" }, { search: "text" },
    ] as Partial<typeof DEFAULT_CONTROLS>[]) {
        assert.equal(canDragTasks({ ...DEFAULT_CONTROLS, ...patch }), false, JSON.stringify(patch));
    }
});
test("section drag reorders without changing task assignments", () => {
    const a = task({ projectId: "p1", heading: "Second" });
    const workspace = { ...w, tasks: [a] };
    const out = reorderNamedSections(workspace, "p1", "Third", "First");
    assert.deepEqual(out.projects[0].sections, ["Third", "First", "Second"]);
    assert.equal(out.tasks[0].heading, "Second");
    assert.equal(workspace.projects[0].sections?.[0], "First");
});
test("section reorder rejects missing, same and cross-project names", () => {
    for (const [a,b] of [["First","First"],["Missing","First"],["First","Missing"]]) assert.equal(reorderNamedSections(w, "p1", a, b), w);
    assert.equal(reorderNamedSections(w, "wrong", "First", "Second"), w);
});
test("area drag updates only area order and preserves project ownership", () => {
    const out = reorderAreas(w, "a3", "a1");
    assert.deepEqual([...out.areas].sort((a,b)=>a.order-b.order).map((a)=>a.id), ["a3","a1","a2"]);
    assert.equal(out.projects[0].areaId, "a1");
    assert.equal(w.areas[0].order, 0);
});
test("area drag ignores no-op and missing targets", () => {
    assert.equal(reorderAreas(w, "a1", "a1"), w);
    assert.equal(reorderAreas(w, "missing", "a1"), w);
    assert.equal(reorderAreas(w, "a1", "missing"), w);
});

test("completed-only filtering can see completed tasks in project and area views", () => {
    const done = task({ projectId: "p1", completedAt: "2026-10-15T12:00:00Z" });
    assert.equal(matches(w, done, "project:p1", today), false);
    assert.equal(matches(w, done, "project:p1", today, "", true), true);
    assert.equal(matches(w, done, "area:a1", today, "", true), true);
    assert.equal(matches(w, done, "area:a2", today, "", true), false);
    assert.equal(applyTaskControls(w, [done], { ...DEFAULT_CONTROLS, filter: "completed" }, today).length, 1);
});
