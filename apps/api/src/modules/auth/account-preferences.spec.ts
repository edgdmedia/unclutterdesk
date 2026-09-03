import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/**
 * Account preferences and changing a password.
 *
 * The preferences page had a "Save preferences" button with no handler and no
 * column to write to, so nothing a user chose survived a refresh. It also
 * offered a "Change password" link that did nothing.
 */
const TENANT = 1n;
const PROFILE = 5n;

const STORED = {
  email: 'ada@example.com',
  emailVerified: true,
  locale: 'en-NG',
  timezone: 'Africa/Lagos',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24-hour',
  weekStartsOn: 'Monday',
  numberFormat: '1,234.56',
};

function makeService({ profile = STORED, updated = 1 }: { profile?: any; updated?: number } = {}) {
  const prisma: any = {
    profile: {
      findFirst: vi.fn().mockResolvedValue(profile),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  const service = new AuthService(prisma, { sign: vi.fn() } as any, { notify: vi.fn() } as any);
  return { service, prisma };
}

describe('AuthService.getPreferences', () => {
  it('reads the profile within the tenant', async () => {
    const { service, prisma } = makeService();
    await service.getPreferences(TENANT, PROFILE);
    expect(prisma.profile.findFirst.mock.calls[0][0].where).toMatchObject({
      id: PROFILE,
      tenantId: TENANT,
    });
  });

  it('returns the real verification state rather than a fixed badge', async () => {
    // The page painted a green "Verified" chip regardless.
    const { service } = makeService({ profile: { ...STORED, emailVerified: false } });
    await expect(service.getPreferences(TENANT, PROFILE)).resolves.toMatchObject({
      emailVerified: false,
    });
  });

  it('never returns the password hash', async () => {
    const { service, prisma } = makeService();
    await service.getPreferences(TENANT, PROFILE);
    expect(prisma.profile.findFirst.mock.calls[0][0].select).not.toHaveProperty('user');
  });

  it('refuses a profile outside the tenant', async () => {
    const { service } = makeService({ profile: null });
    await expect(service.getPreferences(TENANT, PROFILE)).rejects.toThrow(NotFoundException);
  });
});

describe('AuthService.updatePreferences', () => {
  let service: AuthService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  it('saves a value the UI offers', async () => {
    await service.updatePreferences(TENANT, PROFILE, { timeFormat: '12-hour' });
    expect(prisma.profile.updateMany.mock.calls[0][0].data).toEqual({ timeFormat: '12-hour' });
  });

  it('saves several at once', async () => {
    await service.updatePreferences(TENANT, PROFILE, {
      dateFormat: 'YYYY-MM-DD',
      weekStartsOn: 'Sunday',
    });
    expect(prisma.profile.updateMany.mock.calls[0][0].data).toEqual({
      dateFormat: 'YYYY-MM-DD',
      weekStartsOn: 'Sunday',
    });
  });

  describe('tenant scoping', () => {
    // update() takes a unique where, which cannot carry tenantId — the same
    // shape that let three earlier bugs cross practices.
    it('keeps the tenant in the WHERE', async () => {
      await service.updatePreferences(TENANT, PROFILE, { timeFormat: '12-hour' });
      expect(prisma.profile.updateMany.mock.calls[0][0].where).toEqual({
        id: PROFILE,
        tenantId: TENANT,
      });
    });

    it('never uses the unscoped update', async () => {
      await service.updatePreferences(TENANT, PROFILE, { timeFormat: '12-hour' });
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('refuses when the profile is not in that tenant', async () => {
      ({ service, prisma } = makeService({ updated: 0 }));
      await expect(
        service.updatePreferences(TENANT, PROFILE, { timeFormat: '12-hour' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('what it will accept', () => {
    // A stored locale reaches Intl.DateTimeFormat on every page that formats a
    // date, so a junk value would throw far from where it was set.
    it('rejects a value outside the offered list', async () => {
      await expect(
        service.updatePreferences(TENANT, PROFILE, { locale: 'zz-ZZ' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a non-string', async () => {
      await expect(
        service.updatePreferences(TENANT, PROFILE, { timeFormat: 12 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ignores fields that are not preferences', async () => {
      // Otherwise this endpoint would be a way to set your own role.
      await service.updatePreferences(TENANT, PROFILE, {
        timeFormat: '12-hour',
        role: 'OWNER',
        emailVerified: true,
        status: 'active',
      });
      const data = prisma.profile.updateMany.mock.calls[0][0].data;
      expect(data).toEqual({ timeFormat: '12-hour' });
      expect(data).not.toHaveProperty('role');
    });

    it('refuses an empty update rather than writing nothing and reporting success', async () => {
      await expect(service.updatePreferences(TENANT, PROFILE, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('returns the saved values so the page shows what is stored', async () => {
    await expect(
      service.updatePreferences(TENANT, PROFILE, { timeFormat: '12-hour' }),
    ).resolves.toMatchObject({ timeFormat: '24-hour' });
    expect(prisma.profile.findFirst).toHaveBeenCalled();
  });
});

describe('AuthService.changePassword', () => {
  const CURRENT = 'current-password';

  async function withUser(overrides: Record<string, unknown> = {}) {
    const prisma: any = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          id: PROFILE,
          user: { id: 7n, password: await bcrypt.hash(CURRENT, 10) },
          ...overrides,
        }),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
    };
    const service = new AuthService(prisma, { sign: vi.fn() } as any, { notify: vi.fn() } as any);
    return { service, prisma };
  }

  it('changes the password when the current one is right', async () => {
    const { service, prisma } = await withUser();
    await expect(
      service.changePassword(PROFILE, { currentPassword: CURRENT, newPassword: 'a-new-password' }),
    ).resolves.toEqual({ success: true });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('stores a hash, never the password itself', async () => {
    const { service, prisma } = await withUser();
    await service.changePassword(PROFILE, {
      currentPassword: CURRENT,
      newPassword: 'a-new-password',
    });
    const written = prisma.user.update.mock.calls[0][0].data.password;
    expect(written).not.toBe('a-new-password');
    expect(written).toMatch(/^\$2[aby]\$/);
  });

  // A session left open on a shared machine should not be enough to lock the
  // owner out of their own account.
  it('refuses without the current password', async () => {
    const { service, prisma } = await withUser();
    await expect(
      service.changePassword(PROFILE, { currentPassword: 'wrong', newPassword: 'a-new-password' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a new password that is too short to be worth hashing', async () => {
    const { service, prisma } = await withUser();
    await expect(
      service.changePassword(PROFILE, { currentPassword: CURRENT, newPassword: 'short' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses reusing the same password', async () => {
    const { service } = await withUser();
    await expect(
      service.changePassword(PROFILE, { currentPassword: CURRENT, newPassword: CURRENT }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses when either field is missing', async () => {
    const { service } = await withUser();
    await expect(
      service.changePassword(PROFILE, { currentPassword: '', newPassword: 'a-new-password' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a profile with no login attached', async () => {
    const { service } = await withUser({ user: null });
    await expect(
      service.changePassword(PROFILE, { currentPassword: CURRENT, newPassword: 'a-new-password' }),
    ).rejects.toThrow(NotFoundException);
  });
});
