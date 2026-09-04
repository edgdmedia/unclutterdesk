import { ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertSessionLive } from '../../common/session-validity';

/**
 * Platform operators.
 *
 * This used to authenticate the token and check its type, and nothing else —
 * it never touched the database, so revoking an operator's session left them
 * working until the token expired. Fewer accounts than the practice side, but
 * the same bug and a wider reach: these are the accounts that can see every
 * practice on the platform.
 */
@Injectable()
export class PlatformAdminGuard extends JwtAuthGuard {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Runs handleRequest below, which populates req.user and rejects a token
    // that is not a platform admin's.
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    const { user } = context.switchToHttp().getRequest();
    await assertSessionLive(this.prisma, user?.sessionId);
    return true;
  }

  handleRequest(err: any, user: any) {
    const authenticated = super.handleRequest(err, user);
    if (authenticated?.type !== 'platform_admin') {
      throw new ForbiddenException('Platform admin access required');
    }
    return authenticated;
  }
}
