import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveRoot } from './paths';

export async function createTempBuildDir(version?: string | null): Promise<string> {
  const tempDirBase = await fs.realpath(os.tmpdir());
  const tempDir = await fs.mkdtemp(path.join(tempDirBase, 'tasks-build-'));

  const webDistSource = resolveRoot('dist');
  await fs.cp(webDistSource, path.join(tempDir, 'frontend'), { recursive: true, dereference: true });

  const electronDistSource = resolveRoot('electron-dist');
  await fs.cp(electronDistSource, tempDir, {
    recursive: true,
    dereference: true,
  });
  await fs.writeFile(path.join(tempDir, '.npmrc'), 'registry=https://registry.npmjs.org/');
  // Create minimal package.json with electron dependency
  const originalPackage = JSON.parse(await fs.readFile(resolveRoot('package.json'), 'utf-8'));
  const minimalPackage = {
    name: originalPackage.name,
    version: version || originalPackage.version,
    main: 'main.js',
    type: 'module',
    description: 'Still — a little space for your next action',
    author: 'Still contributors',
    devDependencies: {
      electron: originalPackage.devDependencies.electron,
    },
  };

  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(minimalPackage, null, 2));

  // The Electron bundle has no external runtime npm dependencies: only Electron
  // and Node built-ins are externalized by buildElectron. electron-builder owns
  // runtime packaging; a second npm install here is redundant and breaks npm.cmd
  // spawning on Windows.
  return tempDir;
}
