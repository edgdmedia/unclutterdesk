import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * SET-08: the dashboard's photo upload used to vanish on reload because the
 * endpoint stored whatever string it was given — and threw on '' — without
 * ever saying whether it worked. The photo now goes through the same image
 * rules as the logo, with its own wording.
 */
const TENANT = 1n;

function makeService(count = 1) {
  const prisma: any = {
    profile: {
      updateMany: vi.fn().mockResolvedValue({ count }),
    },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

const PHOTO = 'data:image/png;base64,QUJDRA==';

describe('ConsultService.uploadTherapistAvatar', () => {
  it('stores a png, jpeg, webp or gif data URL', async () => {
    for (const type of ['png', 'jpeg', 'webp', 'gif']) {
      const { service, prisma } = makeService();
      await service.uploadTherapistAvatar(TENANT, 5n, `data:image/${type};base64,QUJD`);
      expect(prisma.profile.updateMany.mock.calls[0][0].data.avatarUrl).toBe(`data:image/${type};base64,QUJD`);
    }
  });

  it('stores an https URL', async () => {
    const { service, prisma } = makeService();
    await service.uploadTherapistAvatar(TENANT, 5n, 'https://cdn.example.com/me.jpg');
    expect(prisma.profile.updateMany.mock.calls[0][0].data.avatarUrl).toBe('https://cdn.example.com/me.jpg');
  });

  it('clears the photo on an empty value', async () => {
    const { service, prisma } = makeService();
    await service.uploadTherapistAvatar(TENANT, 5n, '');
    expect(prisma.profile.updateMany.mock.calls[0][0].data.avatarUrl).toBeNull();
    const cleared = makeService();
    await cleared.service.uploadTherapistAvatar(TENANT, 5n, null as unknown as string);
    expect(cleared.prisma.profile.updateMany.mock.calls[0][0].data.avatarUrl).toBeNull();
  });

  it('refuses anything that is not an image, in photo’s words', async () => {
    const { service } = makeService();
    await expect(service.uploadTherapistAvatar(TENANT, 5n, 'javascript:alert(1)')).rejects.toThrow(BadRequestException);
    await expect(service.uploadTherapistAvatar(TENANT, 5n, 'javascript:alert(1)')).rejects.toThrow('The photo must be an image.');
  });

  it('refuses an oversized photo, in photo’s words', async () => {
    const { service } = makeService();
    const big = `data:image/png;base64,${'A'.repeat(100_001)}`;
    await expect(service.uploadTherapistAvatar(TENANT, 5n, big)).rejects.toThrow('That photo is too large');
  });

  it('writes only its own profile in its own practice', async () => {
    const { service, prisma } = makeService();
    await service.uploadTherapistAvatar(TENANT, 5n, PHOTO);
    expect(prisma.profile.updateMany.mock.calls[0][0].where).toEqual({ id: 5n, tenantId: TENANT });
  });

  it('says not found when the profile row was not theirs', async () => {
    const { service } = makeService(0);
    await expect(service.uploadTherapistAvatar(TENANT, 5n, PHOTO)).rejects.toThrow(NotFoundException);
  });
});
