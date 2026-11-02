import { describe, expect, it } from 'vitest';
import { profileTag, purgeTags, secretMatches } from '../purge';

describe('cache purge (§6.12)', () => {
  it('tags one profile per page', () => expect(profileTag('ada')).toBe('profile:ada'));

  it('accepts only our own tags, up to 30', () => {
    expect(purgeTags({ tags: ['profile:ada', 'sitemap'] })).toEqual(['profile:ada', 'sitemap']);
    for (const bad of [null, {}, { tags: [] }, { tags: ['everything'] }, { tags: ['profile:../x'] }, { tags: Array(31).fill('sitemap') }]) {
      expect(purgeTags(bad)).toBeNull();
    }
  });

  it('compares the shared secret exactly', () => {
    expect(secretMatches('s3cret-value', 's3cret-value')).toBe(true);
    expect(secretMatches('s3cret-valuX', 's3cret-value')).toBe(false);
    expect(secretMatches('s3cret', 's3cret-value')).toBe(false);
    expect(secretMatches(null, 's3cret-value')).toBe(false);
    expect(secretMatches('anything', undefined)).toBe(false);
  });
});
