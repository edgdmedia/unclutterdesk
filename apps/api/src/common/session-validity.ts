import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { REFRESH_TOKEN_TYPE } from '../modules/auth/session.service';

/**
 * Whether the session behind an access token is still live.
 *
 * Access tokens are stateless JWTs, so revoking a session only stops the
 * refresh: the token itself keeps working until it expires. That left a
 * fifteen-minute window on exactly the actions people take when they are
 * worried — signing a device out, changing a password because someone may have
 * it, closing a practice. This is the check that closes it.
 *
 * Shared by the practice and platform-admin guards rather than written twice,
 * so one cannot be hardened and the other forgotten.
 */
export async function assertSessionLive(
  prisma: PrismaService,
  sessionId: string | undefined,
): Promise<void> {
  // Tokens minted before sessions existed carry no sid. They cannot be checked
  // against anything and expire within the refresh TTL; refusing them would
  // sign everyone out the moment this deploys.
  if (!sessionId) return;

  const session = await prisma.token.findFirst({
    where: { id: sessionId, type: REFRESH_TOKEN_TYPE },
    select: { revokedAt: true, expiresAt: true },
  });

  // A missing row counts as ended: some paths revoke by marking the row and
  // others by deleting it, and both mean the same thing to the holder.
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new ForbiddenException('This session has ended. Please sign in again.');
  }
}
