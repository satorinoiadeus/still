import { dayKeyOf } from "@still/core/legacy-selectors";
import {
    blank,
    newProject,
    newTask,
    validate,
    validDate,
    type Workspace,
} from "./domain";

type Row = Record<string, unknown>;
export interface ImportPreview {
    workspace: Workspace;
    warnings: string[];
    source: "still" | "legacy";
}
const row = (v: unknown): Row => {
    if (!v || typeof v !== "object" || Array.isArray(v))
        throw Error("Invalid backup record. No data was changed.");
    return v as Row;
};
const text = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;
const stamp = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null;
const order = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Copy supported fields into a NEW workspace; never mutate the source or its database. */
export function previewImport(raw: unknown): ImportPreview {
    const root = row(raw);
    if (root.version === 1 && typeof root.sample === "boolean") {
        return { workspace: validate(raw), warnings: [], source: "still" };
    }
    if ("sample" in root)
        throw Error("Unsupported Still backup version. No data was changed.");
    const source = root.data ? row(root.data) : root;
    if (
        !Array.isArray(source.tasks) ||
        !Array.isArray(source.projects) ||
        !Array.isArray(source.areas)
    )
        throw Error(
            "Choose a Still backup or a legacy JSON export with tasks, projects and areas.",
        );
    if (
        source.tasks.length > 50000 ||
        source.projects.length > 10000 ||
        source.areas.length > 5000
    )
        throw Error("Backup exceeds supported workspace size.");
    const w = blank(),
        warnings = new Set<string>();
    warnings.add(
        "This copies supported fields. Keep your original export: attachments, settings, people, integrations and advanced rules stay only in that original file.",
    );
    const date = (v: unknown) => {
        if (!v) return null;
        const d = dayKeyOf(text(v));
        if (!d || !validDate(d))
            throw Error("A legacy date is invalid. No data was changed.");
        if (text(v).length > 10)
            warnings.add(
                "Timed schedules become dates in this device’s local timezone. Still does not schedule times or notifications.",
            );
        return d;
    };
    const identity = (r: Row) => {
        if (!text(r.id) || !text(r.title, text(r.name)).trim())
            throw Error("A legacy record is missing its ID or title.");
        return text(r.id);
    };
    for (const [i, value] of source.areas.entries()) {
        const a = row(value);
        w.areas.push({
            id: identity(a),
            title: text(a.name, text(a.title)),
            order: order(a.order ?? a.orderNum, i),
        });
        if (a.deletedAt)
            warnings.add(
                "Deleted areas are retained as ordinary areas so their tasks keep their relationships.",
            );
    }
    for (const [i, value] of source.projects.entries()) {
        const p = row(value);
        w.projects.push({
            ...newProject(text(p.title)),
            id: identity(p),
            notes: text(p.supportNotes, text(p.notes)),
            areaId: text(p.areaId) || null,
            deadline: date(p.dueDate),
            state: p.status === "archived" ? "archived" : "active",
            deletedAt: stamp(p.deletedAt),
            order: order(p.order ?? p.orderNum, i),
        });
    }
    const sections = Array.isArray(source.sections)
        ? source.sections.map(row)
        : [];
    const projects = new Map(
        source.projects.map((v) => {
            const p = row(v);
            return [text(p.id), p];
        }),
    );
    for (const [i, value] of source.tasks.entries()) {
        const t = row(value),
            p = projects.get(text(t.projectId));
        const recurrence =
            typeof t.recurrence === "object" && t.recurrence
                ? row(t.recurrence)
                : null;
        const rule =
            typeof t.recurrence === "string"
                ? t.recurrence
                : text(recurrence?.rule);
        const simple =
            ["daily", "weekly", "monthly"].includes(rule) &&
            (!recurrence ||
                Object.keys(recurrence).every((k) =>
                    ["rule", "anchorDay", "seriesId", "strategy"].includes(k),
                )) &&
            (!recurrence?.strategy || recurrence.strategy === "strict");
        const notes = [text(t.description, text(t.notes))];
        if (
            t.status === "waiting" ||
            t.status === "reference" ||
            t.cancelledAt
        ) {
            notes.push(
                `Imported status: ${t.cancelledAt ? "cancelled" : t.status}.`,
            );
            warnings.add(
                "Waiting and reference tasks become ordinary tasks; cancellation history becomes Logbook work. Original status is recorded in notes.",
            );
        }
        if (rule && !simple) {
            notes.push(
                "Original repeat rule (not active in Still): " +
                    JSON.stringify(t.recurrence),
            );
            warnings.add(
                "Unsupported repeat rules are paused and recorded in task notes; review them before using Still.",
            );
        }
        const closed = ["done", "archived"].includes(text(t.status));
        const checklist = Array.isArray(t.checklist)
            ? t.checklist.map((v, j) => {
                  const c = row(v);
                  return {
                      id: text(c.id, `${text(t.id)}-check-${j}`),
                      title: text(c.title),
                      done: c.isCompleted === true || c.done === true,
                  };
              })
            : [];
        w.tasks.push({
            ...newTask(text(t.title)),
            id: identity(t),
            notes: notes.filter(Boolean).join("\n\n"),
            projectId: text(t.projectId) || null,
            areaId: t.projectId ? null : text(t.areaId) || null,
            heading: text(sections.find((s) => s.id === t.sectionId)?.title),
            tags: Array.isArray(t.tags)
                ? t.tags.map((v) => {
                      if (typeof v !== "string")
                          throw Error("Invalid legacy tag.");
                      return v;
                  })
                : [],
            scheduled: date(t.startTime),
            deadline: date(t.dueDate),
            someday: t.status === "someday" || p?.status === "someday",
            priority: ["high", "urgent"].includes(text(t.priority))
                ? "high"
                : t.priority === "low"
                  ? "low"
                  : "none",
            repeat:
                simple && !closed
                    ? (rule as "daily" | "weekly" | "monthly")
                    : "none",
            repeatDay:
                rule === "monthly" && simple
                    ? Number(recurrence?.anchorDay) ||
                      Number(
                          (date(t.startTime) ?? date(t.dueDate))?.slice(-2),
                      ) ||
                      null
                    : null,
            checklist,
            completedAt: closed
                ? (stamp(t.completedAt) ??
                  stamp(t.updatedAt) ??
                  stamp(t.createdAt) ??
                  "1970-01-01T00:00:00.000Z")
                : null,
            deletedAt: stamp(t.deletedAt ?? t.purgedAt),
            order: order(t.order ?? t.orderNum, i),
        });
    }
    return {
        workspace: validate(w),
        warnings: [...warnings],
        source: "legacy",
    };
}
