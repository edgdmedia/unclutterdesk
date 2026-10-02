import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

/**
 * Production starts apps/api/dist/src/main.js (ecosystem.config.js, deploy.sh).
 * `nest build` compiles every file under src, specs included, and one import
 * reaching outside apps/api moves the whole output to dist/apps/api/src, so
 * the server would not start after a deploy. Nothing here may import from
 * outside the API's own folder.
 */
const API_ROOT = resolve(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('the API build layout', () => {
  it('no file imports from outside apps/api', () => {
    const outside: string[] = [];
    for (const file of files(join(API_ROOT, 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/(?:from|import\(|require\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const target = resolve(dirname(file), m[1]);
        if (relative(API_ROOT, target).startsWith('..')) outside.push(`${relative(API_ROOT, file)} -> ${m[1]}`);
      }
    }
    expect(outside).toEqual([]);
  });
});
