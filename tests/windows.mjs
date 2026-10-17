import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
// Public, test-only localhost certificate. Never used by the application build.
const remoteFiles = new Map();
const server = https.createServer({ key: await fs.readFile('tests/fixtures/sync-localhost-key.pem'), cert: await fs.readFile('tests/fixtures/sync-localhost-cert.pem') }, async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const name = req.url.split('/').pop();
  if(req.method === 'PROPFIND') { res.writeHead(207, { 'Content-Type': 'application/xml' }); return res.end('<d:multistatus xmlns:d="DAV:">' + [...remoteFiles.keys()].map(key => '<d:response><d:href>/root/Still/' + key + '</d:href></d:response>').join('') + '</d:multistatus>'); }
  if(req.method === 'PUT') { remoteFiles.set(name, Buffer.concat(chunks).toString()); res.writeHead(201); return res.end(); }
  if(req.method === 'GET' && remoteFiles.has(name)) return res.end(remoteFiles.get(name));
  if(req.method === 'DELETE') { remoteFiles.delete(name); res.writeHead(204); return res.end(); }
  res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `https://127.0.0.1:${server.address().port}/root`;
const application = await _electron.launch({ executablePath: process.argv[2], timeout: 60000, env: { ...process.env, NODE_EXTRA_CA_CERTS: path.resolve('tests/fixtures/sync-localhost-cert.pem') } });
try {
  const page = await application.firstWindow(); page.setDefaultTimeout(30000);
  await page.getByPlaceholder('Add Task').waitFor();
  assert.equal(await page.title(), 'Still');
  const title = 'Windows installation persistence check';
  await page.getByPlaceholder('Add Task').fill(title);
  await page.getByPlaceholder('Add Task').press('Enter');
  await page.getByTestId('task-list-item').filter({ hasText: title }).waitFor();
  await page.waitForTimeout(500); await page.reload();
  await page.getByTestId('task-list-item').filter({ hasText: title }).waitFor();
  // Electron uses hash routing in packaged builds; navigate with its sidebar link.
  await page.evaluate(() => { location.hash = '/desktop/settings/selfhosted-sync'; });
  const providers = page.getByRole('form', { name: 'Additional sync providers' });
  await providers.getByLabel('HTTPS collection URL').fill(endpoint);
  await providers.getByLabel('Username', { exact: true }).fill('test');
  await providers.getByLabel('App password', { exact: true }).fill('test-password');
  await providers.getByLabel('Encryption passphrase', { exact: true }).fill('native test passphrase 123');
  await providers.getByRole('button', { name: 'Connect and sync' }).click();
  await page.getByText('Connected and synced.', { exact: true }).waitFor();
  assert.equal(remoteFiles.size, 1);
  assert.ok([...remoteFiles.values()].every(value => JSON.parse(value).format === 'still-sync-v1' && !value.includes(title)));
  await fs.mkdir('verification' , { recursive: true });
  await page.screenshot({ path: 'verification/windows-installed.png' });
  await fs.writeFile('verification/windows-results.json', JSON.stringify({ installedLaunch: true, taskCreate: true, nativePersistenceAcrossReload: true, nativeHttpsWebDavEncryptedUpload: true }, null, 2));
  console.log('PASS installed Windows app launches, creates tasks and persists across reload');
} finally { await application.close(); server.close(); }
