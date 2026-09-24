import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { ROLES_KEY, type PracticeRole } from './roles';
import { assertSessionLive } from './session-validity';

/**
 * Enforces practice roles on routes behind `JwtAuthGuard`.
 *
 * The role is read from the database rather than the token, because the access
 * token does not carry one: `generateTokens` sets only sub, profileId, tenantId
 * and type, so `jwt.strategy` falls back to `['client']` for every practice
 * user — a JWT-based check would see an owner as a client. Reading the profile
 * also means a demoted admin loses access at once rather than when their
 * 15-minute token expires.
 *
 * Runs after JwtAuthGuard, so `req.user` is populated. Order matters:
 * `@UseGuards(JwtAuthGuard, RolesGuard)`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PracticeRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No annotation means the route is not role-restricted. roles.spec.ts fails
    // the build when an authenticated route lacks one, so this cannot become a
    // silent hole the way the original `@UseGuards(JwtAuthGuard)` did.
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.profileId || !user?.tenantId) {
      // Platform admins hold a token with no tenant or profile; they have their
      // own guard and no business on practice routes.
      throw new ForbiddenException('This endpoint requires a practice profile');
    }

    /*
     * Read alongside the profile rather than after it: both are needed before
     * the request proceeds, and neither should wait on the other. The session
     * rule itself lives in session-validity.ts, shared with the platform-admin
     * guard so one cannot be hardened and the other forgotten.
     */
    const [profile] = await Promise.all([
      this.prisma.profile.findFirst({
        where: { id: BigInt(user.profileId), tenantId: BigInt(user.tenantId) },
        select: { role: true, status: true },
      }),
      assertSessionLive(this.prisma, user.sessionId),
    ]);

    if (!profile) {
      throw new ForbiddenException('Profile not found in this practice');
    }

    // A deactivated profile keeps a valid token until it expires; without this
    // check, removing someone's access would not take effect for 15 minutes.
    if (profile.status !== 'active') {
      throw new ForbiddenException('This account is not active');
    }

    if (!required.includes(profile.role as PracticeRole)) {
      throw new ForbiddenException('Your role does not have access to this resource');
    }

    // Downstream code frequently needs the role; hand it on rather than making
    // each service look it up again.
    req.user.role = profile.role;
    return true;
  }
}
