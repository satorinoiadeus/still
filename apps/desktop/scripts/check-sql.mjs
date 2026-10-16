import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "still-sql-"));
try {
    const path = join(dir, "still.db");
    let db = new DatabaseSync(path);
    const rust = readFileSync("src-tauri/src/lib.rs", "utf8");
    const sql = rust.match(/sql: "([^"]*)"/)[1];
    db.exec(sql);
    db.prepare("INSERT INTO workspace VALUES(1,?,1)").run('{"version":1}');
    assert.throws(() =>
        db.prepare("UPDATE workspace SET payload=?").run("not JSON"),
    );
    assert.throws(() =>
        db.prepare("INSERT INTO workspace VALUES(2,?,1)").run("{}"),
    );
    assert.throws(() => db.prepare("UPDATE workspace SET revision=0").run());
    db.close();
    db = new DatabaseSync(path);
    assert.equal(
        db.prepare("SELECT revision FROM workspace").get().revision,
        1,
    );
    assert.equal(
        db
            .prepare(
                "UPDATE workspace SET payload=?, revision=revision+1 WHERE revision=?",
            )
            .run('{"saved":true}', 1).changes,
        1,
    );
    assert.equal(
        db
            .prepare(
                "UPDATE workspace SET payload=?, revision=revision+1 WHERE revision=?",
            )
            .run('{"stale":true}', 1).changes,
        0,
    );
    assert.equal(
        db.prepare("SELECT payload FROM workspace").get().payload,
        '{"saved":true}',
    );
    db.close();
    console.log(
        "Actual SQLite schema passed: JSON, singleton and revision constraints; persistence on reopen; stale revision rejection. Native plugin runtime not tested.",
    );
} finally {
    rmSync(dir, { recursive: true, force: true });
}
