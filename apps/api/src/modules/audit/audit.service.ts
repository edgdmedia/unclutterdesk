import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The admin audit log (spec §4.4). Every platform-admin action in the v2
 * spec writes one entry: who, what, to which record, and why. Append-only:
 * this service offers no update or delete.
 */
export interface AuditEntry {
  actorUserId: bigint;
  /** Dotted verb, e.g. "profile.takedown", "tenant.register". */
  action: string;
  targetType: string;
  targetId: string | bigint;
  reason?: string | null;
  meta?: Prisma.InputJsonValue;
}

const ACTION = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    if (!ACTION.test(entry.action)) throw new Error(`Audit action must be dotted lowercase: ${entry.action}`);
    return this.prisma.adminAuditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: String(entry.targetId),
        reason: entry.reason?.trim() || null,
        metaJson: entry.meta ?? Prisma.DbNull,
      },
    });
  }

  /** Newest first: everything done to one record. */
  async forTarget(targetType: string, targetId: string | bigint, take = 100) {
    return this.prisma.adminAuditLog.findMany({
      where: { targetType, targetId: String(targetId) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, take), 500),
    });
  }
}
