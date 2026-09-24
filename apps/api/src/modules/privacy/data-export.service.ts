import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { chargedKobo } from '../../common/revenue';

export const ERASED_STATUS = 'erased';

/**
 * Subject access under the NDPA.
 *
 * A person may ask a practice for the personal data it holds about them, and
 * the practice has to be able to answer. Until now it could not: closing a
 * practice was implemented and erasure was implemented, but there was no way
 * to produce a copy of what is held, so a subject access request had no route
 * through the product at all.
 *
 * The practice is the controller of its clients' records — the same reason
 * erasure runs through the practice rather than the platform — so this is a
 * practice owner or admin fulfilling a request on behalf of the person who
 * made it, tenant-scoped so one practice can never export another's client.
 *
 * ## What is in the export, and what is deliberately not
 *
 * Everything here is the client's own: who they are, what they booked, what
 * they were charged, what they themselves wrote on intake and assessment
 * forms, and what the practice sent them.
 *
 * Clinical notes are listed but their content is withheld. A SOAP note is the
 * clinician's record *about* the person, frequently contains third-party
 * detail — a family member, a safeguarding concern — and in most regimes
 * releasing clinical narrative is a judgement a clinician makes case by case,
 * with exemptions for serious harm and for information about other people.
 * Handing that out automatically because an endpoint was called would take
 * that judgement away from the practitioner and hand it to a web request.
 *
 * So the export says a note exists, when it was written, whether it is locked,
 * and which booking it belongs to. That is enough for the person to know the
 * record exists and to ask for it — which is the point of subject access —
 * without the software deciding on the clinician's behalf that it may be
 * disclosed.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async exportClientData(tenantId: bigint, actorProfileId: bigint, clientProfileId: bigint) {
    const actor = await this.prisma.profile.findFirst({
      where: { id: actorProfileId, tenantId },
      select: { id: true, role: true },
    });

    if (!actor || !['OWNER', 'ADMIN'].includes(actor.role)) {
      throw new ForbiddenException('Only a practice owner or admin can export client data');
    }

    // Scoped to the actor's tenant, so one practice can never export another's
    // client — the same rule erasure follows, for the same reason.
    const client = await this.prisma.profile.findFirst({
      where: { id: clientProfileId, tenantId },
      include: { tenant: { select: { name: true, slug: true } } },
    });

    if (!client) {
      throw new NotFoundException('Client not found in this practice');
    }

    if (client.role !== 'CLIENT') {
      throw new BadRequestException(
        'This endpoint exports client records only. A staff member exports their own data from their account.',
      );
    }

    if (client.status === ERASED_STATUS) {
      // The identifiers are gone by design; an export would be a page of
      // tombstones presented as though it were someone's record.
      throw new BadRequestException(
        'This client has been erased, so there is no personal data left to export.',
      );
    }

    const [bookings, submissions, notes, notifications] = await Promise.all([
      this.prisma.consultBooking.findMany({
        where: { tenantId, clientProfileId },
        include: {
          service: { select: { title: true, priceKobo: true, durationMinutes: true } },
          availability: { select: { startsAt: true, endsAt: true, channel: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.universalFormSubmission.findMany({
        where: { tenantId, clientProfileId },
        include: { form: { select: { title: true, systemKey: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clinicalNote.findMany({
        where: { tenantId, clientProfileId },
        // Content is deliberately not selected — see the note above. Selecting
        // it and stripping it later would put it in memory and in any log of
        // this query for no reason.
        select: {
          id: true,
          bookingId: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.findMany({
        where: { profileId: clientProfileId },
        select: { id: true, type: true, title: true, message: true, createdAt: true, readAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    this.logger.log(
      `Client data export: profile ${clientProfileId} in tenant ${tenantId}, by ${actorProfileId}`,
    );

    return {
      // A dated export is the artefact the practice hands over; without this
      // the person cannot tell how current it is.
      generatedAt: new Date().toISOString(),
      practice: { name: client.tenant?.name ?? null, slug: client.tenant?.slug ?? null },

      about: {
        profileId: client.id.toString(),
        email: client.email,
        username: client.username,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        gender: client.gender,
        dateOfBirth: client.dateOfBirth ? client.dateOfBirth.toISOString() : null,
        avatarUrl: client.avatarUrl,
        status: client.status,
        emailVerified: client.emailVerified,
        registeredAt: client.createdAt.toISOString(),
      },

      appointments: bookings.map((booking) => ({
        bookingId: booking.id.toString(),
        service: booking.service?.title ?? null,
        durationMinutes: booking.service?.durationMinutes ?? null,
        startsAt: booking.availability?.startsAt?.toISOString() ?? null,
        endsAt: booking.availability?.endsAt?.toISOString() ?? null,
        channel: booking.availability?.channel ?? null,
        status: booking.status,
        // What was actually charged, not the service's price today.
        amountKobo: chargedKobo(booking).toString(),
        discountCode: booking.discountCodeUsed,
        paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
        paymentReference: booking.paymentRef,
        bookedAt: booking.createdAt.toISOString(),
        notes: booking.notes,
      })),

      // The person's own words: intake answers, consent, PHQ-9 and GAD-7.
      formsYouCompleted: submissions.map((submission) => ({
        submissionId: submission.id.toString(),
        form: submission.form?.title ?? null,
        // systemKey names the instrument: consent, phq9, gad7.
        instrument: submission.form?.systemKey ?? null,
        bookingId: submission.bookingId ? submission.bookingId.toString() : null,
        status: submission.status,
        answers: submission.answersJson,
        scores: submission.derivedJson,
        submittedAt: submission.createdAt.toISOString(),
      })),

      clinicalNotes: {
        note:
          'Your practitioner keeps a clinical record of your sessions. This export lists ' +
          'those records without their content, because releasing clinical notes is a ' +
          'decision your practitioner makes with you. Ask them for a copy.',
        records: notes.map((note) => ({
          noteId: note.id.toString(),
          bookingId: note.bookingId ? note.bookingId.toString() : null,
          writtenAt: note.createdAt.toISOString(),
          lastUpdatedAt: note.updatedAt ? note.updatedAt.toISOString() : null,
          signedAndLocked: note.isLocked,
        })),
      },

      messagesSentToYou: notifications.map((item) => ({
        id: item.id.toString(),
        type: item.type,
        title: item.title,
        message: item.message,
        sentAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
      })),
    };
  }
}
