import { sortAreasForOrderDisplay } from "@still/core/area-ordering";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    blank,
    seed,
    uid,
    newTask,
    newProject,
    localDate,
    parseQuick,
    complete,
    matches,
    merge,
    moveTask,
    type Task,
    type Project,
    type Workspace,
    type View,
} from "./domain";
import {
    createStore,
    exportBackup,
    importBackup,
    confirmReplacement,
    type Store,
} from "./storage";
import "./style.css";
const navs = [
    ["inbox", "Inbox", "inbox"],
    ["today", "Today", "sun"],
    ["upcoming", "Upcoming", "calendar"],
    ["anytime", "Anytime", "layers"],
    ["someday", "Someday", "cloud"],
    ["logbook", "Logbook", "check"],
    ["trash", "Trash", "trash"],
] as const;

// A tiny native SVG set keeps the interface crisp without an icon dependency.
function NavIcon({ name }: { name: (typeof navs)[number][2] | "search" }) {
    const paths: Record<string, React.ReactNode> = {
        inbox: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/></>,
        sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
        layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
        cloud: <><path d="M7 18h11a4 4 0 0 0 .2-8 6.5 6.5 0 0 0-12.4 1.4A3.4 3.4 0 0 0 7 18Z"/></>,
        check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
        trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></>,
        search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    };
    return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
type DropSpot = {
    taskId: string | null;
    placement: "before" | "after";
    section: string | null;
};
function labelDate(s: string | null) {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}
function App() {
    const [, setClock] = useState(0);
    useEffect(() => {
        const refresh = () => setClock((n) => n + 1);
        const timer = setInterval(refresh, 60000);
        window.addEventListener("focus", refresh);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", refresh);
        };
    }, []);
    const [w, setW] = useState<Workspace | null>(null),
        [store, setStore] = useState<Store | null>(null),
        [loaded, setLoaded] = useState(false),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [view, setView] = useState<View>("today"),
        [query, setQuery] = useState(""),
        [menu, setMenu] = useState(false),
        [theme, setTheme] = useState(() => {
            try {
                return localStorage.getItem("still.theme") === "dark"
                    ? "dark"
                    : "light";
            } catch {
                return "light";
            }
        }),
        [modal, setModal] = useState<
            "task" | "project" | "area" | "settings" | "import" | null
        >(null),
        [task, setTask] = useState<Task | null>(null),
        [project, setProject] = useState<Project | null>(null),
        [areaId, setAreaId] = useState<string | null>(null),
        [incoming, setIncoming] = useState<Workspace | null>(null),
        [importWarnings, setImportWarnings] = useState<string[]>([]),
        [undo, setUndo] = useState<Workspace | null>(null),
        [message, setMessage] = useState(""),
        [addingSection, setAddingSection] = useState(false),
        [sectionDraft, setSectionDraft] = useState(""),
        [draggedId, setDraggedId] = useState<string | null>(null),
        [dropSpot, setDropSpot] = useState<DropSpot | null>(null);
    const locked = useRef(false),
        current = useRef(w);
    current.current = w;
    const dragCleanup = useRef<(() => void) | null>(null);
    const rowPositions = useRef(new Map<string, DOMRect>());
    const previousRowView = useRef<View | null>(null);
    // FLIP: animate actual list movement, not a simulated sorting spinner.
    useLayoutEffect(() => {
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const next = new Map<string, DOMRect>();
        document.querySelectorAll<HTMLElement>("[data-task-id]").forEach((row) => {
            const id = row.dataset.taskId;
            if (!id) return;
            const rect = row.getBoundingClientRect();
            next.set(id, rect);
            const before = rowPositions.current.get(id);
            if (before && previousRowView.current === view && !reduced &&
                typeof row.animate === "function" && Math.abs(before.top - rect.top) > 2) {
                row.animate([
                    { transform: `translate3d(0, ${before.top - rect.top}px, 0)` },
                    { transform: "translate3d(0, 0, 0)" },
                ], { duration: 280, easing: "cubic-bezier(.22, 1, .36, 1)" });
            }
        });
        rowPositions.current = next;
        previousRowView.current = view;
    }, [w, view]);
    useEffect(() => () => dragCleanup.current?.(), []);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const s = await createStore(),
                    value = await s.load();
                if (active) {
                    setStore(s);
                    setW(value);
                    setLoaded(true);
                }
            } catch (e) {
                setError(String(e));
                setLoaded(true);
            }
        })();
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem("still.theme", theme);
        } catch {
            /* preference only */
        }
    }, [theme]);
    useEffect(() => {
        if (!message) return;
        const id = setTimeout(() => setMessage(""), 5000);
        return () => clearTimeout(id);
    }, [message]);
    async function commit(next: Workspace, note = "Saved", keepUndo = true) {
        if (!store || locked.current) return false;
        locked.current = true;
        setBusy(true);
        setError("");
        try {
            await store.save(next);
            setUndo(keepUndo ? current.current : null);
            setW(next);
            current.current = next;
            setMessage(note);
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return false;
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    async function confirmChange(message: string) {
        try {
            return await confirmReplacement(message);
        } catch (e) {
            setError(String(e));
            return false;
        }
    }
    function go(v: View) {
        setView(v);
        setMenu(false);
    }
    function addTask(section = "") {
        let t = newTask();
        if (view.startsWith("project:")) {
            t.projectId = view.slice(8);
            t.heading = section;
        }
        if (view.startsWith("area:")) t.areaId = view.slice(5);
        if (view === "today") t.scheduled = localDate();
        if (view === "someday") t.someday = true;
        setTask(t);
        setModal("task");
    }
    function addArea() {
        setMenu(false);
        setError("");
        setAreaId(null);
        setModal("area");
    }
    function addProject() {
        setMenu(false);
        setError("");
        const currentArea = view.startsWith("area:")
            ? view.slice(5)
            : (w?.projects.find((p) => `project:${p.id}` === view)?.areaId ??
              null);
        setProject({ ...newProject(), areaId: currentArea });
        setModal("project");
    }
    useEffect(() => {
        function key(e: KeyboardEvent) {
            const el = e.target as HTMLElement;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                go("search");
                return;
            }
            if (e.key === "Escape") {
                setModal(null);
                setMenu(false);
            }
            if (
                !modal &&
                !(
                    el instanceof HTMLInputElement ||
                    el instanceof HTMLTextAreaElement ||
                    el instanceof HTMLSelectElement
                ) &&
                e.key.toLowerCase() === "n"
            ) {
                e.preventDefault();
                addTask();
            }
        }
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [view, modal]);
    const todayKey = localDate();
    // Counts are independent of navigation, search typing and open dialogs.
    const navCounts = useMemo(
        () =>
            Object.fromEntries(
                navs.map(([v]) => [
                    v,
                    w
                        ? w.tasks.reduce(
                              (n, t) => n + Number(matches(w, t, v, todayKey)),
                              0,
                          )
                        : 0,
                ]),
            ),
        [w, todayKey],
    );
    // Derived lists are stable while only dialogs, toasts or navigation chrome change.
    // Large workspaces no longer re-filter and re-sort on every unrelated render.
    const tasks = useMemo<Task[]>(
        () => w
            ? w.tasks
                  .filter((t) => matches(w, t, view, todayKey, query))
                  .sort((a, b) =>
                      view === "upcoming"
                          ? (a.scheduled ?? "").localeCompare(b.scheduled ?? "") ||
                            a.order - b.order
                          : a.order - b.order,
                  )
            : [],
        [w, view, todayKey, query],
    );
    const activeProjects = useMemo<Project[]>(
        () => w
            ? w.projects
                  .filter((p) => !p.deletedAt && p.state === "active")
                  .sort((a, b) => a.order - b.order)
            : [],
        [w],
    );
    const shownProjects = useMemo<Project[]>(
        () => w
            ? w.projects.filter((p) =>
                  view === "trash"
                      ? !!p.deletedAt
                      : view === "logbook"
                        ? !p.deletedAt && p.state !== "active"
                        : view.startsWith("area:")
                          ? !p.deletedAt && p.state === "active" &&
                            p.areaId === view.slice(5)
                          : false,
              )
            : [],
        [w, view],
    );
    if (!loaded)
        return (
            <div className="start">
                <div className="mark">s.</div>
                <p>Making a little room…</p>
            </div>
        );
    if (!w)
        return (
            <div className="start">
                <div className="mark">s.</div>
                <div className="eyebrow">
                    A LITTLE SPACE FOR YOUR NEXT ACTION
                </div>
                <h1>
                    Less noise.
                    <br />
                    More room.
                </h1>
                <p>
                    Meet Still. A calm place to turn what’s on your
                    <br className="desktop" /> mind into something you can do.
                </p>
                {error && (
                    <div role="alert" className="error">
                        {error}
                    </div>
                )}
                <button
                    disabled={busy || !store}
                    className="primary"
                    onClick={() => commit(seed(), "Sample workspace ready")}
                >
                    Explore a sample workspace →
                </button>
                <button
                    disabled={busy || !store}
                    className="plain"
                    onClick={() => commit(blank(), "Your space is ready")}
                >
                    Start with an empty space
                </button>
                <small>
                    {store?.kind ?? "Storage unavailable"} · No account. No
                    cloud.
                </small>
            </div>
        );
    const area = w.areas.find((a) => `area:${a.id}` === view),
        p = w.projects.find((p) => `project:${p.id}` === view),
        title =
            area?.title ??
            p?.title ??
            navs.find((n) => n[0] === view)?.[1] ??
            "Search";
    const sectionNames = p ? [...new Set([
        ...(p.sections ?? []),
        ...tasks.map((t) => t.heading).filter(Boolean),
    ])] : [];
    const projectTaskOrder = p ? [
        ...tasks.filter((t) => !t.heading),
        ...sectionNames.flatMap((name) => tasks.filter((t) => t.heading === name)),
    ] : tasks;
    type DisplayRow = { kind: "task"; task: Task; index: number } | { kind: "section"; title: string };
    const rows: DisplayRow[] = p ? [
        ...(sectionNames.length ? [{ kind: "section" as const, title: "" }] : []),
        ...projectTaskOrder.filter((t) => !t.heading).map((task) => ({ kind: "task" as const, task, index: projectTaskOrder.indexOf(task) })),
        ...sectionNames.flatMap((name) => [
            { kind: "section" as const, title: name },
            ...projectTaskOrder.filter((t) => t.heading === name).map((task) => ({ kind: "task" as const, task, index: projectTaskOrder.indexOf(task) })),
        ]),
    ] : tasks.map((task, index) => ({ kind: "task" as const, task, index }));
    async function updateTask(t: Task) {
        if (!w) return;
        const next = {
            ...w,
            tasks: w.tasks.some((x) => x.id === t.id)
                ? w.tasks.map((x) => (x.id === t.id ? t : x))
                : [...w.tasks, t],
        };
        if (await commit(next, "Task saved")) setModal(null);
    }
    async function updateProject(p: Project) {
        if (!w) return;
        const next = {
            ...w,
            projects: w.projects.some((x) => x.id === p.id)
                ? w.projects.map((x) => (x.id === p.id ? p : x))
                : [...w.projects, p],
        };
        if (await commit(next, "Project saved")) {
            setModal(null);
            if (!w.projects.some((x) => x.id === p.id)) go(`project:${p.id}`);
        }
    }
    function startDrag(e: React.PointerEvent<HTMLButtonElement>, id: string) {
        if (busy || e.button !== 0 || !w || ["trash", "logbook", "search"].includes(view)) return;
        const origin = e.currentTarget.closest<HTMLElement>("[data-task-id]");
        if (!origin) return;
        e.preventDefault();
        dragCleanup.current?.();
        const startX = e.clientX, startY = e.clientY;
        const rect = origin.getBoundingClientRect();
        let ghost: HTMLElement | null = null;
        let active = false;
        let destination: DropSpot | null = null;
        const cleanup = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onCancel);
            ghost?.remove();
            document.body.classList.remove("is-sorting");
            setDraggedId(null);
            setDropSpot(null);
            dragCleanup.current = null;
        };
        const onMove = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
            if (!active) {
                active = true;
                setDraggedId(id);
                document.body.classList.add("is-sorting");
                ghost = origin.cloneNode(true) as HTMLElement;
                ghost.removeAttribute("data-task-id");
                ghost.classList.add("drag-ghost");
                Object.assign(ghost.style, {
                    position: "fixed", pointerEvents: "none", zIndex: "9999",
                    left: `${rect.left}px`, top: `${rect.top}px`,
                    width: `${rect.width}px`, margin: "0",
                });
                document.body.appendChild(ghost);
            }
            ev.preventDefault();
            if (ghost) ghost.style.transform = `translate3d(${ev.clientX - startX}px, ${ev.clientY - startY}px, 0) rotate(-.8deg)`;
            const at = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-task-id], [data-drop-section]");
            let next: DropSpot | null = null;
            if (at?.hasAttribute("data-task-id")) {
                const targetId = at.dataset.taskId ?? null;
                if (targetId && targetId !== id) {
                    const box = at.getBoundingClientRect();
                    const placement = ev.clientY < box.top + box.height / 2 ? "before" : "after";
                    // Upcoming groups must retain their calendar date ordering.
                    const dragged = w.tasks.find((t) => t.id === id);
                    const target = w.tasks.find((t) => t.id === targetId);
                    if (view !== "upcoming" || dragged?.scheduled === target?.scheduled) {
                        next = { taskId: targetId, placement, section: view.startsWith("project:") ? at.dataset.heading ?? "" : null };
                    }
                }
            } else if (at?.hasAttribute("data-drop-section") && view.startsWith("project:")) {
                next = { taskId: null, placement: "after", section: at.dataset.dropSection ?? "" };
            }
            destination = next;
            setDropSpot((old) => old?.taskId === next?.taskId && old?.placement === next?.placement && old?.section === next?.section ? old : next);
            if (ev.clientY < 72) window.scrollBy({ top: -12, behavior: "auto" });
            else if (ev.clientY > window.innerHeight - 72) window.scrollBy({ top: 12, behavior: "auto" });
        };
        const onUp = (ev: PointerEvent) => {
            if (ev.pointerId !== e.pointerId) return;
            const drop = destination;
            cleanup();
            if (!active || !drop || !w) return;
            const shown = view.startsWith("project:") ? projectTaskOrder : tasks;
            void commit(moveTask(w, shown, id, drop.taskId, drop.placement, drop.section), "Order updated");
        };
        const onCancel = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) cleanup(); };
        window.addEventListener("pointermove", onMove, { passive: false });
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        dragCleanup.current = cleanup;
    }
    async function saveSection(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!p || !w) return;
        const name = sectionDraft.trim();
        const existing = new Set([...(p.sections ?? []), ...w.tasks.filter((t) => t.projectId === p.id).map((t) => t.heading)]);
        if (!name || name.length > 80 || existing.has(name)) {
            setError(name && existing.has(name) ? "That section already exists." : "Enter a section name (up to 80 characters).");
            return;
        }
        if (await commit({ ...w, projects: w.projects.map((x) => x.id === p.id ? { ...x, sections: [...(x.sections ?? []), name] } : x) }, "Section added")) {
            setAddingSection(false);
            setSectionDraft("");
        }
    }
    function reorder(id: string, direction: number) {
        if (!w) return;
        const shown = p ? projectTaskOrder : tasks;
        const i = shown.findIndex((t) => t.id === id),
            other = shown[i + direction];
        if (p && other?.heading !== shown[i]?.heading) return;
        if (!other) return;
        void commit(moveTask(w, shown, id, other.id, direction < 0 ? "before" : "after"), "Order updated");
    }
    function editProject(p: Project) {
        setProject(p);
        setModal("project");
    }
    const subtitle: Record<string, string> = {
        inbox: "A place to put things down. Decide what comes next later.",
        today: "A little focus goes a long way.",
        upcoming: "Make space for what’s ahead.",
        anytime: "Ready when you are.",
        someday: "Good ideas can wait here.",
        logbook: "Small steps, kept.",
        trash: "Nothing here is gone forever.",
        search: "Find a task, a note, or a tag.",
    };
    return (
        <div className="shell">
            <aside className={menu ? "open" : ""}>
                <div className="brand">
                    <span className="mark small">s.</span> still{" "}
                    <span className="brand-label">YOUR QUIET SPACE</span>
                </div>
                <button className="search" onClick={() => go("search")}>
                    <span><NavIcon name="search" /> Search</span>
                    <kbd>Ctrl K</kbd>
                </button>
                <nav>
                    {navs.map(([v, t, icon]) => (
                        <button
                            key={v}
                            onClick={() => go(v)}
                            className={view === v ? "selected" : ""}
                            aria-current={view === v ? "page" : undefined}
                        >
                            <span className={"nav-icon " + v}><NavIcon name={icon} /></span>
                            {t}
                            <span className="count">{navCounts[v] || ""}</span>
                        </button>
                    ))}
                </nav>
                <div className="section-label">
                    AREAS
                    <button aria-label="Add area" onClick={addArea}>
                        ＋
                    </button>
                </div>
                <div className="areas">
                    {sortAreasForOrderDisplay(
                        w.areas.map((a) => ({ ...a, name: a.title })),
                    ).map((a) => (
                        <div key={a.id}>
                            <div className="area-line">
                                <button
                                    onClick={() => go(`area:${a.id}`)}
                                    className={
                                        view === `area:${a.id}`
                                            ? "selected"
                                            : ""
                                    }
                                >
                                    ▧ &nbsp; {a.title}
                                </button>
                                <button
                                    className="area-edit"
                                    aria-label={`Edit area ${a.title}`}
                                    onClick={() => {
                                        setAreaId(a.id);
                                        setModal("area");
                                    }}
                                >
                                    ···
                                </button>
                            </div>
                            {activeProjects
                                .filter((p) => p.areaId === a.id)
                                .map((p) => (
                                    <button
                                        className={
                                            "project-link " +
                                            (view === `project:${p.id}`
                                                ? "selected"
                                                : "")
                                        }
                                        key={p.id}
                                        onClick={() => go(`project:${p.id}`)}
                                    >
                                        ◌ &nbsp; {p.title}
                                    </button>
                                ))}
                        </div>
                    ))}
                    {activeProjects
                        .filter((p) => !p.areaId)
                        .map((p) => (
                            <button
                                className={
                                    "project-link " +
                                    (view === `project:${p.id}`
                                        ? "selected"
                                        : "")
                                }
                                key={p.id}
                                onClick={() => go(`project:${p.id}`)}
                            >
                                ◌ &nbsp; {p.title}
                            </button>
                        ))}
                </div>
                <button className="new-project" onClick={addProject}>
                    ＋ New project
                </button>
                <div className="sidebar-foot">
                    <button onClick={() => setModal("settings")}>
                        ⚙ &nbsp; Settings & backups
                    </button>
                    <small>{store?.kind}</small>
                </div>
            </aside>
            {menu && (
                <button
                    className="scrim"
                    aria-label="Close navigation"
                    onClick={() => setMenu(false)}
                />
            )}
            <main>
                <div className="mobile-create" aria-label="Create and organize">
                    <button className="secondary" onClick={addArea}>
                        ＋ New area
                    </button>
                    <button className="secondary" onClick={addProject}>
                        ＋ New project
                    </button>
                </div>
                <div className="topline">
                    <button
                        className="mobile plain"
                        aria-label="Open navigation"
                        onClick={() => setMenu(!menu)}
                    >
                        ☰
                    </button>
                    <span>
                        {new Date().toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                        })}
                    </span>
                    <span className="local-dot">
                        ● &nbsp; {busy ? "Saving…" : "Local & private"}
                    </span>
                </div>
                {w.sample && (
                    <div className="sample-banner">
                        SAMPLE WORKSPACE{" "}
                        <span>
                            Make yourself at home. These are example tasks.
                        </span>
                        <button onClick={() => setModal("settings")}>
                            Start fresh ↗
                        </button>
                    </div>
                )}
                <header>
                    <div className="eyebrow">MAKE ROOM FOR WHAT MATTERS</div>
                    <div className="heading-line">
                        <h1>{title}</h1>
                        {p ? (
                            <button
                                className="secondary"
                                onClick={() => editProject(p)}
                            >
                                Edit project
                            </button>
                        ) : area ? (
                            <button
                                className="secondary"
                                onClick={() => {
                                    setAreaId(area.id);
                                    setModal("area");
                                }}
                            >
                                Edit area
                            </button>
                        ) : (
                            <span className="quiet-icon">
                                {view === "today" ? "☀" : "✳"}
                            </span>
                        )}
                    </div>
                    <p>
                        {p?.notes ||
                            subtitle[view] ||
                            "Your projects and next actions, in one place."}
                    </p>
                    {p && (
                        <div className="project-info">
                            <span>
                                Done means:{" "}
                                {p.doneMeans || "Define a clear finish line."}
                            </span>
                            {p.deadline && (
                                <span>Deadline {labelDate(p.deadline)}</span>
                            )}
                            <progress
                                max={Math.max(
                                    1,
                                    w.tasks.filter(
                                        (t) =>
                                            t.projectId === p.id &&
                                            !t.deletedAt,
                                    ).length,
                                )}
                                value={
                                    w.tasks.filter(
                                        (t) =>
                                            t.projectId === p.id &&
                                            !t.deletedAt &&
                                            t.completedAt,
                                    ).length
                                }
                            />
                            <small>
                                {
                                    w.tasks.filter(
                                        (t) =>
                                            t.projectId === p.id &&
                                            !t.deletedAt &&
                                            t.completedAt,
                                    ).length
                                }{" "}
                                of{" "}
                                {
                                    w.tasks.filter(
                                        (t) =>
                                            t.projectId === p.id &&
                                            !t.deletedAt,
                                    ).length
                                }{" "}
                                tasks complete
                            </small>
                        </div>
                    )}
                </header>
                {error && (
                    <div className="error" role="alert">
                        {error}
                        <button className="plain" onClick={() => setError("")}>
                            Dismiss
                        </button>
                    </div>
                )}
                {view === "search" && (
                    <input
                        className="query"
                        autoFocus
                        placeholder="Search titles, notes, and #tags…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search tasks"
                    />
                )}
                {shownProjects.length > 0 && (
                    <section className="project-cards">
                        {shownProjects.map((p) => {
                            const ts = w.tasks.filter(
                                    (t) => t.projectId === p.id && !t.deletedAt,
                                ),
                                done = ts.filter((t) => t.completedAt).length,
                                next = ts
                                    .filter(
                                        (t) =>
                                            !t.completedAt &&
                                            !t.someday &&
                                            (!t.scheduled ||
                                                t.scheduled <= localDate()),
                                    )
                                    .sort((a, b) => a.order - b.order)[0];
                            return (
                                <article className="project-card" key={p.id}>
                                    <div className="project-card-top">
                                        <button
                                            className="project-title"
                                            onClick={() =>
                                                p.deletedAt
                                                    ? editProject(p)
                                                    : go(`project:${p.id}`)
                                            }
                                        >
                                            ◌ &nbsp; {p.title}
                                        </button>
                                        {view === "trash" ? (
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    updateProject({
                                                        ...p,
                                                        deletedAt: null,
                                                    })
                                                }
                                            >
                                                Restore project
                                            </button>
                                        ) : view === "logbook" ? (
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    updateProject({
                                                        ...p,
                                                        state: "active",
                                                    })
                                                }
                                            >
                                                Reopen
                                            </button>
                                        ) : (
                                            <button
                                                className="text-button"
                                                onClick={() => editProject(p)}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                    <p>
                                        {p.state === "archived"
                                            ? "Archived · "
                                            : p.state === "completed"
                                              ? "Completed · "
                                              : ""}
                                        {p.doneMeans || "One clear outcome."}
                                    </p>
                                    <progress
                                        max={Math.max(1, ts.length)}
                                        value={done}
                                    />
                                    <div className="project-next">
                                        <small>
                                            {done}/{ts.length} complete
                                        </small>
                                        {!p.deletedAt &&
                                            p.state === "active" &&
                                            (next ? (
                                                <span>Next: {next.title}</span>
                                            ) : (
                                                <button
                                                    className="text-button"
                                                    onClick={() => {
                                                        setTask({
                                                            ...newTask(),
                                                            projectId: p.id,
                                                        });
                                                        setModal("task");
                                                    }}
                                                >
                                                    ＋ Add next action
                                                </button>
                                            ))}
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
                <section className="task-section">
                    <div className="list-label">
                        <span>
                            {view === "today"
                                ? "YOUR NEXT ACTIONS"
                                : p
                                  ? "PROJECT ACTIONS"
                                  : "TASKS"}
                        </span>
                        <span>
                            {tasks.length}{" "}
                            {tasks.length === 1 ? "task" : "tasks"}
                        </span>
                    </div>
                    {tasks.length === 0 && !p ? (
                        <div className="empty">
                            <div className="empty-symbol">◌</div>
                            <h2>
                                {view === "trash"
                                    ? "A clean slate."
                                    : view === "logbook"
                                      ? "Your small wins will live here."
                                      : view === "today"
                                        ? "Room to breathe."
                                        : "A little space to begin."}
                            </h2>
                            <p>
                                {view === "search"
                                    ? "Try a different word."
                                    : ["trash", "logbook"].includes(view)
                                      ? "Keep going, one small step at a time."
                                      : "Add one clear, doable action."}
                            </p>
                            {!["trash", "logbook", "search"].includes(view) && (
                                <button className="secondary" onClick={() => addTask()}>
                                    ＋ Add next action
                                </button>
                            )}
                        </div>
                    ) : (
                        rows.map((entry) => {
                            if (entry.kind === "section") return (
                                <div
                                    key={`section:${entry.title}`}
                                    className={"project-section-header " + (dropSpot?.taskId === null && dropSpot.section === entry.title ? "drop-section" : "")}
                                    data-drop-section={entry.title}
                                >
                                    <h3 className="group-title">{entry.title || "No section"}</h3>
                                    <button type="button" className="section-add-task" onClick={() => addTask(entry.title)} aria-label={`Add task to ${entry.title || "No section"}`}>＋</button>
                                </div>
                            );
                            const t = entry.task;
                            const i = entry.index;
                            return <React.Fragment key={t.id}>
                                {view === "upcoming" &&
                                    (i === 0 ||
                                        tasks[i - 1].scheduled !==
                                            t.scheduled) && (
                                        <h3 className="group-title">
                                            {labelDate(t.scheduled)}
                                        </h3>
                                    )}
                                <div
                                    data-task-id={t.id}
                                    data-heading={p ? t.heading : undefined}
                                    className={
                                        "task-row " +
                                        (t.completedAt ? "done " : "") +
                                        (draggedId === t.id ? "drag-source " : "") +
                                        (dropSpot?.taskId === t.id ? `drop-${dropSpot.placement}` : "")
                                    }
                                >
                                    {view !== "trash" && view !== "logbook" && view !== "search" && (
                                        <button type="button" className="drag-handle" aria-label={`Drag to reorder ${t.title}`} title="Drag to reorder" disabled={busy} onPointerDown={(e) => startDrag(e, t.id)}>⠿</button>
                                    )}
                                    <button
                                        className={
                                            "check " +
                                            (t.priority === "high"
                                                ? "high"
                                                : "")
                                        }
                                        disabled={busy || view === "trash"}
                                        aria-label={
                                            t.completedAt
                                                ? `Reopen ${t.title}`
                                                : `Complete ${t.title}`
                                        }
                                        onClick={() =>
                                            commit(
                                                complete(w, t.id),
                                                t.completedAt
                                                    ? "Task reopened"
                                                    : "A small step, done.",
                                            )
                                        }
                                    >
                                        {t.completedAt ? "✓" : ""}
                                    </button>
                                    <div className="task-content">
                                        <InlineTitle
                                            title={t.title}
                                            disabled={busy || view === "trash"}
                                            save={(title) =>
                                                updateTask({ ...t, title })
                                            }
                                        />
                                        <div className="task-meta">
                                            {t.projectId && (
                                                <span>
                                                    {
                                                        w.projects.find(
                                                            (p) =>
                                                                p.id ===
                                                                t.projectId,
                                                        )?.title
                                                    }
                                                </span>
                                            )}
                                            {t.areaId && (
                                                <span>
                                                    {
                                                        w.areas.find(
                                                            (a) =>
                                                                a.id ===
                                                                t.areaId,
                                                        )?.title
                                                    }
                                                </span>
                                            )}
                                            {t.scheduled && (
                                                <span
                                                    className={
                                                        t.scheduled <
                                                            localDate() &&
                                                        !t.completedAt
                                                            ? "overdue"
                                                            : ""
                                                    }
                                                >
                                                    {t.scheduled === localDate()
                                                        ? "Today"
                                                        : labelDate(
                                                              t.scheduled,
                                                          )}
                                                </span>
                                            )}
                                            {t.deadline && (
                                                <span
                                                    className={
                                                        t.deadline <
                                                            localDate() &&
                                                        !t.completedAt
                                                            ? "overdue"
                                                            : ""
                                                    }
                                                >
                                                    ⚑ Due{" "}
                                                    {labelDate(t.deadline)}
                                                </span>
                                            )}
                                            {t.repeat !== "none" && (
                                                <span>↻ {t.repeat}</span>
                                            )}
                                            {t.checklist.length > 0 && (
                                                <span>
                                                    ☷{" "}
                                                    {
                                                        t.checklist.filter(
                                                            (c) => c.done,
                                                        ).length
                                                    }
                                                    /{t.checklist.length}
                                                </span>
                                            )}
                                            {t.tags.map((tag) => (
                                                <span key={tag} className="tag">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="row-actions">
                                        {view === "trash" ? (
                                            <button
                                                className="text-button"
                                                onClick={() => {
                                                    const parent =
                                                        w.projects.find(
                                                            (p) =>
                                                                p.id ===
                                                                t.projectId,
                                                        );
                                                    commit(
                                                        {
                                                            ...w,
                                                            tasks: w.tasks.map(
                                                                (x) =>
                                                                    x.id ===
                                                                    t.id
                                                                        ? {
                                                                              ...x,
                                                                              deletedAt:
                                                                                  null,
                                                                          }
                                                                        : x,
                                                            ),
                                                            projects:
                                                                parent?.deletedAt
                                                                    ? w.projects.map(
                                                                          (
                                                                              p,
                                                                          ) =>
                                                                              p.id ===
                                                                              parent.id
                                                                                  ? {
                                                                                        ...p,
                                                                                        deletedAt:
                                                                                            null,
                                                                                    }
                                                                                  : p,
                                                                      )
                                                                    : w.projects,
                                                        },
                                                        "Restored",
                                                    );
                                                }}
                                            >
                                                Restore
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="reorder"
                                                    aria-label={`Move ${t.title} up`}
                                                    disabled={
                                                        busy ||
                                                        i === 0 ||
                                                        (p && projectTaskOrder[i - 1]?.heading !== t.heading) ||
                                                        (view === "upcoming" &&
                                                            tasks[i - 1]
                                                                ?.scheduled !==
                                                                t.scheduled)
                                                    }
                                                    onClick={() =>
                                                        reorder(t.id, -1)
                                                    }
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    className="reorder"
                                                    aria-label={`Move ${t.title} down`}
                                                    disabled={
                                                        busy ||
                                                        i === projectTaskOrder.length - 1 ||
                                                        (p && projectTaskOrder[i + 1]?.heading !== t.heading) ||
                                                        (view === "upcoming" &&
                                                            tasks[i + 1]
                                                                ?.scheduled !==
                                                                t.scheduled)
                                                    }
                                                    onClick={() =>
                                                        reorder(t.id, 1)
                                                    }
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    className="edit-button"
                                                    aria-label={`Edit ${t.title}`}
                                                    onClick={() => {
                                                        setTask(t);
                                                        setModal("task");
                                                    }}
                                                >
                                                    ···
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>;
                        })
                    )}
                    {p && (
                        <div className="section-create">
                            {addingSection ? (
                                <form className="section-create-form" onSubmit={saveSection}>
                                    <input autoFocus aria-label="Section name" maxLength={80} value={sectionDraft} onChange={(e) => setSectionDraft(e.target.value)} placeholder="Section name" />
                                    <button className="secondary" type="submit" disabled={busy}>Add section</button>
                                    <button type="button" className="text-button" onClick={() => { setAddingSection(false); setSectionDraft(""); }}>Cancel</button>
                                </form>
                            ) : (
                                <button className="add-section" onClick={() => setAddingSection(true)}>＋ <span>Add section</span></button>
                            )}
                        </div>
                    )}
                </section>
                {!["trash", "logbook"].includes(view) && (
                    <button className="add-inline" onClick={() => addTask()}>
                        ＋ <span>New task</span>
                        <kbd>N</kbd>
                    </button>
                )}
                <div className="bottom-note">
                    One thing at a time is enough.<span>✳</span>
                </div>
            </main>
            <button className="fab" onClick={() => addTask()} aria-label="Add task">
                ＋
            </button>
            {message && (
                <div className="toast" role="status">
                    <span>{message}</span>
                    {undo && (
                        <button
                            onClick={() => {
                                const prev = undo;
                                commit(prev, "Undone", false);
                            }}
                            disabled={busy}
                        >
                            Undo
                        </button>
                    )}
                    <button
                        aria-label="Dismiss notification"
                        onClick={() => setMessage("")}
                    >
                        ×
                    </button>
                </div>
            )}
            {modal && (
                <div
                    className="modal-backdrop"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setModal(null);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={
                            modal === "task"
                                ? "Task editor"
                                : modal === "project"
                                  ? "Project editor"
                                  : modal === "area"
                                    ? "Area editor"
                                    : "Settings and backups"
                        }
                        className="modal"
                        ref={(node) => {
                            if (node && !node.dataset.focused) {
                                node.dataset.focused = "yes";
                                setTimeout(
                                    () =>
                                        node
                                            .querySelector<HTMLElement>(
                                                "input,textarea,select",
                                            )
                                            ?.focus(),
                                    0,
                                );
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key !== "Tab") return;
                            const nodes = Array.from(
                                e.currentTarget.querySelectorAll<HTMLElement>(
                                    "input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled])",
                                ),
                            );
                            const first = nodes[0],
                                last = nodes.at(-1);
                            if (
                                e.shiftKey &&
                                document.activeElement === first
                            ) {
                                e.preventDefault();
                                last?.focus();
                            } else if (
                                !e.shiftKey &&
                                document.activeElement === last
                            ) {
                                e.preventDefault();
                                first?.focus();
                            }
                        }}
                    >
                        {error && (
                            <div className="error" role="alert">
                                {error}
                            </div>
                        )}
                        <button
                            className="close"
                            aria-label="Close dialog"
                            onClick={() => setModal(null)}
                        >
                            ×
                        </button>
                        {modal === "task" && task && (
                            <TaskForm
                                key={task.id}
                                task={task}
                                w={w}
                                busy={busy}
                                save={updateTask}
                                remove={() =>
                                    commit(
                                        {
                                            ...w,
                                            tasks: w.tasks.map((t) =>
                                                t.id === task.id
                                                    ? {
                                                          ...t,
                                                          deletedAt:
                                                              new Date().toISOString(),
                                                      }
                                                    : t,
                                            ),
                                        },
                                        "Moved to Trash",
                                    ).then((ok) => {
                                        if (ok) setModal(null);
                                    })
                                }
                            />
                        )}{" "}
                        {modal === "project" && project && (
                            <ProjectForm
                                key={project.id}
                                project={project}
                                w={w}
                                busy={busy}
                                save={updateProject}
                            />
                        )}{" "}
                        {modal === "area" && (
                            <AreaForm
                                key={areaId ?? "new"}
                                w={w}
                                id={areaId}
                                busy={busy}
                                save={async (title) => {
                                    const createdId = uid();
                                    const next = {
                                        ...w,
                                        areas: areaId
                                            ? w.areas.map((a) =>
                                                  a.id === areaId
                                                      ? { ...a, title }
                                                      : a,
                                              )
                                            : [
                                                  ...w.areas,
                                                  {
                                                      id: createdId,
                                                      title,
                                                      order: w.areas.length,
                                                  },
                                              ],
                                    };
                                    if (await commit(next, "Area saved")) {
                                        setModal(null);
                                        if (!areaId) go(`area:${createdId}`);
                                    }
                                }}
                                remove={async () => {
                                    if (
                                        w.projects.some(
                                            (p) => p.areaId === areaId,
                                        ) ||
                                        w.tasks.some((t) => t.areaId === areaId)
                                    ) {
                                        setError(
                                            "Move all projects and tasks out of this area before deleting it, including items in Logbook and Trash.",
                                        );
                                        return;
                                    }
                                    if (
                                        await commit(
                                            {
                                                ...w,
                                                areas: w.areas.filter(
                                                    (a) => a.id !== areaId,
                                                ),
                                            },
                                            "Area deleted",
                                        )
                                    )
                                        setModal(null);
                                }}
                            />
                        )}
                        {modal === "settings" && (
                            <>
                                <div className="eyebrow">
                                    YOUR SPACE, YOUR DATA
                                </div>
                                <h2>Settings & backups</h2>
                                <p className="help">
                                    {store?.kind}. Desktop and mobile keep
                                    separate workspaces. Move them with a backup
                                    file.
                                </p>
                                <label>
                                    Appearance
                                    <select
                                        value={theme}
                                        onChange={(e) =>
                                            setTheme(e.target.value)
                                        }
                                    >
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </label>
                                <div className="settings-actions">
                                    <button
                                        className="secondary"
                                        onClick={async () => {
                                            try {
                                                if (await exportBackup(w)) {
                                                    setUndo(null);
                                                    setMessage(
                                                        "Backup exported",
                                                    );
                                                }
                                            } catch (e) {
                                                setError(String(e));
                                            }
                                        }}
                                    >
                                        Export JSON backup ↗
                                    </button>
                                    <button
                                        className="secondary"
                                        onClick={async () => {
                                            try {
                                                const x = await importBackup();
                                                if (x) {
                                                    setIncoming(x.workspace);
                                                    setImportWarnings(
                                                        x.warnings,
                                                    );
                                                    setModal("import");
                                                }
                                            } catch (e) {
                                                setError(String(e));
                                                setModal(null);
                                            }
                                        }}
                                    >
                                        Import backup
                                    </button>
                                </div>
                                <p className="help">
                                    You can also import a legacy JSON export.
                                    The preview explains any differences before
                                    you save. Existing app data stays untouched.
                                </p>
                                <h3>A fresh beginning</h3>
                                <p className="help">
                                    Export a backup before replacing your
                                    workspace.
                                </p>
                                <div className="settings-actions">
                                    <button
                                        className="secondary"
                                        onClick={async () => {
                                            if (
                                                await confirmChange(
                                                    "Replace this entire workspace with an empty one? Export a backup first.",
                                                )
                                            )
                                                commit(
                                                    blank(),
                                                    "Empty workspace ready",
                                                ).then((ok) => {
                                                    if (ok) {
                                                        go("inbox");
                                                        setModal(null);
                                                    }
                                                });
                                        }}
                                    >
                                        Start empty
                                    </button>
                                    <button
                                        className="secondary"
                                        onClick={async () => {
                                            if (
                                                await confirmChange(
                                                    "Replace this entire workspace with sample tasks? Export a backup first.",
                                                )
                                            )
                                                commit(
                                                    seed(),
                                                    "Sample workspace ready",
                                                ).then((ok) => {
                                                    if (ok) {
                                                        go("today");
                                                        setModal(null);
                                                    }
                                                });
                                        }}
                                    >
                                        Load sample
                                    </button>
                                </div>
                                <h3>Quick entry</h3>
                                <p className="help">
                                    <code>
                                        Write proposal tomorrow #business !high
                                    </code>
                                    <br />
                                    Understands today, tomorrow, #tags, !high
                                    and !low. Everything else stays in the
                                    title. Review parsed fields before saving. N
                                    opens capture; Ctrl/Cmd K opens search.
                                </p>
                                <h3>Recurrence</h3>
                                <p className="help">
                                    Repeats from the scheduled date, or
                                    completion day if unscheduled. Missed dates
                                    are skipped; only one future task is
                                    created. Monthly repeats preserve the
                                    original day and clamp to the month’s last
                                    day. Deadlines do not carry forward.
                                    Reopening a task keeps its existing next
                                    occurrence. Undo reverses the last change.
                                </p>
                                <p className="help">
                                    Still 0.2.1 · Based on the original Mindwtr
                                    foundations, licensed under AGPL-3.0-only.
                                    Source: github.com/satorinoiadeus/Mindwtr.
                                    Dates use your local calendar. No
                                    notifications, accounts, or cloud sync.
                                </p>
                            </>
                        )}
                        {modal === "import" && incoming && (
                            <>
                                <div className="eyebrow">BACKUP PREVIEW</div>
                                {importWarnings.length > 0 && (
                                    <div
                                        className="migration-notes"
                                        role="note"
                                    >
                                        <strong>Review before importing</strong>
                                        <ul>
                                            {importWarnings.map((note) => (
                                                <li key={note}>{note}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <h2>Bring your tasks home.</h2>
                                <p>
                                    {incoming.areas.length} areas ·{" "}
                                    {incoming.projects.length} projects ·{" "}
                                    {incoming.tasks.length} tasks
                                </p>
                                <p className="help">
                                    Merge adds new IDs and keeps your current
                                    versions of existing items. Importing twice
                                    will not duplicate them. Replace overwrites
                                    the workspace.
                                </p>
                                <div className="settings-actions">
                                    <button
                                        disabled={busy}
                                        className="primary"
                                        onClick={async () => {
                                            try {
                                                if (
                                                    await commit(
                                                        merge(w, incoming),
                                                        "Backup merged",
                                                    )
                                                ) {
                                                    setModal(null);
                                                    go("inbox");
                                                }
                                            } catch (e) {
                                                setError(String(e));
                                            }
                                        }}
                                    >
                                        Merge
                                    </button>
                                    <button
                                        disabled={busy}
                                        className="secondary"
                                        onClick={async () => {
                                            if (
                                                await confirmChange(
                                                    "Replace all current data with this backup?",
                                                )
                                            )
                                                commit(
                                                    incoming,
                                                    "Backup restored",
                                                ).then((ok) => {
                                                    if (ok) {
                                                        setModal(null);
                                                        go("inbox");
                                                    }
                                                });
                                        }}
                                    >
                                        Replace everything
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
function InlineTitle({
    title,
    save,
    disabled,
}: {
    title: string;
    save: (s: string) => void;
    disabled: boolean;
}) {
    const [editing, setEditing] = useState(false),
        [draft, setDraft] = useState(title);
    useEffect(() => setDraft(title), [title]);
    return editing ? (
        <input
            className="inline-title"
            aria-label="Task title"
            autoFocus
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                    setDraft(title);
                    setEditing(false);
                }
            }}
            onBlur={() => {
                setEditing(false);
                if (draft.trim() && draft.trim() !== title) save(draft.trim());
                else setDraft(title);
            }}
        />
    ) : (
        <button
            className="task-title"
            disabled={disabled}
            title="Click to edit title"
            onClick={() => setEditing(true)}
        >
            {title}
        </button>
    );
}
function TaskForm({
    task,
    w,
    busy,
    save,
    remove,
}: {
    task: Task;
    w: Workspace;
    busy: boolean;
    save: (t: Task) => void;
    remove: () => void;
}) {
    const [t, set] = useState(structuredClone(task)),
        [quick, setQuick] = useState(""),
        [check, setCheck] = useState("");
    const existing = w.tasks.some((x) => x.id === t.id);
    const change = <K extends keyof Task>(key: K, value: Task[K]) =>
        set((s) => ({ ...s, [key]: value }));
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (t.title.trim())
                    save({
                        ...t,
                        title: t.title.trim(),
                        tags: t.tags.filter(Boolean),
                        repeatDay:
                            t.repeat === "monthly"
                                ? (t.repeatDay ??
                                  Number(
                                      (t.scheduled ?? localDate()).slice(-2),
                                  ))
                                : t.repeatDay,
                    });
            }}
        >
            <div className="eyebrow">ONE CLEAR NEXT ACTION</div>
            <h2>
                {existing ? "A little more detail." : "What’s on your mind?"}
            </h2>
            {!existing && (
                <div className="quick">
                    <label>
                        Quick entry
                        <input
                            value={quick}
                            onChange={(e) => setQuick(e.target.value)}
                            placeholder="Write proposal tomorrow #business !high"
                        />
                    </label>
                    <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                            const parsed = parseQuick(quick);
                            set((s) => ({ ...s, ...parsed }));
                            setQuick("");
                        }}
                    >
                        Parse into fields ↓
                    </button>
                </div>
            )}
            <label>
                Task title
                <input
                    required
                    maxLength={500}
                    value={t.title}
                    onChange={(e) => change("title", e.target.value)}
                    placeholder="Start with a verb…"
                />
            </label>
            <label>
                Notes
                <textarea
                    value={t.notes}
                    onChange={(e) => change("notes", e.target.value)}
                    rows={3}
                    placeholder="Anything worth remembering."
                />
            </label>
            <label>
                Location
                <select
                    value={
                        t.projectId
                            ? "p:" + t.projectId
                            : t.areaId
                              ? "a:" + t.areaId
                              : "inbox"
                    }
                    onChange={(e) => {
                        const v = e.target.value;
                        set((s) => ({
                            ...s,
                            projectId: v.startsWith("p:") ? v.slice(2) : null,
                            areaId: v.startsWith("a:") ? v.slice(2) : null,
                        }));
                    }}
                >
                    <option value="inbox">Inbox</option>
                    <optgroup label="Areas">
                        {w.areas.map((a) => (
                            <option key={a.id} value={"a:" + a.id}>
                                {a.title}
                            </option>
                        ))}
                    </optgroup>
                    <optgroup label="Projects">
                        {w.projects
                            .filter(
                                (p) =>
                                    !p.deletedAt &&
                                    (p.state === "active" ||
                                        p.id === t.projectId),
                            )
                            .map((p) => (
                                <option key={p.id} value={"p:" + p.id}>
                                    {p.title}
                                </option>
                            ))}
                    </optgroup>
                </select>
            </label>
            {t.projectId && (
                <label>
                    Heading (optional)
                    <input
                        value={t.heading}
                        onChange={(e) => change("heading", e.target.value)}
                        placeholder="e.g. First steps"
                        list="still-section-suggestions"
                    />
                    <datalist id="still-section-suggestions">
                        {(w.projects.find((p) => p.id === t.projectId)?.sections ?? []).map((name) => <option key={name} value={name} />)}
                    </datalist>
                </label>
            )}
            <div className="form-grid">
                <label>
                    Scheduled · when I’ll work on it
                    <input
                        type="date"
                        min="1900-01-01"
                        max="9999-12-31"
                        value={t.scheduled ?? ""}
                        onChange={(e) => {
                            change("scheduled", e.target.value || null);
                            if (e.target.value) {
                                change("someday", false);
                                if (t.repeat === "monthly")
                                    change(
                                        "repeatDay",
                                        Number(e.target.value.slice(-2)),
                                    );
                            }
                        }}
                    />
                </label>
                <label>
                    Deadline · when it must be done
                    <input
                        type="date"
                        min="1900-01-01"
                        max="9999-12-31"
                        value={t.deadline ?? ""}
                        onChange={(e) =>
                            change("deadline", e.target.value || null)
                        }
                    />
                </label>
            </div>
            <label className="checkbox-label">
                <input
                    type="checkbox"
                    checked={t.someday}
                    onChange={(e) =>
                        set((s) => ({
                            ...s,
                            someday: e.target.checked,
                            scheduled: e.target.checked ? null : s.scheduled,
                        }))
                    }
                />{" "}
                Someday · intentionally set aside
            </label>
            <div className="form-grid">
                <label>
                    Priority
                    <select
                        value={t.priority}
                        onChange={(e) =>
                            change(
                                "priority",
                                e.target.value as Task["priority"],
                            )
                        }
                    >
                        <option value="none">Normal</option>
                        <option value="high">High</option>
                        <option value="low">Low</option>
                    </select>
                </label>
                <label>
                    Repeat
                    <select
                        value={t.repeat}
                        onChange={(e) => {
                            change("repeat", e.target.value as Task["repeat"]);
                            change(
                                "repeatDay",
                                Number((t.scheduled ?? localDate()).slice(-2)),
                            );
                        }}
                    >
                        <option value="none">Does not repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </label>
            </div>
            <label>
                Tags · separated by commas
                <input
                    value={t.tags.join(", ")}
                    onChange={(e) =>
                        change("tags", [
                            ...new Set(
                                e.target.value
                                    .split(",")
                                    .map((s) => s.trim().replace(/^#/, "")),
                            ),
                        ])
                    }
                />
            </label>
            <label>Checklist</label>
            <div className="checklist">
                {t.checklist.map((c) => (
                    <div key={c.id}>
                        <input
                            aria-label={`Complete checklist item ${c.title}`}
                            type="checkbox"
                            checked={c.done}
                            onChange={() =>
                                change(
                                    "checklist",
                                    t.checklist.map((x) =>
                                        x.id === c.id
                                            ? { ...x, done: !x.done }
                                            : x,
                                    ),
                                )
                            }
                        />
                        <input
                            aria-label="Checklist item title"
                            value={c.title}
                            onChange={(e) =>
                                change(
                                    "checklist",
                                    t.checklist.map((x) =>
                                        x.id === c.id
                                            ? { ...x, title: e.target.value }
                                            : x,
                                    ),
                                )
                            }
                        />
                        <button
                            type="button"
                            className="plain"
                            aria-label={`Remove checklist item ${c.title}`}
                            onClick={() =>
                                change(
                                    "checklist",
                                    t.checklist.filter((x) => x.id !== c.id),
                                )
                            }
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <div className="check-add">
                <input
                    aria-label="New checklist item"
                    value={check}
                    onChange={(e) => setCheck(e.target.value)}
                    placeholder="Another small step"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (check.trim()) {
                                change("checklist", [
                                    ...t.checklist,
                                    {
                                        id: uid(),
                                        title: check.trim(),
                                        done: false,
                                    },
                                ]);
                                setCheck("");
                            }
                        }
                    }}
                />
                <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                        if (check.trim()) {
                            change("checklist", [
                                ...t.checklist,
                                { id: uid(), title: check.trim(), done: false },
                            ]);
                            setCheck("");
                        }
                    }}
                >
                    Add
                </button>
            </div>
            <div className="form-footer">
                {existing && (
                    <button
                        className="danger plain"
                        type="button"
                        disabled={busy}
                        onClick={remove}
                    >
                        Move to Trash
                    </button>
                )}
                <button
                    className="primary"
                    disabled={
                        busy ||
                        !t.title.trim() ||
                        t.checklist.some((c) => !c.title.trim())
                    }
                >
                    Save task →
                </button>
            </div>
        </form>
    );
}
function ProjectForm({
    project,
    w,
    busy,
    save,
}: {
    project: Project;
    w: Workspace;
    busy: boolean;
    save: (p: Project) => void;
}) {
    const [p, set] = useState({ ...project });
    const change = <K extends keyof Project>(key: K, value: Project[K]) =>
        set((s) => ({ ...s, [key]: value }));
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (p.title.trim()) save({ ...p, title: p.title.trim() });
            }}
        >
            <div className="eyebrow">A FINISH LINE YOU CAN SEE</div>
            <h2>
                {w.projects.some((x) => x.id === p.id)
                    ? "Shape your project."
                    : "One doable project."}
            </h2>
            <label>
                Outcome
                <input
                    required
                    maxLength={500}
                    value={p.title}
                    placeholder="Launch the first pilot"
                    onChange={(e) => change("title", e.target.value)}
                />
            </label>
            <label>
                Done means…
                <textarea
                    rows={2}
                    value={p.doneMeans}
                    onChange={(e) => change("doneMeans", e.target.value)}
                    placeholder="What will be true when this is finished?"
                />
            </label>
            <label>
                Notes
                <textarea
                    rows={3}
                    value={p.notes}
                    onChange={(e) => change("notes", e.target.value)}
                />
            </label>
            <label>
                Area
                <select
                    value={p.areaId ?? ""}
                    onChange={(e) => change("areaId", e.target.value || null)}
                >
                    <option value="">No area</option>
                    {w.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.title}
                        </option>
                    ))}
                </select>
            </label>
            <div className="form-grid">
                <label>
                    Deadline
                    <input
                        type="date"
                        min="1900-01-01"
                        max="9999-12-31"
                        value={p.deadline ?? ""}
                        onChange={(e) =>
                            change("deadline", e.target.value || null)
                        }
                    />
                </label>
                <label>
                    Status
                    <select
                        value={p.state}
                        onChange={(e) =>
                            change("state", e.target.value as Project["state"])
                        }
                    >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>
                </label>
            </div>
            <p className="help">
                Completing or archiving a project hides its unfinished actions
                from active lists. Reopen it from Logbook.
            </p>
            <div className="form-footer">
                {w.projects.some((x) => x.id === p.id) && (
                    <button
                        type="button"
                        className="danger plain"
                        disabled={busy}
                        onClick={() =>
                            save({
                                ...p,
                                deletedAt: p.deletedAt
                                    ? null
                                    : new Date().toISOString(),
                            })
                        }
                    >
                        {p.deletedAt
                            ? "Restore project"
                            : "Move project to Trash"}
                    </button>
                )}
                <button className="primary" disabled={busy || !p.title.trim()}>
                    Save project →
                </button>
            </div>
        </form>
    );
}
function AreaForm({
    w,
    id,
    busy,
    save,
    remove,
}: {
    w: Workspace;
    id: string | null;
    busy: boolean;
    save: (s: string) => void;
    remove: () => void;
}) {
    const [title, set] = useState(
        w.areas.find((a) => a.id === id)?.title ?? "",
    );
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) save(title.trim());
            }}
        >
            <div className="eyebrow">A PART OF YOUR LIFE</div>
            <h2>{id ? "Your area." : "Create an area."}</h2>
            <p className="help">
                An ongoing responsibility, without a finish date.
            </p>
            <label>
                Name
                <input
                    required
                    maxLength={100}
                    value={title}
                    onChange={(e) => set(e.target.value)}
                    placeholder="Personal, Health, Creative…"
                />
            </label>
            <div className="form-footer">
                {id && (
                    <button
                        type="button"
                        className="plain danger"
                        disabled={busy}
                        onClick={remove}
                    >
                        Delete empty area
                    </button>
                )}
                <button className="primary" disabled={busy || !title.trim()}>
                    Save area →
                </button>
            </div>
        </form>
    );
}
createRoot(document.getElementById("root")!).render(<App />);
