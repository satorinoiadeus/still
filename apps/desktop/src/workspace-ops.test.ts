import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, newTask, newProject, validate, moveTask, type Workspace } from "./domain";
import { prepareTaskForSave, prepareProjectForSave, moveTaskDestination, duplicateTask } from "./workspace-ops";
const w: Workspace = blank();
w.areas = [{ id: "a1", title: "Work", order: 0 }];
w.projects = [{ ...newProject("Launch"), id: "p1", areaId: "a1", sections: ["First", "Second"] }, { ...newProject("Unassigned"), id: "p2" }];
w.tasks = [
    { ...newTask("Original"), id: "t1", projectId: "p1", heading: "First", order: 1, tags: ["Work"], checklist: [{ id: "c1", title: "Check", done: true }] },
    { ...newTask("Second"), id: "t2", areaId: "a1", order: 2 },
];
test("task save trims title and notes without touching original", () => {
    const original = { ...w.tasks[0], title: "  Do thing  ", notes: "  Notes \n " };
    const result = prepareTaskForSave(original, w);
    assert.equal(result.title, "Do thing");
    assert.equal(result.notes, "Notes");
    assert.equal(original.title, "  Do thing  ");
});
test("task labels trim, remove @ and deduplicate case-insensitively", () => {
    const result = prepareTaskForSave({ ...w.tasks[0], tags: [" @Work ", "work", "", " Home ", "HOME"] }, w);
    assert.deepEqual(result.tags, ["Work", "Home"]);
});
test("checklist titles trim and original checklist remains untouched", () => {
    const result = prepareTaskForSave({ ...w.tasks[0], checklist: [{ id: "c1", title: "  Hello  ", done: false }] }, w);
    assert.equal(result.checklist[0].title, "Hello");
    assert.equal(w.tasks[0].checklist[0].title, "Check");
});
test("task save rejects blank title and checklist titles", () => {
    assert.throws(() => prepareTaskForSave({ ...w.tasks[0], title: "  " }, w));
    assert.throws(() => prepareTaskForSave({ ...w.tasks[0], checklist: [{ id: "c1", title: "  ", done: false }] }, w));
});
test("task save rejects duplicate checklist IDs", () => {
    assert.throws(() => prepareTaskForSave({ ...w.tasks[0], checklist: [{ id: "c1", title: "A", done: false }, { id: "c1", title: "B", done: false }] }, w));
});
test("task save rejects missing area and project references", () => {
    assert.throws(() => prepareTaskForSave({ ...w.tasks[0], projectId: "missing" }, w));
    assert.throws(() => prepareTaskForSave({ ...w.tasks[0], projectId: null, areaId: "missing" }, w));
});
test("project membership clears duplicate area assignment", () => {
    const result = prepareTaskForSave({ ...w.tasks[0], areaId: "a1" }, w);
    assert.equal(result.areaId, null);
    assert.equal(result.projectId, "p1");
});
test("moving to inbox clears old section but retains notes, labels and dates", () => {
    const out = moveTaskDestination(w, "t1", { kind: "inbox" });
    assert.equal(out.tasks[0].projectId, null);
    assert.equal(out.tasks[0].heading, "");
    assert.deepEqual(out.tasks[0].tags, ["Work"]);
    assert.equal(out.tasks[0].checklist.length, 1);
    assert.equal(w.tasks[0].projectId, "p1");
    assert.doesNotThrow(() => validate(out));
});
test("moving between projects clears stale section", () => {
    const out = moveTaskDestination(w, "t1", { kind: "project", id: "p2" });
    assert.equal(out.tasks[0].projectId, "p2");
    assert.equal(out.tasks[0].heading, "");
    assert.equal(out.tasks[0].areaId, null);
    assert.doesNotThrow(() => validate(out));
});
test("moving to an area clears project ownership", () => {
    const out = moveTaskDestination(w, "t1", { kind: "area", id: "a1" });
    assert.equal(out.tasks[0].areaId, "a1");
    assert.equal(out.tasks[0].projectId, null);
    assert.doesNotThrow(() => validate(out));
});
test("destination moves ignore missing and unchanged destinations", () => {
    assert.equal(moveTaskDestination(w, "missing", { kind: "inbox" }), w);
    assert.equal(moveTaskDestination(w, "t1", { kind: "project", id: "p1" }), w);
    assert.equal(moveTaskDestination(w, "t1", { kind: "project", id: "missing" }), w);
    assert.equal(moveTaskDestination(w, "t1", { kind: "area", id: "missing" }), w);
});
test("project save normalizes sections and preserves first casing", () => {
    const result = prepareProjectForSave({ ...w.projects[0], title: " Launch ", notes: " a ", doneMeans: " b ", sections: [" First ", "first", "", "Second"] }, w);
    assert.deepEqual(result.sections, ["First", "Second"]);
    assert.equal(result.title, "Launch");
    assert.equal(result.notes, "a");
    assert.equal(result.doneMeans, "b");
});
test("project save rejects unknown area and blank title", () => {
    assert.throws(() => prepareProjectForSave({ ...w.projects[0], areaId: "missing" }, w));
    assert.throws(() => prepareProjectForSave({ ...w.projects[0], title: "  " }, w));
});
test("duplicate task creates independent IDs, resets completion, retains project", () => {
    const original = { ...w, tasks: [{ ...w.tasks[0], completedAt: "2026-10-15T10:00:00Z", nextId: null }, w.tasks[1]] };
    const out = duplicateTask(original, "t1");
    const copy = out.tasks[2];
    assert.equal(copy.title, "Original (copy)");
    assert.notEqual(copy.id, "t1");
    assert.notEqual(copy.checklist[0].id, "c1");
    assert.equal(copy.checklist[0].done, false);
    assert.equal(copy.completedAt, null);
    assert.equal(copy.projectId, "p1");
    assert.doesNotThrow(() => validate(out));
});
test("duplicate task ignores unknown and deleted records", () => {
    assert.equal(duplicateTask(w, "missing"), w);
    assert.equal(duplicateTask({ ...w, tasks: [{ ...w.tasks[0], deletedAt: "2026-10-15T10:00:00Z" }] }, "t1").tasks.length, 1);
});
test("self-drops do not change task order", () => {
    assert.equal(moveTask(w, w.tasks, "t1", "t1", "after"), w);
});
test("large task collections avoid spread-argument stack limits", () => {
    const large = { ...w, tasks: Array.from({ length: 20000 }, (_, i) => ({ ...newTask("T" + i), id: "big" + i, order: i })) };
    const out = duplicateTask(large, "big0");
    assert.equal(out.tasks.length, 20001);
    assert.equal(out.tasks.at(-1)?.order, 20000);
});
