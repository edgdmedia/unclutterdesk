import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Every internal link goes to a route that exists, and every button does
 * something.
 *
 * Both failed in ways nobody noticed. The signup consent checkbox linked to
 * /terms-of-service and /privacy-policy, which existed nowhere, so the two
 * documents someone was accepting could not be opened. "Export", "Download
 * report", "Previous", "Next", the notification bell, "Contact practice" and
 * "View settlements" were all buttons with no handler: enabled, clickable,
 * inert.
 *
 * A person cannot see the difference between a control that does nothing and
 * one that failed silently, so this is checked rather than reviewed.
 */
const APP = resolve(__dirname, '../..');
const PAGES = resolve(APP, 'pages');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const PAGE_FILES = sourceFiles(PAGES);
const APP_TSX = readFileSync(resolve(APP, 'App.tsx'), 'utf8');

/** Every path given to a <Route>. */
const ROUTES = [...APP_TSX.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

function routeExists(target: string): boolean {
  const path = target.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return ROUTES.some((route) => {
    if (route === '*') return false;
    const normalised = route.replace(/\/+$/, '') || '/';
    const pattern = new RegExp(
      '^' + normalised.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*') + '$',
    );
    return pattern.test(path);
  });
}

describe('the route table', () => {
  test('was actually found', () => {
    expect(ROUTES.length).toBeGreaterThan(20);
    expect(PAGE_FILES.length).toBeGreaterThan(30);
  });
});

describe('internal links', () => {
  // Router <Link to="/..."> and plain internal hrefs.
  const links: Array<{ file: string; target: string }> = [];
  for (const file of PAGE_FILES) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const m of source.matchAll(/(?:to|href)="(\/[^"]*)"/g)) {
      links.push({ file: file.slice(APP.length + 1), target: m[1] });
    }
  }

  test('there are some to check', () => {
    expect(links.length).toBeGreaterThan(5);
  });

  test('every one resolves to a declared route', () => {
    const broken = links.filter((l) => !routeExists(l.target));
    expect(broken.map((l) => `${l.file} → ${l.target}`)).toEqual([]);
  });
});

describe('buttons', () => {
  /*
   * A <button> has to do something: carry an onClick, submit a form, or be
   * explicitly disabled. Anything else looks live and is not.
   */
  const dead: string[] = [];
  for (const file of PAGE_FILES) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const m of source.matchAll(/<button\b([^>]*?)>/gs)) {
      /*
       * Tailwind writes state into class names, so a className carrying
       * "disabled:opacity-50" would otherwise read as a disabled attribute and
       * wave through the exact dead button this is looking for.
       */
      const attrs = m[1].replace(/className="[^"]*"/g, '').replace(/style=\{[^}]*\}/g, '');
      const acts = /onClick|onMouseDown|onPointerDown|type="submit"|\bdisabled\b/.test(attrs);
      if (!acts) {
        const line = source.slice(0, m.index).split('\n').length;
        dead.push(`${file.slice(APP.length + 1)}:${line}`);
      }
    }
  }

  test('every one acts, submits, or says it is disabled', () => {
    expect(dead).toEqual([]);
  });
});

describe('placeholder links', () => {
  test('no page ships an anchor to nowhere', () => {
    const offenders = PAGE_FILES.filter((file) =>
      /href="#"/.test(stripComments(readFileSync(file, 'utf8'))),
    ).map((f) => f.slice(APP.length + 1));
    expect(offenders).toEqual([]);
  });
});
