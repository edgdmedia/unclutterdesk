import { describe, expect, it } from 'vitest';
import { isSafeReturnPath, resolveReturnTo } from './returnTo';

describe('isSafeReturnPath', () => {
  it.each([
    '/portal/sessions/10/recap',
    '/portal/assessments/5',
    '/forms/3',
    '/portal?tab=recap',
  ])('accepts %s', (path) => {
    expect(isSafeReturnPath(path)).toBe(true);
  });

  it.each([
    '//evil.example/portal',
    'https://evil.example/portal',
    'http://evil.example',
    'javascript:alert(1)',
    'portal/sessions',
    '',
    null,
    undefined,
  ])('rejects %s', (path) => {
    expect(isSafeReturnPath(path as string | null | undefined)).toBe(false);
  });
});

describe('resolveReturnTo', () => {
  it('prefers state over search', () => {
    expect(resolveReturnTo('/portal/sessions/10/recap', '/forms/3')).toBe('/portal/sessions/10/recap');
  });

  it('falls back to search when state is missing', () => {
    expect(resolveReturnTo(null, '/portal/assessments/5')).toBe('/portal/assessments/5');
  });

  it('falls back to /portal for unsafe values', () => {
    expect(resolveReturnTo('https://evil.example', '//evil.example')).toBe('/portal');
  });
});