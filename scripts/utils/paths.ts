import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveRoot(...segments: string[]): string {
  return path.resolve(__dirname, '..', '..', ...segments);
}
