import { previewImport, type ImportPreview } from "./legacy-import";
import { blank, validate, type Workspace } from "./domain";
export interface Store {
    kind: string;
    load(): Promise<Workspace | null>;
    save(w: Workspace): Promise<void>;
}
export const native = () =>
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export class BrowserStore implements Store {
    kind = "Browser-local preview";
    private rev: string | null = null;
    async load() {
        this.rev = localStorage.getItem("still.workspace.v1");
        return this.rev ? validate(JSON.parse(this.rev)) : null;
    }
    async save(w: Workspace) {
        if (localStorage.getItem("still.workspace.v1") !== this.rev)
            throw Error(
                "Another tab changed this workspace. Reload before editing.",
            );
        const value = JSON.stringify(validate(w));
        localStorage.setItem("still.workspace.v1", value);
        this.rev = value;
    }
}
export async function createStore(): Promise<Store> {
    if (!native()) return new BrowserStore();
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    const db = await Database.load("sqlite:still.db");
    let revision = 0;
    return {
        kind: "SQLite · on this device",
        async load() {
            const rows = await db.select<
                { payload: string; revision: number }[]
            >("SELECT payload,revision FROM workspace WHERE id=1");
            if (!rows.length) return null;
            revision = rows[0].revision;
            return validate(JSON.parse(rows[0].payload));
        },
        async save(w) {
            const value = JSON.stringify(validate(w));
            const result = await db.execute(
                "INSERT INTO workspace(id,payload,revision) VALUES(1,$1,1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=workspace.revision+1 WHERE workspace.revision=$2",
                [value, revision],
            );
            if (result.rowsAffected !== 1)
                throw Error(
                    "Workspace changed in another window. Reload before editing.",
                );
            revision++;
        },
    };
}
export async function exportBackup(w: Workspace) {
    const text = JSON.stringify(validate(w), null, 2),
        name = `still-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (native()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({
            defaultPath: name,
            filters: [{ name: "Still backup", extensions: ["json"] }],
        });
        if (!path) return false;
        await writeTextFile(path, text);
        return true;
    }
    const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
}
export async function importBackup(): Promise<ImportPreview | null> {
    if (native()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const path = await open({
            multiple: false,
            filters: [{ name: "Still backup", extensions: ["json"] }],
        });
        if (!path) return null;
        return previewImport(JSON.parse(await readTextFile(path)));
    }
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.oncancel = () => resolve(null);
        input.onchange = async () => {
            try {
                const f = input.files?.[0];
                if (!f) return resolve(null);
                if (f.size > 20000000) throw Error("Backup exceeds 20 MB.");
                resolve(previewImport(JSON.parse(await f.text())));
            } catch (e) {
                reject(e);
            }
        };
        input.click();
    });
}
export const emptyWorkspace = blank;

/** Use the native dialog on packaged apps rather than WebView confirm behavior. */
export async function confirmReplacement(message: string): Promise<boolean> {
    if (!native()) return window.confirm(message);
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return confirm(message, {
        title: "Still — replace workspace?",
        kind: "warning",
    });
}
