import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Heavy modules load on first use, not at startup (common/lazy-module.ts).
 *
 * Everything imported at the top of a file is loaded before the API can
 * answer /health. On the production server sharp, googleapis, resvg and
 * satori took most of a ~20 s boot, which once made a good deploy fail its
 * health check. A plain `import x from 'sharp'` anywhere would bring that
 * back unnoticed, so only type imports and lazy `import('…')` are allowed.
 */
const HEAVY = ['sharp', 'googleapis', 'satori', '@resvg/resvg-js', 'pdfkit'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('heavy modules stay out of startup', () => {
  it('none is imported for its value at the top of a file', () => {
    const root = join(__dirname);
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      const text = readFileSync(file, 'utf8');
      for (const mod of HEAVY) {
        const quoted = mod.replace(/[/@.-]/g, (c) => `\\${c}`);
        // `import x from 'm'`, `import * as x from 'm'`, `import { a } from 'm'`, `import 'm'`, `require('m')`
        const value = new RegExp(`^\\s*import\\s+(?!type\\b)[^;]*?from\\s+['"]${quoted}['"]|^\\s*import\\s+['"]${quoted}['"]|\\brequire\\(\\s*['"]${quoted}['"]\\s*\\)`, 'm');
        if (value.test(text)) offenders.push(`${relative(root, file)} imports ${mod}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the check itself catches a value import and lets type imports through', () => {
    const value = /^\s*import\s+(?!type\b)[^;]*?from\s+['"]sharp['"]/m;
    expect(value.test(`import sharp from 'sharp';`)).toBe(true);
    expect(value.test(`import * as s from 'sharp';`)).toBe(true);
    expect(value.test(`import type sharpType from 'sharp';`)).toBe(false);
  });
});
