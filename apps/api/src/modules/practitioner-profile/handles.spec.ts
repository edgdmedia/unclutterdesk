import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDLE_PATTERN, RESERVED_HANDLES, handleProblem, normalizeHandle, suggestHandle } from './handles';

describe('profile handles (§6.2)', () => {
  it.each(['ada', 'adaeze-okonkwo', 'dr-a1', 'a'.repeat(30)])('accepts %s', (h) => {
    expect(handleProblem(h)).toBeNull();
  });

  it.each(['ab', 'a'.repeat(31), 'Ada', '-ada', 'ada-', 'ada_o', 'ada o', 'adá'])('rejects the format of %s', (h) => {
    expect(handleProblem(h)).toBe('format');
  });

  it.each(['admin', 'api', 'pricing', 'login', 'directory', 'clinic', 'for-clinics', 'www', 'demo', 'robots.txt'])(
    'reserves %s',
    (h) => expect(RESERVED_HANDLES.has(h)).toBe(true),
  );

  it('reports reserved names as reserved, not as a format problem', () => {
    expect(handleProblem('pricing')).toBe('reserved');
  });

  it('normalises only case and spacing, so the check can say what is wrong', () => {
    expect(normalizeHandle('  Ada-O ')).toBe('ada-o');
  });

  it('matches the database check in the migration', () => {
    // Same expression as "PractitionerProfile_handle_format".
    expect(HANDLE_PATTERN.source).toBe('^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
  });

  describe('suggestions', () => {
    it.each([
      ['Dr. Adaeze Okonkwo', 'adaeze-okonkwo'],
      ['Prof Dr Chinedu Eze', 'chinedu-eze'],
      ['Ngozi  Ọkafor', 'ngozi-okafor'],
      ['Al', 'al-therapy'],
      ['!!!', 'therapist'],
      ['A very long name that goes on and on and on', 'a-very-long-name-that-goes-on'],
    ])('suggests %s -> %s', (name, handle) => {
      expect(suggestHandle(name)).toBe(handle);
      expect(HANDLE_PATTERN.test(handle)).toBe(true);
    });
  });

  it('reserves every page the marketing site serves, so a handle never shadows one', () => {
    // Landing and profiles share one domain after the move (§4.1b).
    const pages = resolve(__dirname, '../../../../landing/src/pages');
    const paths = readdirSync(pages)
      .map((f) => f.replace(/\.(astro|ts|md|mdx)$/, ''))
      .filter((p) => p !== 'index' && p !== '404' && !p.startsWith('['));
    const unreserved = paths.filter((p) => !RESERVED_HANDLES.has(p));
    expect(unreserved).toEqual([]);
  });
});
