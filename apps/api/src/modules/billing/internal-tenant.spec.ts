import { describe, it, expect, vi } from 'vitest';
import { setInternalTenant } from './internal-tenant';

function db(tenant: Record<string, unknown> | null) {
  return {
    tenant: { findUnique: vi.fn().mockResolvedValue(tenant), update: vi.fn().mockResolvedValue({}) },
    notificationDispatch: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
}

describe('set-internal-tenant (§5.4)', () => {
  it('refuses a tenant that does not exist', async () => {
    const d = db(null);
    await expect(setInternalTenant(d, 9n, 'PRO')).rejects.toThrow(/No practice with id 9/);
    expect(d.tenant.update).not.toHaveBeenCalled();
  });

  it.each(['FREE', 'GOLD', ''])('refuses tier %j', async (tier) => {
    await expect(setInternalTenant(db({ id: 9n }), 9n, tier)).rejects.toThrow(/--tier/);
  });

  it('sets INTERNAL with no end date, stops any lapse, and cancels the pending migration emails by their prefix', async () => {
    const until = new Date('2027-01-24T10:00:00Z');
    const d = db({ id: 9n, subscriptionTier: 'STARTER', complimentaryReason: 'MIGRATION', complimentaryUntil: until });
    const result = await setInternalTenant(d, 9n, 'PRO');
    expect(d.notificationDispatch.updateMany).toHaveBeenCalledWith({
      where: { dedupeKey: { startsWith: 'complimentary:9:2027-01-24:' }, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(d.tenant.update).toHaveBeenCalledWith({
      where: { id: 9n },
      data: { subscriptionTier: 'PRO', complimentaryReason: 'INTERNAL', complimentaryUntil: null, subscriptionLapsedAt: null, downgradeAt: null },
    });
    expect(result).toMatchObject({ changed: true, cancelledEmails: 2, before: { subscriptionTier: 'STARTER', complimentaryReason: 'MIGRATION' } });
  });

  it('is safe to run twice: the second run changes nothing', async () => {
    const d = db({ id: 9n, subscriptionTier: 'PRO', complimentaryReason: 'INTERNAL', complimentaryUntil: null });
    const result = await setInternalTenant(d, 9n, 'PRO');
    expect(result.changed).toBe(false);
    expect(d.tenant.update).not.toHaveBeenCalled();
    expect(d.notificationDispatch.updateMany).not.toHaveBeenCalled();
  });
});
