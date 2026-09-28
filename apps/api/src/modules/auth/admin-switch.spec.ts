import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

async function setup(user: Record<string, unknown> | null, practice: Record<string, unknown> | null = null) {
  const prisma: any = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    profile: { findFirst: vi.fn().mockResolvedValue(practice) },
  };
  const sessions: any = {
    revokeSession: vi.fn().mockResolvedValue(1),
    startSession: vi.fn().mockResolvedValue(undefined),
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AuthService(prisma, jwt, {} as any, sessions);
  return { service, prisma, sessions, jwt };
}

const password = 'correct horse';
const hashed = bcrypt.hashSync(password, 4);
const admin = { id: 3n, email: 'me@unclutter.com.ng', username: 'me', password: hashed, platformRole: 'SUPER_ADMIN', lockedUntil: null };
const practice = {
  id: 20n,
  tenantId: 5n,
  email: 'me@unclutter.com.ng',
  username: 'me',
  firstName: 'Ola',
  lastName: null,
  type: 'therapist',
  role: 'OWNER',
  status: 'active',
  avatarUrl: null,
  tenant: { name: 'Unclutter', slug: 'unclutter', subscriptionTier: 'CLINIC' },
  consultTherapistProfile: {},
};

describe('switching from a practice to the admin console', () => {
  it('needs the password again, ends the practice session and starts an admin one', async () => {
    const { service, sessions, jwt } = await setup(admin);
    const result = await service.switchToPlatformAdmin(3n, 'sid-practice', password);

    expect(sessions.revokeSession).toHaveBeenCalledWith('sid-practice', 3n);
    expect(sessions.startSession).toHaveBeenCalledTimes(1);
    expect(result.profile).toMatchObject({ type: 'platform_admin', platformRole: 'SUPER_ADMIN', hasPractice: true });
    expect(jwt.decode(result.accessToken)).toMatchObject({ type: 'platform_admin', roles: ['SUPER_ADMIN'] });
  });

  it('refuses a wrong password and keeps the practice session', async () => {
    const { service, sessions } = await setup(admin);
    await expect(service.switchToPlatformAdmin(3n, 'sid-practice', 'guess')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.revokeSession).not.toHaveBeenCalled();
    expect(sessions.startSession).not.toHaveBeenCalled();
  });

  it('refuses someone without a platform role, even with the right password', async () => {
    const { service, sessions } = await setup({ ...admin, platformRole: null });
    await expect(service.switchToPlatformAdmin(3n, 'sid-practice', password)).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.startSession).not.toHaveBeenCalled();
  });

  it('refuses a locked account', async () => {
    const { service } = await setup({ ...admin, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(service.switchToPlatformAdmin(3n, 'sid', password)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('switching from the admin console back to a practice', () => {
  it('signs in to the user’s own practice without a password', async () => {
    const { service, sessions, jwt } = await setup({ platformRole: 'SUPER_ADMIN' }, practice);
    const result = await service.switchToPractice(3n, 'sid-admin');

    expect(sessions.revokeSession).toHaveBeenCalledWith('sid-admin', 3n);
    expect(result.profile).toMatchObject({ tenantSlug: 'unclutter', role: 'OWNER', platformAdmin: true });
    expect(jwt.decode(result.accessToken)).toMatchObject({ profileId: '20', tenantId: '5' });
  });

  it('says so when there is no practice to go back to', async () => {
    const { service, sessions } = await setup({ platformRole: 'SUPER_ADMIN' }, null);
    await expect(service.switchToPractice(3n, 'sid-admin')).rejects.toBeInstanceOf(NotFoundException);
    expect(sessions.revokeSession).not.toHaveBeenCalled();
  });
});
