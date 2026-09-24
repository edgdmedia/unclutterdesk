import { describe, expect, it } from 'vitest';
import { cardPadding } from '@unclutterdesk/ui';

/*
 * Card applies padding as an inline style. Pages pass Tailwind-style values,
 * which are not CSS, so those cards rendered with no padding at all.
 */
describe('Card padding', () => {
  it.each([
    ['p-[22px]', '22px'],
    ['p-[24px_26px]', '24px 26px'],
    ['p-[16px_18px]', '16px 18px'],
    ['p-4', '16px'],
    ['p-0', '0px'],
    ['sm', '18px 20px'],
    ['lg', '24px 26px'],
    [12, 12],
  ])('%s becomes %s', (input, css) => {
    expect(cardPadding(input)).toBe(css);
  });

  it('never hands the browser a class name as CSS', () => {
    for (const value of ['p-[22px]', 'p-[24px_26px]', 'p-4']) {
      expect(String(cardPadding(value))).not.toMatch(/^p-/);
    }
  });
});
