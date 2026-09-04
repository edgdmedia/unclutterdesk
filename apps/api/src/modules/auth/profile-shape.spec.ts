import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';

/**
 * Login, refresh and /status describe the signed-in profile the same way.
 *
 * They used to disagree. Refresh carried practiceName and tenantSlug; login
 * carried neither; /status carried tenantId but neither of those, and added
 * isTherapist that the other two lacked. So a client reading tenantSlug after
 * signing in got nothing until a token refresh happened — and tenantSlug is
 * what the booking link and the practice branding are built from, so the app
 * worked by luck of whatever triggered a refresh first.
 */
const FIELDS = [
  'id',
  'tenantId',
  'email',
  'username',
  'firstName',
  'lastName',
  'type',
  'status',
  'avatarUrl',
  'practiceName',
  'tenantSlug',
  'isTherapist',
].sort();

const PROFILE = {
  id: 5n,
  tenantId: 1n,
  email: 'ada@practice.ng',
  username: null,
  firstName: 'Ada',
  lastName: 'Ola',
  type: 'therapist',
  status: 'active',
  avatarUrl: null,
  tenant: { name: 'Ada Therapy', slug: 'ada-therapy' },
  consultTherapistProfile: { id: 9n },
};

/** The private builder every one of the three endpoints now goes through. */
function build(profile: unknown) {
  const service = new AuthService({} as any, {} as any, {} as any, {} as any);
  return (service as unknown as { practiceProfile: (p: unknown) => Record<string, unknown> })
    .practiceProfile(profile);
}

describe('the signed-in profile', () => {
  it('carries every field the app reads', () => {
    expect(Object.keys(build(PROFILE)).sort()).toEqual(FIELDS);
  });

  // The field the booking link and the practice branding are built from.
  it('carries the practice slug', () => {
    expect(build(PROFILE).tenantSlug).toBe('ada-therapy');
  });

  it('carries the practice name', () => {
    expect(build(PROFILE).practiceName).toBe('Ada Therapy');
  });

  it('says whether this person takes appointments', () => {
    expect(build(PROFILE).isTherapist).toBe(true);
    expect(build({ ...PROFILE, consultTherapistProfile: null }).isTherapist).toBe(false);
  });

  it('renders ids as strings, since they are BigInt and JSON has no such thing', () => {
    const built = build(PROFILE);
    expect(built.id).toBe('5');
    expect(built.tenantId).toBe('1');
  });

  /*
   * A profile whose tenant was not loaded reports null rather than throwing.
   * The parameter type requires the relation, so a caller that forgets the
   * include fails to compile — this is the belt to that pair of braces.
   */
  it('reports null rather than guessing when the tenant was not loaded', () => {
    const built = build({ ...PROFILE, tenant: null });
    expect(built.tenantSlug).toBeNull();
    expect(built.practiceName).toBeNull();
  });

  it('never returns the password or the user row', () => {
    const built = build({ ...PROFILE, user: { password: 'hashed' } });
    expect(built).not.toHaveProperty('password');
    expect(built).not.toHaveProperty('user');
    expect(JSON.stringify(built)).not.toContain('hashed');
  });
});
