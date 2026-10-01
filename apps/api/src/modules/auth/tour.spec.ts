import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

/**
 * ONB-06: the dashboard walkthrough is shown once per person, on any device.
 * The date lives on the profile and travels with the signed-in profile, so a
 * second device sees the same thing.
 */
const BASE_PROFILE = {
  id: 5n,
  tenantId: 1n,
  email: 'dr.jane@smiththerapy.ng',
  username: 'dr.jane',
  firstName: 'Jane',
  lastName: 'Smith',
  type: 'therapist',
  role: 'OWNER',
  status: 'active',
  permissions: [],
  avatarUrl: null,
  tourCompletedAt: null,
  tenant: { name: 'Smith Therapy', slug: 'smith-therapy', subscriptionTier: 'PRO' },
  consultTherapistProfile: { id: 9n },
  user: { platformRole: null },
};

function make(over: Record<string, any> = {}) {
  const profile = { ...BASE_PROFILE, ...over };
  const prisma: any = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(profile),
      update: vi.fn().mockImplementation(async ({ data }: any) => ({ ...profile, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const jwt: any = { sign: vi.fn(() => 'jwt') };
  const service = new AuthService(prisma, jwt, {} as any, {} as any, {} as any);
  return { prisma, service, profile };
}

describe('the walkthrough date on the signed-in profile', () => {
  it('GET /v1/auth/status carries tourCompletedAt, as an ISO string or null', async () => {
    const { service } = make();
    const status = await service.getSessionStatus(5n);
    expect(status.tourCompletedAt).toBeNull();

    const done = make({ tourCompletedAt: new Date('2026-10-01T08:00:00.000Z') });
    expect((await done.service.getSessionStatus(5n)).tourCompletedAt).toBe('2026-10-01T08:00:00.000Z');
  });
});

describe('completeTour', () => {
  it('stamps the caller’s own profile, and only when not already stamped', async () => {
    const { prisma, service } = make();
    const result = await service.completeTour(5n);
    expect(prisma.profile.updateMany.mock.calls[0][0].where).toEqual({ id: 5n, tourCompletedAt: null });
    expect(result.tourCompletedAt).toBeInstanceOf(Date);
  });

  it('a second call keeps the first date', async () => {
    const first = new Date('2026-10-01T08:00:00.000Z');
    const { prisma, service } = make({ tourCompletedAt: first });
    const result = await service.completeTour(5n, { tourCompletedAt: first });
    expect(prisma.profile.updateMany).not.toHaveBeenCalled();
    expect(result.tourCompletedAt).toEqual(first);
  });
});
