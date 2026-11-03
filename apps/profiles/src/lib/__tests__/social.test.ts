import { describe, expect, it } from 'vitest';
import { socialItems } from '../profiles';
import { safeHttpsUrl } from '../security';

describe('socialItems', () => {
  it('renders the list form, labelling websites by their domain and dropping anything unsafe', () => {
    expect(
      socialItems(
        [
          { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/folake' },
          { platform: 'website', label: 'Website', url: 'https://www.folake.ng/' },
          { platform: 'website', label: 'Website', url: 'javascript:alert(1)' },
        ],
        safeHttpsUrl,
      ),
    ).toEqual([
      { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/folake' },
      { platform: 'website', label: 'folake.ng', url: 'https://www.folake.ng/' },
    ]);
  });

  it('still reads the older keyed form', () => {
    expect(socialItems({ linkedin: 'https://linkedin.com/in/f', x: 'http://x.com/f' }, safeHttpsUrl)).toEqual([
      { platform: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/f' },
    ]);
  });

  it('shows at most 8', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ platform: 'website', label: 'Website', url: `https://e${i}.example/` }));
    expect(socialItems(many, safeHttpsUrl)).toHaveLength(8);
  });
});
