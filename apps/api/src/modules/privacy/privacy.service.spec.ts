import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrivacyService, ERASED_STATUS } from './privacy.service';

function makePrisma(overrides: any = {}) {
  const tx = {
    webPushSubscription: { deleteMany: vi.fn() },
    notificationPreference: { deleteMany: vi.fn() },
    notificationDispatch: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    emailLog: { deleteMany: vi.fn() },
    consultBooking: { updateMany: vi.fn() },
    profile: { update: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    token: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
  };
  const prisma: any = {
    profile: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    ...overrides,
  };
  return { prisma, tx };
}

const ACTOR = { id: 1n, role: 'OWNER' };
const CLIENT = { id: 9n, role: 'CLIENT', status: 'active', userId: 42n };

function withProfiles(prisma: any, actor: any, target: any) {
  prisma.profile.findFirst
    .mockResolvedValueOnce(actor)
    .mockResolvedValueOnce(target);
}

describe('PrivacyService.eraseClientPersonalData', () => {
  let service: PrivacyService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    ({ prisma, tx } = makePrisma());
    service = new PrivacyService(prisma);
  });

  describe('authorisation', () => {
    it('refuses a therapist', async () => {
      withProfiles(prisma, { id: 1n, role: 'THERAPIST' }, CLIENT);
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses a receptionist', async () => {
      withProfiles(prisma, { id: 1n, role: 'RECEPTIONIST' }, CLIENT);
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).rejects.toThrow(ForbiddenException);
    });

    it('allows an owner and an admin', async () => {
      for (const role of ['OWNER', 'ADMIN']) {
        ({ prisma, tx } = makePrisma());
        service = new PrivacyService(prisma);
        withProfiles(prisma, { id: 1n, role }, CLIENT);
        await expect(service.eraseClientPersonalData(1n, 1n, 9n)).resolves.toBeDefined();
      }
    });

    it('scopes the client lookup to the actor tenant', async () => {
      withProfiles(prisma, ACTOR, CLIENT);
      await service.eraseClientPersonalData(7n, 1n, 9n);
      expect(prisma.profile.findFirst.mock.calls[1][0].where).toMatchObject({
        id: 9n,
        tenantId: 7n,
      });
    });

    it('404s when the client is not in this tenant', async () => {
      withProfiles(prisma, ACTOR, null);
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to erase a staff member through this route', async () => {
      withProfiles(prisma, ACTOR, { ...CLIENT, role: 'THERAPIST' });
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('is not repeatable once erased', async () => {
      withProfiles(prisma, ACTOR, { ...CLIENT, status: ERASED_STATUS });
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).rejects.toThrow(BadRequestException);
    });
  });

  describe('what it erases', () => {
    beforeEach(() => withProfiles(prisma, ACTOR, CLIENT));

    it('clears every identifying field on the profile', async () => {
      await service.eraseClientPersonalData(1n, 1n, 9n);
      const data = tx.profile.update.mock.calls[0][0].data;
      expect(data).toMatchObject({
        firstName: null,
        lastName: null,
        phone: null,
        gender: null,
        dateOfBirth: null,
        avatarUrl: null,
        emailVerified: false,
        status: ERASED_STATUS,
      });
      expect(data.email).toBe('erased-9@erased.invalid');
      expect(data.username).toBe('erased-9');
    });

    it('removes contact channels and revokes sessions', async () => {
      await service.eraseClientPersonalData(1n, 1n, 9n);
      expect(tx.webPushSubscription.deleteMany).toHaveBeenCalledWith({ where: { profileId: 9n } });
      expect(tx.notificationPreference.deleteMany).toHaveBeenCalled();
      expect(tx.notification.deleteMany).toHaveBeenCalled();
      expect(tx.emailLog.deleteMany).toHaveBeenCalled();
      expect(tx.token.deleteMany).toHaveBeenCalledWith({ where: { userId: 42n } });
    });

    it('strips booking free-text but keeps the bookings', async () => {
      await service.eraseClientPersonalData(1n, 1n, 9n);
      expect(tx.consultBooking.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 1n, clientProfileId: 9n },
        data: { notes: null },
      });
    });

    it('does everything inside one transaction', async () => {
      await service.eraseClientPersonalData(1n, 1n, 9n);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('what it must NOT touch', () => {
    beforeEach(() => withProfiles(prisma, ACTOR, CLIENT));

    it('never deletes clinical notes or assessment submissions', async () => {
      await service.eraseClientPersonalData(1n, 1n, 9n);
      // Retention obligations outlive the erasure request; the records survive
      // and are simply no longer tied to an identifiable person.
      expect((tx as any).clinicalNote).toBeUndefined();
      expect((tx as any).universalFormSubmission).toBeUndefined();
    });

    it('reports what it kept and why', async () => {
      const receipt = await service.eraseClientPersonalData(1n, 1n, 9n);
      const kept = receipt.retained.map((r) => r.record).join(' ');
      expect(kept).toContain('Clinical notes');
      expect(kept).toContain('Bookings');
      expect(receipt.retained.every((r) => r.reason.length > 0)).toBe(true);
    });
  });

  describe('shared logins across practices', () => {
    it('neutralises the login when no other practice still has the client', async () => {
      withProfiles(prisma, ACTOR, CLIENT);
      tx.profile.count.mockResolvedValue(0);
      await service.eraseClientPersonalData(1n, 1n, 9n);

      const data = tx.user.update.mock.calls[0][0].data;
      expect(data.email).toBe('erased-user-42@erased.invalid');
      // A random bcrypt hash, not a fixed placeholder anyone could predict.
      expect(data.password).toMatch(/^\$2[aby]\$/);
      expect(data.lockedUntil).toBeNull();
    });

    it('leaves the login alone when another practice still has a live profile', async () => {
      withProfiles(prisma, ACTOR, CLIENT);
      tx.profile.count.mockResolvedValue(1);
      await service.eraseClientPersonalData(1n, 1n, 9n);

      expect(tx.user.update).not.toHaveBeenCalled();
      // Sessions are still revoked — this practice's access must end now.
      expect(tx.token.deleteMany).toHaveBeenCalled();
    });

    it('excludes already-erased profiles when counting remaining practices', async () => {
      withProfiles(prisma, ACTOR, CLIENT);
      await service.eraseClientPersonalData(1n, 1n, 9n);
      expect(tx.profile.count.mock.calls[0][0].where).toMatchObject({
        userId: 42n,
        id: { not: 9n },
        status: { not: ERASED_STATUS },
      });
    });

    it('handles a client with no login account', async () => {
      withProfiles(prisma, ACTOR, { ...CLIENT, userId: null });
      await expect(service.eraseClientPersonalData(1n, 1n, 9n)).resolves.toBeDefined();
      expect(tx.token.deleteMany).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });
});
