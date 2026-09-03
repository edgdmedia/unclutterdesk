import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PracticeClosureService, CLOSURE_GRACE_DAYS } from './practice-closure.service';

const DAY = 24 * 60 * 60 * 1000;

function makePrisma() {
  const order: string[] = [];
  const del = (name: string) =>
    vi.fn(async () => {
      order.push(name);
      return { count: 1 };
    });

  const tx: any = {
    tenant: { update: vi.fn(), delete: vi.fn(async () => order.push('tenant')) },
    profile: {
      findMany: vi.fn().mockResolvedValue([{ id: 5n, userId: 42n }]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: del('profiles'),
    },
    user: { delete: vi.fn(async () => order.push('users')) },
    token: { deleteMany: del('sessions') },
    clinicalNote: { deleteMany: del('clinicalNotes') },
    universalFormSubmission: { deleteMany: del('formSubmissions') },
    universalForm: { deleteMany: del('forms') },
    consultBooking: { deleteMany: del('bookings') },
    consultAvailability: { deleteMany: del('availability') },
    consultService: { deleteMany: del('services') },
    discountCode: { deleteMany: del('discountCodes') },
    consultPendingInvite: { deleteMany: del('pendingInvites') },
    bankSubaccount: { deleteMany: del('bankSubaccounts') },
    notificationDispatch: { deleteMany: del('notificationDispatches') },
    notification: { deleteMany: del('notifications') },
    notificationPreference: { deleteMany: del('notificationPreferences') },
    emailLog: { deleteMany: del('emailLogs') },
    webPushSubscription: { deleteMany: del('pushSubscriptions') },
    consultTherapistProfile: { deleteMany: del('therapistProfiles') },
  };

  const prisma: any = {
    profile: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  return { prisma, tx, order };
}

describe('PracticeClosureService.requestClosure', () => {
  let prisma: any, tx: any, service: PracticeClosureService;

  beforeEach(() => {
    ({ prisma, tx } = makePrisma());
    service = new PracticeClosureService(prisma);
    prisma.profile.findFirst.mockResolvedValue({ role: 'OWNER' });
    prisma.tenant.findUnique.mockResolvedValue({ slug: 'dr-smith', closureRequestedAt: null });
  });

  it('closes the practice for the owner', async () => {
    const result = await service.requestClosure(1n, 9n, 'dr-smith');
    expect(tx.tenant.update.mock.calls[0][0].data).toMatchObject({
      isActive: false,
      closureRequestedBy: 9n,
    });
    expect(new Date(result.purgeableFrom).getTime() - new Date(result.closureRequestedAt).getTime())
      .toBe(CLOSURE_GRACE_DAYS * DAY);
  });

  // Closing ends everyone's access, so it is not an admin-level action.
  it('refuses an admin', async () => {
    prisma.profile.findFirst.mockResolvedValue({ role: 'ADMIN' });
    await expect(service.requestClosure(1n, 9n, 'dr-smith')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a therapist', async () => {
    prisma.profile.findFirst.mockResolvedValue({ role: 'THERAPIST' });
    await expect(service.requestClosure(1n, 9n, 'dr-smith')).rejects.toThrow(ForbiddenException);
  });

  it('scopes the actor lookup to the tenant being closed', async () => {
    await service.requestClosure(7n, 9n, 'dr-smith');
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({ id: 9n, tenantId: 7n });
  });

  describe('confirmation', () => {
    it('requires the slug to be typed', async () => {
      await expect(service.requestClosure(1n, 9n, 'wrong')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a missing confirmation', async () => {
      await expect(service.requestClosure(1n, 9n, undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts surrounding whitespace and different case', async () => {
      await expect(service.requestClosure(1n, 9n, '  DR-Smith  ')).resolves.toBeDefined();
    });
  });

  it('revokes every session in the practice', async () => {
    await service.requestClosure(1n, 9n, 'dr-smith');
    expect(tx.token.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: [42n] } } });
  });

  it('deletes nothing — closure is reversible until the purge', async () => {
    await service.requestClosure(1n, 9n, 'dr-smith');
    expect(tx.profile.deleteMany).not.toHaveBeenCalled();
    expect(tx.clinicalNote.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenant.delete).not.toHaveBeenCalled();
  });

  it('cannot be requested twice', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      slug: 'dr-smith',
      closureRequestedAt: new Date(),
    });
    await expect(service.requestClosure(1n, 9n, 'dr-smith')).rejects.toThrow(BadRequestException);
  });

  it('404s an unknown practice', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(service.requestClosure(1n, 9n, 'dr-smith')).rejects.toThrow(NotFoundException);
  });
});

