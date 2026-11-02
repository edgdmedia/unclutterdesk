import { describe, it, expect } from 'vitest';
import { safeEqual } from './timing-safe';

describe('safeEqual', () => {
  it('returns true for equal strings', () => {
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false for unequal strings', () => {
    expect(safeEqual('a', 'b')).toBe(false);
    expect(safeEqual('secret', 'Secret')).toBe(false);
  });

  it('returns false for empty strings', () => {
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
    expect(safeEqual('a', '')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(safeEqual(['a'], 'a')).toBe(false);
    expect(safeEqual('a', ['a'])).toBe(false);
    expect(safeEqual(null, 'a')).toBe(false);
    expect(safeEqual('a', null)).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(safeEqual('a', 'ab')).toBe(false);
    expect(safeEqual('ab', 'a')).toBe(false);
  });

  it('returns false for non-ASCII strings with same character count but different byte length', () => {
    // 'é' is 2 bytes in UTF-8, 'e' is 1 byte
    // Comparing character count would pass the length check and crash
    expect(safeEqual('é', 'e')).toBe(false);
    expect(safeEqual('é', 'é')).toBe(true);
  });
});