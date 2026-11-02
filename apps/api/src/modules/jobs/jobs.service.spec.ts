import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { JobDeferredError, JobsService, MAX_ATTEMPTS } from './jobs.service';

const NOW = new Date('2026-11-02T12:00:00Z');

function setup(job: Record<string, unknown> = {}) {
  const row = { id: 1n, type: 't', payloadJson: { a: 1 }, attempts: 1, ...job };
  const prisma: any = {
    backgroundJob: {
      create: vi.fn().mockResolvedValue({ id: 1n }),
      findFirst: vi.fn().mockResolvedValue({ id: 9n }),
      findMany: vi.fn().mockResolvedValue([{ id: 1n }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { jobs: new JobsService(prisma), prisma };
}

describe('JobsService', () => {
  it('returns the pending job instead of a duplicate for the same key', async () => {
    const { jobs, prisma } = setup();
    prisma.backgroundJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    expect(await jobs.enqueue('t', {}, { dedupeKey: 'k' })).toEqual({ id: 9n });
  });

  it('runs a due job with its handler and marks it complete', async () => {
    const { jobs, prisma } = setup();
    const handler = vi.fn().mockResolvedValue(undefined);
    jobs.register('t', handler);
    expect(await jobs.runDue(NOW)).toBe(1);
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    expect(prisma.backgroundJob.update.mock.calls[0][0].data).toMatchObject({ lockedUntil: null, lastError: null });
    expect(prisma.backgroundJob.update.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
  });

  it('skips a job another process claimed first', async () => {
    const { jobs, prisma } = setup();
    const handler = vi.fn();
    jobs.register('t', handler);
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 0 });
    expect(await jobs.runDue(NOW)).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('claims with an expiring lock and counts the attempt', async () => {
    const { jobs, prisma } = setup();
    jobs.register('t', vi.fn());
    await jobs.runDue(NOW);
    const claim = prisma.backgroundJob.updateMany.mock.calls[0][0];
    expect(claim.data.attempts).toEqual({ increment: 1 });
    expect(claim.data.lockedUntil.getTime() - NOW.getTime()).toBe(10 * 60 * 1000);
  });

  it('retries a failure with a growing gap', async () => {
    const { jobs, prisma } = setup({ attempts: 3 });
    jobs.register('t', vi.fn().mockRejectedValue(new Error('boom')));
    await jobs.runDue(NOW);
    const data = prisma.backgroundJob.update.mock.calls[0][0].data;
    expect(data.lastError).toBe('boom');
    expect(data.failedAt).toBeUndefined();
    expect(data.runAfter.getTime() - NOW.getTime()).toBe(20 * 60 * 1000);
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts and keeps the job`, async () => {
    const { jobs, prisma } = setup({ attempts: MAX_ATTEMPTS });
    jobs.register('t', vi.fn().mockRejectedValue(new Error('boom')));
    await jobs.runDue(NOW);
    expect(prisma.backgroundJob.update.mock.calls[0][0].data.failedAt).toBeInstanceOf(Date);
  });

  it('defers without using up an attempt when the work is not possible yet', async () => {
    const { jobs, prisma } = setup({ attempts: MAX_ATTEMPTS });
    jobs.register('t', vi.fn().mockRejectedValue(new JobDeferredError('R2 not configured')));
    await jobs.runDue(NOW);
    const data = prisma.backgroundJob.update.mock.calls[0][0].data;
    expect(data.attempts).toEqual({ decrement: 1 });
    expect(data.failedAt).toBeUndefined();
    expect(data.runAfter.getTime() - NOW.getTime()).toBe(60 * 60 * 1000);
  });

  it('defers a job whose handler is not registered', async () => {
    const { jobs, prisma } = setup();
    await jobs.runDue(NOW);
    expect(prisma.backgroundJob.update.mock.calls[0][0].data.attempts).toEqual({ decrement: 1 });
  });

  it('refuses two handlers for one type', () => {
    const { jobs } = setup();
    jobs.register('t', vi.fn());
    expect(() => jobs.register('t', vi.fn())).toThrow(/already has a handler/);
  });

  it('runs one job now, with the same claim', async () => {
    const { jobs, prisma } = setup();
    const handler = vi.fn().mockResolvedValue(undefined);
    jobs.register('t', handler);
    await jobs.runNow(1n, NOW);
    expect(prisma.backgroundJob.updateMany.mock.calls[0][0].where).toMatchObject({ id: 1n, completedAt: null, failedAt: null });
    expect(handler).toHaveBeenCalled();
  });

  it('leaves a job another process holds to that process', async () => {
    const { jobs, prisma } = setup();
    const handler = vi.fn();
    jobs.register('t', handler);
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 0 });
    await jobs.runNow(1n, NOW);
    expect(handler).not.toHaveBeenCalled();
  });
});
