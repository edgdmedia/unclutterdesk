import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const TENANT = 1n;

function make(over: Record<string, any> = {}) {
  const prisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.email) return over.userEmail === where.email ? over.user ?? null : null;
        return null; // username is always free in these tests
      }),
      create: vi.fn(async ({ data }: any) => ({ id: 77n, ...data })),
    },
    profile: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.accountTokenHash) {
          const p = over.inviteProfile ?? null;
          return p ? { ...p, ...('found' in over && !over.found ? null : {}) } : null;
        }
        if (where.userId !== undefined) return over.profileByUser ?? null;
        if (where.email) return over.profileByEmail ?? null;
        return null;
      }),
      findMany: vi.fn().mockResolvedValue(over.profiles ?? []),
      create: vi.fn(async ({ data }: any) => ({ id: 88n, tenantId: TENANT, email: data.email, type: data.type, role: 'CLIENT', status: 'active', ...data })),
      update: vi.fn(async ({ where, data }: any) => ({ ...(over.profileByEmail ?? over.inviteProfile ?? {}), id: (where.id ?? 40n), ...data })),
    },
    token: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), updateMany: vi.fn() },
    session: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
  };
  const jwt: any = { sign: vi.fn((p: any) => `jwt:${p.profileId}`) };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const sessions: any = { startSession: vi.fn().mockResolvedValue(undefined), record: vi.fn() };
  const invites: any = {};
  const service = new AuthService(prisma, jwt, notifications, sessions, invites);
  return { prisma, service, notifications, sessions };
}

describe('clientSignup', () => {
  it('needs a practice', async () => {
    const { service } = make();
    await expect(service.clientSignup(undefined, { firstName: 'A', lastName: '', email: 'a@x.com', password: 'password1234' }, {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('creates the user and this practice’s client profile, and signs in', async () => {
    const { service, prisma, sessions } = make({ profileByEmail: null });
    const res = await service.clientSignup(TENANT, { firstName: 'Ada', lastName: 'O', email: 'Ada@X.com ', password: 'password1234' }, {} as any);
    expect(prisma.user.create).toHaveBeenCalled();
    const created = prisma.profile.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ tenantId: TENANT, role: 'CLIENT', emailVerified: true, userId: 77n });
    expect(res.profile.role).toBe('CLIENT');
    expect(sessions.startSession).toHaveBeenCalled();
  });
  it('links a profile staff already created', async () => {
    const { service, prisma } = make({ profileByEmail: { id: 40n, tenantId: TENANT, email: 'ada@x.com', userId: null, role: 'CLIENT', status: 'active', type: 'user', firstName: 'Ada', lastName: null, username: 'ada', emailVerified: false } });
    await service.clientSignup(TENANT, { firstName: 'Ada', lastName: 'O', email: 'ada@x.com', password: 'password1234' }, {} as any);
    expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 40n } }));
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });
  it('says “account exists” when the email already has one here', async () => {
    const { service } = make({
      userEmail: 'ada@x.com',
      user: { id: 5n, password: 'x', status: 'active', profiles: [{ id: 40n, tenantId: TENANT }] },
    });
    await expect(service.clientSignup(TENANT, { firstName: 'A', lastName: '', email: 'ada@x.com', password: 'password1234' }, {} as any)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('clientSetPassword', () => {
  const invite = { id: 40n, tenantId: TENANT, email: 'a@x.com', userId: null, role: 'CLIENT', status: 'active', type: 'user', username: 'a', firstName: null, lastName: null, emailVerified: false, accountTokenExpiresAt: new Date(Date.now() + 86_400_000) };
  it('refuses a missing token', async () => {
    const { service } = make({ inviteProfile: null });
    await expect(service.clientSetPassword({ token: 't', password: 'password1234' }, {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('refuses an expired token', async () => {
    const { service } = make({ inviteProfile: { ...invite, accountTokenExpiresAt: new Date(Date.now() - 1000) } });
    await expect(service.clientSetPassword({ token: 't', password: 'password1234' }, {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('accepts the invite: creates the user, links the profile, clears the token', async () => {
    const { service, prisma } = make({ inviteProfile: invite });
    await service.clientSetPassword({ token: 't', password: 'password1234', firstName: 'Ada', lastName: 'Ola' }, {} as any);
    expect(prisma.user.create).toHaveBeenCalled();
    const upd = prisma.profile.update.mock.calls.at(-1)[0].data;
    expect(upd).toMatchObject({ userId: 77n, emailVerified: true, accountTokenHash: null, accountTokenExpiresAt: null });
  });
});
