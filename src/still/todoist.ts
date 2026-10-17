import { TaskModel } from '@/core/model';
import type { ITaskModelData, TaskSchema } from '@/core/type';
import type { TreeID } from 'loro-crdt';

const columns = [
  'TYPE',
  'CONTENT',
  'DESCRIPTION',
  'PRIORITY',
  'INDENT',
  'AUTHOR',
  'RESPONSIBLE',
  'DATE',
  'DATE_LANG',
  'TIMEZONE',
  'DURATION',
  'DURATION_UNIT',
  'DEADLINE',
  'DEADLINE_LANG',
];
export interface TodoistPreview {
  snapshot: Uint8Array;
  tasks: number;
  sections: number;
  warnings: string[];
}
// RFC 4180: quoted commas, embedded newlines, escaped quotes and UTF-8 BOM.
export function parseCsv(source: string): string[][] {
  if (source.length > 5_000_000) throw new Error('CSV exceeds the 5 MB limit.');
  const input = source.replace(/^\uFEFF/, '');
  const delimiter = input.slice(0, input.indexOf('\n') < 0 ? input.length : input.indexOf('\n')).includes(';')
    ? ';'
    : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === '"' && !value && !closed) quoted = true;
    else if (c === delimiter) {
      row.push(value);
      value = '';
      closed = false;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      closed = false;
    } else {
      if (closed || c === '"') throw new Error('Malformed CSV quoting.');
      value += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length > 5001) throw new Error('Import at most 5,000 rows at a time.');
  return rows;
}
function dateValue(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) return;
  return date;
}
export function previewTodoist(source: string, title: string): TodoistPreview {
  const rows = parseCsv(source);
  const header = rows.shift()?.map((value) => value.trim().toUpperCase()) ?? [];
  if (!header.includes('TYPE') || !header.includes('CONTENT'))
    throw new Error('Choose a Todoist project CSV containing TYPE and CONTENT columns.');
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV column names.');
  const model = new TaskModel();
  const project = model.addProject({ title: title.trim() || 'Imported from Todoist' });
  const warnings = new Set<string>();
  const parents: TreeID[] = [];
  const last = new Map<TreeID, TreeID>();
  let section: TreeID = project;
  let taskCount = 0;
  let sectionCount = 0;
  let previous: TreeID | undefined;
  const position = (parentId: TreeID) => {
    const prior = last.get(parentId);
    return prior
      ? { type: 'afterElement' as const, previousElementId: prior }
      : { type: 'firstElement' as const, parentId };
  };
  for (const [index, cells] of rows.entries()) {
    if (cells.length > header.length) throw new Error(`Row ${index + 2} has too many columns.`);
    const row = Object.fromEntries(header.map((key, i) => [key, cells[i] || '']));
    const type = row.TYPE.trim().toLowerCase();
    if (type === 'section') {
      section = model.addProjectHeading({ title: row.CONTENT, position: position(project) });
      last.set(project, section);
      parents.length = 0;
      previous = undefined;
      sectionCount++;
      continue;
    }
    if (type === 'note') {
      if (!previous) throw new Error(`Note on row ${index + 2} has no preceding task.`);
      const task = model.toJSON().taskObjectMap.get(previous) as TaskSchema;
      model.updateTask(previous, { notes: [task.notes, row.CONTENT].filter(Boolean).join('\n\n') });
      continue;
    }
    if (type !== 'task') throw new Error(`Unsupported row type “${row.TYPE}” on row ${index + 2}.`);
    const indent = Number(row.INDENT || '1');
    if (!Number.isInteger(indent) || indent < 1 || indent > 4 || (indent > 1 && !parents[indent - 2]))
      throw new Error(`Invalid task indentation on row ${index + 2}.`);
    const parentId = indent === 1 ? section : parents[indent - 2];
    const preserved: string[] = [];
    const startDate = dateValue(row.DATE || '');
    const dueDate = dateValue(row.DEADLINE || '');
    for (const field of header) {
      const value = row[field];
      if (!value) continue;
      const handled =
        ['TYPE', 'CONTENT', 'DESCRIPTION', 'INDENT'].includes(field) ||
        (field === 'PRIORITY' && value === '4') ||
        (field === 'DATE' && startDate !== undefined) ||
        (field === 'DEADLINE' && dueDate !== undefined) ||
        ['DATE_LANG', 'DEADLINE_LANG'].includes(field);
      if (!handled) {
        preserved.push(`${field}: ${value}`);
        warnings.add(`${field} values are retained in task notes because Still cannot represent them exactly.`);
      }
    }
    const notes = [row.DESCRIPTION, preserved.length ? '[Todoist metadata]\n' + preserved.join('\n') : '']
      .filter(Boolean)
      .join('\n\n');
    const id = model.addTask({ title: row.CONTENT, notes, startDate, dueDate, position: position(parentId) });
    last.set(parentId, id);
    parents[indent - 1] = id;
    parents.length = indent;
    previous = id;
    taskCount++;
  }
  if (!taskCount) throw new Error('The CSV contains no tasks.');
  return { snapshot: model.export(), tasks: taskCount, sections: sectionCount, warnings: [...warnings] };
}
const csvCell = (value: string) => '"' + value.replace(/"/g, '""') + '"';
export function exportTodoist(
  state: ITaskModelData,
  scope: string
): { csv: string; tasks: number; warnings: string[] } {
  const rows = [columns];
  const warnings = new Set<string>();
  let tasks = 0;
  let skipped = 0;
  const walk = (ids: string[], depth: number) => {
    for (const id of ids) {
      const item = state.taskObjectMap.get(id as TreeID);
      if (!item) continue;
      if (item.type === 'projectHeading') {
        if (item.isArchived) {
          warnings.add('Archived sections are excluded.');
          continue;
        }
        rows.push(columns.map((key) => (key === 'TYPE' ? 'section' : key === 'CONTENT' ? item.title : '')));
        walk(item.children, depth);
      }
      if (item.type !== 'task') continue;
      if (item.status !== 'created') {
        skipped++;
        continue;
      }
      if (depth > 4)
        throw new Error(
          'Todoist supports four indentation levels. Move deeper subtasks before exporting this project.'
        );
      const metadata: string[] = [];
      if (item.recurringRule) {
        metadata.push('Still recurrence: ' + JSON.stringify(item.recurringRule));
        warnings.add('Recurrence rules are preserved in descriptions; configure recurrence in Todoist after import.');
      }
      if (item.tags.length) {
        metadata.push('Still tags: ' + item.tags.join(', '));
        warnings.add('Tags are preserved in descriptions.');
      }
      const date = (value?: number) => (value === undefined ? '' : new Date(value).toISOString().slice(0, 10));
      const values: Record<string, string> = {
        TYPE: 'task',
        CONTENT: item.title,
        DESCRIPTION: [item.notes, ...metadata].filter(Boolean).join('\n\n'),
        PRIORITY: '4',
        INDENT: String(depth),
        DATE: date(item.startDate),
        DATE_LANG: 'en',
        DEADLINE: date(item.dueDate),
        DEADLINE_LANG: 'en',
      };
      rows.push(columns.map((key) => values[key] || ''));
      tasks++;
      walk(item.children, depth + 1);
    }
  };
  const project = state.taskObjectMap.get(scope as TreeID);
  if (scope !== 'inbox' && project?.type !== 'project') throw new Error('Choose a project or Inbox.');
  walk(
    scope === 'inbox'
      ? state.rootObjectIdList.filter((id) => state.taskObjectMap.get(id)?.type === 'task')
      : (project as { children: TreeID[] }).children,
    1
  );
  if (skipped)
    warnings.add(`${skipped} completed or canceled tasks (and their subtasks) are excluded by Todoist CSV transfer.`);
  if (tasks > 300)
    warnings.add('Todoist imports up to 300 tasks per project CSV; split this project before importing.');
  return { csv: '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), tasks, warnings: [...warnings] };
}
