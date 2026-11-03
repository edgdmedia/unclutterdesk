import { describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service';

/* §6.17 with §6.16: a solo practice's page uses its owner's profile where its own fields are empty. */
const facts = { displayName: 'Dr Ada Obi', photoUrl: 'https://media.example/ada.webp', headline: 'Calm support', about: 'I help adults with anxiety.', city: 'Lagos' };

function service({ members = [{ profile: { role: 'OWNER', userId: 7n } }], useProfile = true } = {}) {
  const prisma: any = {
    tenant: { findUnique: vi.fn(async () => ({ useProfileForPractice: useProfile })) },
    consultTherapistProfile: { findMany: vi.fn(async () => members) },
  };
  const personFacts: any = { forUsers: vi.fn(async () => new Map([['7', facts]])) };
  return new TenantService(prisma, {} as any, undefined, undefined, personFacts);
}

describe('solo practice page from the owner\'s profile', () => {
  it('fills empty practice fields from the owner\'s profile', async () => {
    expect(await service().withSoloProfile(1n, { welcomeMessage: null, tagline: '', city: null, logoUrl: null })).toEqual({
      welcomeMessage: 'I help adults with anxiety.', tagline: 'Calm support', city: 'Lagos', logoUrl: 'https://media.example/ada.webp',
    });
  });

  it('never overrides what the practice has filled in', async () => {
    expect(await service().withSoloProfile(1n, { welcomeMessage: 'Welcome to our practice', tagline: 'Our line', city: 'Abuja', logoUrl: 'https://x/logo.png' })).toEqual({});
  });

  it('does nothing for a team practice, a practice whose owner doesn\'t see clients, or when switched off', async () => {
    const empty = { welcomeMessage: null, tagline: null, city: null, logoUrl: null };
    expect(await service({ members: [{ profile: { role: 'OWNER', userId: 7n } }, { profile: { role: 'THERAPIST', userId: 8n } }] }).withSoloProfile(1n, empty)).toEqual({});
    expect(await service({ members: [{ profile: { role: 'THERAPIST', userId: 8n } }] }).withSoloProfile(1n, empty)).toEqual({});
    expect(await service({ useProfile: false }).withSoloProfile(1n, empty)).toEqual({});
  });
});
