import { newTask, uid, type Task, type Project, type Workspace } from "./domain";

/** Preserve the v1 backup schema while cleaning new/edited records before persistence. */
export function prepareTaskForSave(t: Task, w: Workspace): Task {
    const title = t.title.trim();
    if (!title) throw Error("A task needs a title.");
    if (t.projectId && !w.projects.some((p) => p.id === t.projectId && !p.deletedAt)) {
        throw Error("This task's project no longer exists.");
    }
    if (t.areaId && !w.areas.some((a) => a.id === t.areaId)) {
        throw Error("This task's area no longer exists.");
    }
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const raw of t.tags) {
        const tag = raw.trim().replace(/^@/, "");
        const key = tag.toLocaleLowerCase();
        if (tag && !seen.has(key)) { seen.add(key); tags.push(tag); }
    }
    const checklist = t.checklist.map((c) => ({ ...c, title: c.title.trim() }));
    if (checklist.some((c) => !c.title)) throw Error("Checklist items need a title.");
    const ids = new Set(checklist.map((c) => c.id));
    if (ids.size !== checklist.length) throw Error("Duplicate checklist IDs.");
    return {
        ...t,
        title,
        notes: t.notes.trim(),
        tags,
        checklist,
        // A task belongs to either a project or an area, not both.
        areaId: t.projectId ? null : t.areaId,
        heading: t.projectId ? t.heading.trim() : "",
    };
}
export function prepareProjectForSave(p: Project, w: Workspace): Project {
    const title = p.title.trim();
    if (!title) throw Error("A project needs a name.");
    if (p.areaId && !w.areas.some((a) => a.id === p.areaId)) throw Error("The chosen area no longer exists.");
    const sections: string[] = [];
    const seen = new Set<string>();
    for (const raw of p.sections ?? []) {
        const name = raw.trim();
        const key = name.toLocaleLowerCase();
        if (name && !seen.has(key)) { seen.add(key); sections.push(name); }
    }
    if (sections.length > 200 || sections.some((name) => name.length > 80)) throw Error("Too many sections or a section name is too long.");
    return { ...p, title, notes: p.notes.trim(), doneMeans: p.doneMeans.trim(), sections };
}
/** Move tasks between Inbox, Areas and Projects without losing their other properties. */
export function moveTaskDestination(w: Workspace, id: string, destination: { kind: "inbox" | "project" | "area"; id?: string }): Workspace {
    const task = w.tasks.find((t) => t.id === id && !t.deletedAt);
    if (!task) return w;
    if (destination.kind === "project" && !w.projects.some((p) => p.id === destination.id && !p.deletedAt && p.state === "active")) return w;
    if (destination.kind === "area" && !w.areas.some((a) => a.id === destination.id)) return w;
    const projectId = destination.kind === "project" ? destination.id ?? null : null;
    const areaId = destination.kind === "area" ? destination.id ?? null : null;
    if (task.projectId === projectId && task.areaId === areaId) return w;
    return { ...w, tasks: w.tasks.map((t) => t.id === id
        ? { ...t, projectId, areaId, heading: t.projectId === projectId ? t.heading : "" }
        : t) };
}
/** A fresh task copy, including independent checklist item IDs and no completion/repeat chain. */
export function duplicateTask(w: Workspace, id: string): Workspace {
    const source = w.tasks.find((t) => t.id === id && !t.deletedAt);
    if (!source) return w;
    const copy: Task = {
        ...newTask(),
        ...source,
        id: uid(),
        title: source.title + " (copy)",
        completedAt: null,
        deletedAt: null,
        nextId: null,
        checklist: source.checklist.map((c) => ({ ...c, id: uid(), done: false })),
        order: w.tasks.reduce((max, t) => Math.max(max, t.order), 0) + 1,
    };
    return { ...w, tasks: [...w.tasks, copy] };
}
