import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MAX_SOCIAL_LINKS, describeSocialLink, normaliseSocialLinks, readSocialLinks } from './social-links';

describe('social links', () => {
  it('works out the platform from the address, and calls anything else a website', () => {
    expect(describeSocialLink('https://www.instagram.com/folake').platform).toBe('instagram');
    expect(describeSocialLink('https://ng.linkedin.com/in/folake').label).toBe('LinkedIn');
    expect(describeSocialLink('https://twitter.com/folake').platform).toBe('x');
    expect(describeSocialLink('https://wa.me/2348000000000').platform).toBe('whatsapp');
    expect(describeSocialLink('https://folake.substack.com/').platform).toBe('substack');
    expect(describeSocialLink('https://notinstagram.com/x').platform).toBe('website');
    expect(describeSocialLink('https://folakecounselling.ng/').label).toBe('Website');
  });

  it('accepts a list of https links, dropping blanks and duplicates', () => {
    expect(normaliseSocialLinks(['https://instagram.com/a', '  ', 'https://instagram.com/a', 'https://example.org'])).toEqual([
      'https://instagram.com/a',
      'https://example.org/',
    ]);
    expect(normaliseSocialLinks([])).toBeNull();
    expect(normaliseSocialLinks(null)).toBeNull();
  });

  it('refuses non-https, credentials, bare words, objects and too many links', () => {
    for (const bad of [['http://example.org'], ['javascript:alert(1)'], ['https://u:p@example.org'], ['https://localhost'], ['folake'], [42]]) {
      expect(() => normaliseSocialLinks(bad)).toThrow(BadRequestException);
    }
    expect(() => normaliseSocialLinks({ instagram: 'https://instagram.com/a' })).toThrow(BadRequestException);
    const many = Array.from({ length: MAX_SOCIAL_LINKS + 1 }, (_, i) => `https://example.org/${i}`);
    expect(() => normaliseSocialLinks(many)).toThrow(/up to 8/);
  });

  it('reads both the list form and the older keyed form, skipping anything unsafe', () => {
    expect(readSocialLinks(['https://example.org/', 'http://bad.example', 'javascript:x'])).toEqual(['https://example.org/']);
    expect(readSocialLinks({ instagram: 'https://instagram.com/a', website: 'https://example.org/' })).toEqual([
      'https://example.org/',
      'https://instagram.com/a',
    ]);
    expect(readSocialLinks(null)).toEqual([]);
    expect(readSocialLinks('nope')).toEqual([]);
  });
});

describe('the editor copy of the platform list', () => {
  it('matches this one, so the label while typing is the label shown publicly', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { SOCIAL_PLATFORMS } = await import('./social-links');
    const app = readFileSync(resolve(__dirname, '../../../../app/src/pages/practice/profile/socialPlatform.ts'), 'utf8');
    const listed = [...app.matchAll(/\{ platform: '([^']+)', label: '([^']+)', hosts: \[([^\]]*)\] \}/g)].map((m) => ({
      platform: m[1],
      label: m[2],
      hosts: [...m[3].matchAll(/'([^']+)'/g)].map((h) => h[1]),
    }));
    expect(listed).toEqual(SOCIAL_PLATFORMS.map((p) => ({ platform: p.platform, label: p.label, hosts: [...p.hosts] })));
  });
});
