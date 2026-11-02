import { describe, expect, it } from 'vitest';
import { normalizeHost } from './normalize-host';

describe('normalizeHost', () => {
  it('returns the hostname unchanged when no trailing dot', () => {
    expect(normalizeHost('chente.com')).toBe('chente.com');
  });

  it('lowercases the hostname', () => {
    expect(normalizeHost('Chente.COM')).toBe('chente.com');
  });

  it('removes exactly one trailing dot', () => {
    expect(normalizeHost('chente.com.')).toBe('chente.com');
  });

  it('does not remove multiple trailing dots', () => {
    expect(normalizeHost('chente.com..')).toBe('chente.com.');
  });
});