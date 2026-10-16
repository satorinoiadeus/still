import { test } from "node:test";
import assert from "node:assert/strict";
import { previewImport } from "./legacy-import";
import { blank, merge, validate } from "./domain";
const fixture = () => ({
    areas: [{ id: "a", name: "Personal", order: 0 }],
    projects: [
        {
            id: "p",
            title: "Move home",
            status: "active",
            areaId: "a",
            supportNotes: "Keep this note",
        },
    ],
    sections: [{ id: "s", projectId: "p", title: "Packing" }],
    tasks: [
        {
            id: "t",
            title: "Pack books",
            status: "next",
            projectId: "p",
            sectionId: "s",
            startTime: "2026-10-16",
            dueDate: "2026-10-20",
            recurrence: { rule: "monthly", anchorDay: 16 },
            tags: ["home"],
            checklist: [{ id: "c", title: "Find boxes", isCompleted: true }],
        },
    ],
});
test("legacy import preserves relationships, dates, checklist IDs and supported recurrence without source mutation", () => {
    const original = fixture(),
        before = structuredClone(original),
        p = previewImport(original);
    assert.deepEqual(original, before);
    assert.equal(p.source, "legacy");
    assert.equal(p.workspace.tasks[0].projectId, "p");
    assert.equal(p.workspace.tasks[0].heading, "Packing");
    assert.equal(p.workspace.tasks[0].repeat, "monthly");
    assert.deepEqual(p.workspace.tasks[0].checklist, [
        { id: "c", title: "Find boxes", done: true },
    ]);
    assert.equal(p.workspace.projects[0].notes, "Keep this note");
    assert.deepEqual(merge(p.workspace, p.workspace), p.workspace);
    validate(p.workspace);
});
test("advanced repeats pause visibly instead of becoming a different active repeat", () => {
    const f = fixture();
    Object.assign(f.tasks[0].recurrence, { byDay: ["MO", "WE"] });
    const p = previewImport(f);
    assert.equal(p.workspace.tasks[0].repeat, "none");
    assert.match(p.workspace.tasks[0].notes, /Original repeat rule/);
    assert.ok(p.warnings.some((x) => x.includes("paused")));
});
test("legacy lifecycle states retain historical work and someday projects", () => {
    const f = fixture();
    f.projects[0].status = "someday";
    f.tasks[0].status = "archived";
    Object.assign(f.tasks[0], {
        completedAt: "2026-10-01T12:00:00Z",
        deletedAt: "2026-10-02T12:00:00Z",
    });
    const t = previewImport(f).workspace.tasks[0];
    assert.equal(t.completedAt, "2026-10-01T12:00:00Z");
    assert.equal(t.deletedAt, "2026-10-02T12:00:00Z");
    assert.equal(t.someday, true);
    assert.equal(t.repeat, "none");
});
test("invalid legacy references, dates, duplicate IDs, malformed records reject entirely", () => {
    for (const modify of [
        (f: ReturnType<typeof fixture>) => {
            f.tasks[0].projectId = "missing";
        },
        (f: ReturnType<typeof fixture>) => {
            f.tasks[0].startTime = "2026-02-30";
        },
        (f: ReturnType<typeof fixture>) => {
            f.tasks[0].id = "p";
        },
        (f: ReturnType<typeof fixture>) => {
            f.tasks.push(null as never);
        },
    ]) {
        const f = fixture();
        modify(f);
        assert.throws(() => previewImport(f));
    }
    assert.throws(() => previewImport({ tasks: [] }));
    assert.throws(() =>
        previewImport({
            version: 2,
            sample: false,
            tasks: [],
            projects: [],
            areas: [],
        }),
    );
});
test("Still backup roundtrip remains lossless and original selectors convert timestamps locally", () => {
    const w = blank();
    assert.deepEqual(previewImport(w), {
        workspace: w,
        warnings: [],
        source: "still",
    });
    const f = fixture();
    f.tasks[0].startTime = new Date(2026, 9, 16, 23).toISOString();
    const p = previewImport({ data: f });
    assert.equal(p.workspace.tasks[0].scheduled, "2026-10-16");
    assert.ok(p.warnings.some((x) => x.includes("timezone")));
});
