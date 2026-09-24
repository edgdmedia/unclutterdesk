import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantService, INVITE_ID_PREFIX, parseInviteRef } from './tenant.service';

/**
 * Staff invitations.
 *
 * Inviting someone created a ConsultPendingInvite and no Profile, while the
 * roster listed profiles — so an invitation was invisible the moment it was
 * sent. An owner could not see who they had invited, chase them, or take it
 * back. Nothing was emailed either: the endpoint minted a claim link and handed
 * it to the caller, while the page promised the invitee an email.
 */
const TENANT = 1n;
const OWNER = 5n;

function makeService(over: Record<string, any> = {}) {
  const prisma: any = {
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ role: 'OWNER' }),
    },
    consultPendingInvite: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({
        id: 7n,
        email: 'new@practice.ng',
        role: 'THERAPIST',
        claimToken: 'tok',
        expiresAt: new Date('2026-09-11T00:00:00Z'),
      }),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        id: TENANT,
        name: 'Ada Therapy',
        subscriptionTier: 'CLINIC',
      }),
    },
    ...over,
  };
  const notifications = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { service: new TenantService(prisma, notifications as any), prisma, notifications };
}

const member = (over: Record<string, unknown> = {}) => ({
  id: 10n,
  email: 'ada@practice.ng',
  firstName: 'Ada',
  lastName: 'Ola',
  role: 'OWNER',
  status: 'active',
  avatarUrl: null,
  consultTherapistProfile: null,
  ...over,
});

const invite = (over: Record<string, unknown> = {}) => ({
  id: 7n,
  email: 'new@practice.ng',
  role: 'THERAPIST',
  claimToken: 'tok',
  sentAt: new Date('2026-09-01T09:00:00Z'),
  expiresAt: new Date('2026-09-08T09:00:00Z'),
  ...over,
});

describe('the roster', () => {
  it('lists people who have joined', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findMany.mockResolvedValue([member()]);
    const roster = await service.getClinicStaff(TENANT);
    expect(roster).toMatchObject([{ kind: 'member', email: 'ada@practice.ng' }]);
  });

  // The bug: an outstanding invitation appeared nowhere at all.
  it('lists invitations that are still outstanding', async () => {
    const { service, prisma } = makeService();
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite()]);
    const roster = await service.getClinicStaff(TENANT);
    expect(roster).toMatchObject([
      { kind: 'invite', email: 'new@practice.ng', status: 'pending', role: 'THERAPIST' },
    ]);
  });

  it('says when an invitation was sent and when it lapses', async () => {
    const { service, prisma } = makeService();
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite()]);
    const [row] = await service.getClinicStaff(TENANT);
    expect(row.invitedAt).toBe('2026-09-01T09:00:00.000Z');
    expect(row.expiresAt).toBe('2026-09-08T09:00:00.000Z');
  });

  it('asks only for invitations that can still be claimed', async () => {
    const { service, prisma } = makeService();
    await service.getClinicStaff(TENANT);
    const where = prisma.consultPendingInvite.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  // The invite row survives the claim, so the same person would appear twice.
  it('does not list someone twice once they have joined', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findMany.mockResolvedValue([member({ email: 'new@practice.ng' })]);
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite()]);
    const roster = await service.getClinicStaff(TENANT);
    expect(roster).toHaveLength(1);
    expect(roster[0].kind).toBe('member');
  });

  it('matches a claimed address regardless of case', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findMany.mockResolvedValue([member({ email: 'New@Practice.NG' })]);
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite()]);
    expect(await service.getClinicStaff(TENANT)).toHaveLength(1);
  });

  /*
   * Profiles and invites are separate autoincrement sequences, so a bare id can
   * name one of each. A client that mixed them up would deactivate a colleague
   * while trying to withdraw an invitation.
   */
  it('namespaces invite ids so they cannot be mistaken for a profile', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findMany.mockResolvedValue([member({ id: 7n })]);
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite({ id: 7n })]);
    const roster = await service.getClinicStaff(TENANT);
    expect(roster.map((r) => r.id)).toEqual(['7', `${INVITE_ID_PREFIX}7`]);
  });

  it('never returns the claim token, which is enough to join the practice', async () => {
    const { service, prisma } = makeService();
    prisma.consultPendingInvite.findMany.mockResolvedValue([invite()]);
    const roster = await service.getClinicStaff(TENANT);
    expect(JSON.stringify(roster)).not.toContain('tok');
  });
});

