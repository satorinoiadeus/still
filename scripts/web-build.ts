import { webBuildCommand } from './commands/webBuild';
await webBuildCommand({ useRelativeBase: process.argv.includes('--use-relative-base') });
