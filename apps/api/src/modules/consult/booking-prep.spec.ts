import { describe, expect, it, vi } from 'vitest';
import { ConsultService } from './consult.service';

/**
 * The prep payload carries two notes with two jobs: the last session's note
 * ("where you left off") and this session's own note, which the session room
 * edits. The room once edited the first, so a locked note from last week
 * locked today's editor and the practitioner could not write a SOAP note.
 */
const TENANT = 1n;
const PROVIDER = 5n;
const BOOKING = 100n;

function make(notes: { previous?: any; own?: any }) {
  const booking = {
    id: BOOKING,
    clientProfileId: 9n,
    availabilityId: 3n,
    status: 'COMPLETED',
    client: { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com' },
    service: { title: 'Therapy' },
    availability: { startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000), providerProfileId: PROVIDER },
    location: null,
  };
  const prisma: any = {
    consultBooking: { findFirst: vi.fn(async ({ where }: any) => (where.id === BOOKING ? booking : null)) },
    clinicalNote: {
      findFirst: vi.fn(async ({ where }: any) => (where.bookingId === BOOKING ? notes.own ?? null : notes.previous ?? null)),
    },
    universalFormSubmission: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new ConsultService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  return { service, prisma };
}

const note = (id: bigint, isLocked: boolean, subjective: string) => ({
  id,
  subjective,
  objective: null,
  assessment: null,
  plan: null,
  isLocked,
  createdAt: new Date(),
});

describe("a session's prep", () => {
  it("returns this session's own note apart from the last session's", async () => {
    const { service } = make({ previous: note(1n, true, 'last week'), own: note(2n, false, 'today') });
    const prep = await service.getBookingPrep(TENANT, PROVIDER, BOOKING);
    expect(prep.latestNote).toMatchObject({ id: '1', isLocked: true });
    expect(prep.sessionNote).toMatchObject({ id: '2', isLocked: false, subjective: 'today' });
  });

  it('has no session note before one is written, even when the last one is locked', async () => {
    const { service } = make({ previous: note(1n, true, 'last week') });
    const prep = await service.getBookingPrep(TENANT, PROVIDER, BOOKING);
    expect(prep.sessionNote).toBeNull();
  });

  it("looks for this session's note by booking, in this practice", async () => {
    const { service, prisma } = make({});
    await service.getBookingPrep(TENANT, PROVIDER, BOOKING);
    const own = prisma.clinicalNote.findFirst.mock.calls.find((c: any[]) => c[0].where.bookingId === BOOKING);
    expect(own[0].where).toMatchObject({ tenantId: TENANT, bookingId: BOOKING });
  });
});
