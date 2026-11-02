import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Generic background jobs (spec §4.4): cache purges, preview images, photo
 * copies. Each job type has one handler, registered by the module that owns
 * the work. Jobs run on the 5-minute schedule (JobsCron), a few at a time.
 *
 * - A job is claimed with an atomic update before it runs, so two API
 *   processes never run the same job at once.
 * - A failure is retried with growing gaps (5, 10, 20, 40 minutes), and after
 *   MAX_ATTEMPTS the job is marked failed and kept for the admin to see.
 * - A handler throws JobDeferredError when the work isn't possible yet (for
 *   example, R2 isn't configured): the job waits an hour without using up an
 *   attempt.
 * - `dedupeKey` keeps one pending job per key; enqueueing again is a no-op.
 */

export type JobHandler = (payload: any) => Promise<void>;

export class JobDeferredError extends Error {}

export const MAX_ATTEMPTS = 5;
const BATCH = 20;
const LOCK_MS = 10 * 60 * 1000;
const RETRY_BASE_MS = 5 * 60 * 1000;
const DEFER_MS = 60 * 60 * 1000;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly prisma: PrismaService) {}

  /** Called once by the owning module, in onModuleInit. */
  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) throw new Error(`Job type ${type} already has a handler`);
    this.handlers.set(type, handler);
  }

  async enqueue(type: string, payload: Prisma.InputJsonValue, options: { dedupeKey?: string; runAfter?: Date } = {}) {
    try {
      return await this.prisma.backgroundJob.create({
        data: { type, payloadJson: payload, dedupeKey: options.dedupeKey ?? null, runAfter: options.runAfter ?? new Date() },
      });
    } catch (err) {
      // A pending job with this key already exists (partial unique index).
      if (options.dedupeKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.backgroundJob.findFirst({
          where: { dedupeKey: options.dedupeKey, completedAt: null, failedAt: null },
        });
      }
      throw err;
    }
  }

  /** Run the jobs that are due. Returns how many ran (successfully or not). */
  async runDue(now = new Date()): Promise<number> {
    const due = await this.prisma.backgroundJob.findMany({
      where: {
        completedAt: null,
        failedAt: null,
        runAfter: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      orderBy: { runAfter: 'asc' },
      take: BATCH,
      select: { id: true },
    });

    let ran = 0;
    for (const { id } of due) {
      // Claim: only one process wins this update.
      const claimed = await this.prisma.backgroundJob.updateMany({
        where: { id, completedAt: null, failedAt: null, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MS), attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      const job = await this.prisma.backgroundJob.findUnique({ where: { id } });
      if (!job) continue;
      ran += 1;
      await this.runOne(job, now);
    }
    return ran;
  }

  private async runOne(job: { id: bigint; type: string; payloadJson: Prisma.JsonValue; attempts: number }, now: Date) {
    const handler = this.handlers.get(job.type);
    try {
      if (!handler) throw new JobDeferredError(`No handler for job type ${job.type}`);
      await handler(job.payloadJson);
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: { completedAt: new Date(), lockedUntil: null, lastError: null },
      });
    } catch (err) {
      const message = (err as Error).message?.slice(0, 1000) || 'Unknown error';
      if (err instanceof JobDeferredError) {
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: { runAfter: new Date(now.getTime() + DEFER_MS), attempts: { decrement: 1 }, lockedUntil: null, lastError: message },
        });
        return;
      }
      const giveUp = job.attempts >= MAX_ATTEMPTS;
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: giveUp
          ? { failedAt: new Date(), lockedUntil: null, lastError: message }
          : { runAfter: new Date(now.getTime() + RETRY_BASE_MS * 2 ** (job.attempts - 1)), lockedUntil: null, lastError: message },
      });
      this.logger.warn(`job ${job.id} (${job.type}) ${giveUp ? 'failed for good' : 'will retry'}: ${message}`);
    }
  }
}
