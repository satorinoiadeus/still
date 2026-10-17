import React from "react";
import type { Task, Workspace } from "./domain";

export function applyBatchAction(workspace: Workspace, ids: readonly string[], action: "complete" | "trash"): Workspace {
    const selected = new Set(ids);
    const timestamp = new Date().toISOString();
    return {
        ...workspace,
        tasks: workspace.tasks.map(task => !selected.has(task.id) ? task :
            action === "complete" ? { ...task, completedAt: task.completedAt ?? timestamp } :
            { ...task, deletedAt: task.deletedAt ?? timestamp }),
    };
}
export function BatchToolbar({ tasks, selected, onSelectedChange, onAction, disabled = false }: {
    tasks: Task[];
    selected: string[];
    onSelectedChange: (ids: string[]) => void;
    onAction: (action: "complete" | "trash") => void;
    disabled?: boolean;
}) {
    return <div className="batch-toolbar" role="toolbar" aria-label="Batch task actions">
        <button type="button" onClick={() => onSelectedChange(tasks.map(t => t.id))}>Select all visible</button>
        <button type="button" onClick={() => onSelectedChange([])}>Clear</button>
        <span aria-live="polite">{selected.length} selected</span>
        <button type="button" disabled={disabled || !selected.length} onClick={() => onAction("complete")}>Complete</button>
        <button type="button" disabled={disabled || !selected.length} onClick={() => onAction("trash")}>Move to Trash</button>
    </div>;
}
export function BatchCheckbox({ task, selected, onChange }: {
    task: Task; selected: boolean; onChange: (selected: boolean) => void;
}) {
    return <input className="batch-check" type="checkbox" aria-label={`Select ${task.title}`} checked={selected} onChange={e => onChange(e.target.checked)} />;
}
