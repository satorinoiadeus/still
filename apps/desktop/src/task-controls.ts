import { addDays, localDate, type Task, type Workspace, type Project, type Area } from "./domain";

/** The filters are pure: no mutation, storage access, timers or network calls. */
export const FILTERS = [
    ["all", "All tasks"],
    ["overdue", "Overdue"],
    ["scheduledToday", "Scheduled today"],
    ["dueToday", "Deadline today"],
    ["next7", "Next 7 days"],
    ["next30", "Next 30 days"],
    ["future", "Future dates"],
    ["unscheduled", "No schedule"],
    ["scheduled", "Has schedule"],
    ["noDate", "No dates at all"],
    ["hasDeadline", "Has deadline"],
    ["noDeadline", "No deadline"],
    ["high", "High priority"],
    ["normal", "Normal priority"],
    ["low", "Low priority"],
    ["tagged", "Has labels"],
    ["untagged", "No labels"],
    ["notes", "Has notes"],
    ["noNotes", "No notes"],
    ["checklist", "Has checklist"],
    ["noChecklist", "No checklist"],
    ["checklistOpen", "Checklist unfinished"],
    ["checklistDone", "Checklist finished"],
    ["repeating", "Repeating"],
    ["oneTime", "Not repeating"],
    ["inProject", "In a project"],
    ["noProject", "Not in a project"],
    ["inArea", "In an area"],
    ["noArea", "No area"],
    ["someday", "Someday"],
    ["actionable", "Not someday"],
    ["completed", "Completed"],
    ["incomplete", "Incomplete"],
] as const;
export type FilterKind = (typeof FILTERS)[number][0];

export const SORTS = [
    ["manual", "Manual order"],
    ["scheduled", "Scheduled date"],
    ["deadline", "Deadline"],
    ["priority", "Priority"],
    ["title", "Title A–Z"],
    ["project", "Project"],
    ["area", "Area"],
    ["labels", "Labels"],
    ["checklist", "Checklist progress"],
    ["notes", "Description length"],
    ["repeat", "Recurrence"],
    ["completed", "Completion date"],
    ["section", "Section"],
] as const;
export type SortMode = (typeof SORTS)[number][0];
export interface TaskControls {
    sort: SortMode;
    reverse: boolean;
    filter: FilterKind;
    priority: "all" | Task["priority"];
    label: string;
    project: string;
    area: string;
    search: string;
    compact: boolean;
    layout: "list" | "board";
}
export const DEFAULT_CONTROLS: TaskControls = {
    sort: "manual", reverse: false, filter: "all", priority: "all",
    label: "", project: "", area: "", search: "", compact: false, layout: "list",
};
const filterKeys = new Set<string>(FILTERS.map(([key]) => key));
const sortKeys = new Set<string>(SORTS.map(([key]) => key));
const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
const safeString = (v: unknown, max = 120): string => typeof v === "string" ? v.slice(0, max) : "";
export function parseTaskControls(raw: unknown): TaskControls {
    if (!isObject(raw)) return { ...DEFAULT_CONTROLS };
    return {
        sort: typeof raw.sort === "string" && sortKeys.has(raw.sort) ? raw.sort as SortMode : "manual",
        reverse: raw.reverse === true,
        filter: typeof raw.filter === "string" && filterKeys.has(raw.filter) ? raw.filter as FilterKind : "all",
        priority: ["all", "none", "high", "low"].includes(String(raw.priority)) ? raw.priority as TaskControls["priority"] : "all",
        label: safeString(raw.label),
        project: safeString(raw.project),
        area: safeString(raw.area),
        search: safeString(raw.search, 300),
        compact: raw.compact === true,
        layout: raw.layout === "board" ? "board" : "list",
    };
}
export function loadTaskControls(): TaskControls {
    try {
        const raw = localStorage.getItem("still.task-controls.v2");
        return raw ? parseTaskControls(JSON.parse(raw)) : { ...DEFAULT_CONTROLS };
    } catch { return { ...DEFAULT_CONTROLS }; }
}
export function persistTaskControls(controls: TaskControls): boolean {
    try {
        localStorage.setItem("still.task-controls.v2", JSON.stringify(parseTaskControls(controls)));
        return true;
    } catch { return false; }
}
const norm = (s: string) => s.normalize("NFKC").toLocaleLowerCase();
const hasText = (s: string) => s.trim().length > 0;
const between = (date: string | null, start: string, end: string) =>
    date !== null && date >= start && date <= end;
