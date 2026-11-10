import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionRecapService } from './session-recap.service';
import { AssessmentService } from '../assessments/assessment.service';
import { InstrumentService } from '../assessments/instrument.service';
import { BUILTIN_INSTRUMENTS } from '../assessments/builtin-instruments';

/**
 * The recap as the client receives it: formatted in the email and as a page
 * in the portal, with assessments attached for the session and tick-boxes the
 * client ticks off. The real assessment service runs; only storage and the
 * email are faked.
 */
const TENANT = 1n;
const CLIENT = 40n;
const CLINICIAN = { profileId: 6n, viewAll: false, clinical: true };
const DESK = { profileId: 9n, viewAll: true, clinical: false, desk: true };

const t = (text: string) => ({ type: 'text', text });
const task = (text: string, checked = false) => ({ type: 'taskItem', attrs: { checked }, content: [{ type: 'paragraph', content: [t(text)] }] });
const RECAP = JSON.stringify({ type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [t('Your next steps')] },
  { type: 'taskList', content: [task('Day 1'), task('Day 2'), task('Day 3', true)] },
] });

function make(over: { booking?: Record<string, any>; enabled?: string[]; assigned?: any[]; plan?: string; found?: boolean } = {}) {
  const booking = {
    id: 900n,
    tenantId: TENANT,
    clientProfileId: CLIENT,
    clientRecap: RECAP,
    clientRecapSentAt: null as Date | null,
    recapAssessmentKeys: [] as string[],
    recapTicks: null as unknown,
    client: { id: CLIENT, email: 'ada@example.com', firstName: 'Ada', timezone: 'Africa/Lagos' },
    service: { title: 'Individual Therapy' },
    availability: { startsAt: new Date('2026-11-05T17:00:00Z'), therapist: { profile: { firstName: 'Olalekan', lastName: 'O' } } },
    ...over.booking,
  };
  const assigned: any[] = [...(over.assigned ?? [])];
  let nextId = 70n;
  const prisma: any = {
    consultBooking: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (over.found === false) return null;
        if (where.clientProfileId !== undefined && where.clientProfileId !== CLIENT) return null;
        if (where.clientRecapSentAt && !booking.clientRecapSentAt) return null;
        return booking;
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Calm Practice', slug: 'calm', customDomain: null, customDomainStatus: null, subscriptionTier: over.plan ?? 'PRO', subscriptionStatus: 'active' }) },
    tenantAssessment: { findUnique: vi.fn(async ({ where }: any) => ((over.enabled ?? ['BPAQ', 'DAR_5', 'RSES']).includes(where.tenantId_instrumentKey.instrumentKey) ? { id: 1 } : null)) },
    assessmentInstrument: {
      findUnique: vi.fn(async ({ where }: any) => stored(where.key)),
      findMany: vi.fn(async ({ where }: any) => where.key.in.map(stored).filter(Boolean)),
    },
    assessmentAssignment: {
      findMany: vi.fn(async () => assigned),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, id: nextId++, status: 'SENT', createdAt: new Date() };
        assigned.push(row);
        return row;
      }),
    },
  };
  const notifications: any = { sendEmail: vi.fn().mockResolvedValue({ success: true }) };
  const instruments = new InstrumentService(prisma);
  const assessments = new AssessmentService(prisma, notifications, instruments);
  return { service: new SessionRecapService(prisma, notifications, assessments), prisma, notifications, booking, assigned };
}

function stored(key: string) {
  const def = BUILTIN_INSTRUMENTS.find((d) => d.key === key);
  return def ? { key, version: 1, status: 'PUBLISHED', builtIn: true, definition: def, updatedAt: new Date() } : null;
}

