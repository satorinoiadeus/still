import React, { useMemo, useState } from "react";
import { addDays, localDate, newTask, type Task, type Workspace } from "./domain";
import { parseSmartEntry } from "./quick-add";
type Props = {
    base: Task;
    workspace: Workspace;
    busy: boolean;
    save: (task: Task) => Promise<boolean>;
    close: () => void;
};
export default function QuickAdd({ base, workspace, busy, save, close }: Props) {
    const [entry, setEntry] = useState("");
    const [notes, setNotes] = useState("");
    const [date, setDate] = useState<string | null | undefined>(undefined);
    const [priority, setPriority] = useState<Task["priority"] | undefined>(undefined);
    const [destination, setDestination] = useState(base.projectId ? "p:" + base.projectId : base.areaId ? "a:" + base.areaId : "inbox");
    const [section, setSection] = useState(base.heading);
    const [extraLabels, setExtraLabels] = useState<string[]>([]);
    const [labelDraft, setLabelDraft] = useState("");
    const [keepAdding, setKeepAdding] = useState(false);
    const [sending, setSending] = useState(false);
    const parsed = useMemo(() => parseSmartEntry(entry, workspace), [entry, workspace]);
    const target = destination === "inbox" && parsed.projectId ? "p:" + parsed.projectId : destination;
    const selectedProject = target.startsWith("p:") ? workspace.projects.find((p) => p.id === target.slice(2)) : null;
    const labels = [...new Set(workspace.tasks.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b));
    const resolvedLabels = [...new Set([...parsed.tags, ...extraLabels])];
    const resolvedDate = date === undefined ? parsed.scheduled ?? base.scheduled : date;
    const resolvedPriority = priority ?? (parsed.priority !== "none" ? parsed.priority : base.priority);
    function addLabel() {
        const name = labelDraft.trim().replace(/^[@#]/, "").replace(/\s+/g, "-").slice(0, 40);
        if (name) setExtraLabels((xs) => [...new Set([...xs, name])]);
        setLabelDraft("");
    }
    async function submit() {
        if (busy || sending || !parsed.title.trim()) return;
        const projectId = target.startsWith("p:") ? target.slice(2) : null;
        const areaId = projectId
            ? workspace.projects.find((p) => p.id === projectId)?.areaId ?? null
            : target.startsWith("a:") ? target.slice(2) : null;
        const task: Task = {
            ...newTask(),
            title: parsed.title.slice(0, 500),
            notes: notes.trim(),
            projectId,
            areaId,
            heading: projectId ? section : "",
            scheduled: resolvedDate,
            priority: resolvedPriority,
            tags: resolvedLabels,
            someday: base.someday && !resolvedDate,
        };
        setSending(true);
        try {
            const ok = await save(task);
            if (ok) {
                if (!keepAdding) close();
                else {
                    setEntry(""); setNotes(""); setDate(undefined); setPriority(undefined);
                    setExtraLabels([]); setLabelDraft("");
                }
            }
        } finally { setSending(false); }
    }
    return (
        <form className="quick-add-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="quick-add-heading"><span className="quick-add-icon">＋</span><div><strong>Quick add</strong><small>Capture it now. Organize it as you go.</small></div></div>
            <textarea
                autoFocus required aria-label="Quick add task name" rows={2} maxLength={800}
                value={entry} placeholder="e.g. Plan weekend trip tomorrow @personal p1"
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
            />
            <input aria-label="Task description" className="quick-add-description" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Description (optional)" />
            <div className="quick-add-chips" aria-label="Quick date suggestions">
                <button type="button" className={resolvedDate === localDate() ? "selected" : ""} onClick={() => setDate(localDate())}>☀ Today</button>
                <button type="button" className={resolvedDate === addDays(localDate(), 1) ? "selected" : ""} onClick={() => setDate(addDays(localDate(), 1))}>Tomorrow</button>
                <button type="button" onClick={() => setDate(addDays(localDate(), 7))}>Next week</button>
                <label className="quick-date-chip">▦ <input aria-label="Choose date" type="date" value={resolvedDate ?? ""} onChange={(e) => setDate(e.target.value || null)} /></label>
                {resolvedDate && <button type="button" onClick={() => setDate(null)}>Clear date ×</button>}
            </div>
            <div className="quick-add-options">
                <label>Project or Area
                    <select aria-label="Quick add destination" value={target} onChange={(e) => { setDestination(e.target.value); setSection(""); }}>
                        <option value="inbox">Inbox</option>
                        <optgroup label="Areas">{workspace.areas.map((a) => <option key={a.id} value={"a:" + a.id}>{a.title}</option>)}</optgroup>
                        <optgroup label="Projects">{workspace.projects.filter((p) => !p.deletedAt && p.state === "active").map((p) => <option key={p.id} value={"p:" + p.id}>{p.title}</option>)}</optgroup>
                    </select>
                </label>
                <label>Priority
                    <select aria-label="Quick add priority" value={resolvedPriority} onChange={(e) => setPriority(e.target.value as Task["priority"])}>
                        <option value="none">○ Normal</option><option value="high">🔴 High</option><option value="low">🔵 Low</option>
                    </select>
                </label>
                {selectedProject && <label>Section
                    <select aria-label="Quick add section" value={section} onChange={(e) => setSection(e.target.value)}>
                        <option value="">No section</option>
                        {(selectedProject.sections ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </label>}
            </div>
            <div className="quick-label-editor">
                <label htmlFor="quick-label-input">Labels</label>
                <div className="quick-label-input-row">
                    <input id="quick-label-input" aria-label="Add label" list="quick-label-suggestions" value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} placeholder="Type a label…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }} />
                    <datalist id="quick-label-suggestions">{labels.map((x) => <option key={x} value={x} />)}</datalist>
                    <button type="button" onClick={addLabel} disabled={!labelDraft.trim()}>Add</button>
                </div>
                {resolvedLabels.length > 0 && <div className="quick-label-pills">{resolvedLabels.map((tag) => <button type="button" key={tag} aria-label={"Remove label " + tag} onClick={() => { setExtraLabels((xs) => xs.filter((x) => x !== tag)); setEntry((s) => s.split(/\s+/).filter((x) => x !== "@" + tag && x !== "#" + tag).join(" ")); }}>@{tag} ×</button>)}</div>}
            </div>
            <p className="quick-add-hint">Try <code>tomorrow</code>, <code>Friday</code>, <code>in 3 days</code>, <code>@label</code>, <code>#project</code>, <code>p1</code>. Press <kbd>Enter</kbd> to add; <kbd>Shift + Enter</kbd> for a new line.</p>
            <div className="quick-add-footer">
                <label className="quick-keep"><input type="checkbox" checked={keepAdding} onChange={(e) => setKeepAdding(e.target.checked)} /> Keep adding</label>
                <button type="button" className="secondary" onClick={close}>Cancel</button>
                <button type="submit" className="primary" disabled={busy || sending || !parsed.title.trim()}>{sending ? "Adding…" : "Add task ↗"}</button>
            </div>
        </form>
    );
}
