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
        w.HTMLInputElement.prototype,
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
fill(dialog.querySelector("input"), "Write proposal tomorrow #business !high");
await pause();
await click("Parse into fields");
dialog = w.document.querySelector("[role=dialog]");
const inputs = dialog.querySelectorAll("input");
assert.equal(inputs[1].value, "Write proposal");
await click("Save task");
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
await click("×");
// Exercise the same visible creation controls used on a narrow mobile screen.
w.innerWidth = 390;
w.innerHeight = 844;
w.document.querySelector('[aria-label="Open navigation"]').click();
await pause();
assert.ok(w.document.querySelector("aside.open"));
await click("New area");
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
fill(dialog.querySelector("input[required]"), "First section action");
await pause();
await click("Save task");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
assert.equal(state.tasks.find((t) => t.title === "First section action").heading, "First steps");
await click("New task");
dialog = w.document.querySelector("[role=dialog]");
fill(dialog.querySelector("input[required]"), "My mobile action");
await pause();
await click("Save task");
state = JSON.parse(w.localStorage.getItem("still.workspace.v1"));
const mobileProject = state.projects.find((p) => p.title === "Mobile project");
assert.equal(mobileProject.areaId, mobileArea.id);
assert.equal(
    state.tasks.find((t) => t.title === "My mobile action").projectId,
    mobileProject.id,
);
assert.match(w.document.querySelector("main").textContent, /My mobile action/);
console.log(
    "UI smoke passed: onboarding, capture, Trash, restore, recurrence, Undo, theme; mobile drawer, area → project → task creation and saved relationships.",
);
await w.happyDOM.close();
