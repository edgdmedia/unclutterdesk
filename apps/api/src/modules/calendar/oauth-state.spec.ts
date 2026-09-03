import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

/**
 * Google OAuth state.
 *
 * The state was `${tenantId}_${profileId}` — two sequential ids, so anyone
 * could predict a victim's. An attacker could run a consent flow with their own
 * Google account, put the victim's ids in the state, and have their refresh
 * token written onto that therapist's profile; from then on the practice's
 * bookings would push to the attacker's calendar. The write was also scoped by
 * profileId alone, so it crossed tenants.
 */
function makeService() {
  const prisma: any = {
    token: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    consultTherapistProfile: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const service = new CalendarService(prisma);
  // Stand in for Google's token exchange.
  (service as any).oauth2Client = {
    generateAuthUrl: (opts: any) => `https://accounts.google.com/o/oauth2/auth?state=${opts.state}`,
    getToken: vi.fn().mockResolvedValue({ tokens: { refresh_token: 'rt_attacker_or_owner' } }),
  };
  return { service, prisma };
}

async function issueState(service: CalendarService, tenant = '1', profile = '9') {
  const url = await service.generateAuthUrl(tenant, profile, '42');
  return decodeURIComponent(new URL(url).searchParams.get('state')!);
}

describe('Google OAuth state', () => {
  let service: CalendarService;
  let prisma: any;

  beforeEach(() => {
    ({ service, prisma } = makeService());
  });

  describe('issuing', () => {
    it('is not derivable from the ids', async () => {
      const state = await issueState(service, '1', '9');
      expect(state).not.toBe('1_9');
      expect(state).not.toContain('1_9');
    });

    it('differs every time for the same practitioner', async () => {
      expect(await issueState(service)).not.toBe(await issueState(service));
    });

    it('records a single-use nonce that expires', async () => {
      await issueState(service);
      const row = prisma.token.create.mock.calls[0][0].data;
      expect(row.type).toBe('google_oauth_state');
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(row.expiresAt.getTime()).toBeLessThan(Date.now() + 15 * 60 * 1000);
    });
  });

  describe('accepting a callback', () => {
    it('accepts the state it issued', async () => {
      const state = await issueState(service);
      await expect(service.handleCallback('code', state)).resolves.toBeUndefined();
    });

    it('writes the refresh token scoped to tenant and profile', async () => {
      const state = await issueState(service, '7', '9');
      await service.handleCallback('code', state);
      expect(prisma.consultTherapistProfile.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 7n, profileId: 9n },
        data: { googleRefreshToken: 'rt_attacker_or_owner' },
      });
    });

    it('never uses the unscoped update', async () => {
      const state = await issueState(service);
      await service.handleCallback('code', state);
      expect(prisma.consultTherapistProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('rejecting', () => {
    it('the old predictable format', async () => {
      await expect(service.handleCallback('code', '1_9')).rejects.toThrow(BadRequestException);
    });

    it('a missing state', async () => {
      await expect(service.handleCallback('code', '')).rejects.toThrow(BadRequestException);
    });

    it('a payload whose signature does not match', async () => {
      const state = await issueState(service);
      const [payload] = state.split('.');
      await expect(service.handleCallback('code', `${payload}.forged`)).rejects.toThrow(
        BadRequestException,
      );
    });

    // The attack the fix exists for: swap in someone else's ids and re-sign
    // nothing. The signature covers the payload, so it no longer verifies.
    it('a payload edited to name a different practitioner', async () => {
      const state = await issueState(service, '1', '9');
      const [payload, signature] = state.split('.');
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
      decoded.p = '999';
      const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url');

      await expect(service.handleCallback('code', `${tampered}.${signature}`)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.consultTherapistProfile.updateMany).not.toHaveBeenCalled();
    });

    it('a replayed state', async () => {
      const state = await issueState(service);
      prisma.token.deleteMany.mockResolvedValue({ count: 0 }); // already consumed
      await expect(service.handleCallback('code', state)).rejects.toThrow(BadRequestException);
    });

    it('an expired state', async () => {
      const state = await issueState(service);
      vi.setSystemTime(new Date(Date.now() + 11 * 60 * 1000));
      await expect(service.handleCallback('code', state)).rejects.toThrow(BadRequestException);
      vi.useRealTimers();
    });

    it('exchanges the code only after the state is validated', async () => {
      await service.handleCallback('code', '1_9').catch(() => undefined);
      expect((service as any).oauth2Client.getToken).not.toHaveBeenCalled();
    });

    it('a practitioner who is not in the state tenant', async () => {
      prisma.consultTherapistProfile.updateMany.mockResolvedValue({ count: 0 });
      const state = await issueState(service);
      await expect(service.handleCallback('code', state)).rejects.toThrow(BadRequestException);
    });
  });
});
