import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright') : await import('playwright');
const port = process.env.STILL_TEST_PORT || '33617';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { stdio: 'pipe' });
let serverLog = ''; server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
const results = [], errors = [];
let browser;
const passed = name => { results.push({ name, passed: true }); console.log('PASS', name); };
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ headless: true,
    ...(process.env.STILL_CHROMIUM_PATH ? { executablePath: process.env.STILL_CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--no-zygote'] } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(12000);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.getByPlaceholder('Add Task').waitFor();
  assert.equal(await page.title(), 'Still');
  const add = async title => { await page.getByPlaceholder('Add Task').fill(title); await page.getByPlaceholder('Add Task').press('Enter'); await page.getByTestId('task-list-item').filter({ hasText: title }).waitFor(); await page.waitForTimeout(150); };
  for (const title of ['Choose one thing that matters', 'Give the workspace a little room', 'Plan a quieter week']) await add(title);
  passed('Desktop task creation through real composer');
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(1000); console.log('RELOAD', await page.locator('body').innerText(), 'ERRORS', errors); await page.getByTestId('task-list-item').filter({ hasText: 'Plan a quieter week' }).waitFor();
  passed('IndexedDB persistence across reload');
  const row = page.getByTestId('task-list-item').filter({ hasText: 'Plan a quieter week' });
  await row.click();
  const textareas = await page.locator('textarea').count();
  assert.ok(textareas >= 1, 'Real task detail editor opens');
  passed('Desktop task detail opens');
  await page.getByRole('button', { name: 'Search tasks and commands' }).click();
  await page.locator('[data-test-id="command-palette-input"]').fill('quieter');
  await page.locator('[data-test-id="command-palette-result-item"]').first().waitFor();
  await page.keyboard.press('Escape'); passed('Command palette searches actual tasks');
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  assert.equal(await page.getByRole('button', { name: 'Toggle sidebar' }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Toggle sidebar' }).click(); passed('Sidebar collapses and restores');
  await fs.mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/still-desktop.png' });
  await page.goto(base + '/desktop/settings/appearance');
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  await page.getByRole('button', { name: 'Clay', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Clay', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-density'), 'compact');
  assert.equal(await page.locator('html').getAttribute('data-accent'), 'clay');
  await page.getByRole('button', { name: 'Comfortable', exact: true }).click();
  await page.getByRole('button', { name: 'Sage', exact: true }).click(); passed('Appearance preferences persist safely');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.goto(base + '/desktop/inbox'); await page.getByPlaceholder('Add Task').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: 'screenshots/still-desktop-dark.png' }); passed('Dark theme');
  await page.evaluate(() => localStorage.setItem('theme', 'light')); await page.reload();
  await page.getByPlaceholder('Add Task').waitFor();
  await page.getByTestId('task-list-item').filter({ hasText: 'Give the workspace' }).getByTestId('task-item-status-box').click();
  await page.getByRole('link', { name: 'Completed', exact: true }).click();
  await page.getByText('Give the workspace a little room', { exact: true }).waitFor(); passed('Task completion and completed view');
  const mobile = await context.newPage(); await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(base + '/home'); await mobile.getByRole('navigation', { name: 'Main navigation' }).waitFor();
  const nav = mobile.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('button', { name: 'Inbox', exact: true }).click();
  await mobile.getByTestId('task-item').filter({ hasText: 'Choose one thing' }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.screenshot({ path: 'screenshots/still-mobile.png' });
  passed('Mobile navigation, shared real tasks and no horizontal overflow');
  await mobile.getByTestId('mobile-home-create-task-button').click();
  const mobileTitle = mobile.getByTestId('edit-task-title-input'); await mobileTitle.waitFor();
  await mobileTitle.fill('A little space for tomorrow'); await mobileTitle.blur();
  await nav.getByRole('button', { name: 'Today', exact: true }).click();
  await nav.getByRole('button', { name: 'Inbox', exact: true }).click();
  await mobile.getByText('A little space for tomorrow', { exact: true }).first().waitFor();
  await mobile.reload(); await mobile.getByText('A little space for tomorrow', { exact: true }).first().waitFor();
  passed('Mobile inline task creation and persistence');
  await mobile.screenshot({ path: 'screenshots/still-mobile.png' });
  await mobile.setViewportSize({ width: 768, height: 1024 });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); passed('Tablet width has no horizontal overflow');
  // Loaded web app continues accepting changes without a network connection; not a first-load offline PWA claim.
  await context.setOffline(true); await mobile.getByTestId('mobile-home-create-task-button').click();
  await mobile.getByTestId('edit-task-title-input').fill('Captured offline'); await mobile.getByTestId('edit-task-title-input').blur();
  await nav.getByRole('button', { name: 'Today', exact: true }).click(); await nav.getByRole('button', { name: 'Inbox', exact: true }).click();
  await mobile.getByText('Captured offline', { exact: true }).first().waitFor(); passed('Offline in-session task creation');
  assert.deepEqual(errors, []); passed('No uncaught browser exceptions');
} catch (error) { results.push({ name: 'Browser verification', passed: false, error: String(error), serverLog }); console.error(error); process.exitCode = 1; }
finally { await fs.mkdir('verification', { recursive: true }); await fs.writeFile('verification/ui-results.json', JSON.stringify({ results, errors }, null, 2)); await browser?.close(); server.kill(); }
