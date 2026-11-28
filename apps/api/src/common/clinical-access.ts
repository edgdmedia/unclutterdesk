import { NotFoundException } from '@nestjs/common';
import { authenticatedProfileId } from './authenticated-tenant';
import { effectivePermissions } from './permissions';

/**
 * Who is reading a clinical record. `viewAll` (owners, admins) sees every
 * client's; any other clinician sees only the clients they treat, matching
 * session prep, which shows a treating therapist the client's last note.
 */
export type ClinicalViewer = { profileId: bigint; viewAll: boolean };

export function clinicalViewer(req: any): ClinicalViewer {
  const held = effectivePermissions(String(req.user?.role ?? ''), (req.user?.permissions ?? []) as string[]);
  return { profileId: authenticatedProfileId(req), viewAll: held.has('sessions.view-all') };
}

/** Not Found rather than Forbidden: a client someone doesn't treat is not theirs to know about. */
export async function assertTreatsClient(
  prisma: { consultBooking: { findFirst(args: any): Promise<unknown> } },
  tenantId: bigint,
  viewer: ClinicalViewer,
  clientProfileId: bigint,
): Promise<void> {
  if (viewer.viewAll) return;
  const treated = await prisma.consultBooking.findFirst({
    where: { tenantId, clientProfileId, availability: { providerProfileId: viewer.profileId } },
    select: { id: true },
  });
  if (!treated) throw new NotFoundException('Client not found');
}
