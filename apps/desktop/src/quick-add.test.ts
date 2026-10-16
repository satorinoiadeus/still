import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSmartEntry } from "./quick-add";
const w = { projects: [{ id:"p1", title:"Launch", areaId:"a1", deletedAt:null }], areas:[{ id:"a1", title:"Work", order:0 }] };
test("quick capture recognizes date, label, priority and project", () => {
    const x = parseSmartEntry("Ship homepage tomorrow @design #Launch p1", w as never, "2026-10-16");
    assert.equal(x.title, "Ship homepage");
    assert.equal(x.scheduled, "2026-10-17");
    assert.equal(x.priority, "high");
    assert.deepEqual(x.tags, ["design"]);
    assert.equal(x.projectId, "p1");
    assert.equal(x.areaId, "a1");
});
test("unmatched hashtags remain labels for old shorthand", () => {
    const x = parseSmartEntry("Email customer #sales !low", w as never, "2026-10-16");
    assert.equal(x.title, "Email customer");
    assert.deepEqual(x.tags, ["sales"]);
    assert.equal(x.priority, "low");
});
test("relative dates use local calendar days", () => {
    assert.equal(parseSmartEntry("Walk in 3 days", w as never, "2026-10-16").scheduled, "2026-10-19");
    assert.equal(parseSmartEntry("Plan weekend", w as never, "2026-10-16").scheduled, "2026-10-17");
    assert.equal(parseSmartEntry("Call on Monday", w as never, "2026-10-16").scheduled, "2026-10-19");
});
test("ordinary task titles are not eaten", () => {
    assert.equal(parseSmartEntry("Review Monday's notes", w as never, "2026-10-16").title, "Review Monday's notes");
});
