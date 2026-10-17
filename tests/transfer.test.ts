import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskModel } from '../src/core/model';
import { parseCsv, previewTodoist, exportTodoist } from '../src/still/todoist';
import { openSnapshot, sealSnapshot } from '../src/still/syncCrypto';
import { ProviderStorage } from '../src/still/ProviderStorage';
import type { SyncRequester, SyncRequest } from '../src/still/syncRequest';
import { ByteBuffer, decodeBase64, encodeBase64 } from '@hamsterbase/foundation/buffer';
const csv = 'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,DATE,DEADLINE\r\nsection,Planning,,,,,\r\ntask,"Parent, with comma","First line\nSecond line",1,1,2026-10-18,2026-10-20\r\ntask,"Child ""quoted""",,4,2,every weekday,\r\nnote,Extra note,,,,,\r\n';
test('Todoist CSV imports sections, nesting, Unicode, notes, dates and preserves unsupported metadata', () => {
 const preview = previewTodoist('\uFEFF' + csv, 'Todoist project'); assert.equal(preview.tasks, 2); assert.equal(preview.sections, 1); assert.equal(preview.warnings.length, 2);
 const m = new TaskModel(); m.addTask({ title: 'Existing task' }); m.import([preview.snapshot]);
 const state = m.toJSON(); const parent = state.taskList.find(item => item.title === 'Parent, with comma'); const child = state.taskList.find(item => item.title === 'Child "quoted"');
 assert.ok(parent?.type === 'task' && child?.type === 'task'); assert.equal(child.parentId, parent.id); assert.equal(parent.startDate, Date.UTC(2026, 9, 18)); assert.match(parent.notes!, /PRIORITY: 1/); assert.match(child.notes!, /every weekday/); assert.match(child.notes!, /Extra note/); assert.ok(state.taskList.some(item => item.title === 'Existing task'));
 const project = state.taskList.find(item => item.type === 'project')!; const exported = exportTodoist(state, project.id); const again = new TaskModel(); again.import([previewTodoist(exported.csv, 'Again').snapshot]); assert.equal(exported.tasks, 2); assert.equal(again.toJSON().taskList.filter(item => item.type === 'task').length, 2);
});
test('CSV parser accepts quoted multiline fields and rejects malformed or dangerous structures before importing', () => {
 assert.deepEqual(parseCsv('TYPE;CONTENT\n"task";"café 🌿"'), [['TYPE','CONTENT'],['task','café 🌿']]);
 for(const invalid of ['TYPE,CONTENT\ntask,"unclosed', 'TYPE,CONTENT,INDENT\ntask,Orphan,2', 'TYPE,CONTENT\nunknown,Task', 'hello,world', 'TYPE,CONTENT,TYPE\ntask,Task,task']) assert.throws(() => previewTodoist(invalid, 'Invalid'));
 assert.throws(() => parseCsv('x'.repeat(5_000_001)));
});
test('Todoist export scopes project, excludes completed tasks and rejects unsupported nesting', () => {
 const m = new TaskModel(); const project = m.addProject({ title: 'Project' }); const id = m.addTask({ title: 'Active', position: { type: 'firstElement', parentId: project } }); const done = m.addTask({ title: 'Done', position: { type: 'afterElement', previousElementId: id } }); m.updateTask(done, { status: 'completed' }); m.addTask({ title: 'Inbox task' });
 const result = exportTodoist(m.toJSON(), project); assert.equal(result.tasks, 1); assert.match(result.warnings.join(), /completed/); assert.ok(!result.csv.includes('Inbox task'));
 let parent = id; for(let i = 0; i < 4; i++) parent = m.addTask({ title: `Level ${i}`, position: { type: 'firstElement', parentId: parent } }); assert.throws(() => exportTodoist(m.toJSON(), project), /four indentation/);
});
test('authenticated sync encryption rejects wrong passphrase, tampering and foreign documents', async () => {
 const encrypted = await sealSnapshot('private snapshot', 'long passphrase 123'); assert.equal(await openSnapshot(encrypted, 'long passphrase 123'), 'private snapshot');
 await assert.rejects(openSnapshot(encrypted, 'wrong passphrase')); const tampered = JSON.parse(encrypted); tampered.data = tampered.data.slice(0, -4) + 'AAAA'; await assert.rejects(openSnapshot(JSON.stringify(tampered), 'long passphrase 123')); await assert.rejects(openSnapshot('{"tasks":[]}', 'long passphrase 123'));
});
const config = (type: 'webdav'|'dropbox') => ({ id: 'test', type, entrypoint: 'https://dav.example/root', authToken: 'token', username: 'user', folder: 'Still', passphrase: 'long passphrase 123' });
function fakeDav() {
 const files = new Map<string, string>(); const calls: SyncRequest[] = [];
 const request: SyncRequester = async req => { calls.push(req); const name = new URL(req.url).pathname.split('/').pop()!;
  if(req.method === 'PROPFIND') return { status: 207, body: '<d:multistatus xmlns:d="DAV:">' + [...files.keys(), 'data.json', '../foreign.hbTask'].map(key => `<d:response><d:href>/root/Still/${key}</d:href></d:response>`).join('') + '</d:multistatus>' };
  if(req.method === 'PUT') { files.set(name, req.body!); return { status: 201, body: '' }; }
  if(req.method === 'GET') return { status: files.has(name) ? 200 : 404, body: files.get(name) || '' };
  if(req.method === 'DELETE') { files.delete(name); return { status: 204, body: '' }; }
  throw new Error(req.method);
 }; return { files, calls, request };
}
test('WebDAV reads/writes encrypted Still-only filenames and rejects path traversal', async () => {
 const fake = fakeDav(); const storage = new ProviderStorage(config('webdav'), fake.request); const key = await storage.save('snapshot'); assert.equal(fake.files.size, 1); assert.ok(!fake.files.get(key)!.includes('snapshot')); assert.deepEqual(await storage.list(), [key]); assert.equal(await storage.read(key), 'snapshot'); await storage.delete(key); assert.equal(fake.files.size, 0); await assert.rejects(storage.read('../data.json')); assert.equal(fake.calls[0].headers['If-None-Match'], '*');
});
test('WebDAV transport converges two independent Still CRDT replicas', async () => {
 const fake = fakeDav(); const leftStorage = new ProviderStorage(config('webdav'), fake.request); const rightStorage = new ProviderStorage(config('webdav'), fake.request);
 const a = new TaskModel(); a.setPeerId('501'); a.addTask({ title: 'Laptop task' }); const b = new TaskModel(); b.setPeerId('502'); b.addTask({ title: 'Phone task' });
 const sync = async (model: TaskModel, storage: ProviderStorage) => { const keys = await storage.list(); const merged = new TaskModel(); merged.import([model.export(), ...await Promise.all(keys.map(async key => decodeBase64(await storage.read(key)).buffer))]); const key = await storage.save(encodeBase64(ByteBuffer.wrap(merged.export()))); model.import([merged.export()]); for(const previous of keys) if(previous !== key) await storage.delete(previous); };
 await sync(a, leftStorage); await sync(b, rightStorage); await sync(a, leftStorage); assert.equal(a.toJSON().taskList.length, 2); assert.equal(b.toJSON().taskList.length, 2); assert.equal(fake.files.size, 1);
});
test('Dropbox honors pagination, upload no-overwrite mode and foreign-file isolation', async () => {
 const keys = ['still-v1-11111111-1111-4111-8111-111111111111.hbSync', 'still-v1-22222222-2222-4222-8222-222222222222.hbSync']; const calls: SyncRequest[] = []; let uploaded = '';
 const request: SyncRequester = async req => { calls.push(req); const endpoint = req.url.split('/files/')[1]; if(endpoint === 'list_folder') return { status: 200, body: JSON.stringify({ entries: [{ '.tag': 'file', name: keys[0] }, { '.tag': 'file', name: 'data.json' }], has_more: true, cursor: 'next' }) }; if(endpoint === 'list_folder/continue') return { status: 200, body: JSON.stringify({ entries: [{ '.tag': 'file', name: keys[1] }], has_more: false }) }; if(endpoint === 'upload') { uploaded = req.body!; assert.equal(JSON.parse(req.headers['Dropbox-API-Arg']).mode, 'add'); return { status: 200, body: '{}' }; } if(endpoint === 'download') return { status: 200, body: uploaded }; if(endpoint === 'delete_v2') return { status: 200, body: '{}' }; throw new Error(endpoint); };
 const storage = new ProviderStorage(config('dropbox'), request); assert.deepEqual(await storage.list(), keys); const key = await storage.save('Dropbox snapshot'); assert.equal(await storage.read(key), 'Dropbox snapshot'); await storage.delete(key); assert.ok(calls.every(call => call.headers.Authorization === 'Bearer token'));
});
test('provider failures are surfaced without returning an empty remote database', async () => {
 for(const status of [401,403,429,500]) { const storage = new ProviderStorage(config('webdav'), async () => ({ status, body: '' })); await assert.rejects(storage.list(), new RegExp(String(status))); await assert.rejects(storage.save('snapshot')); }
 assert.throws(() => new ProviderStorage({ ...config('webdav'), entrypoint: 'http://insecure.example' })); assert.throws(() => new ProviderStorage({ ...config('dropbox'), folder: '../Mindwtr' }));
});
