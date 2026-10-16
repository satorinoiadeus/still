import { Window } from "happy-dom";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const html = await readFile("Still.html", "utf8");
const w = new Window({ url: "http://localhost:5173" });
w.document.write(
    '<!doctype html><html><body><div id="root"></div></body></html>',
);
w.structuredClone = structuredClone;
w.eval(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const pause = () => new Promise((r) => setTimeout(r, 200));
const waitFor = async (predicate, label, timeoutMs = 6000) => {
    const deadline = Date.now() + timeoutMs;
    while (!predicate() && Date.now() < deadline) await pause();
    assert.ok(predicate(), `Timed out waiting for ${label}`);
};
const button = (text) =>
    [...w.document.querySelectorAll("button")].find((b) =>
        b.textContent.includes(text),
    );
const click = async (text) => {
    const deadline = Date.now() + 8000;
    while ((!button(text) || button(text).disabled) && Date.now() < deadline)
        await pause();
    const b = button(text);
    assert.ok(b, `Button ${text}`);
    assert.equal(b.disabled, false, `Enabled ${text}`);
    b.click();
    await pause();
};
const fill = (el, value) => {
    assert.ok(el);
    const setter = Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype,
        "value",
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new w.Event("input", { bubbles: true }));
};
await pause();
await click("Explore a sample workspace");

