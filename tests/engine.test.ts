import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskModel } from '../src/core/model';
import { encodePatch } from '../src/core/export/encode';
import { decodePatch } from '../src/core/export/decode';
import { encryptData, decryptData } from '../src/core/crypto/encryptData';
import { parseRecurringRule } from '../src/core/time/parseRecurringRule';
const day = Date.UTC(2026, 9, 17);
test('task create, edit, complete, delete and undo', async () => {
  const m = new TaskModel(); m.setPeerId('42'); m.clearUndoHistory(); const id = m.addTask({ title: 'Plan the week' });
  assert.equal(m.getTask(id).title, 'Plan the week');
  m.updateTask(id, { title: 'Next week', notes: 'Quiet focus', startDate: day, dueDate: day + 86400000, tags: ['work'] });
  assert.equal(m.getTask(id).notes, 'Quiet focus');
  assert.equal(m.getTask(id).dueDate, day + 86400000);
  assert.deepEqual(m.getTask(id).tags, ['work']);
  m.updateTask(id, { status: 'completed', completionAt: day });
  assert.equal(m.getTask(id).status, 'completed');
  await new Promise(r => setTimeout(r, 0)); m.clearUndoHistory(); m.deleteItem(id); await new Promise(r => setTimeout(r, 0)); assert.equal(m.toJSON().taskObjectMap.has(id), false);
  m.undo(); await new Promise(r => setTimeout(r, 0)); assert.equal(m.toJSON().taskList.some(task => task.title === 'Next week' && task.status === 'completed'), true);
});
test('areas, projects, headings, subtasks and ordering', () => {
  const m = new TaskModel(); const area = m.addArea({ title: 'Personal' });
  const project = m.addProject({ title: 'A calmer workspace', position: { type: 'firstElement', parentId: area } });
  const heading = m.addProjectHeading({ title: 'This week', position: { type: 'firstElement', parentId: project } });
  const a = m.addTask({ title: 'Clear the desk', position: { type: 'firstElement', parentId: heading } });
  const b = m.addTask({ title: 'Choose what matters', position: { type: 'afterElement', previousElementId: a } });
  const child = m.addTask({ title: 'Keep a notebook', position: { type: 'firstElement', parentId: a } });
  assert.equal(m.getProject(project).parentId, area); assert.equal(m.getTask(child).parentId, a);
  assert.deepEqual(m.getProjectHeading(heading).children, [a, b]);
  m.updateTask(b, { position: { type: 'beforeElement', nextElementId: a } });
  assert.deepEqual(m.getProjectHeading(heading).children, [b, a]);
});
test('snapshot backup round trip preserves data and repeated import is idempotent', () => {
  const m = new TaskModel(); const id = m.addTask({ title: 'Durable task', startDate: day, notes: 'Save this' });
  const child = m.addTask({ title: 'Durable child', position: { type: 'firstElement', parentId: id } });
  const backup = encodePatch(m.export()).content; const restored = new TaskModel(); restored.import([decodePatch(backup)]);
  assert.equal(restored.getTask(id).startDate, day); assert.equal(restored.getTask(id).notes, 'Save this');
  assert.equal(restored.getTask(child).parentId, id); restored.import([decodePatch(backup)]);
  assert.equal(restored.toJSON().taskList.length, 2);
});
test('reject damaged backup and legacy Still JSON', () => {
  assert.throws(() => decodePatch('{"tasks":[]}'));
  const m = new TaskModel(); m.addTask({ title: 'Keep me' });
  assert.throws(() => decodePatch(encodePatch(m.export()).content + 'damaged'));
  assert.equal(m.toJSON().taskList.length, 1);
});
test('two replicas merge independent offline changes using upstream CRDT', () => {
  const a = new TaskModel(); a.setPeerId('101'); const id = a.addTask({ title: 'Shared task' });
  const b = new TaskModel(); b.import([a.export()]); b.setPeerId('102');
  a.updateTask(id, { notes: 'Laptop edit' }); b.updateTask(id, { title: 'Phone edit' });
  const left = a.export(), right = b.export(); a.import([right]); b.import([left]);
  assert.equal(a.getTask(id).title, 'Phone edit'); assert.equal(b.getTask(id).notes, 'Laptop edit');
});
test('upstream recurrence parser validates rules', () => {
  assert.equal(parseRecurringRule('1w').weeks, 1); assert.equal(parseRecurringRule('1m-1d').days, -1);
  assert.equal(parseRecurringRule('garbage').valid, false); assert.equal(parseRecurringRule('0d').valid, false);
});

test('AES encryption round trip and wrong-key rejection', () => {
 const ciphertext = encryptData('Private task notes', 'test-key');
 assert.equal(decryptData(ciphertext, 'test-key'), 'Private task notes');
 assert.throws(() => decryptData(ciphertext, 'wrong-key'));
});

test('completing a recurring task creates the next scheduled occurrence', () => {
  const m = new TaskModel();
  const id = m.addTask({ title: 'Daily review', startDate: day,
    recurringRule: { startDate: { valid: true, days: 1, from: 'start' } } });
  m.updateTask(id, { status: 'completed', completionAt: day });
  const next = m.toJSON().taskList.find(task => task.id !== id && task.type === 'task');
  assert.ok(next && next.type === 'task');
  assert.equal(next.startDate, day + 86400000);
  assert.equal(next.status, 'created');
});
