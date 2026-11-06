import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReviewRequestService } from './review-request.service';
import { reviewInviteToken, reviewInviteTokenValid } from './review-invite';
import { tenantWebOrigin } from '../../common/origins';

/**
 * Asking a client for a review. Never automatic: many therapy ethics codes
 * caution against soliciting testimonials from clients still in care, so the
 * practitioner chooses, per completed session, and each session is asked once.
 * The email carries a signed link, so the form knows who the client is and
 * which session it was, and nobody else can use it.
 */
const TENANT = 1n;
const OWN = { profileId: 6n, viewAll: false, clinical: true };
const DESK = { profileId: 9n, viewAll: true };

function make(over: { booking?: any; form?: any; reviewed?: any } = {}) {
  const booking = {
    id: 900n,
    tenantId: TENANT,
    status: 'COMPLETED',
    reviewRequestedAt: null,
    client: { id: 40n, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com' },
    service: { title: 'Individual Therapy' },
    availability: { startsAt: new Date('2026-11-05T10:00:00Z'), providerProfileId: 6n, therapist: { profile: { firstName: 'Segun', lastName: 'Ade' } } },
    ...(over.booking ?? {}),
  };
  const prisma: any = {
    consultBooking: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (over.booking === null) return null;
        const provider = where.availability?.providerProfileId;
        if (provider !== undefined && provider !== booking.availability.providerProfileId) return null;
        return booking;
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    universalForm: { findFirst: vi.fn().mockResolvedValue(over.form === undefined ? { id: 3n } : over.form) },
    universalFormSubmission: { findFirst: vi.fn().mockResolvedValue(over.reviewed ?? null) },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null }) },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  return { prisma, notifications, service: new ReviewRequestService(prisma, notifications) };
}

describe('the signed review link', () => {
  it('is valid for its own session only', () => {
    const t = reviewInviteToken(TENANT, 900n);
    expect(reviewInviteTokenValid(TENANT, 900n, t)).toBe(true);
    expect(reviewInviteTokenValid(TENANT, 901n, t)).toBe(false);
    expect(reviewInviteTokenValid(2n, 900n, t)).toBe(false);
    expect(reviewInviteTokenValid(TENANT, 900n, 'nope')).toBe(false);
    expect(reviewInviteTokenValid(TENANT, 900n, undefined)).toBe(false);
  });
});

describe('sending a review request', () => {
  it('emails the client a signed link to the review form for this session', async () => {
    const { service, notifications } = make();
    await service.send(TENANT, OWN, 900n);
    const mail = notifications.sendEmail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: 'ada@example.com', type: 'bookings.review_request', tenantId: TENANT, profileId: 40n });
    expect(mail.link).toBe(`${tenantWebOrigin({ slug: 'calm' })}/review?booking=900&t=${reviewInviteToken(TENANT, 900n)}`);
    expect(mail.message).toMatch(/Segun Ade/);
  });

  it('records when it was asked, once', async () => {
    const { service, prisma } = make();
    const r = await service.send(TENANT, OWN, 900n);
    const call = prisma.consultBooking.updateMany.mock.calls[0][0];
    // The match carries "not yet asked", so two clicks send one email.
    expect(call.where).toMatchObject({ id: 900n, tenantId: TENANT, reviewRequestedAt: null });
    expect(call.data.reviewRequestedAt).toBeInstanceOf(Date);
    expect(r.reviewRequestedAt).toEqual(expect.any(String));
  });

  it('refuses a session already asked', async () => {
    const { service, notifications } = make({ booking: { reviewRequestedAt: new Date('2026-11-05T12:00:00Z') } });
    await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow(/already asked/i);
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('sends nothing when another click already claimed it', async () => {
    const { service, prisma, notifications } = make();
    prisma.consultBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow(/already asked/i);
    expect(notifications.sendEmail).not.toHaveBeenCalled();
  });

  it('frees the session to be asked again when the email fails', async () => {
    const { service, prisma, notifications } = make();
    notifications.sendEmail.mockRejectedValue(new Error('smtp'));
    await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow('smtp');
    const undo = prisma.consultBooking.updateMany.mock.calls[1][0];
    expect(undo.data).toEqual({ reviewRequestedAt: null });
  });

  it('only for a completed session', async () => {
    for (const status of ['CONFIRMED', 'CANCELLED', 'PENDING_PAYMENT']) {
      const { service } = make({ booking: { status } });
      await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow(/completed/i);
    }
  });

  it('needs a review form', async () => {
    const { service } = make({ form: null });
    await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow(/review form/i);
  });

  it('needs the client to have an email', async () => {
    const { service } = make({ booking: { client: { id: 40n, firstName: 'Ada', lastName: null, email: null } } });
    await expect(service.send(TENANT, OWN, 900n)).rejects.toThrow(/no email/i);
  });

  it("a therapist may not ask another practitioner's client", async () => {
    const { service } = make({ booking: { availability: { startsAt: new Date(), providerProfileId: 77n, therapist: { profile: {} } } } });
    await expect(service.send(TENANT, OWN, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the desk may ask for any session', async () => {
    const { service, notifications } = make({ booking: { availability: { startsAt: new Date(), providerProfileId: 77n, therapist: { profile: { firstName: 'Bola' } } } } });
    await service.send(TENANT, DESK, 900n);
    expect(notifications.sendEmail).toHaveBeenCalled();
  });
});

describe('opening the link', () => {
  it('says who the client is and which session, for a valid link', async () => {
    const { service } = make();
    const r = await service.invite(TENANT, 900n, reviewInviteToken(TENANT, 900n));
    expect(r).toEqual({
      firstName: 'Ada',
      practitionerName: 'Segun Ade',
      serviceTitle: 'Individual Therapy',
      sessionAt: '2026-11-05T10:00:00.000Z',
      alreadyReviewed: false,
    });
  });

  it('gives away nothing for a bad link, not even that the session exists', async () => {
    const { service, prisma } = make();
    await expect(service.invite(TENANT, 900n, 'forged')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.findFirst).not.toHaveBeenCalled();
  });

  it('says when this session was already reviewed', async () => {
    const { service } = make({ reviewed: { id: 5n } });
    const r = await service.invite(TENANT, 900n, reviewInviteToken(TENANT, 900n));
    expect(r.alreadyReviewed).toBe(true);
  });

  it('is refused for a missing booking', async () => {
    const { service } = make({ booking: null });
    await expect(service.invite(TENANT, 900n, reviewInviteToken(TENANT, 900n))).rejects.toBeInstanceOf(NotFoundException);
  });
});

