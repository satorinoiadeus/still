import test from "node:test";
import assert from "node:assert/strict";
import { blank, newProject, newTask } from "./domain";
import { exportTodoistCsv, importTodoistCsv, parseCsv } from "./todoist-csv";

test("CSV parser supports quoted commas, escaped quotes, and newlines", () => {
    assert.deepEqual(parseCsv('TYPE,CONTENT\r\ntask,"a, ""quoted""\nname"\r\n'), [
        ["TYPE", "CONTENT"], ["task", 'a, "quoted"\nname'],
    ]);
});
test("Todoist export and import preserve titles, notes, project grouping and dates", () => {
    const workspace = blank();
    const project = newProject("Work, life");
    const task = newTask('Call "Jane"');
    task.projectId = project.id;
    task.notes = "Discuss\nplans";
    task.scheduled = "2026-10-18";
    task.priority = "high";
    workspace.projects.push(project);
    workspace.tasks.push(task);
    const csv = exportTodoistCsv(workspace);
    const imported = importTodoistCsv(blank(), csv);
    assert.equal(imported.count, 1);
    assert.equal(imported.workspace.projects[0].title, project.title);
    assert.equal(imported.workspace.tasks[0].title, task.title);
    assert.equal(imported.workspace.tasks[0].notes, task.notes);
    assert.equal(imported.workspace.tasks[0].scheduled, task.scheduled);
    assert.equal(imported.workspace.tasks[0].priority, "high");
    assert.equal(imported.workspace.tasks[0].projectId, imported.workspace.projects[0].id);
});
test("invalid Todoist headers are rejected without altering the workspace", () => {
    const workspace = blank();
    assert.throws(() => importTodoistCsv(workspace, "foo,bar\na,b"), /Not a Todoist CSV/);
    assert.equal(workspace.tasks.length, 0);
});
