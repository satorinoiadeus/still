import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { TreeID } from 'loro-crdt';
import { useService } from '@/hooks/use-service';
import { ITodoService } from '@/services/todo/common/todoService';
import { useWatchEvent } from '@/hooks/use-watch-event';
import type { UpdateTaskSchema } from '@/core/type';

interface Selection {
  active: boolean;
  selected: Set<TreeID>;
  toggle: (id: TreeID) => void;
  register: (id: TreeID) => () => void;
  items: Set<TreeID>;
  setSelected: React.Dispatch<React.SetStateAction<Set<TreeID>>>;
  setActive: (active: boolean) => void;
}
const Context = createContext<Selection | null>(null);
export function MobileSelectionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(new Set<TreeID>());
  const [items, setItems] = useState(new Set<TreeID>());
  const register = useCallback((id: TreeID) => {
    setItems((previous) => new Set(previous).add(id));
    return () => {
      setItems((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    };
  }, []);
  const toggle = (id: TreeID) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Context.Provider value={{ active, selected, toggle, register, items, setSelected, setActive }}>
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useMobileSelection(id: TreeID, overlay: boolean) {
  const selection = useContext(Context);
  const register = selection?.register;
  useEffect(() => {
    if (!overlay) return register?.(id);
  }, [id, overlay, register]);
  return selection;
}
export function MobileSelectionToolbar() {
  const selection = useContext(Context)!;
  const todo = useService(ITodoService);
  useWatchEvent(todo.onStateChange);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!selection.items.size) return null;
  const { selected, active } = selection;
  const finish = () => {
    selection.setSelected(new Set());
    selection.setActive(false);
    setConfirmDelete(false);
  };
  // A selected ancestor already carries its children when moving or deleting.
  const roots = () =>
    [...selected].filter((id) => {
      const parentOf = (key: string): TreeID | undefined => {
        const item = todo.modelState.taskObjectMap.get(key as TreeID);
        return item && 'parentId' in item ? (item.parentId as TreeID | undefined) : undefined;
      };
      let parent = parentOf(id);
      while (parent) {
        if (selected.has(parent)) return false;
        parent = parentOf(parent);
      }
      return todo.modelState.taskObjectMap.has(id);
    });
  const apply = (update?: UpdateTaskSchema) => {
    try {
      todo.runInTransaction(() => {
        const ids = !update || update.position ? roots().reverse() : [...selected].filter(id => todo.modelState.taskObjectMap.get(id)?.type === 'task');
        for (const id of ids) {
          if (update) todo.updateTask(id, update);
          else todo.deleteItem(id);
        }
      });
      finish();
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!active)
    return (
      <div className="still-select-entry px-5 pt-2 text-right">
        <button
          type="button"
          className="still-small-button"
          data-testid="mobile-select"
          onClick={() => {
            todo.endEditingContent();
            selection.setActive(true);
          }}
        >
          Select tasks
        </button>
      </div>
    );
  return (
    <section className="still-batch" aria-label="Batch actions">
      <div className="flex items-center justify-between gap-2">
        <strong aria-live="polite">{selected.size} selected</strong>
        <button onClick={() => selection.setSelected(new Set(selection.items))}>Select all</button>
        <button onClick={finish}>Done</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button disabled={!selected.size} onClick={() => apply({ status: 'completed' })}>
          Complete
        </button>
        <button disabled={!selected.size} onClick={() => apply({ status: 'created' })}>
          Reopen
        </button>
        <label>
          Move{' '}
          <select
            aria-label="Move selected tasks"
            disabled={!selected.size}
            value=""
            onChange={(event) => {
              if (event.target.value)
                apply({
                  position: {
                    type: 'firstElement',
                    parentId: event.target.value === 'inbox' ? undefined : (event.target.value as TreeID),
                  },
                });
            }}
          >
            <option value="">Choose…</option>
            <option value="inbox">Inbox</option>
            {[...todo.modelState.taskObjectMap.values()]
              .filter((item) => item.type === 'project' || item.type === 'area')
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title || 'Untitled'}
                </option>
              ))}
          </select>
        </label>
        <label>
          Schedule{' '}
          <input
            aria-label="Schedule selected tasks"
            disabled={!selected.size}
            type="date"
            onChange={(event) => {
              if (event.target.value) apply({ startDate: Date.parse(event.target.value + 'T00:00:00Z') });
            }}
          />
        </label>
        <button disabled={!selected.size} onClick={() => apply({ startDate: null })}>
          Clear schedule
        </button>
        <button disabled={!selected.size} onClick={() => setConfirmDelete(true)}>
          Delete…
        </button>
      </div>
      {confirmDelete && (
        <div className="mt-3" role="alert">
          Delete {selected.size} selected tasks and their subtasks?{' '}
          <button onClick={() => apply()}>Confirm delete</button>
          <button onClick={() => setConfirmDelete(false)}>Keep tasks</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