describe('parseInviteRef', () => {
  it('reads a namespaced id', () => {
    expect(parseInviteRef(`${INVITE_ID_PREFIX}7`)).toBe(7n);
  });

  it('refuses anything that is not a number', () => {
    expect(parseInviteRef('invite-abc')).toBeNull();
    expect(parseInviteRef('7; DROP TABLE')).toBeNull();
    expect(parseInviteRef('')).toBeNull();
  });
});

describe('withdrawing an invitation', () => {
  it('deletes the row, which is what stops the link working', async () => {
    const { service, prisma } = makeService();
    await service.revokeStaffInvite(TENANT, OWNER, `${INVITE_ID_PREFIX}7`);
    expect(prisma.consultPendingInvite.deleteMany).toHaveBeenCalledWith({
      where: { id: 7n, tenantId: TENANT },
    });
  });

  // delete() takes a unique where, which cannot carry a tenant filter.
  it('keeps the practice in the WHERE', async () => {
    const { service, prisma } = makeService();
    await service.revokeStaffInvite(TENANT, OWNER, `${INVITE_ID_PREFIX}7`);
    expect(prisma.consultPendingInvite.deleteMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  it('is refused to anyone but an owner or admin', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findFirst.mockResolvedValue({ role: 'THERAPIST' });
    await expect(
      service.revokeStaffInvite(TENANT, OWNER, `${INVITE_ID_PREFIX}7`),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.consultPendingInvite.deleteMany).not.toHaveBeenCalled();
  });

  it('is refused to someone outside the practice', async () => {
    const { service, prisma } = makeService();
    prisma.profile.findFirst.mockResolvedValue(null);
    await expect(
      service.revokeStaffInvite(TENANT, OWNER, `${INVITE_ID_PREFIX}7`),
    ).rejects.toThrow(ForbiddenException);
  });

  it('answers the same way whether the invite is gone or belongs elsewhere', async () => {
    const { service, prisma } = makeService();
    prisma.consultPendingInvite.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      service.revokeStaffInvite(TENANT, OWNER, `${INVITE_ID_PREFIX}7`),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses a malformed id rather than coercing it', async () => {
    const { service, prisma } = makeService();
    await expect(service.revokeStaffInvite(TENANT, OWNER, 'invite-nope')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.consultPendingInvite.deleteMany).not.toHaveBeenCalled();
  });
});

describe('sending the invitation', () => {
  const dto = { email: 'New@Practice.NG', role: 'THERAPIST' as const };

  it('emails the person being invited', async () => {
    const { service, notifications } = makeService();
    await service.inviteStaffMember(TENANT, dto);
    expect(notifications.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new@practice.ng', type: 'tenant.staff_invite' }),
    );
  });

  it('carries the claim link and the practice name', async () => {
    const { service, notifications } = makeService();
    await service.inviteStaffMember(TENANT, dto);
    const sent = notifications.sendEmail.mock.calls[0][0];
    expect(sent.link).toContain('/invite/claim?token=');
    expect(sent.title).toContain('Ada Therapy');
  });

  it('is branded as the practice, not the platform', async () => {
    const { service, notifications } = makeService();
    await service.inviteStaffMember(TENANT, dto);
    expect(notifications.sendEmail.mock.calls[0][0].tenantId).toBe(TENANT);
  });

  it('names the role, so the invitee knows what they are accepting', async () => {
    const { service, notifications } = makeService();
    await service.inviteStaffMember(TENANT, { ...dto, role: 'RECEPTIONIST' });
    expect(notifications.sendEmail.mock.calls[0][0].message).toContain('a receptionist');
  });

  it('reports that it was sent', async () => {
    const { service } = makeService();
    await expect(service.inviteStaffMember(TENANT, dto)).resolves.toMatchObject({
      emailSent: true,
    });
  });

  describe('when the mail provider fails', () => {
    // The invitation is already valid; losing it to a provider blip would be
    // worse than handing back the link with a note.
    it('still returns a usable invitation', async () => {
      const { service, notifications } = makeService();
      notifications.sendEmail.mockResolvedValue({ success: false, error: 'smtp down' });
      const result = await service.inviteStaffMember(TENANT, dto);
      expect(result.emailSent).toBe(false);
      expect(result.inviteUrl).toContain('/invite/claim?token=');
    });

    it('survives the mailer throwing', async () => {
      const { service, notifications } = makeService();
      notifications.sendEmail.mockRejectedValue(new Error('boom'));
      await expect(service.inviteStaffMember(TENANT, dto)).resolves.toMatchObject({
        emailSent: false,
      });
    });
  });

  it('sends nothing when the plan does not allow staff at all', async () => {
    const { service, notifications, prisma } = makeService();
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT, name: 'Solo', subscriptionTier: 'STARTER' });
    await expect(service.inviteStaffMember(TENANT, dto)).rejects.toThrow();
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });
});
