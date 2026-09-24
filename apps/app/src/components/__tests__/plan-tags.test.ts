import { describe, expect, it } from 'vitest';
import { planIncludes } from '../Sidebar';

// The sidebar tags only features outside the practice's plan.
describe('planIncludes', () => {
  it.each([
    ['starter', 'pro', false],
    ['starter', 'clinic', false],
    ['pro', 'pro', true],
    ['pro', 'clinic', false],
    ['clinic', 'pro', true],
    ['clinic', 'clinic', true],
    ['PRO', 'pro', true],
    [undefined, 'pro', false],
  ])('a %s practice has %s features: %s', (plan, tier, expected) => {
    expect(planIncludes(plan as string | undefined, tier)).toBe(expected);
  });
});
