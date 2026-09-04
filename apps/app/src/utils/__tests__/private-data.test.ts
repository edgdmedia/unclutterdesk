import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * No invented people, practices or records on the pages real users see.
 *
 * The app shipped a notifications page listing a named client, a PHQ-9 score of
 * 14 and a ₦450,000 settlement — all fabricated, rendered inside whichever
 * practice was signed in. An account page seeded the email field with a
 * stranger's address. Several avatars painted a fixed "JS" beside a real,
 * API-supplied name. None of this is a placeholder a user can tell apart from
 * their own data, and a therapist could act on it.
 *
 * This scans the source rather than checking one file against a fixed list of
 * names, so the next page cannot quietly reintroduce the same thing.
 */
const SRC = resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'test' || entry === 'node_modules') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: path.slice(SRC.length + 1),
  src: readFileSync(path, 'utf8'),
}));

/**
 * What a user could actually read on screen.
 *
 * Comments are stripped because the note explaining what was removed from a
 * page necessarily quotes it, and `placeholder="..."` is a greyed hint that
 * clears on typing rather than shipped data.
 */
function renderedText(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/placeholder=(?:"[^"]*"|\{[^}]*\})/g, '');
}

describe('private app data policy', () => {
  test('finds the pages, so the checks below cannot pass vacuously', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  test('ships no demo records or demo fallback data', () => {
    const app = FILES.find((f) => f.path === 'App.tsx')!.src;
    for (const banned of [
      'FALLBACK_CLIENTS',
      'FALLBACK_SESSIONS',
      'FALLBACK_STAFF',
      'fallbackData:',
    ]) {
      expect(app, `App.tsx still carries ${banned}`).not.toContain(banned);
    }
  });

  test('names no invented practice or practitioner outside a placeholder', () => {
    // Identities that were shipped as real content at some point.
    const invented = [
      'Smith Therapy',
      'Jane Smith',
      'smiththerapy',
      'okonkwotherapy',
      'Adaeze Okonkwo',
      'Okonkwo Therapy',
      'Tunde Bello',
      'Adaeze Okonkwo',
    ];
    const offenders: string[] = [];

    for (const { path, src } of FILES) {
      const body = renderedText(src);
      for (const name of invented) {
        if (body.includes(name)) offenders.push(`${path}: ${name}`);
      }
    }

    expect(
      offenders,
      'These name an invented practice or person as content a user would read ' +
        'as their own data. Placeholders are exempt; rendered text is not.\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  test('paints no fixed initials into an avatar beside a real name', () => {
    // "JS" sat in the badge next to {booking.therapistName} and {brand.name},
    // so every practitioner in the product wore the same stranger's initials.
    const offenders: string[] = [];
    for (const { path, src } of FILES) {
      // A two-capital string alone in a JSX text node.
      const matches = src.match(/>\s*(JS|ST|AO|JD|AB)\s*</g);
      if (matches) offenders.push(`${path}: ${matches.join(', ').trim()}`);
    }
    expect(
      offenders,
      'Derive initials from the name being displayed (see utils/initials.ts).\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  test('invents no clinical scores or settlement amounts', () => {
    // A PHQ-9 score and a ₦450,000 settlement were hardcoded into the
    // notifications feed. A clinician cannot tell an invented score from a real
    // one, and may act on it.
    const offenders: string[] = [];
    for (const { path, src } of FILES) {
      const body = renderedText(src);
      if (/(PHQ-9|GAD-7)\s*score\s*\d/i.test(body)) offenders.push(`${path}: hardcoded screening score`);
      if (/₦450,000|₦[\d,]+ deposited/.test(body)) offenders.push(`${path}: hardcoded settlement`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  test('the notifications feed is read from the API, not from a literal array', () => {
    // Matched on file name, not path: pages are grouped by audience and a page
    // moving between those folders should not break a policy check about it.
    const page = FILES.find((f) => f.path.endsWith('/NotificationsPage.tsx'));
    expect(page, 'NotificationsPage.tsx not found — was it renamed?').toBeDefined();
    expect(page!.src).toContain('/v1/notifications');
  });
});
