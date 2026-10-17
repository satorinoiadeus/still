import { _electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const application = await _electron.launch({ executablePath: process.argv[2], timeout: 60000 });
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
  await fs.mkdir('verification', { recursive: true });
  await page.screenshot({ path: 'verification/windows-installed.png' });
  await fs.writeFile('verification/windows-results.json', JSON.stringify({ installedLaunch: true, taskCreate: true, nativePersistenceAcrossReload: true }, null, 2));
  console.log('PASS installed Windows app launches, creates tasks and persists across reload');
} finally { await application.close(); }
