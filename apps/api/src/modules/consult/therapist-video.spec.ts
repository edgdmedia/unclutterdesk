import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConsultService } from './consult.service';

/**
 * VID-01: a therapist's sessions run in Unclutter Desk's own video room, or in
 * Google Meet when their Google account is connected. Nothing else is accepted.
 */
const TENANT = 1n;
const PROVIDER = 5n;

function make(therapistOver: Record<string, unknown> = {}) {
  const prisma: any = {
    consultTherapistProfile: {
      findUnique: vi.fn().mockResolvedValue({
        profileId: PROVIDER, tenantId: TENANT, offersOnline: true, offersInPerson: false, googleRefreshToken: null,
        workLocations: [], profile: { firstName: 'Ada', lastName: null }, videoProvider: 'BUILT_IN',
        ...therapistOver,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    profile: { update: vi.fn().mockResolvedValue({}) },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

describe('choosing how video sessions run', () => {
  it('refuses a provider we do not offer', async () => {
    const { service } = make();
    await expect(service.updateTherapistProfile(TENANT, PROVIDER, { videoProvider: 'ZOOM' } as any)).rejects.toThrow(BadRequestException);
  });

  it('refuses Google Meet until Google is connected', async () => {
    const { service } = make();
    await expect(service.updateTherapistProfile(TENANT, PROVIDER, { videoProvider: 'GOOGLE_MEET' } as any)).rejects.toThrow(
      'Connect Google Calendar first to use Google Meet.',
    );
  });

  it('accepts Google Meet with Google connected, and built-in video always', async () => {
    const connected = make({ googleRefreshToken: 'enc:token' });
    await connected.service.updateTherapistProfile(TENANT, PROVIDER, { videoProvider: 'GOOGLE_MEET' } as any);
    expect(connected.prisma.consultTherapistProfile.update.mock.calls[0][0].data.videoProvider).toBe('GOOGLE_MEET');

    const plain = make();
    await plain.service.updateTherapistProfile(TENANT, PROVIDER, { videoProvider: 'BUILT_IN' } as any);
    expect(plain.prisma.consultTherapistProfile.update.mock.calls[0][0].data.videoProvider).toBe('BUILT_IN');
  });

  it('tells the profile page whether Google is connected, never the token', async () => {
    const { service } = make({ googleRefreshToken: 'enc:token' });
    const profile: any = await service.getTherapistProfile(TENANT, PROVIDER);
    expect(profile.googleConnected).toBe(true);
    expect(JSON.stringify(profile, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/enc:token/);
  });
});
