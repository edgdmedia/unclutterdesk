import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { reviewInviteToken } from '../consult/review-invite';

/**
 * A review sent from a review request link. The signed link says who the
 * client is and which session it was, so the request's name and email are
 * never trusted: a link cannot file a review as someone else.
 */
const TENANT = 1n;
const FORM = { id: 3n, tenantId: TENANT, title: 'Leave a review', targetType: 'REVIEW', reviewPublicationMode: 'MANUAL', schemaJson: [] };

function make(over: { form?: any; booking?: any; reviewed?: any } = {}) {
  const prisma: any = {
    universalForm: { findFirst: vi.fn().mockResolvedValue(over.form === undefined ? FORM : over.form) },
    consultBooking: { findFirst: vi.fn().mockResolvedValue(over.booking === undefined ? { id: 900n, clientProfileId: 40n } : over.booking) },
    profile: { findFirst: vi.fn().mockResolvedValue({ id: 40n, tenantId: TENANT, firstName: 'Ada', lastName: 'Ola', email: 'ada@example.com' }), create: vi.fn(), update: vi.fn() },
    universalFormSubmission: {
      findFirst: vi.fn().mockResolvedValue(over.reviewed ?? null),
      create: vi.fn(async ({ data }: any) => ({ id: 77n, createdAt: new Date(), ...data })),
    },
  };
  return { prisma, service: new IntakeService(prisma) };
}

const dto = (over: Record<string, unknown> = {}) => ({
  formId: '3',
  bookingId: '900',
  inviteToken: reviewInviteToken(TENANT, 900n),
  clientName: 'Someone Else',
  clientEmail: 'someone@else.com',
  answersJson: { rating: 5 },
  ...over,
});

describe('a review from a review request link', () => {
  it("is filed as the session's client, against the session", async () => {
    const { service, prisma } = make();
    await service.submitReviewByInvite(TENANT, dto());
    const row = prisma.universalFormSubmission.create.mock.calls[0][0].data;
    expect(row).toMatchObject({ tenantId: TENANT, formId: 3n, bookingId: 900n, clientProfileId: 40n, targetType: 'REVIEW' });
    // The name and email in the request were not used to find or make anyone.
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  it('refuses a forged or reused link', async () => {
    const { service, prisma } = make();
    await expect(service.submitReviewByInvite(TENANT, dto({ inviteToken: 'forged' }))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.submitReviewByInvite(TENANT, dto({ bookingId: '901' }))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.universalFormSubmission.create).not.toHaveBeenCalled();
  });

  it('only for a review form', async () => {
    const { service } = make({ form: { ...FORM, targetType: 'INTAKE' } });
    await expect(service.submitReviewByInvite(TENANT, dto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('once per session', async () => {
    const { service, prisma } = make({ reviewed: { id: 5n } });
    await expect(service.submitReviewByInvite(TENANT, dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.universalFormSubmission.create).not.toHaveBeenCalled();
  });
});