assert.match(w.document.body.textContent, /Ask one lawyer/);
await click("New task");
let dialog = w.document.querySelector("[role=dialog]");
assert.ok(dialog);
fill(dialog.querySelector('textarea[aria-label="Quick add task name"]'), "Write proposal tomorrow #business !high");
await pause();
await click("Add task ↗");
assert.ok(!w.document.querySelector("[role=dialog]"));
await click("Upcoming");
assert.match(w.document.body.textContent, /Write proposal/);
const saved = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
const added = saved.tasks.find((t) => t.title === "Write proposal");
assert.ok(added);
assert.deepEqual(added.tags, ["business"]);
assert.equal(added.priority, "high");
const edit = w.document.querySelector('[aria-label="Edit Write proposal"]');
edit.click();
await pause();
await click("Move to Trash");
await click("Trash");
assert.match(w.document.body.textContent, /Write proposal/);
await click("Restore");
assert.ok(!w.document.querySelector('[aria-label="Edit Write proposal"]'));
await click("Upcoming");
assert.match(w.document.body.textContent, /Write proposal/);
await click("Today");
const complete = w.document.querySelector(
    '[aria-label="Complete Take ten quiet minutes to stretch"]',
);
complete.click();
await pause();
let state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
assert.equal(
    state.tasks.filter((t) => t.title === "Take ten quiet minutes to stretch")
        .length,
    2,
);
await click("Undo");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
assert.equal(
    state.tasks.filter((t) => t.title === "Take ten quiet minutes to stretch")
        .length,
    1,
);
await click("New project");
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector("input"), "Finish a small test");
await pause();
await click("Save project");
assert.match(w.document.body.textContent, /Finish a small test/);
await click("Settings & backups");
dialog = w.document.querySelector("[role=dialog]");
const select = dialog.querySelector("select");
select.value = "dark";
select.dispatchEvent(new w.Event("change", { bubbles: true }));
await pause();
assert.equal(w.document.documentElement.dataset.theme, "dark");
w.document.querySelector('[aria-label="Close dialog"]').click();
await pause();
// Exercise the same visible creation controls used on a narrow mobile screen.
w.innerWidth = 390;
w.innerHeight = 844;
w.document.querySelector('[aria-label="Open navigation"]').click();
await pause();
assert.ok(w.document.querySelector("aside.open"));
const areaButton = w.document.querySelector('[aria-label="Add area"]');
assert.ok(areaButton, "Browse drawer provides area creation");
areaButton.click();
await pause();
assert.ok(
    !w.document.querySelector("aside.open"),
    "Drawer closes before creating an area",
);
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector("input"), "Mobile life");
await pause();
await click("Save area");
await waitFor(() => w.document.querySelector("main h1")?.textContent === "Mobile life", "area navigation");
await click("New project");
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector("input"), "Mobile project");
await pause();
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
const mobileArea = state.areas.find((a) => a.title === "Mobile life");
assert.equal(
    dialog.querySelector("select").value,
    mobileArea.id,
    "Project inherits current area",
);
await click("Save project");
await waitFor(() => w.document.querySelector("main h1")?.textContent === "Mobile project", "project navigation");
// The Area overview is quiet by default; old giant cards remain an opt-in choice.
w.document.querySelector(".area-link").click();
await waitFor(() => w.document.querySelector("main h1")?.textContent === "Mobile life", "area overview");
assert.ok(w.document.querySelector(".project-cards.as-list"), "Compact project list is the default");
assert.equal(w.document.querySelector(".project-cards.as-cards"), null);
assert.equal(w.document.querySelectorAll(".project-card").length, 1);
assert.equal(w.document.querySelector(".project-outcome"), null, "No repeated placeholder outcome");
assert.equal(w.document.querySelector(".project-progress-line"), null, "No 0/0 progress bar");
assert.equal(w.document.querySelector(".project-link"), null, "Sidebar project links start collapsed");
assert.equal(w.document.querySelector('[aria-label="Expand projects in Mobile life"]')?.getAttribute("aria-expanded"), "false");
w.document.querySelector('[aria-label="Expand projects in Mobile life"]').click();
await pause();
assert.ok(w.document.querySelector(".project-link"), "Area project navigation can expand");
w.document.querySelector('[aria-label="Collapse projects in Mobile life"]').click();
await pause();
assert.equal(w.document.querySelector(".project-link"), null, "Area project navigation can collapse");
w.document.querySelector('[aria-label="Project cards"]').click();
await pause();
assert.ok(w.document.querySelector(".project-cards.as-cards"), "Optional cards work");
assert.equal(w.localStorage.getItem("still.project-display.v1"), "cards");
w.document.querySelector('[aria-label="Compact project list"]').click();
await pause();
assert.ok(w.document.querySelector(".project-cards.as-list"), "Compact list can be restored");
w.document.querySelector(".project-title").click();
await waitFor(() => w.document.querySelector("main h1")?.textContent === "Mobile project", "project navigation restored");
await click("Add section");
let sectionInput = w.document.querySelector('input[aria-label="Section name"]');
assert.ok(sectionInput, "Inline section editor opens");
fill(sectionInput, "First steps");
await click("Add section");
await waitFor(() => w.document.querySelector('[data-drop-section="First steps"]'), "section creation");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
assert.deepEqual(state.projects.find((p) => p.title === "Mobile project").sections, ["First steps"]);
const sectionTaskButton = w.document.querySelector('[aria-label="Add task to First steps"]');
assert.ok(sectionTaskButton);
sectionTaskButton.click();
await pause();
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector('textarea[aria-label="Quick add task name"]'), "First section action");
await pause();
await click("Add task ↗");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
assert.equal(state.tasks.find((t) => t.title === "First section action").heading, "First steps");
await click("New task");
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector('textarea[aria-label="Quick add task name"]'), "My mobile action");
await pause();
await click("Add task ↗");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
const mobileProject = state.projects.find((p) => p.title === "Mobile project");
assert.equal(mobileProject.areaId, mobileArea.id);
assert.equal(
    state.tasks.find((t) => t.title === "My mobile action").projectId,
    mobileProject.id,
);
assert.match(w.document.querySelector("main").textContent, /My mobile action/);
// New controls live in a collapsible corner rather than taking up screen space.
assert.equal(w.document.querySelector('[aria-label="Sort tasks"]'), null, "Filters start collapsed");
await click("Filter & sort");
assert.ok(w.document.querySelector('[aria-label="Sort tasks"]'));
assert.ok(w.document.querySelector('[aria-label="Filter by priority"]'));
assert.ok(w.document.querySelector('[aria-label="Filter tasks"]'));
assert.ok(w.document.querySelector('[aria-label="Project layout"]'));
assert.ok(w.document.querySelector('[aria-label="Delete section First steps"]'));
assert.ok(w.document.querySelector('[aria-label="Drag section First steps"]'));
assert.ok(w.document.querySelector('[aria-label="Drag area Mobile life"]'));
await click("Board");
assert.ok(w.document.querySelector(".task-board"), "Board layout is available");
assert.ok(w.document.querySelector(".board-task-card .drag-handle"), "Board tasks can be dragged");
await click("List");
assert.ok(!w.document.querySelector(".task-board"), "List layout can be restored");
const priority = w.document.querySelector('[aria-label="Filter by priority"]');
priority.value = "high";
priority.dispatchEvent(new w.Event("change", { bubbles: true }));
await pause();
assert.equal(w.document.querySelectorAll(".task-row").length, 0, "Priority filtering updates visible tasks");
await click("Reset filters");
await pause();
assert.ok(w.document.querySelectorAll(".task-row").length >= 2, "Reset restores visible tasks");
await click("Done");
assert.equal(w.document.querySelector('[aria-label="Sort tasks"]'), null, "Panel collapses again");
console.log(
    "UI smoke passed: onboarding, capture, Trash, restore, recurrence, Undo, theme; mobile drawer, area → project → task creation and saved relationships.",
);
await w.happyDOM.close();
