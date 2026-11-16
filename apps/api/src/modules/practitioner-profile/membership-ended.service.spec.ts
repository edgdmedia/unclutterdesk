import { describe, expect, it, vi } from 'vitest';
import { MembershipEndedService } from './membership-ended.service';
import { PURGE_JOB } from './profile-purge.job';

/**
 * A small in-memory stand-in for the database: it holds places, profiles,
 * memberships and practices, and answers the queries the service makes, so
 * the tests check what ends up stored rather than which calls were made.
 */
type Place = { id: bigint; profileId: bigint; tenantId: bigint; therapistProfileId: bigint; isMain: boolean; sortOrder: number; createdAt: Date };
type PProfile = { id: bigint; userId: bigint; handle: string; status: string; bookingMode: string; displayName: string };

function world() {
  const tenants = new Map<bigint, { id: bigint; name: string }>([
    [5n, { id: 5n, name: 'Calm Clinic' }],
    [6n, { id: 6n, name: 'Harbour Practice' }],
  ]);
  const users = new Map<bigint, { id: bigint; email: string }>([[1n, { id: 1n, email: 'folake@example.com' }]]);
  // Folake's memberships: 50 in Calm Clinic, 60 in Harbour Practice.
  const memberships = new Map<bigint, { id: bigint; tenantId: bigint; userId: bigint | null }>([
    [50n, { id: 50n, tenantId: 5n, userId: 1n }],
    [60n, { id: 60n, tenantId: 6n, userId: 1n }],
  ]);
  const profiles = new Map<bigint, PProfile>([
    [100n, { id: 100n, userId: 1n, handle: 'folake', status: 'PUBLISHED', bookingMode: 'DESK', displayName: 'Folake Adeyemi' }],
  ]);
  let places: Place[] = [
    { id: 1n, profileId: 100n, tenantId: 5n, therapistProfileId: 50n, isMain: true, sortOrder: 0, createdAt: new Date('2026-10-01') },
    { id: 2n, profileId: 100n, tenantId: 6n, therapistProfileId: 60n, isMain: false, sortOrder: 1, createdAt: new Date('2026-10-02') },
  ];

  const matches = (p: Place, where: any) =>
    (where.id === undefined || p.id === where.id) &&
    (where.profileId === undefined || p.profileId === where.profileId) &&
    (where.tenantId === undefined || p.tenantId === where.tenantId) &&
    (where.isMain === undefined || p.isMain === where.isMain) &&
    (where.therapistProfileId === undefined ||
      (typeof where.therapistProfileId === 'bigint' ? p.therapistProfileId === where.therapistProfileId : where.therapistProfileId.in.includes(p.therapistProfileId)));

  const joined = (p: Place) => ({
    ...p,
    tenant: tenants.get(p.tenantId)!,
    profile: { ...profiles.get(p.profileId)!, user: users.get(profiles.get(p.profileId)!.userId)! },
  });

  const placeModel = {
    findMany: async ({ where }: any) => places.filter((p) => matches(p, where)).map(joined),
    findFirst: async ({ where }: any) =>
      places.filter((p) => matches(p, where)).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null,
    delete: async ({ where }: any) => {
      const found = places.find((p) => p.id === where.id);
      if (!found) throw new Error('Record to delete does not exist');
      places = places.filter((p) => p.id !== where.id);
      return found;
    },
    deleteMany: async ({ where }: any) => {
      const before = places.length;
      places = places.filter((p) => !matches(p, where));
      return { count: before - places.length };
    },
    update: async ({ where, data }: any) => Object.assign(places.find((p) => p.id === where.id)!, data),
    count: async ({ where }: any) => places.filter((p) => matches(p, where)).length,
  };
  const practitionerProfile = {
    update: async ({ where, data }: any) => Object.assign(profiles.get(where.id)!, data),
  };
  const profile = {
    findMany: async ({ where }: any) =>
      [...memberships.values()]
        .filter((m) => (where.id ? where.id.in.includes(m.id) : true) && (where.tenantId === undefined || m.tenantId === where.tenantId) && m.userId !== null)
        .map((m) => {
          const pp = [...profiles.values()].find((x) => x.userId === m.userId) ?? null;
          return {
            id: m.id,
            tenant: tenants.get(m.tenantId)!,
            user: { email: users.get(m.userId!)!.email, practitionerProfile: pp && { ...pp, places: places.filter((pl) => pl.profileId === pp.id && pl.therapistProfileId === m.id) } },
          };
        }),
  };
  const prisma: any = {
    practitionerPlace: placeModel,
    practitionerProfile,
    profile,
    $transaction: async (fn: any) => fn(prisma),
  };
  const jobs = { enqueue: vi.fn(async () => ({ id: 1n })), runNow: vi.fn(async () => undefined) };
  const notifications = { sendEmail: vi.fn(async (_input: any) => ({ ok: true })) };
  const service = new MembershipEndedService(prisma, jobs as any, notifications as any);
  return { service, jobs, notifications, places: () => places, profile: () => profiles.get(100n)!, memberships };
}

const purgedTags = (jobs: { enqueue: ReturnType<typeof vi.fn> }) =>
  jobs.enqueue.mock.calls.filter(([type]) => type === PURGE_JOB).flatMap(([, payload]: any) => payload.tags);

