import { newTask, newProject, uid, type Workspace } from "./domain";

const columns = ["TYPE","CONTENT","DESCRIPTION","PRIORITY","INDENT","AUTHOR","RESPONSIBLE","DATE","DATE_LANG","TIMEZONE","DURATION","DURATION_UNIT"];
function csvCell(value: unknown): string {
    const s = String(value ?? "");
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function exportTodoistCsv(w: Workspace): string {
    const rows: string[][] = [columns];
    for (const p of w.projects.filter(p => !p.deletedAt)) {
        rows.push(["section", p.title, p.notes, "1", "1", "", "", "", "", "", "", ""]);
        for (const t of w.tasks.filter(t => t.projectId === p.id && !t.deletedAt)) {
            rows.push(["task", t.title, t.notes, t.priority === "high" ? "4" : "1", "1", "", "", t.scheduled ?? "", "en", "", "", ""]);
        }
    }
    rows.push(["section", "Inbox", "", "1", "1", "", "", "", "", "", "", ""]);
    for (const t of w.tasks.filter(t => !t.projectId && !t.deletedAt)) {
        rows.push(["task", t.title, t.notes, t.priority === "high" ? "4" : "1", "1", "", "", t.scheduled ?? "", "en", "", "", ""]);
    }
    return "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], cell = "", quoted = false;
    text = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell); if (row.some(Boolean)) rows.push(row);
            row = []; cell = "";
        } else cell += c;
    }
    if (quoted) throw Error("Unclosed CSV quote");
    row.push(cell); if (row.some(Boolean)) rows.push(row);
    return rows;
}
export function importTodoistCsv(w: Workspace, text: string): { workspace: Workspace; count: number } {
    if (text.length > 10_000_000) throw Error("CSV exceeds 10 MB");
    const rows = parseCsv(text);
    const header = rows.shift()?.map(x => x.trim().toUpperCase()) ?? [];
    const at = (row: string[], key: string) => row[header.indexOf(key)] ?? "";
    if (!header.includes("TYPE") || !header.includes("CONTENT")) throw Error("Not a Todoist CSV: TYPE and CONTENT columns required");
    const next: Workspace = { ...w, projects: [...w.projects], tasks: [...w.tasks] };
    let projectId: string | null = null, count = 0;
    for (const row of rows) {
        const kind = at(row, "TYPE").toLowerCase(), title = at(row, "CONTENT").trim();
        if (!title) continue;
        if (kind === "section") {
            if (title.toLowerCase() === "inbox") { projectId = null; continue; }
            const p = newProject(title); p.id = uid(); p.notes = at(row, "DESCRIPTION");
            next.projects.push(p); projectId = p.id;
        } else if (kind === "task") {
            const t = newTask(title); t.projectId = projectId; t.notes = at(row, "DESCRIPTION");
            t.priority = at(row, "PRIORITY") === "4" ? "high" : "none";
            const date = at(row, "DATE").trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) t.scheduled = date;
            next.tasks.push(t); count++;
        }
    }
    if (!count) throw Error("No supported Todoist tasks found");
    return { workspace: next, count };
}
