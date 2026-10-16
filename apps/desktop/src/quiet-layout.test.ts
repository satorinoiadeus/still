import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { blank, newProject, newTask, type Workspace } from "./domain";
import {
    FILTERS, SORTS, DEFAULT_CONTROLS, applyTaskControls, parseTaskControls,
    type FilterKind, type SortMode,
} from "./task-controls";

const today = "2026-10-16";
const w: Workspace = blank();
w.areas = [
    { id: "area1", title: "Creative", order: 0 },
    { id: "area2", title: "Work", order: 1 },
];
w.projects = [
    { ...newProject("Illustrate"), id: "project1", areaId: "area1" },
    { ...newProject("Launch"), id: "project2", areaId: "area2" },
];
const task = (n: number) => ({
    ...newTask("Task " + n),
    id: "t" + n,
    order: n,
    notes: n % 3 === 0 ? "Write a thoughtful note " + n : "",
    tags: n % 4 === 0 ? ["creative", "important"] : n % 4 === 1 ? ["work"] : [],
    priority: (["none", "high", "low"] as const)[n % 3],
    scheduled: n % 4 === 0 ? "2026-10-17" : n % 4 === 1 ? "2026-10-15" : null,
    deadline: n % 7 === 0 ? "2026-10-18" : null,
    projectId: n % 4 === 0 ? "project1" : n % 4 === 1 ? "project2" : null,
    areaId: n % 4 === 2 ? "area1" : null,
    heading: n % 4 === 0 ? "Next" : "",
    repeat: n % 6 === 0 ? "daily" as const : "none" as const,
    someday: n % 11 === 0,
    completedAt: n % 13 === 0 ? "2026-10-15T10:00:00Z" : null,
    checklist: n % 5 === 0 ? [{ id: "c" + n, title: "Step", done: n % 2 === 0 }] : [],
});
const source = Array.from({ length: 120 }, (_, i) => task(i));
const fingerprint = JSON.stringify(source);

test("858 deterministic filter/sort/reverse combinations are lossless, stable and immutable", () => {
    let cases = 0;
    for (const [filter] of FILTERS) for (const [sort] of SORTS) for (const reverse of [false, true]) {
        const controls = { ...DEFAULT_CONTROLS, filter: filter as FilterKind, sort: sort as SortMode, reverse };
        const first = applyTaskControls(w, source, controls, today);
        const second = applyTaskControls(w, source, controls, today);
        assert.deepEqual(first.map((t) => t.id), second.map((t) => t.id), "Determinism: " + JSON.stringify(controls));
        assert.equal(new Set(first.map((t) => t.id)).size, first.length, "No duplicate tasks");
        assert.ok(first.every((t) => source.some((s) => s.id === t.id)), "No invented tasks");
        assert.deepEqual(parseTaskControls(controls), controls, "Controls roundtrip");
        cases++;
    }
    assert.equal(cases, 858);
    assert.equal(JSON.stringify(source), fingerprint, "Selectors must never mutate workspace data");
});
test("additional 858 label, priority, project, area, search combinations are deterministic", () => {
    let cases = 0;
    for (const [filter] of FILTERS) for (const [sort] of SORTS) for (const reverse of [false, true]) {
        const controls = {
            ...DEFAULT_CONTROLS, filter: filter as FilterKind, sort: sort as SortMode, reverse,
            label: cases % 3 === 0 ? "creative" : "",
            priority: (["all", "high", "none", "low"] as const)[cases % 4],
            project: cases % 5 === 0 ? "project1" : "",
            area: cases % 7 === 0 ? "area1" : "",
            search: cases % 9 === 0 ? "task" : "",
        };
        const actual = applyTaskControls(w, source, controls, today);
        const repeat = applyTaskControls(w, source, controls, today);
        assert.deepEqual(actual.map((t) => t.id), repeat.map((t) => t.id));
        if (controls.label) assert.ok(actual.every((t) => t.tags.includes(controls.label)));
        if (controls.priority !== "all") assert.ok(actual.every((t) => t.priority === controls.priority));
        if (controls.project) assert.ok(actual.every((t) => t.projectId === controls.project));
        cases++;
    }
    assert.equal(cases, 858);
    assert.equal(JSON.stringify(source), fingerprint);
});
test("the existing light and dark Still palettes remain unchanged on Android and Windows", () => {
    const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
    const light = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
    const dark = css.match(/html\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? "";
    for (const [name, expected] of [
        ["--bg", "#f9faf7"], ["--side", "#f1f4ef"], ["--surface", "#ffffff"],
        ["--text", "#26362d"], ["--muted", "#617066"], ["--accent", "#356a50"],
        ["--tint", "#dfece2"], ["--tint-soft", "#edf5ee"],
    ]) assert.ok(light.includes(name + ": " + expected), "Light palette drift: " + name);
    for (const [name, expected] of [
        ["--bg", "#171f1b"], ["--side", "#1b2520"], ["--surface", "#253029"],
        ["--text", "#edf3eb"], ["--accent", "#9bceaa"], ["--tint", "#324b3b"],
    ]) assert.ok(dark.includes(name + ": " + expected), "Dark palette drift: " + name);
    assert.ok(css.includes("env(safe-area-inset-bottom"), "Android gesture bar spacing");
    assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "Respect reduced motion");
    assert.ok(css.includes(".project-cards.as-list"), "Compact project overview");
    assert.ok(css.includes(".project-cards.as-cards"), "Optional card overview");
    assert.ok(css.includes(".area-line .area-expand"), "Disclosure controls");
});
