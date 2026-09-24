import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';

/**
 * The app sends the practice name as the account handle, and User.username is
 * unique across the platform. The second practice called "Grace Therapy" used
 * to get a 500 and leave an empty practice behind.
 */
function makeService(takenUsernames: string[]) {
  const prisma: any = {
    user: {
      findUnique: vi.fn(({ where }: any) =>
        Promise.resolve(where.username && takenUsernames.includes(where.username) ? { id: 99n } : null),
      ),
      create: vi.fn().mockResolvedValue({ id: 1n }),
    },
    tenant: { create: vi.fn().mockResolvedValue({ id: 4n }) },
    profile: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 5n, tenantId: 4n, email: 'b@grace.ng', status: 'pending', emailVerified: false }),
    },
    token: { create: vi.fn(), deleteMany: vi.fn() },
    consultTherapistProfile: { create: vi.fn() },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { service: new AuthService(prisma, {} as any, notifications, {} as any), prisma };
}

const dto = {
  email: 'b@grace.ng',
  password: 'Str0ng!Passw0rd',
  firstName: 'Bola',
  practiceName: 'Grace Therapy',
  username: 'grace-therapy',
  type: 'therapist',
};

describe('signing up a practice whose name is already taken', () => {
  it('keeps the handle when it is free', async () => {
    const { service, prisma } = makeService([]);
    await service.register(undefined, dto);
    expect(prisma.user.create.mock.calls[0][0].data.username).toBe('grace-therapy');
  });

  it('adds a suffix instead of failing', async () => {
    const { service, prisma } = makeService(['grace-therapy']);
    await service.register(undefined, dto);
    const username = prisma.user.create.mock.calls[0][0].data.username;
    expect(username).toMatch(/^grace-therapy-[0-9a-f]{4}$/);
    expect(prisma.profile.create.mock.calls[0][0].data.username).toBe(username);
  });
});
