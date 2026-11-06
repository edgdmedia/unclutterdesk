/**
 * A cancelled session that came from a plan goes back to "not scheduled": it
 * was paid for already, so cancelling its time must not lose it. Every cancel
 * path calls this, so none can forget.
 */
export async function returnPlanSessionOnCancel(
  db: { planSession: { updateMany: (args: any) => Promise<{ count: number }> } },
  tenantId: bigint,
  bookingId: bigint,
): Promise<boolean> {
  const r = await db.planSession.updateMany({
    where: { tenantId, bookingId, status: 'SCHEDULED' },
    data: { status: 'PAID', bookingId: null },
  });
  return r.count > 0;
}
