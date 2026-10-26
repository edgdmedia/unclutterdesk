import { isTier, type Tier } from '../entitlements/entitlements';
import { complimentaryPrefix } from '../invites/complimentary-emails';

/** The Prisma calls the script needs; a narrow type so the spec can fake them. */
export interface InternalTenantDb {
  tenant: {
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  notificationDispatch: { updateMany(args: any): Promise<{ count: number }> };
}

export interface InternalTenantResult {
  changed: boolean;
  before: { subscriptionTier: string; complimentaryReason: string | null; complimentaryUntil: string | null };
  after: { subscriptionTier: Tier; complimentaryReason: 'INTERNAL'; complimentaryUntil: null };
  cancelledEmails: number;
}

/**
 * Gives a practice a complimentary plan with no end date (spec §5.4): Olalekan's
 * own practice. Refuses unknown tenants and tiers; safe to run twice. Pending
 * migration/invite emails for the period it replaces are cancelled through
 * the same dedupe-key prefix the cron uses, so the cron doesn't queue them
 * again (it only queues for periods with an end date, which this one isn't).
 */
export async function setInternalTenant(db: InternalTenantDb, tenantId: bigint, tier: string): Promise<InternalTenantResult> {
  if (!isTier(tier) || tier === 'FREE') throw new Error(`--tier must be STARTER, PRO or CLINIC (got "${tier}")`);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, subscriptionTier: true, complimentaryReason: true, complimentaryUntil: true },
  });
  if (!tenant) throw new Error(`No practice with id ${tenantId}; nothing changed.`);

  const before = {
    subscriptionTier: tenant.subscriptionTier,
    complimentaryReason: tenant.complimentaryReason ?? null,
    complimentaryUntil: tenant.complimentaryUntil ? tenant.complimentaryUntil.toISOString() : null,
  };
  const after = { subscriptionTier: tier, complimentaryReason: 'INTERNAL' as const, complimentaryUntil: null };

  let cancelledEmails = 0;
  if (tenant.complimentaryUntil) {
    const res = await db.notificationDispatch.updateMany({
      where: { dedupeKey: { startsWith: complimentaryPrefix(tenant.id, tenant.complimentaryUntil) }, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    cancelledEmails = res.count;
  }

  const changed =
    before.subscriptionTier !== after.subscriptionTier ||
    before.complimentaryReason !== after.complimentaryReason ||
    before.complimentaryUntil !== after.complimentaryUntil;
  if (changed) {
    await db.tenant.update({
      where: { id: tenant.id },
      // An INTERNAL plan never lapses, so any lapse in progress stops too.
      data: { ...after, subscriptionLapsedAt: null, downgradeAt: null },
    });
  }
  return { changed, before, after, cancelledEmails };
}
