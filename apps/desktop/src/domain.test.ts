import { test } from "node:test";
import assert from "node:assert/strict";
import {
    blank,
    seed,
    newTask,
    newProject,
    complete,
    matches,
    nextDate,
    validate,
    merge,
    parseQuick,
    validDate,
    addDays,
    moveTask,
} from "./domain";
import { BrowserStore } from "./storage";
test("seed validates and survives JSON round trip", () => {
    const w = seed("2026-10-15");
    assert.deepEqual(validate(JSON.parse(JSON.stringify(w))), w);
});
test("classifies schedule, deadline, someday, area, and inbox independently", () => {
    const w = seed("2026-10-15"),
        t = {
            ...newTask("Deadline only"),
            areaId: w.areas[0].id,
            deadline: "2026-10-15",
        };
    assert.equal(matches(w, t, "today", "2026-10-15"), false);
    assert.equal(matches(w, t, "anytime", "2026-10-15"), true);
    t.scheduled = "2026-10-14";
    assert.equal(matches(w, t, "today", "2026-10-15"), true);
    t.scheduled = "2026-10-16";
    assert.equal(matches(w, t, "upcoming", "2026-10-15"), true);
    t.someday = true;
    assert.equal(matches(w, t, "someday", "2026-10-15"), true);
    assert.equal(matches(w, t, "upcoming", "2026-10-15"), false);
    assert.equal(matches(w, newTask("Capture"), "inbox"), true);
    assert.equal(matches(w, t, `area:${w.areas[0].id}`), true);
});
test("monthly recurrence preserves anchor across short and leap months", () => {
    assert.equal(
        nextDate("2026-01-31", "monthly", 31, "2026-01-31"),
        "2026-02-28",
    );
    assert.equal(
        nextDate("2026-02-28", "monthly", 31, "2026-02-28"),
        "2026-03-31",
    );
    assert.equal(
        nextDate("2028-01-31", "monthly", 31, "2028-01-31"),
        "2028-02-29",
    );
});
test("missed daily and weekly repeats create only a future occurrence", () => {
    assert.equal(
        nextDate("2026-01-01", "daily", null, "2026-10-15"),
        "2026-10-16",
    );
    assert.equal(
        nextDate("2026-10-01", "weekly", null, "2026-10-15"),
        "2026-10-22",
    );
});
test("completing, reopening, recompleting never duplicates next occurrence", () => {
    let w = blank();
    const t = {
        ...newTask("Stretch"),
        repeat: "monthly" as const,
        repeatDay: 31,
        scheduled: "2026-01-31",
        deadline: "2026-02-01",
    };
    w.tasks = [t];
    w = complete(w, t.id, "2026-01-31");
    assert.equal(w.tasks.length, 2);
    assert.equal(w.tasks[1].scheduled, "2026-02-28");
    assert.equal(w.tasks[1].deadline, null);
    assert.ok(w.tasks[0].completedAt);
    w = complete(w, t.id, "2026-01-31");
    assert.equal(w.tasks[0].completedAt, null);
    w = complete(w, t.id, "2026-01-31");
    assert.equal(w.tasks.length, 2);
    validate(w);
});
test("undo snapshot restores completion and removes generated repeat", () => {
    const w = blank();
    w.tasks = [{ ...newTask("Daily"), repeat: "daily" }];
    const before = structuredClone(w);
    const after = complete(w, w.tasks[0].id, "2026-10-15");
    assert.equal(after.tasks.length, 2);
    assert.deepEqual(w, before);
    assert.equal(validate(before).tasks.length, 1);
});
test("deleted projects hide children; archived projects leave active lists", () => {
    const w = seed("2026-10-15"),
        t = w.tasks[0],
        p = w.projects[0];
    p.deletedAt = new Date().toISOString();
    assert.equal(matches(w, t, "today", "2026-10-15"), false);
    p.deletedAt = null;
    p.state = "archived";
    assert.equal(matches(w, t, "today", "2026-10-15"), false);
    p.state = "active";
    assert.equal(matches(w, t, "today", "2026-10-15"), true);
    t.deletedAt = new Date().toISOString();
    assert.equal(matches(w, t, "trash"), true);
});
test("quick capture is conservative and preserves unknown text", () => {
    assert.deepEqual(
        parseQuick("Write proposal tomorrow #business !high", "2026-10-15"),
        {
            title: "Write proposal",
            scheduled: "2026-10-16",
            priority: "high",
            tags: ["business"],
        },
    );
    assert.equal(
        parseQuick("Ask next Friday at 9am").title,
        "Ask next Friday at 9am",
    );
    assert.equal(parseQuick("Meet TodayCo #тест").title, "Meet TodayCo");
});
test("merge is idempotent, retains existing data and relationships", () => {
    const a = seed(),
        b = seed();
    const m = merge(a, b);
    assert.equal(m.tasks.length, a.tasks.length + b.tasks.length);
    assert.deepEqual(merge(m, b), m);
    b.tasks[0].title = "Incoming edit";
    assert.equal(
        merge(b, a).tasks.find((t) => t.id === b.tasks[0].id)?.title,
        "Incoming edit",
    );
});
test("invalid imports reject before mutation", () => {
    const a = seed(),
        before = structuredClone(a);
    for (const mutate of [
        (w: ReturnType<typeof seed>) => (w.version = 2 as 1),
        (w: ReturnType<typeof seed>) => (w.tasks[0].scheduled = "2026-02-30"),
        (w: ReturnType<typeof seed>) => (w.tasks[0].projectId = "missing"),
        (w: ReturnType<typeof seed>) => (w.tasks[0].order = NaN),
        (w: ReturnType<typeof seed>) => w.tasks.push(w.tasks[0]),
        (w: ReturnType<typeof seed>) => (w.tasks[0].nextId = "missing"),
    ]) {
        const b = structuredClone(a);
        mutate(b);
        assert.throws(() => validate(b));
    }
    assert.deepEqual(a, before);
    assert.throws(() => validate({ version: 99 }));
});
test("local date arithmetic does not shift dates with UTC offsets", () => {
    assert.ok(validDate("2028-02-29"));
    assert.ok(!validDate("2026-02-29"));
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("browser persistence survives restart, handles edits and detects concurrent writers", async () => {
    const data = new Map<string, string>();
    Object.assign(globalThis, {
        localStorage: {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => data.set(k, v),
        },
    });
    const s = new BrowserStore();
    assert.equal(await s.load(), null);
    const w = seed();
    await s.save(w);
    const reopened = new BrowserStore();
    assert.deepEqual(await reopened.load(), w);
    w.tasks[0].title = "Changed";
    w.tasks[0].order = 40;
    await reopened.save(w);
    const stale = new BrowserStore();
    await stale.load();
    w.tasks[0].deletedAt = new Date().toISOString();
    await reopened.save(w);
    await assert.rejects(() => stale.save(w), /Another tab/);
    const end = new BrowserStore();
    assert.deepEqual(await end.load(), w);
});
test("project creation and task movement preserve validation", () => {
    const w = seed(),
        p = { ...newProject("Finish something"), areaId: w.areas[1].id };
    w.projects.push(p);
    w.tasks[0].projectId = p.id;
    assert.doesNotThrow(() => validate(w));
    w.tasks[0].areaId = w.areas[0].id;
    assert.throws(() => validate(w));
});

test("search includes completed and archived work but excludes trash", () => {
    const w = seed();
    w.projects[0].state = "archived";
    w.tasks[0].completedAt = new Date().toISOString();
    assert.equal(
        matches(w, w.tasks[0], "search", "2026-10-15", "lawyer"),
        true,
    );
    w.tasks[0].deletedAt = new Date().toISOString();
    assert.equal(
        matches(w, w.tasks[0], "search", "2026-10-15", "lawyer"),
        false,
    );
});

test("storage failure rejects without claiming a saved workspace", async () => {
    const data = new Map<string, string>();
    let fail = false;
    Object.assign(globalThis, {
        localStorage: {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => {
                if (fail) throw Error("Disk full");
                data.set(k, v);
            },
        },
    });
    const s = new BrowserStore();
    await s.load();
    const before = seed();
    await s.save(before);
    const after = structuredClone(before);
    after.tasks[0].title = "Not saved";
    fail = true;
    await assert.rejects(() => s.save(after), /Disk full/);
    assert.deepEqual(await new BrowserStore().load(), before);
});

test("sections survive round trips, including empty sections and older backups", () => {
    const w = blank();
    const p = newProject("Book");
    w.projects = [p];
    p.sections = ["Outline", "Draft", "Review"];
    assert.deepEqual(validate(JSON.parse(JSON.stringify(w))).projects[0].sections, p.sections);
    delete p.sections;
    assert.equal(validate(w).projects[0].sections, undefined);
    p.sections = ["Outline", "Outline"];
    assert.throws(() => validate(w));
    p.sections = ["   "];
    assert.throws(() => validate(w));
});
test("drag ordering updates task section without losing unrelated tasks", () => {
    const w = blank(), p = newProject("Book");
    p.sections = ["Draft", "Review"];
    w.projects = [p];
    const a = { ...newTask("First"), projectId: p.id, heading: "Draft", order: 1 };
    const b = { ...newTask("Second"), projectId: p.id, heading: "Review", order: 2 };
    const unrelated = { ...newTask("Elsewhere"), order: 3 };
    w.tasks = [a, b, unrelated];
    const moved = moveTask(w, [a, b], a.id, b.id, "after", "Review");
    assert.equal(moved.tasks[0].heading, "Review");
    assert.ok(moved.tasks[0].order > moved.tasks[1].order);
    assert.equal(moved.tasks[2].title, "Elsewhere");
    assert.equal(w.tasks[0].heading, "Draft", "Original workspace remains immutable");
    assert.deepEqual(validate(moved), moved);
    assert.equal(moveTask(w, [a, b], a.id, "unknown", "after"), w);
});
