import { addDays, localDate, type Task, type Workspace } from "./domain";
export interface SmartEntry {
    title: string;
    scheduled: string | null;
    priority: Task["priority"];
    tags: string[];
    projectId: string | null;
    areaId: string | null;
}
const norm = (s: string) => s.trim().toLocaleLowerCase();
function nextWeekday(today: string, target: number): string {
    const [y, m, d] = today.split("-").map(Number);
    const current = new Date(y, m - 1, d, 12).getDay();
    return addDays(today, ((target - current + 7) % 7) || 7);
}
export function parseSmartEntry(input: string, w: Pick<Workspace, "projects" | "areas">, today = localDate()): SmartEntry {
    let title = input.trim(), scheduled: string | null = null;
    let priority: Task["priority"] = "none", projectId: string | null = null, areaId: string | null = null;
    const tags: string[] = [];
    title = title.replace(/(^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/gu, (_full, gap: string, name: string) => {
        const project = w.projects.find((p) => !p.deletedAt && norm(p.title) === norm(name.replace(/_/g, " ")));
        if (!project) { tags.push(name); return gap; }
        projectId = project.id; areaId = project.areaId; return gap;
    });
    title = title.replace(/(^|\s)@([\p{L}\p{N}_-]+)(?=\s|$)/gu, (_full, gap: string, label: string) => {
        tags.push(label); return gap;
    });
    title = title.replace(/(^|\s)(?:!(high|low)|p([1-4]))(?=\s|$)/gi, (_full, gap: string, flag: string | undefined, p: string | undefined) => {
        priority = flag ? flag.toLowerCase() as Task["priority"] : Number(p) <= 2 ? "high" : "low";
        return gap;
    });
    const dates: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
        [/(^|\s)(today|tomorrow)(?=\s|$)/i, (m) => addDays(today, m[2].toLowerCase() === "tomorrow" ? 1 : 0)],
        [/(^|\s)next\s+week(?=\s|$)/i, () => addDays(today, 7)],
        [/(^|\s)(this\s+)?weekend(?=\s|$)/i, () => nextWeekday(today, 6)],
        [/(^|\s)in\s+(\d{1,3})\s+days?(?=\s|$)/i, (m) => addDays(today, Number(m[2]))],
        [/(^|\s)(?:on\s+)?(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?=\s|$)/i, (m) => {
            const days: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
            return nextWeekday(today, days[m[2].slice(0, 3).toLowerCase()]);
        }],
        [/(^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/, (m) => m[2]],
    ];
    for (const [pattern, resolve] of dates) {
        const found = title.match(pattern);
        if (found) {
            scheduled = resolve(found);
            title = title.replace(pattern, "$1");
            break;
        }
    }
    return { title: title.replace(/\s+/g, " ").trim(), scheduled, priority, tags: [...new Set(tags)], projectId, areaId };
}
