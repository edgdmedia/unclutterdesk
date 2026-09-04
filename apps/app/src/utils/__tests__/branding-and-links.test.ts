import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Product name and dead links, checked across every app.
 *
 * The product is Unclutter Desk. "unclutterOS" and "Unclutter OS" survived in
 * the auth shell, both platform admin screens, the invite page, the login
 * footer — which also claimed an "Inc." that does not exist — the legal pages,
 * and inside every calendar invite sent to a client.
 *
 * This scans the source rather than a list of known files, so a new screen
 * cannot quietly reintroduce either.
 */
const APPS = resolve(__dirname, '../../../..');
const SOURCE_DIRS = ['app/src', 'landing/src', 'api/src'];
const CODE = /\.(ts|tsx|astro|js|jsx)$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (CODE.test(entry) && !entry.includes('.spec.') && !entry.includes('.test.')) {
      out.push(path);
    }
  }
  return out;
}

const ALL_SOURCE = SOURCE_DIRS.flatMap((d) => sourceFiles(resolve(APPS, d)));

function offenders(pattern: RegExp): string[] {
  return ALL_SOURCE.filter((file) => pattern.test(readFileSync(file, 'utf8'))).map((file) =>
    file.slice(APPS.length + 1),
  );
}

describe('the product has one name', () => {
  test('it found real files to scan', () => {
    // A broken walk would make every assertion below pass vacuously.
    expect(ALL_SOURCE.length).toBeGreaterThan(100);
  });

  test('no source ships the old name', () => {
    expect(offenders(/unclutterOS|Unclutter OS/)).toEqual([]);
  });

  // Went into clients' calendars, where it outlives the booking.
  test('no source ships the old domain', () => {
    expect(offenders(/unclutter\.os/)).toEqual([]);
  });

  test('no source claims a company that does not exist', () => {
    expect(offenders(/Unclutter\s*(Desk|OS)\s*Inc\.?/)).toEqual([]);
  });
});

describe('links go somewhere', () => {
  test('the landing footer has no placeholder anchors', () => {
    const landing = readFileSync(
      resolve(APPS, 'landing/src/components/LandingPage.tsx'),
      'utf8',
    );
    expect(landing).not.toContain('href="#"');
  });
});