const anyDate = (t: Task, pred: (s: string) => boolean) =>
    (t.scheduled !== null && pred(t.scheduled)) || (t.deadline !== null && pred(t.deadline));
export function matchesTaskFilter(t: Task, kind: FilterKind, today = localDate(), w?: Workspace, projectIndex?: Map<string, Project>): boolean {
    switch (kind) {
        case "all": return true;
        case "overdue": return anyDate(t, (d) => d < today) && !t.completedAt;
        case "scheduledToday": return t.scheduled === today;
        case "dueToday": return t.deadline === today;
        case "next7": return between(t.scheduled, today, addDays(today, 7)) || between(t.deadline, today, addDays(today, 7));
        case "next30": return between(t.scheduled, today, addDays(today, 30)) || between(t.deadline, today, addDays(today, 30));
        case "future": return anyDate(t, (d) => d > today);
        case "unscheduled": return t.scheduled === null;
        case "scheduled": return t.scheduled !== null;
        case "noDate": return t.scheduled === null && t.deadline === null;
        case "hasDeadline": return t.deadline !== null;
        case "noDeadline": return t.deadline === null;
        case "high": return t.priority === "high";
        case "normal": return t.priority === "none";
        case "low": return t.priority === "low";
        case "tagged": return t.tags.length > 0;
        case "untagged": return t.tags.length === 0;
        case "notes": return hasText(t.notes);
        case "noNotes": return !hasText(t.notes);
        case "checklist": return t.checklist.length > 0;
        case "noChecklist": return t.checklist.length === 0;
        case "checklistOpen": return t.checklist.some((x) => !x.done);
        case "checklistDone": return t.checklist.length > 0 && t.checklist.every((x) => x.done);
        case "repeating": return t.repeat !== "none";
        case "oneTime": return t.repeat === "none";
        case "inProject": return t.projectId !== null;
        case "noProject": return t.projectId === null;
        case "inArea": return t.areaId !== null || !!(w && t.projectId && (projectIndex?.get(t.projectId) ?? w.projects.find((p) => p.id === t.projectId))?.areaId);
        case "noArea": return t.areaId === null && !(w && t.projectId && (projectIndex?.get(t.projectId) ?? w.projects.find((p) => p.id === t.projectId))?.areaId);
        case "someday": return t.someday;
        case "actionable": return !t.someday;
        case "completed": return t.completedAt !== null;
        case "incomplete": return t.completedAt === null;
    }
}
function taskAreaId(t: Task, projects: Map<string, Project>): string {
    return t.areaId ?? projects.get(t.projectId ?? "")?.areaId ?? "";
}
function field(t: Task, projects: Map<string, Project>, areas: Map<string, Area>, sort: SortMode): string | number {
    switch (sort) {
        case "manual": return t.order;
        case "scheduled": return t.scheduled ?? "\uffff";
        case "deadline": return t.deadline ?? "\uffff";
        case "priority": return ({ high: 0, none: 1, low: 2 } as const)[t.priority];
        case "title": return norm(t.title);
        case "project": return norm(projects.get(t.projectId ?? "")?.title ?? "\uffff");
        case "area": return norm(areas.get(taskAreaId(t, projects))?.title ?? "\uffff");
        case "labels": return norm([...t.tags].sort().join(",") || "\uffff");
        case "checklist": return t.checklist.length ? t.checklist.filter((x) => x.done).length / t.checklist.length : -1;
        case "notes": return t.notes.length;
        case "repeat": return ({ none: 0, daily: 1, weekly: 2, monthly: 3 } as const)[t.repeat];
        case "completed": return t.completedAt ?? "\uffff";
        case "section": return norm(t.heading);
    }
}
export function applyTaskControls(
    w: Workspace, source: readonly Task[], options: TaskControls, today = localDate(),
): Task[] {
    const opts = parseTaskControls(options);
    const search = norm(opts.search.trim());
    const label = norm(opts.label);
    // One indexed lookup per render instead of repeated linear project/area scans
    // for every task and every comparator invocation.
    const projects = new Map(w.projects.map((p) => [p.id, p]));
    const areas = new Map(w.areas.map((a) => [a.id, a]));
    const visible = source.filter((t) => {
        if (opts.priority !== "all" && t.priority !== opts.priority) return false;
        if (opts.project && t.projectId !== opts.project) return false;
        if (opts.area && taskAreaId(t, projects) !== opts.area) return false;
        if (label && !t.tags.some((tag) => norm(tag) === label)) return false;
        if (!matchesTaskFilter(t, opts.filter, today, w, projects)) return false;
        if (search) {
            const project = projects.get(t.projectId ?? "");
            const haystack = norm([t.title, t.notes, t.heading, ...t.tags, project?.title ?? ""].join(" "));
            if (!haystack.includes(search)) return false;
        }
        return true;
    });
    return visible.map((task, index) => ({ task, index }))
        .sort((a, b) => {
            const left = field(a.task, projects, areas, opts.sort), right = field(b.task, projects, areas, opts.sort);
            const nullish = (x: string | number) => x === "\uffff";
            // Undated items always go last, even in descending date sorts.
            if (nullish(left) !== nullish(right)) return nullish(left) ? 1 : -1;
            const comparison = typeof left === "number" && typeof right === "number"
                ? left - right : String(left).localeCompare(String(right));
            return comparison === 0 ? a.index - b.index : comparison * (opts.reverse ? -1 : 1);
        })
        .map(({ task }) => task);
}
/** Reordering a filtered or auto-sorted list would mislead users; use manual mode first. */
export function canDragTasks(options: TaskControls): boolean {
    return options.sort === "manual" && !options.reverse && options.filter === "all" &&
        options.priority === "all" && !options.label && !options.project &&
        !options.area && !options.search.trim();
}
/** Pure reorder; leaves unrelated projects/areas untouched. */
export function reorderNamedSections(w: Workspace, projectId: string, moved: string, target: string): Workspace {
    const project = w.projects.find((p) => p.id === projectId);
    if (!project || !moved || !target || moved === target) return w;
    const all = [...new Set([...(project.sections ?? []), ...w.tasks.filter((t) => t.projectId === projectId).map((t) => t.heading).filter(Boolean)])];
    if (!all.includes(moved) || !all.includes(target)) return w;
    const to = all.indexOf(target);
    const ids = all.filter((name) => name !== moved);
    ids.splice(to, 0, moved);
    return { ...w, projects: w.projects.map((p) => p.id === projectId ? { ...p, sections: ids } : p) };
}
export function reorderAreas(w: Workspace, moved: string, target: string): Workspace {
    if (moved === target) return w;
    const ids = [...w.areas].sort((a, b) => a.order - b.order).map((a) => a.id);
    if (!ids.includes(moved) || !ids.includes(target)) return w;
    const to = ids.indexOf(target);
    const reordered = ids.filter((id) => id !== moved);
    reordered.splice(to, 0, moved);
    const rank = new Map(reordered.map((id, index) => [id, index]));
    return { ...w, areas: w.areas.map((a) => ({ ...a, order: rank.get(a.id) ?? a.order })) };
}