describe('PracticeClosureService.purgeClosedPractice', () => {
  let prisma: any, tx: any, order: string[], service: PracticeClosureService;

  const elapsed = () => new Date(Date.now() - (CLOSURE_GRACE_DAYS + 1) * DAY);

  beforeEach(() => {
    ({ prisma, tx, order } = makePrisma());
    service = new PracticeClosureService(prisma);
    prisma.tenant.findUnique.mockResolvedValue({
      slug: 'dr-smith',
      closureRequestedAt: elapsed(),
    });
  });

  describe('refuses to run unless every precondition holds', () => {
    it('404s an unknown practice', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.purgeClosedPractice(1n, 'dr-smith')).rejects.toThrow(NotFoundException);
    });

    it('requires the slug confirmation', async () => {
      await expect(service.purgeClosedPractice(1n, 'nope')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a practice that never requested closure', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ slug: 'dr-smith', closureRequestedAt: null });
      await expect(service.purgeClosedPractice(1n, 'dr-smith')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses while the retention window is still open', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        slug: 'dr-smith',
        closureRequestedAt: new Date(Date.now() - 1 * DAY),
      });
      await expect(service.purgeClosedPractice(1n, 'dr-smith')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows it the moment the window has elapsed', async () => {
      await expect(service.purgeClosedPractice(1n, 'dr-smith')).resolves.toBeDefined();
    });
  });

  describe('deletion order', () => {
    it('removes bookings before profiles', async () => {
      // ConsultBooking.client -> Profile is RESTRICT: reversing these two makes
      // Postgres refuse to delete any client who has ever booked.
      await service.purgeClosedPractice(1n, 'dr-smith');
      expect(order.indexOf('bookings')).toBeLessThan(order.indexOf('profiles'));
    });

    it('removes clinical notes and submissions before bookings', async () => {
      await service.purgeClosedPractice(1n, 'dr-smith');
      expect(order.indexOf('clinicalNotes')).toBeLessThan(order.indexOf('bookings'));
      expect(order.indexOf('formSubmissions')).toBeLessThan(order.indexOf('bookings'));
    });

    it('removes submissions before the forms they belong to', async () => {
      await service.purgeClosedPractice(1n, 'dr-smith');
      expect(order.indexOf('formSubmissions')).toBeLessThan(order.indexOf('forms'));
    });

    it('removes the tenant last', async () => {
      await service.purgeClosedPractice(1n, 'dr-smith');
      expect(order[order.length - 1]).toBe('tenant');
    });

    it('runs entirely in one transaction', async () => {
      await service.purgeClosedPractice(1n, 'dr-smith');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('shared logins', () => {
    it('deletes a login left with no profile anywhere', async () => {
      tx.profile.count.mockResolvedValue(0);
      const result = await service.purgeClosedPractice(1n, 'dr-smith');
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 42n } });
      expect(result.deleted.users).toBe(1);
    });

    it('keeps a login that still has a profile at another practice', async () => {
      tx.profile.count.mockResolvedValue(1);
      const result = await service.purgeClosedPractice(1n, 'dr-smith');
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(result.deleted.users).toBe(0);
    });
  });

  it('reports what it deleted', async () => {
    const result = await service.purgeClosedPractice(1n, 'dr-smith');
    expect(result.slug).toBe('dr-smith');
    expect(result.deleted).toMatchObject({ tenant: 1, bookings: 1, clinicalNotes: 1 });
  });
});
