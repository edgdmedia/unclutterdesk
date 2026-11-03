import { describe, expect, it } from 'vitest';
import { emailSignature } from '../emailSignature';

const base = { name: 'Ada Obi', kindLabel: 'Counsellor', url: 'https://therapysts.com/ada-obi' };

describe('emailSignature', () => {
  it('escapes every value', () => {
    const html = emailSignature({
      name: '<script>alert(1)</script> & "Co"',
      kindLabel: "Owner's <b>",
      url: 'https://therapysts.com/a?b=1&c=2',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
  });

  it('links only https urls', () => {
    expect(emailSignature(base)).toContain('href="https://therapysts.com/ada-obi"');
    const javascript = emailSignature({ ...base, url: 'javascript:alert(1)' });
    expect(javascript).not.toContain('href=');
    const http = emailSignature({ ...base, url: 'http://therapysts.com/ada-obi' });
    expect(http).not.toContain('href=');
  });

  it('uses inline styles only, because email clients drop a style block', () => {
    const html = emailSignature(base);
    expect(html).not.toContain('<style');
    expect(html).toMatch(/style="/);
  });
});