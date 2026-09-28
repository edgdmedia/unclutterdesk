import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The layout rules from the responsive spec. Pages fill the space the shell
 * gives them; they do not set their own width, and they lay out columns through
 * Grid so there is always a narrow fallback.
 *
 * Pages listed in MIGRATED must follow the rules now. Every other page is
 * reported (not failed) until its PR moves it onto the shared components.
 */
const SRC = resolve(__dirname, '..');
const PAGES = join(SRC, 'pages');

const MIGRATED = [
  'pages/practice/ClientDetailPage.tsx',
  'pages/practice/AnalyticsPage.tsx',
  'pages/practice/DashboardPage.tsx',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** Every rule a file breaks, as "rule: evidence". */
export function violations(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/(?<![\w:-])(min|max)-w-\[(\d{3,4})px\]/g)) {
    // Page wrappers were all 1040px+; inner reading widths such as a 720px note card are fine.
    if (Number(m[2]) >= 900) found.push(`sets its own width: ${m[0]}`);
  }
  for (const m of source.matchAll(/(?<![\w:-])max-w-(?:[4-7]xl|screen-\w+)/g)) found.push(`sets its own width: ${m[0]}`);
  for (const m of source.matchAll(/(?<![\w:/\]-])grid-cols-([2-9]|1[0-2])(?![\w-])/g)) found.push(`bare multi-column grid: ${m[0]}`);
  for (const m of source.matchAll(/(?<![\w:/\]-])grid-cols-\[([^\]]+)\]/g)) {
    const widest = Math.max(0, ...m[1].split('_').map((t) => Number(/^(\d+)px$/.exec(t)?.[1] ?? 0)));
    if (widest >= 200) found.push(`fixed-width column with no narrow fallback: ${m[0]}`);
  }
  for (const m of source.matchAll(/<(table|aside)\b/g)) found.push(`builds its own ${m[1]}`);
  return found;
}

describe('layout rules', () => {
  it('recognises what it should', () => {
    expect(violations('<div className="flex-1 min-w-[1192px]">')).toEqual(['sets its own width: min-w-[1192px]']);
    expect(violations('<div className="max-w-[1200px] mx-auto">')).toHaveLength(1);
    expect(violations('<div className="max-w-[720px]">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-4 gap-3">')).toEqual(['bare multi-column grid: grid-cols-4']);
    expect(violations('<div className="grid grid-cols-1 lg:grid-cols-4">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-1 @min-[960px]/page:grid-cols-[1fr_300px]">')).toEqual([]);
    expect(violations('<div className="grid grid-cols-[1fr_300px]">')).toHaveLength(1);
    expect(violations('<div className="grid grid-cols-[96px_24px_1fr]">')).toEqual([]);
    expect(violations('<table>')).toEqual(['builds its own table']);
  });

  const all = files(PAGES).map((path) => ({ file: relative(SRC, path), problems: violations(readFileSync(path, 'utf8')) }));

  it.each(MIGRATED)('%s follows the layout rules', (file) => {
    const entry = all.find((e) => e.file === file);
    expect(entry, `${file} not found`).toBeTruthy();
    expect(entry!.problems).toEqual([]);
  });

  it('reports the pages not yet moved over', () => {
    const pending = all.filter((e) => !MIGRATED.includes(e.file) && e.problems.length > 0);
    if (pending.length) {
      console.info(`Layout rules: ${pending.length} page(s) still to migrate:\n${pending.map((e) => `  ${e.file}: ${e.problems.length}`).join('\n')}`);
    }
    expect(true).toBe(true);
  });
});

describe('tests use the real app', () => {
  it('no test replaces the shared design system with fakes', () => {
    const testFiles = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.test\.tsx?$/.test(name) ? [path] : [];
      });
    })(SRC);
    const offenders = testFiles
      .filter((f) => /vi\.mock\(\s*['"]@unclutterdesk\/ui['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
