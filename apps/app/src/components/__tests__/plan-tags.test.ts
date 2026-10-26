import { describe, expect, it } from 'vitest';
import { missingPlanFor } from '../shell/practiceNav';
import { summary } from '../../test/entitlementSummary';

// Tags come from the entitlements response: which features the plan has, and
// which plan includes the rest. No plan names are compared in the app.
describe('missingPlanFor', () => {
  it('names the plan that includes a missing feature', () => {
    expect(missingPlanFor('customDomain', summary())).toBe('Pro');
    expect(missingPlanFor('staff', summary())).toBe('Pro');
    expect(missingPlanFor('therapists', summary({ staffInviteRoles: ['ADMIN', 'RECEPTIONIST'] }))).toBe('Clinic');
  });

  it('tags nothing the plan includes', () => {
    expect(missingPlanFor('customDomain', summary({ customDomain: true }))).toBeUndefined();
    expect(missingPlanFor('staff', summary({ staffInviteRoles: ['ADMIN'] }))).toBeUndefined();
  });

  it('tags nothing while the plan is unknown, or for an ungated entry', () => {
    expect(missingPlanFor('customDomain', null)).toBeUndefined();
    expect(missingPlanFor(undefined, summary())).toBeUndefined();
  });
});
