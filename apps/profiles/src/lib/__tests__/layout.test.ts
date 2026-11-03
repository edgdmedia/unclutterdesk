import { describe, expect, it } from 'vitest';
import { initialsOf, layoutOf } from '../layout';

describe('layouts (§6.5)', () => {
  it('keeps a known layout and falls back to classic otherwise', () => {
    expect(layoutOf('editorial')).toBe('editorial');
    expect(layoutOf('split')).toBe('split');
    expect(layoutOf('brutalist')).toBe('classic');
    expect(layoutOf(undefined)).toBe('classic');
  });

  it('makes initials from the first and last names, skipping a title', () => {
    expect(initialsOf('Dr. Folake Adeyemi')).toBe('FA');
    expect(initialsOf('Amina Bello')).toBe('AB');
    expect(initialsOf('Chinedu Okwudili Eze')).toBe('CE');
    expect(initialsOf('Halima')).toBe('H');
    expect(initialsOf('  ')).toBe('');
    expect(initialsOf('Dr')).toBe('D');
  });
});
