import React, { useState } from 'react';
import { useService } from '@/hooks/use-service';
import { useWatchEvent } from '@/hooks/use-watch-event';
import { ITodoService } from '@/services/todo/common/todoService';
import { encodePatch } from '@/core/export/encode';
import { previewTodoist, exportTodoist, TodoistPreview } from './todoist';
import { saveTextFile } from './saveTextFile';
export function TodoistTransfer() {
  const todo = useService(ITodoService);
  useWatchEvent(todo.onStateChange);
  const [preview, setPreview] = useState<TodoistPreview | null>(null);
  const [scope, setScope] = useState('inbox');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupReady, setBackupReady] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await operation();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="still-transfer" aria-label="Todoist transfer">
      <h3>Todoist</h3>
      <p>
        Import a Todoist project CSV into a new Still project. Your existing tasks stay in place. Export one project at
        a time for Todoist. Use a Still backup for a complete, lossless copy.
      </p>
      <label>
        Import Todoist CSV{' '}
        <input
          aria-label="Import Todoist CSV"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setPreview(null);
            setBackupReady(false);
            void run(async () => {
              if (file.size > 5_000_000) throw new Error('CSV exceeds 5 MB.');
              setPreview(previewTodoist(await file.text(), file.name.replace(/\.csv$/i, '')));
            });
            event.target.value = '';
          }}
        />
      </label>
      {preview && (
        <div className="flex flex-col gap-3">
          <p>
            {preview.tasks} tasks · {preview.sections} sections. Imports as a separate project.
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveTextFile(
                  'Still-before-Todoist.hbTask',
                  encodePatch(todo.exportPatch({}, todo.storageId)).content
                );
                setBackupReady(true);
                setMessage('Backup prepared. Save it before confirming import.');
              })
            }
          >
            1. Save backup
          </button>
          <button
            disabled={busy || !backupReady}
            onClick={() =>
              void run(async () => {
                await todo.import([preview.snapshot], todo.storageId);
                setPreview(null);
                setMessage('Todoist project imported.');
              })
            }
          >
            2. Import {preview.tasks} tasks
          </button>
        </div>
      )}
      <label>
        Export project{' '}
        <select aria-label="Todoist export project" value={scope} onChange={(event) => setScope(event.target.value)}>
          <option value="inbox">Inbox</option>
          {todo.modelState.taskList
            .filter((item) => item.type === 'project')
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || 'Untitled project'}
              </option>
            ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const result = exportTodoist(todo.modelState, scope);
            if (!result.tasks) throw new Error('This project has no active tasks to export.');
            setMessage(`${result.tasks} tasks. ${result.warnings.join(' ')}`);
            await saveTextFile('Still-Todoist.csv', result.csv, 'text/csv;charset=utf-8');
          })
        }
      >
        Export Todoist CSV
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