describe('attaching assessments to a recap', () => {
  it('keeps the chosen ones, once each', async () => {
    const { service, prisma } = make();
    await service.setAttachments(TENANT, CLINICIAN, 900n, ['BPAQ', 'DAR_5', 'BPAQ']);
    expect(prisma.consultBooking.update).toHaveBeenCalledWith({ where: { id: 900n }, data: { recapAssessmentKeys: ['BPAQ', 'DAR_5'] } });
  });

  it('says now, not on send, when one cannot be sent', async () => {
    const off = make({ enabled: ['DAR_5'] });
    await expect(off.service.setAttachments(TENANT, CLINICIAN, 900n, ['BPAQ'])).rejects.toThrow(/Switch Buss–Perry AQ on/);
    const starter = make({ plan: 'STARTER' });
    await expect(starter.service.setAttachments(TENANT, CLINICIAN, 900n, ['BPAQ'])).rejects.toThrow(/Pro plan/);
    expect(off.prisma.consultBooking.update).not.toHaveBeenCalled();
  });

  it('refuses what is not a list of library keys, and too many at once', async () => {
    const { service } = make();
    await expect(service.setAttachments(TENANT, CLINICIAN, 900n, 'BPAQ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setAttachments(TENANT, CLINICIAN, 900n, ['bpaq; drop'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setAttachments(TENANT, CLINICIAN, 900n, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])).rejects.toThrow(/at most 6/);
  });

  it('is for clinical staff only', async () => {
    const { service } = make();
    await expect(service.setAttachments(TENANT, DESK, 900n, ['DAR_5'])).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('sending the recap', () => {
  it('refuses one that was never written', async () => {
    const { service } = make({ booking: { clientRecap: null } });
    await expect(service.send(TENANT, CLINICIAN, 900n)).rejects.toThrow(/Write the recap/);
  });

  it('emails it formatted, with a link to the portal page, and stamps the send', async () => {
    const { service, notifications, prisma } = make();
    await service.send(TENANT, CLINICIAN, 900n);
    const email = notifications.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: 'ada@example.com', type: 'bookings.session_recap', title: 'Your recap from Individual Therapy', actionLabel: 'Open in my portal', profileId: CLIENT });
    expect(email.link).toMatch(/\/portal\/sessions\/900\/recap$/);
    expect(email.richBody).toEqual(JSON.parse(RECAP));
    expect(email.message).toContain('Thursday 5 November');
    expect(email.links).toEqual([]);
    expect(prisma.consultBooking.update.mock.calls[0][0].data.clientRecapSentAt).toBeInstanceOf(Date);
  });

  it('assigns the attached assessments for the session and links each one', async () => {
    const { service, notifications, prisma } = make({ booking: { recapAssessmentKeys: ['BPAQ', 'DAR_5'] } });
    const r = await service.send(TENANT, CLINICIAN, 900n);
    expect(prisma.assessmentAssignment.create).toHaveBeenCalledTimes(2);
    expect(prisma.assessmentAssignment.create.mock.calls[0][0].data).toMatchObject({ tenantId: TENANT, clientProfileId: CLIENT, bookingId: 900n, instrumentKey: 'BPAQ', sentByProfileId: 6n });
    const email = notifications.sendEmail.mock.calls[0][0];
    // One email, the recap's: assessments attached to it send nothing of their own.
    expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.links.map((l: any) => l.label)).toEqual(['Start Buss–Perry AQ (about 10 minutes)', 'Start DAR-5 (about 2 minutes)']);
    expect(email.links[0].url).toMatch(/\/portal\/assessments\/70$/);
    expect(email.message).toContain('2 short questionnaires');
    expect(r.assessments.map((a) => a.key)).toEqual(['BPAQ', 'DAR_5']);
  });

  it('sending again does not send an assessment twice, and does not link one already done', async () => {
    const done = { id: 60n, instrumentKey: 'BPAQ', status: 'COMPLETED', createdAt: new Date() };
    const { service, notifications, prisma } = make({ booking: { recapAssessmentKeys: ['BPAQ', 'DAR_5'] }, assigned: [done] });
    await service.send(TENANT, CLINICIAN, 900n);
    expect(prisma.assessmentAssignment.create).toHaveBeenCalledTimes(1);
    expect(prisma.assessmentAssignment.create.mock.calls[0][0].data.instrumentKey).toBe('DAR_5');
    expect(notifications.sendEmail.mock.calls[0][0].links.map((l: any) => l.label)).toEqual(['Start DAR-5 (about 2 minutes)']);
  });

  it('the desk cannot send assessments with it', async () => {
    const { service } = make({ booking: { recapAssessmentKeys: ['DAR_5'] } });
    await expect(service.send(TENANT, DESK, 900n)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is not found for another practitioner’s session', async () => {
    const { service } = make({ found: false });
    await expect(service.send(TENANT, CLINICIAN, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('the recap in the portal', () => {
  const sent = { clientRecapSentAt: new Date('2026-11-06T09:00:00Z') };

  it('is the client’s own, and only once sent', async () => {
    const draft = make();
    await expect(draft.service.forClient(TENANT, CLIENT, 900n)).rejects.toBeInstanceOf(NotFoundException);
    const other = make({ booking: sent });
    await expect(other.service.forClient(TENANT, 41n, 900n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shows the recap, the session, and its assessments', async () => {
    const open = { id: 71n, instrumentKey: 'DAR_5', status: 'SENT', createdAt: new Date() };
    const { service } = make({ booking: sent, assigned: [open] });
    const r = await service.forClient(TENANT, CLIENT, 900n);
    expect(r).toMatchObject({ id: '900', serviceTitle: 'Individual Therapy', therapistName: 'Olalekan O', sentAt: '2026-11-06T09:00:00.000Z' });
    expect(JSON.parse(r.recap)).toEqual(JSON.parse(RECAP));
    expect(r.assessments).toEqual([{ id: '71', key: 'DAR_5', shortName: 'DAR-5', name: 'Dimensions of Anger Reactions (DAR-5)', estimatedMinutes: 2, status: 'SENT' }]);
  });

  it('starts the ticks as the practitioner wrote them, then keeps the client’s', async () => {
    expect((await make({ booking: sent }).service.forClient(TENANT, CLIENT, 900n)).ticks).toEqual([false, false, true]);
    expect((await make({ booking: { ...sent, recapTicks: [true, false, false] } }).service.forClient(TENANT, CLIENT, 900n)).ticks).toEqual([true, false, false]);
  });

  it('saves the client’s ticks', async () => {
    const { service, prisma } = make({ booking: sent });
    const r = await service.saveTicks(TENANT, CLIENT, 900n, [true, true, false]);
    expect(prisma.consultBooking.updateMany).toHaveBeenCalledWith({ where: { id: 900n, tenantId: TENANT, clientProfileId: CLIENT }, data: { recapTicks: [true, true, false] } });
    expect(r.ticks).toEqual([true, true, false]);
  });

  it('refuses ticks that do not fit the recap', async () => {
    const { service, prisma } = make({ booking: sent });
    await expect(service.saveTicks(TENANT, CLIENT, 900n, [true, true, true, true])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saveTicks(TENANT, CLIENT, 900n, ['yes'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.saveTicks(TENANT, 41n, 900n, [true])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultBooking.updateMany).not.toHaveBeenCalled();
  });
});
