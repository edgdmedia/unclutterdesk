import { describe, expect, it, vi } from 'vitest';
import { ConsultService } from '../consult/consult.service';
import { SubscriptionLapseService } from '../billing/subscription-lapse.service';
import { AdminService } from '../admin/admin.service';
import { PracticeClosureService } from '../privacy/practice-closure.service';
import { ConsultModule } from '../consult/consult.module';
import { BillingModule } from '../billing/billing.module';
import { AdminModule } from '../admin/admin.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { PractitionerProfileModule } from './practitioner-profile.module';
import { MembershipEndedService } from './membership-ended.service';

/**
 * §6.14: every existing way a therapist stops being an active member of a
 * practice reaches the one leaving-a-practice handler. The handler itself is
 * covered in membership-ended.service.spec.ts; here each exit is checked to
 * call it, with the right memberships, and only when something changed.
 */
const handler = () => ({
  onMembershipEnded: vi.fn(async () => undefined),
  onPracticeEnded: vi.fn(async () => undefined),
  onMembershipReactivated: vi.fn(async () => undefined),
  onPracticeReactivated: vi.fn(async () => undefined),
});

describe('wiring', () => {
  // The services take the handler as @Optional(), so a module that can't
  // provide it would silently skip §6.14. Each exit's module must import it.
  it.each([
    ['ConsultModule', ConsultModule],
    ['BillingModule', BillingModule],
    ['AdminModule', AdminModule],
    ['PrivacyModule', PrivacyModule],
  ])('%s can inject the leaving-a-practice handler', (_name, mod) => {
    expect(Reflect.getMetadata('imports', mod)).toContain(PractitionerProfileModule);
  });

  it('the profile module exports the handler', () => {
    expect(Reflect.getMetadata('exports', PractitionerProfileModule)).toContain(MembershipEndedService);
  });
});

describe('exit 1: the therapist status toggle', () => {
  const setup = () => {
    const ended = handler();
    const prisma: any = {
      profile: { findFirst: vi.fn().mockResolvedValue({ role: 'OWNER' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      consultTherapistProfile: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const none = {} as any;
    const service = new ConsultService(prisma, none, none, none, none, none, none, undefined, undefined, undefined, ended as any);
    return { service, ended, prisma };
  };

  it('switching a therapist off ends that membership', async () => {
    const { service, ended } = setup();
    await service.adminUpdateTherapistStatus(5n, 1n, 50n, 'inactive');
    expect(ended.onMembershipEnded).toHaveBeenCalledWith([50n]);
  });

  it('switching a therapist back on offers to add the practice back', async () => {
    const { service, ended } = setup();
    await service.adminUpdateTherapistStatus(5n, 1n, 50n, 'active');
    expect(ended.onMembershipReactivated).toHaveBeenCalledWith([50n]);
    expect(ended.onMembershipEnded).not.toHaveBeenCalled();
  });

  it('a repeated toggle changes nothing and sends nothing', async () => {
    const { service, ended, prisma } = setup();
    prisma.profile.findFirst.mockResolvedValueOnce({ role: 'OWNER' }).mockResolvedValueOnce({ status: 'active' });
    await service.adminUpdateTherapistStatus(5n, 1n, 50n, 'active');
    expect(ended.onMembershipReactivated).not.toHaveBeenCalled();
  });
});

describe('exit 2: a downgrade pausing staff (§5.4a)', () => {
  const setup = (paused: bigint[]) => {
    const ended = handler();
    const prisma: any = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7n, downgradeAt: new Date('2026-11-01'), subscriptionLapsedAt: null,
          subscriptionTier: 'PRO', subscriptionStatus: 'past_due', complimentaryUntil: null, complimentaryReason: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      profile: {
        findMany: vi.fn().mockResolvedValue(paused.map((id) => ({ id }))),
        updateMany: vi.fn().mockResolvedValue({ count: paused.length }),
      },
      consultBooking: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    };
    const service = new SubscriptionLapseService(prisma, undefined, ended as any);
    return { service, ended };
  };

  it('moving to FREE ends every membership it pauses', async () => {
    const { service, ended } = setup([50n, 51n]);
    await service.moveToFree(7n, new Date('2026-11-02'));
    expect(ended.onMembershipEnded).toHaveBeenCalledWith([50n, 51n]);
  });

  it('renewing offers the reactivated staff their place back', async () => {
    const { service, ended } = setup([50n]);
    await service.stopLapse(7n);
    expect(ended.onMembershipReactivated).toHaveBeenCalledWith([50n]);
  });
});

describe('exit 3: a platform admin switching a practice off', () => {
  const setup = (wasActive: boolean) => {
    const ended = handler();
    const prisma: any = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ isActive: wasActive }),
        update: vi.fn(async ({ data }: any) => ({ id: 5n, isActive: data.isActive ?? wasActive, ecosystemIntegrationEnabled: false, subscriptionTier: 'FREE' })),
      },
    };
    const service = new AdminService(prisma, undefined, undefined, ended as any);
    return { service, ended };
  };

  it('ends every membership in the practice', async () => {
    const { service, ended } = setup(true);
    await service.updateTenant(5n, { isActive: false });
    expect(ended.onPracticeEnded).toHaveBeenCalledWith(5n);
  });

  it('switching it back on offers everyone their place back', async () => {
    const { service, ended } = setup(false);
    await service.updateTenant(5n, { isActive: true });
    expect(ended.onPracticeReactivated).toHaveBeenCalledWith(5n);
  });

  it('does nothing when the switch did not change', async () => {
    const { service, ended } = setup(true);
    await service.updateTenant(5n, { isActive: true });
    await service.updateTenant(5n, { ecosystemIntegrationEnabled: false });
    expect(ended.onPracticeEnded).not.toHaveBeenCalled();
    expect(ended.onPracticeReactivated).not.toHaveBeenCalled();
  });
});

describe('exit 4: a practice closure', () => {
  it('ends every membership in the practice', async () => {
    const ended = handler();
    const tx: any = {
      tenant: { update: vi.fn() },
      profile: { findMany: vi.fn().mockResolvedValue([]) },
      token: { deleteMany: vi.fn() },
    };
    const prisma: any = {
      profile: { findFirst: vi.fn().mockResolvedValue({ role: 'OWNER' }) },
      tenant: { findUnique: vi.fn().mockResolvedValue({ slug: 'calm', closureRequestedAt: null }) },
      $transaction: vi.fn(async (cb: any) => cb(tx)),
    };
    const service = new PracticeClosureService(prisma, undefined, ended as any);
    await service.requestClosure(5n, 1n, 'calm');
    expect(ended.onPracticeEnded).toHaveBeenCalledWith(5n);
  });
});
