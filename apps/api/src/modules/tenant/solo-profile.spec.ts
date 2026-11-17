import { describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service';

/* §6.17 with §6.16: a solo practice's page uses its owner's profile where its own fields are empty. */
const facts = { displayName: 'Dr Ada Obi', photoUrl: 'https://media.example/ada.webp', headline: 'Calm support', about: 'I help adults with anxiety.', city: 'Lagos' };

function service({
  members = [{ profile: { role: 'OWNER', userId: 7n } }],
  useProfile = true,
  look = null as { themeKey: string; brandColor: string | null } | null,
} = {}) {
  const prisma: any = {
    tenant: { findUnique: vi.fn(async () => ({ useProfileForPractice: useProfile })) },
    consultTherapistProfile: { findMany: vi.fn(async () => members) },
    // The owner's profile look (§6.5): null for an owner with no profile.
    practitionerProfile: { findUnique: vi.fn(async ({ where }: any) => (where.userId === 7n ? look : null)) },
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

/* Shared public page plan task 6: the booking flow takes the look of the page it came from. */
describe("a solo practice's booking pages take the owner's profile look", () => {
  const fields = { welcomeMessage: 'Set', tagline: 'Set', city: 'Set', logoUrl: 'https://x/logo.png', primaryColor: '#0F3A53' };

  it("uses the profile palette's accent instead of the practice colour", async () => {
    expect(await service({ look: { themeKey: 'warm', brandColor: null } }).withSoloProfile(1n, fields)).toEqual({ primaryColor: '#8A5A3C' });
    expect(await service({ look: { themeKey: 'night', brandColor: null } }).withSoloProfile(1n, fields)).toEqual({ primaryColor: '#8FB6EC' });
  });

  it('uses a custom brand colour as the profile page shows it, made readable', async () => {
    // A light yellow is darkened until it reads, the same answer the profile page gets.
    const { brandTokens } = await import('../practitioner-profile/custom-colour');
    expect(await service({ look: { themeKey: 'custom', brandColor: '#F5D90A' } }).withSoloProfile(1n, fields)).toEqual({ primaryColor: brandTokens('#F5D90A')!.accent });
  });

  it("keeps the practice colour without an owner profile, for a team, or when switched off", async () => {
    expect(await service({ look: null }).withSoloProfile(1n, fields)).toEqual({});
    expect(await service({ look: { themeKey: 'warm', brandColor: null }, members: [{ profile: { role: 'OWNER', userId: 7n } }, { profile: { role: 'THERAPIST', userId: 8n } }] }).withSoloProfile(1n, fields)).toEqual({});
    expect(await service({ look: { themeKey: 'warm', brandColor: null }, useProfile: false }).withSoloProfile(1n, fields)).toEqual({});
  });
});

describe('the public practice info the booking pages read', () => {
  it("carries the owner's profile accent for a solo practice using its profile", async () => {
    const prisma: any = {
      tenant: {
        findFirst: vi.fn(async () => ({ id: 1n, name: 'Ada Practice', slug: 'ada', primaryColor: '#0F3A53', secondaryColor: '#E3B341', isActive: true })),
        findUnique: vi.fn(async () => ({ useProfileForPractice: true })),
      },
      consultTherapistProfile: { findMany: vi.fn(async () => [{ profile: { role: 'OWNER', userId: 7n } }]) },
      practitionerProfile: { findUnique: vi.fn(async () => ({ themeKey: 'earth', brandColor: null })) },
    };
    const info = await new TenantService(prisma, {} as any).getPublicTenantInfo('ada');
    expect(info.primaryColor).toBe('#56622A');
    expect(info.secondaryColor).toBe('#E3B341');
  });
});