describe('leaving a practice (§6.14)', () => {
  it("removes only that practice's place and keeps the others", async () => {
    const w = world();
    await w.service.onMembershipEnded([60n]);
    expect(w.places().map((p) => p.tenantId)).toEqual([5n]);
    expect(w.places()[0].isMain).toBe(true);
    expect(w.profile().bookingMode).toBe('DESK');
  });

  it('promotes the next place by sort order when the main place goes', async () => {
    const w = world();
    await w.service.onMembershipEnded([50n]);
    expect(w.places()).toHaveLength(1);
    expect(w.places()[0]).toMatchObject({ tenantId: 6n, isMain: true });
    expect(w.profile().bookingMode).toBe('DESK');
  });

  it('still leaves one main place when several end at once', async () => {
    const w = world();
    w.places().push({ id: 3n, profileId: 100n, tenantId: 7n, therapistProfileId: 70n, isMain: false, sortOrder: 2, createdAt: new Date('2026-10-03') });
    await w.service.onMembershipEnded([50n, 60n]);
    expect(w.places()).toEqual([expect.objectContaining({ therapistProfileId: 70n, isMain: true })]);
  });

  it('falls back to NONE when no places remain', async () => {
    const w = world();
    await w.service.onMembershipEnded([50n, 60n]);
    expect(w.places()).toHaveLength(0);
    expect(w.profile().bookingMode).toBe('NONE');
  });

  it('leaves an external booking link alone when the last place goes', async () => {
    const w = world();
    w.profile().bookingMode = 'EXTERNAL';
    await w.service.onMembershipEnded([50n, 60n]);
    expect(w.profile().bookingMode).toBe('EXTERNAL');
  });

  it('purges the public page so a printed QR code still lands on a working profile', async () => {
    const w = world();
    await w.service.onMembershipEnded([60n]);
    expect(purgedTags(w.jobs)).toContain('profile:folake');
  });

  it('does not purge a page that is not published', async () => {
    const w = world();
    w.profile().status = 'DRAFT';
    await w.service.onMembershipEnded([60n]);
    expect(purgedTags(w.jobs)).toEqual([]);
  });

  it('emails the therapist naming the practice', async () => {
    const w = world();
    await w.service.onMembershipEnded([60n]);
    expect(w.notifications.sendEmail).toHaveBeenCalledTimes(1);
    const email = w.notifications.sendEmail.mock.calls[0][0] as any;
    expect(email.to).toBe('folake@example.com');
    expect(email.message).toContain('Your profile no longer books through Harbour Practice.');
    expect(email.message).not.toContain('Set up your own booking');
  });

  it('offers one-step own booking when no places remain', async () => {
    const w = world();
    await w.service.onMembershipEnded([50n, 60n]);
    const last = w.notifications.sendEmail.mock.calls.at(-1)![0] as any;
    expect(last.message).toContain('Set up your own booking in one step');
    expect(last.link).toMatch(/\/dashboard\/profile\/own-booking$/);
  });

  it('does nothing, and sends nothing, for a membership with no place', async () => {
    const w = world();
    await w.service.onMembershipEnded([999n]);
    expect(w.places()).toHaveLength(2);
    expect(w.notifications.sendEmail).not.toHaveBeenCalled();
    expect(w.jobs.enqueue).not.toHaveBeenCalled();
  });

  it('is safe to run twice for the same exit', async () => {
    const w = world();
    await w.service.onMembershipEnded([60n]);
    await w.service.onMembershipEnded([60n]);
    expect(w.places()).toHaveLength(1);
    expect(w.notifications.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('removes every place in a practice that is switched off or closed', async () => {
    const w = world();
    await w.service.onPracticeEnded(5n);
    expect(w.places().map((p) => p.tenantId)).toEqual([6n]);
    expect(w.places()[0].isMain).toBe(true);
  });

  it('keeps going when an email fails: the place is still removed', async () => {
    const w = world();
    w.notifications.sendEmail.mockRejectedValueOnce(new Error('smtp down'));
    await w.service.onMembershipEnded([60n]);
    expect(w.places()).toHaveLength(1);
  });
});

describe('membership reactivated (§6.14)', () => {
  it('does not re-add the place, and tells the therapist they can add it back', async () => {
    const w = world();
    await w.service.onMembershipEnded([60n]);
    w.notifications.sendEmail.mockClear();
    await w.service.onMembershipReactivated([60n]);
    expect(w.places().map((p) => p.tenantId)).toEqual([5n]);
    expect(w.notifications.sendEmail).toHaveBeenCalledTimes(1);
    expect((w.notifications.sendEmail.mock.calls[0][0] as any).message).toContain('add Harbour Practice back');
  });

  it('says nothing when the place is still on the profile', async () => {
    const w = world();
    await w.service.onMembershipReactivated([60n]);
    expect(w.notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('covers every member of a practice switched back on', async () => {
    const w = world();
    await w.service.onPracticeEnded(6n);
    w.notifications.sendEmail.mockClear();
    await w.service.onPracticeReactivated(6n);
    expect(w.notifications.sendEmail).toHaveBeenCalledTimes(1);
  });
});
