import { localDayKey } from "@still/core/legacy-selectors";
import { generateUUID } from "@still/core/uuid";
export type Repeat = "none" | "daily" | "weekly" | "monthly";
export interface Area {
    id: string;
    title: string;
    order: number;
}
export interface Project {
    id: string;
    title: string;
    notes: string;
    doneMeans: string;
    areaId: string | null;
    deadline: string | null;
    state: "active" | "completed" | "archived";
    deletedAt: string | null;
    order: number;
    /** Ordered section titles. Optional for existing Still backups. */
    sections?: string[];
}
export interface Task {
    id: string;
    title: string;
    notes: string;
    areaId: string | null;
    projectId: string | null;
    heading: string;
    tags: string[];
    scheduled: string | null;
    deadline: string | null;
    someday: boolean;
    priority: "none" | "high" | "low";
    repeat: Repeat;
    repeatDay: number | null;
    checklist: { id: string; title: string; done: boolean }[];
    completedAt: string | null;
    deletedAt: string | null;
    nextId: string | null;
    order: number;
}
export interface Workspace {
    version: 1;
    sample: boolean;
    areas: Area[];
    projects: Project[];
    tasks: Task[];
}
export type View =
    | "inbox"
    | "today"
    | "upcoming"
    | "anytime"
    | "someday"
    | "logbook"
    | "trash"
    | "search"
    | `area:${string}`
    | `project:${string}`;
