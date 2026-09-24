import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export const REFRESH_TOKEN_TYPE = 'refresh';

/** Matches REFRESH_EXPIRES_IN in auth.config. */
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeviceInfo {
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * Refresh sessions.
 *
 * Refresh tokens were stateless JWTs — signed, handed out, never recorded — so
 * nothing could be revoked. Logout cleared the browser's cookies and left the
 * token itself valid for its full 30 days; "sign out everywhere" was
 * impossible; and closing a practice deleted Token rows under the comment "end
 * every session belonging to this practice immediately", which ended none.
 *
 * Each refresh token now carries a session id and has a row behind it. The row
 * holds the hash of the *current* token only, and refreshing rotates it, which
 * gives away theft: if a token that was already exchanged comes back, two
 * parties hold that session, so the whole session is revoked rather than
 * guessing which one is the thief.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static newSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  /** A user agent is attacker-controlled text; it is only ever displayed. */
  private static trim(value: string | null | undefined, max: number): string | null {
    if (!value) return null;
    return value.slice(0, max);
  }

  async startSession(
    sessionId: string,
    userId: bigint,
    refreshToken: string,
    device: DeviceInfo = {},
  ) {
    await this.prisma.token.create({
      data: {
        id: sessionId,
        userId,
        type: REFRESH_TOKEN_TYPE,
        tokenHash: SessionService.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        lastUsedAt: new Date(),
        userAgent: SessionService.trim(device.userAgent, 400),
        ipAddress: SessionService.trim(device.ipAddress, 60),
      },
    });
  }

  /**
   * Swap a presented refresh token for the next one in the same session.
   *
   * Returns false when the session is unknown, revoked, expired, or the token
   * is not the one currently outstanding.
   */
  async rotate(
    sessionId: string,
    presentedToken: string,
    nextToken: string,
    device: DeviceInfo = {},
  ): Promise<boolean> {
    const session = await this.prisma.token.findUnique({ where: { id: sessionId } });

    if (
      !session ||
      session.type !== REFRESH_TOKEN_TYPE ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      return false;
    }

    if (session.tokenHash !== SessionService.hash(presentedToken)) {
      // A token from earlier in this session came back. It was valid once, so
      // it was either replayed by a thief or is a straggler from a client that
      // raced itself — either way two parties now hold it. Ending the session
      // costs one honest user a sign-in; not ending it leaves a thief inside.
      this.logger.warn(
        `Refresh token reuse detected on session ${sessionId} (user ${session.userId}); revoking it`,
      );
      await this.revokeSession(sessionId);
      return false;
    }

    // updateMany with revokedAt still null, so two simultaneous refreshes
    // cannot both win and hand out two live tokens for one session.
    const rotated = await this.prisma.token.updateMany({
      where: { id: sessionId, revokedAt: null, tokenHash: session.tokenHash },
      data: {
        tokenHash: SessionService.hash(nextToken),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ...(device.userAgent ? { userAgent: SessionService.trim(device.userAgent, 400) } : {}),
        ...(device.ipAddress ? { ipAddress: SessionService.trim(device.ipAddress, 60) } : {}),
      },
    });

    return rotated.count === 1;
  }

  /**
   * `userId` is optional only for internal callers that already own the
   * session. Anything driven by a request must pass it, so one account cannot
   * end another account's session by guessing an id.
   */
  async revokeSession(sessionId: string, userId?: bigint): Promise<number> {
    const res = await this.prisma.token.updateMany({
      where: {
        id: sessionId,
        type: REFRESH_TOKEN_TYPE,
        revokedAt: null,
        ...(userId === undefined ? {} : { userId }),
      },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  /**
   * Ends every session for a user, optionally sparing the one making the
   * request so "sign out my other devices" does not sign the user out here too.
   */
  async revokeAllForUser(userId: bigint, exceptSessionId?: string): Promise<number> {
    const res = await this.prisma.token.updateMany({
      where: {
        userId,
        type: REFRESH_TOKEN_TYPE,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    if (res.count > 0) {
      this.logger.log(`Revoked ${res.count} session(s) for user ${userId}`);
    }
    return res.count;
  }

  async listForUser(userId: bigint, currentSessionId?: string) {
    const sessions = await this.prisma.token.findMany({
      where: {
        userId,
        type: REFRESH_TOKEN_TYPE,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      // Never the token hash — this list is shown in a browser.
      device: describeDevice(s.userAgent),
      ipAddress: s.ipAddress,
      lastUsedAt: (s.lastUsedAt ?? s.createdAt).toISOString(),
      startedAt: s.createdAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }
}

/**
 * A readable device name from a user agent.
 *
 * Deliberately coarse: the point is for someone to recognise their own devices
 * and spot one they do not know, not to fingerprint them. Unrecognised agents
 * are reported as unknown rather than guessed at, and the raw string is never
 * returned — it is attacker-controlled and would render in the page.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent.toLowerCase();

  const os = ua.includes('iphone')
    ? 'iPhone'
    : ua.includes('ipad')
      ? 'iPad'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('mac os') || ua.includes('macintosh')
          ? 'Mac'
          : ua.includes('windows')
            ? 'Windows'
            : ua.includes('linux')
              ? 'Linux'
              : null;

  // Order matters: Edge and Chrome both say "Chrome"; Chrome and Safari both
  // say "Safari".
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('firefox')
      ? 'Firefox'
      : ua.includes('chrome') || ua.includes('crios')
        ? 'Chrome'
        : ua.includes('safari')
          ? 'Safari'
          : null;

  if (os && browser) return `${browser} on ${os}`;
  if (os) return os;
  if (browser) return browser;
  return 'Unknown device';
}
