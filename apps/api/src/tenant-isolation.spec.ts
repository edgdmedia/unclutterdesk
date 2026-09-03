import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A structural guard against the bug that appeared three times in this codebase:
 * a service method accepting `tenantId` and never using it, so the query runs
 * across every practice on the platform.
 *
 *   lockNote(tenantId, noteId)                  -> update({ where: { id } })
 *   adminUpdateTherapistStatus(tenantId, ...)   -> update({ where: { id } })
 *   uploadTherapistAvatar(tenantId, ...)        -> update({ where: { id } })
 *
 * The common cause is Prisma's `update()` requiring a unique `where`, which
 * cannot carry a tenant filter — so the parameter is accepted, the compiler is
 * satisfied, and the scope silently disappears. `updateMany` is the fix.
 *
 * This reads the source rather than exercising behaviour, so it also covers
 * methods nobody has written a unit test for — which is the point, since all
 * three of the above had no tests when they shipped.
 */
const MODULES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'modules');

function serviceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...serviceFiles(path));
    else if (entry.endsWith('.service.ts') && !entry.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

/** Extract `{ name, args, body }` for every async method in a source file. */
function methods(src: string) {
  const found: { name: string; args: string; body: string }[] = [];
  for (const m of src.matchAll(/ {2}(?:private |protected |public )?async (\w+)\(([\s\S]*?)\)\s*(?::[^{]*)?\{/g)) {
    const name = m[1];
    const args = m[2].replace(/\s+/g, ' ');
    // Walk braces from the opening one to find the method body.
    let depth = 0;
    let body = '';
    for (let i = m.index! + m[0].length - 1; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          body = src.slice(m.index! + m[0].length, i);
          break;
        }
      }
    }
    found.push({ name, args, body });
  }
  return found;
}

describe('tenant isolation', () => {
  const files = serviceFiles(MODULES_DIR);

  it('finds the service files to check', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('no service method accepts tenantId without using it', () => {
    const violations: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const { name, args, body } of methods(src)) {
        if (!args.includes('tenantId')) continue;
        if (body.includes('tenantId')) continue;
        violations.push(
          `${file.slice(file.indexOf('modules'))} -> ${name}(${args.slice(0, 60)}…)`,
        );
      }
    }

    expect(
      violations,
      'These methods take a tenant and ignore it, so their queries span every ' +
        'practice. If the row is already located by a tenant-scoped query, pass ' +
        'that scope through anyway — or use updateMany with { id, tenantId }.\n' +
        violations.join('\n'),
    ).toEqual([]);
  });

  // The parser is only useful if it actually sees the methods; a regex that
  // silently matches nothing would make the test above vacuously pass.
  it('parses a meaningful number of methods', () => {
    const total = files.reduce((n, f) => n + methods(readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(50);
  });

  it('detects a violation when one is present', () => {
    const sample = `
      export class ExampleService {
        async safeOne(tenantId: bigint, id: bigint) {
          return this.prisma.thing.findFirst({ where: { id, tenantId } });
        }
        async leaky(tenantId: bigint, id: bigint) {
          return this.prisma.thing.update({ where: { id }, data: {} });
        }
      }
    `;
    const leaks = methods(sample)
      .filter((m) => m.args.includes('tenantId') && !m.body.includes('tenantId'))
      .map((m) => m.name);
    expect(leaks).toEqual(['leaky']);
  });
});