export const uid = generateUUID;
export function localDate(d = new Date()): string {
    return localDayKey(d);
}
export function validDate(v: unknown): v is string {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split("-").map(Number);
    if (y < 1900 || y > 9999) return false;
    const x = new Date(y, m - 1, d, 12);
    return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d;
}
export function addDays(day: string, n: number) {
    const [y, m, d] = day.split("-").map(Number);
    return localDate(new Date(y, m - 1, d + n, 12));
}
export function nextDate(
    base: string,
    repeat: Repeat,
    anchor: number | null,
    today = localDate(),
): string {
    if (repeat === "none") return base;
    let next = base;
    const step = (s: string) => {
        if (repeat === "daily") return addDays(s, 1);
        if (repeat === "weekly") return addDays(s, 7);
        const [y, m, d] = s.split("-").map(Number);
        const last = new Date(y, m + 1, 0, 12).getDate();
        return localDate(new Date(y, m, Math.min(anchor ?? d, last), 12));
    };
    next = step(next);
    while (next <= today) {
        next = step(next);
    }
    return next;
}
export function blank(): Workspace {
    return { version: 1, sample: false, areas: [], projects: [], tasks: [] };
}
export function newTask(title = ""): Task {
    return {
        id: uid(),
        title,
        notes: "",
        areaId: null,
        projectId: null,
        heading: "",
        tags: [],
        scheduled: null,
        deadline: null,
        someday: false,
        priority: "none",
        repeat: "none",
        repeatDay: null,
        checklist: [],
        completedAt: null,
        deletedAt: null,
        nextId: null,
        order: Date.now(),
    };
}
export function newProject(title = ""): Project {
    return {
        id: uid(),
        title,
        notes: "",
        doneMeans: "",
        areaId: null,
        deadline: null,
        state: "active",
        deletedAt: null,
        order: Date.now(),
        sections: [],
    };
}
export function seed(today = localDate()): Workspace {
    const w = blank();
    w.sample = true;
    w.areas = ["Business", "Personal", "Health", "Creative"].map(
        (title, order) => ({ id: uid(), title, order }),
    );
    const p = {
        ...newProject("Launch the first pilot"),
        areaId: w.areas[0].id,
        notes: "A small, useful test. Learn from real work.",
        doneMeans: "One customer has tried it and shared feedback.",
    };
    const p2 = {
        ...newProject("Finish chapter one"),
        areaId: w.areas[3].id,
        doneMeans: "A complete first draft, ready to read.",
    };
    w.projects = [p, p2];
    w.tasks = [
        {
            ...newTask("Ask one lawyer about their last fixed-fee overrun"),
            projectId: p.id,
            scheduled: today,
            priority: "high" as const,
            notes: "Listen for what happened, when they noticed, and what they tried.",
            checklist: [
                { id: uid(), title: "Choose one person to ask", done: true },
                {
                    id: uid(),
                    title: "Write down their exact words",
                    done: false,
                },
            ],
        },
        {
            ...newTask("Sketch the smallest useful demo"),
            projectId: p.id,
            scheduled: today,
            heading: "Make it tangible",
        },
        {
            ...newTask("Take ten quiet minutes to stretch"),
            areaId: w.areas[2].id,
            scheduled: today,
            repeat: "daily" as const,
        },
        {
            ...newTask("Draft the chapter opening"),
            projectId: p2.id,
            scheduled: addDays(today, 1),
        },
        { ...newTask("Clear the desk"), areaId: w.areas[1].id },
        {
            ...newTask("A story set in a small frontier town"),
            areaId: w.areas[3].id,
            someday: true,
        },
        { ...newTask("Look into a better desk lamp") },
        {
            ...newTask("Choose a name for this workspace"),
            areaId: w.areas[1].id,
            completedAt: new Date().toISOString(),
        },
    ].map((t, i) => ({ ...t, order: i }));
    return w;
}
export function hiddenProject(w: Workspace, t: Task) {
    return t.projectId
        ? w.projects.find((p) => p.id === t.projectId)
        : undefined;
}
export function matches(
    w: Workspace,
    t: Task,
    view: View,
    today = localDate(),
    query = "",
): boolean {
    const p = hiddenProject(w, t),
        deleted = !!t.deletedAt || !!p?.deletedAt;
    if (view === "trash") return !!t.deletedAt;
    if (deleted) return false;
    if (view === "logbook") return !!t.completedAt;
    if (view === "search")
        return `${t.title} ${t.notes} ${t.tags.join(" ")} ${p?.title ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
    if (t.completedAt || p?.state === "completed" || p?.state === "archived")
        return false;
    if (view.startsWith("project:")) return t.projectId === view.slice(8);
    if (view.startsWith("area:"))
        return t.areaId === view.slice(5) || p?.areaId === view.slice(5);
    if (view === "someday") return t.someday;
    if (t.someday) return false;
    if (view === "inbox") return !t.projectId && !t.areaId;
    if (view === "today") return !!t.scheduled && t.scheduled <= today;
    if (view === "upcoming") return !!t.scheduled && t.scheduled > today;
    if (view === "anytime") return !t.scheduled && !!(t.projectId || t.areaId);
    return false;
}
export function complete(
    w: Workspace,
    id: string,
    today = localDate(),
): Workspace {
    const n = structuredClone(w),
        t = n.tasks.find((t) => t.id === id);
    if (!t) throw Error("Task not found");
    if (t.completedAt) {
        t.completedAt = null;
        return n;
    }
    t.completedAt = new Date().toISOString();
    if (t.repeat !== "none" && !t.nextId) {
        const base = t.scheduled ?? today;
        const next = {
            ...structuredClone(t),
            id: uid(),
            completedAt: null,
            nextId: null,
            order: Math.max(0, ...n.tasks.map((x) => x.order)) + 1,
            scheduled: nextDate(base, t.repeat, t.repeatDay, today),
            deadline: null,
            checklist: t.checklist.map((c) => ({
                ...c,
                id: uid(),
                done: false,
            })),
        };
        t.nextId = next.id;
        n.tasks.push(next);
    }
    return n;
}
/** Reorder a visible list, preserving every task outside that view.
 * Project drops may also move a task to a different named section.
 * The view must be checked for allowed drop targets by the caller. */
export function moveTask(
    w: Workspace,
    visible: Task[],
    movedId: string,
    targetId: string | null,
    placement: "before" | "after",
    section: string | null = null,
): Workspace {
    const ids = visible.map((t) => t.id);
    if (!ids.includes(movedId) || (targetId && !ids.includes(targetId))) return w;
    const reordered = ids.filter((id) => id !== movedId);
    const targetIndex = targetId ? reordered.indexOf(targetId) : reordered.length;
    const insertAt = targetId
        ? targetIndex + (placement === "after" ? 1 : 0)
        : reordered.length;
    reordered.splice(insertAt, 0, movedId);
    const visibleIds = new Set(ids);
    const orderedIds = [
        ...reordered,
        ...w.tasks.filter((t) => !visibleIds.has(t.id)).sort((a, b) => a.order - b.order).map((t) => t.id),
    ];
    const orderById = new Map(orderedIds.map((id, index) => [id, index]));
    return {
        ...w,
        tasks: w.tasks.map((t) => ({
            ...t,
            order: orderById.get(t.id) ?? t.order,
            heading: t.id === movedId && section !== null ? section : t.heading,
        })),
    };
}

export function parseQuick(text: string, today = localDate()) {
    let scheduled: string | null = null,
        priority: Task["priority"] = "none";
    const tags: string[] = [];
    let title = text
        .replace(
            /(^|\s)(today|tomorrow)(?=\s|$)/gi,
            (_m, space: string, word: string) => {
                if (scheduled) return _m;
                scheduled =
                    word.toLowerCase() === "today" ? today : addDays(today, 1);
                return space;
            },
        )
        .replace(
            /(^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/gu,
            (_m, s: string, tag: string) => {
                tags.push(tag);
                return s;
            },
        )
        .replace(/(^|\s)!(high|low)(?=\s|$)/gi, (_m, s: string, p: string) => {
            priority = p.toLowerCase() as Task["priority"];
            return s;
        })
        .replace(/\s+/g, " ")
        .trim();
    return { title, scheduled, priority, tags: [...new Set(tags)] };
}
export function validate(raw: unknown): Workspace {
    const fail = (): never => {
        throw Error("Invalid backup. No data was changed.");
    };
    if (!raw || typeof raw !== "object") return fail();
    const w = raw as Workspace;
    if (
        w.version !== 1 ||
        typeof w.sample !== "boolean" ||
        !Array.isArray(w.areas) ||
        !Array.isArray(w.projects) ||
        !Array.isArray(w.tasks) ||
        w.tasks.length > 50000 ||
        w.areas.length > 5000 ||
        w.projects.length > 10000
    )
        return fail();
    const ids = new Set<string>();
    const str = (v: unknown) => typeof v === "string" && v.length <= 100000;
    const id = (v: unknown) =>
        typeof v === "string" && v.length > 0 && v.length <= 100;
    const order = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    const date = (v: unknown) => v === null || validDate(v);
    const timestamp = (v: unknown) =>
        v === null ||
        (typeof v === "string" &&
            v.length <= 40 &&
            Number.isFinite(Date.parse(v)));
    const identity = (x: { id: string; title: string; order: number }) => {
        if (
            !x ||
            !id(x.id) ||
            ids.has(x.id) ||
            !str(x.title) ||
            !x.title.trim() ||
            !order(x.order)
        )
            fail();
        ids.add(x.id);
    };
    for (const a of w.areas) identity(a);
    const areaIds = new Set(w.areas.map((a) => a.id));
    for (const p of w.projects) {
        identity(p);
        if (
            !str(p.notes) ||
            !str(p.doneMeans) ||
            (p.sections !== undefined && (
                !Array.isArray(p.sections) ||
                p.sections.length > 200 ||
                !p.sections.every((name) =>
                    typeof name === "string" && name.length <= 80 &&
                    name.trim() === name && !!name &&
                    p.sections!.filter((s) => s === name).length === 1
                )
            )) ||
            !date(p.deadline) ||
            !timestamp(p.deletedAt) ||
            !["active", "completed", "archived"].includes(p.state) ||
            (p.areaId !== null && !areaIds.has(p.areaId))
        )
            fail();
    }
    const projectIds = new Set(w.projects.map((p) => p.id));
    for (const t of w.tasks) {
        identity(t);
        if (
            !str(t.notes) ||
            !str(t.heading) ||
            !date(t.scheduled) ||
            !date(t.deadline) ||
            typeof t.someday !== "boolean" ||
            !["none", "high", "low"].includes(t.priority) ||
            !["none", "daily", "weekly", "monthly"].includes(t.repeat) ||
            !(
                t.repeatDay === null ||
                (Number.isInteger(t.repeatDay) &&
                    t.repeatDay >= 1 &&
                    t.repeatDay <= 31)
            ) ||
            !timestamp(t.completedAt) ||
            !timestamp(t.deletedAt) ||
            !(t.nextId === null || id(t.nextId)) ||
            !Array.isArray(t.tags) ||
            !t.tags.every(str) ||
            !Array.isArray(t.checklist) ||
            (t.areaId !== null && !areaIds.has(t.areaId)) ||
            (t.projectId !== null && !projectIds.has(t.projectId)) ||
            (t.projectId !== null && t.areaId !== null)
        )
            fail();
        const checklistIds = new Set();
        for (const c of t.checklist) {
            if (
                !c ||
                !id(c.id) ||
                checklistIds.has(c.id) ||
                !str(c.title) ||
                !c.title.trim() ||
                typeof c.done !== "boolean"
            )
                fail();
            checklistIds.add(c.id);
        }
    }
    const taskIds = new Set(w.tasks.map((t) => t.id));
    for (const t of w.tasks)
        if (t.nextId !== null && (!taskIds.has(t.nextId) || t.nextId === t.id))
            fail();
    return structuredClone(w);
}
export function merge(a: Workspace, b: Workspace): Workspace {
    const merged = {
        version: 1 as const,
        sample: a.sample,
        areas: [...a.areas],
        projects: [...a.projects],
        tasks: [...a.tasks],
    };
    for (const key of ["areas", "projects", "tasks"] as const) {
        const known = new Set(merged[key].map((x) => x.id));
        for (const x of b[key])
            if (!known.has(x.id)) {
                (merged[key] as { id: string }[]).push(structuredClone(x));
                known.add(x.id);
            }
    }
    return validate(merged);
}
