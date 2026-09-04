import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';
import { DeviceInfo, SessionService } from './session.service';
import { JWT_EXPIRES_IN, REFRESH_SECRET, REFRESH_EXPIRES_IN } from '../../common/auth.config';
import { NotificationService } from '../notifications/notification.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Verbose auth tracing for a developer chasing a login problem.
   *
   * This used to be an unconditional logger.log, and its payloads carried
   * password lengths and bcrypt hash prefixes. Anyone who could read logs — the
   * host, an error tracker, a support tool, a contractor — could narrow an
   * account's password, and a sibling log line printed the whole password-reset
   * link, which is account takeover on its own.
   *
   * The secrets are gone from the payloads. What remains is still an email and
   * a tenant/profile map per attempt, which is personal data under the NDPA, so
   * it is off unless someone deliberately turns it on — and it is refused
   * outright in production, where the flag being set by accident is exactly the
   * failure this is meant to prevent.
   */
  static authDebugEnabled(): boolean {
    // Read per call rather than once at import, so turning it on is a config
    // change rather than a restart-and-hope, and so the payloads stay testable
    // with it on — the gate is a second line of defence, not the only one.
    return process.env.AUTH_DEBUG_LOGS === 'true' && process.env.NODE_ENV !== 'production';
  }

  private authDebug(event: string, details: Record<string, unknown>) {
    if (!AuthService.authDebugEnabled()) return;
    this.logger.log(`[AUTH_DEBUG] ${event} ${JSON.stringify(details)}`);
  }

  private unauthorized(message: string, code: string): never {
    throw new UnauthorizedException({ message, code });
  }

  private forbidden(message: string, code: string): never {
    throw new ForbiddenException({ message, code });
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notifications: NotificationService,
    private readonly sessions: SessionService,
  ) {}

  async register(tenantId: bigint | undefined, dto: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    practiceName?: string;
    type?: string; // "user", "therapist", "admin"
    alsoTherapist?: boolean; // Practice owner who also provides services
  }) {
    const email = dto.email.toLowerCase().trim();

    // Workspace creation requires a brand-new account. If a global User
    // already exists for this email, re-registering would silently keep the
    // OLD password (the User row is reused) and create a fresh profile that
    // can never log in with the password just chosen — surfacing as confusing
    // "Invalid email or password" on the login screen.
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      this.logger.warn(
        `Registration blocked for ${email}: existing user ${existingUser.id.toString()} already has a password hash`,
      );
      throw new ConflictException(
        'An account with this email already exists. Please log in or reset your password.',
      );
    }

    // Password policy: min 8 chars with upper, lower, digit and a special char.
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(dto.password) || !/[a-z]/.test(dto.password)) {
      throw new BadRequestException('Password must contain both uppercase and lowercase letters');
    }
    if (!/[0-9]/.test(dto.password)) {
      throw new BadRequestException('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(dto.password)) {
      throw new BadRequestException('Password must contain at least one special character');
    }

    const username = (dto.username || email.split('@')[0]).toLowerCase().trim();

    let targetTenantId = tenantId;
    if (!targetTenantId) {
      const cleanSlug = (dto.username || dto.firstName || 'practice').toLowerCase().replace(/[^a-z0-9]/g, '');
      const newTenant = await this.prisma.tenant.create({
        data: {
          name: dto.practiceName || `${dto.firstName || 'Practice'} Therapy`,
          slug: `${cleanSlug || 'practice'}-${Date.now().toString().slice(-4)}`,
          isActive: true,
        },
      });
      targetTenantId = newTenant.id;
    }

    // Check if user profile already exists for this tenant
    const existingProfile = await this.prisma.profile.findFirst({
      where: { tenantId: targetTenantId, email },
    });
    if (existingProfile?.userId) {
      throw new BadRequestException('An account with this email already exists in this practice');
    }
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    const isTherapist = dto.type === 'therapist' || dto.alsoTherapist === true;
    const isOwner = !tenantId;
    const profile = existingProfile
      ? await this.prisma.profile.update({
          where: { id: existingProfile.id },
          data: {
            userId: existingProfile.userId || user.id,
            username: existingProfile.username || username,
            firstName: dto.firstName ?? existingProfile.firstName,
            lastName: dto.lastName ?? existingProfile.lastName,
            type: dto.type || existingProfile.type || 'user',
          },
        })
      : await this.prisma.profile.create({
          data: {
            tenantId: targetTenantId,
            userId: user.id,
            email,
            username,
            firstName: dto.firstName,
            lastName: dto.lastName,
            type: dto.type || 'user',
            role: isOwner ? 'OWNER' : undefined,
            status: 'pending',
            emailVerified: false,
          },
        });

    // If therapist, create ConsultTherapistProfile
    if (isTherapist) {
      await this.prisma.consultTherapistProfile.create({
        data: {
          tenantId: targetTenantId,
          profileId: profile.id,
          publicUsername: username,
          bookingEmail: email,
          notificationEmail: email,
          isPublic: true,
          acceptsGeneralBooking: true,
          isVerified: true,
        },
        });
    }

    this.authDebug('register', {
      email,
      tenantId: targetTenantId?.toString() ?? null,
      userId: user.id.toString(),
      profileId: profile.id.toString(),
      profileStatus: profile.status,
      emailVerified: profile.emailVerified,
    });

    // New accounts must verify their email before they can sign in. If a
    // profile already existed and was verified, skip re-verification.
    const alreadyVerified = profile.emailVerified === true;
    let emailSent = false;
    if (!alreadyVerified) {
      const code = await this.createEmailVerificationCode(user.id);
      try {
        const result = await this.notifications.sendEmail({
          to: profile.email,
          type: 'auth.email_verification',
          title: 'Verify your email address',
          message: `Welcome to Unclutter Desk! Enter this code in the app to activate your account. It expires in 30 minutes.`,
          code,
          tenantId: profile.tenantId,
          profileId: profile.id,
        });
        emailSent = result.success === true;
      } catch (err) {
        this.logger.warn(`Failed to send verification email to ${profile.email}: ${(err as Error).message}`);
      }
    }

    return {
      message: 'Registration successful. Please verify your email before logging in.',
      verification_required: !alreadyVerified,
      email_sent: emailSent,
      profile_id: profile.id.toString(),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(input: string | undefined, fallbackMs: number): number {
    const match = (input || '').match(/^(\d+)([smhd])$/);
    if (!match) return fallbackMs;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return fallbackMs;
    }
  }

  private async createEmailVerificationCode(userId: bigint) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = this.hashToken(code);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(process.env.EMAIL_VERIFICATION_EXPIRES_IN, 30 * 60 * 1000),
    );

    await this.prisma.token.deleteMany({
      where: { userId, type: 'email_verification' },
    });

    await this.prisma.token.create({
      data: {
        id: `${userId.toString()}-email-verification-${Date.now()}`,
        userId,
        type: 'email_verification',
        tokenHash,
        expiresAt,
      },
    });

    return code;
  }

  private async createPasswordResetToken(userId: bigint): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(process.env.PASSWORD_RESET_EXPIRES_IN, 60 * 60 * 1000),
    );

    await this.prisma.token.deleteMany({
      where: { userId, type: 'password_reset' },
    });

    await this.prisma.token.create({
      data: {
        id: `${userId.toString()}-password-reset-${Date.now()}`,
        userId,
        type: 'password_reset',
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  async verifyEmail(dto: { email: string; code: string }) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid email or verification code');

    const token = await this.prisma.token.findFirst({
      where: { userId: user.id, type: 'email_verification', tokenHash: this.hashToken(dto.code) },
    });
    if (!token) throw new BadRequestException('Invalid email or verification code');
    if (token.expiresAt < new Date()) {
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    const profile = await this.prisma.profile.findFirst({
      where: { userId: user.id },
      orderBy: [{ emailVerified: 'desc' }, { createdAt: 'desc' }],
    });
    if (!profile) throw new BadRequestException('Profile not found');
    const wasVerified = profile.emailVerified === true;

    await this.prisma.profile.updateMany({
      where: { userId: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        status: 'active',
      },
    });

    const updatedProfiles = await this.prisma.profile.findMany({
      where: { userId: user.id },
      select: { id: true, tenantId: true, status: true, emailVerified: true, emailVerifiedAt: true },
      orderBy: { createdAt: 'desc' },
    });

    this.authDebug('verify_email', {
      email,
      userId: user.id.toString(),
      tokenId: token.id,
      matchedProfileId: profile.id.toString(),
      profiles: updatedProfiles.map((item) => ({
        id: item.id.toString(),
        tenantId: item.tenantId.toString(),
        status: item.status,
        emailVerified: item.emailVerified,
        emailVerifiedAt: item.emailVerifiedAt?.toISOString() ?? null,
      })),
    });

    await this.prisma.token.deleteMany({ where: { userId: user.id, type: 'email_verification' } });

    // First-time verification → send a welcome email. Non-fatal: verification
    // must succeed even if SMTP is down, so failures are only logged.
    if (!wasVerified) {
      try {
        await this.notifications.sendEmail({
          to: profile.email,
          type: 'auth.welcome',
          title: 'Welcome to Unclutter Desk',
          message: `Your email has been verified and your practice workspace is active. You can now sign in and start booking clients, writing SOAP notes, and more. Get started at app.unclutterdesk.com.`,
          tenantId: profile.tenantId,
          profileId: profile.id,
        });
      } catch (err) {
        this.logger.warn(`Failed to send welcome email to ${profile.email}: ${(err as Error).message}`);
      }
    }

    return { message: 'Email verified successfully', success: true, email: profile.email };
  }

  async resendVerification(dto: { email: string }) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('No account found for this email');

    const profile = await this.prisma.profile.findFirst({
      where: { userId: user.id },
      orderBy: [{ emailVerified: 'asc' }, { createdAt: 'desc' }],
    });
    if (!profile || profile.emailVerified) {
      return { message: 'Email already verified', success: true, alreadyVerified: true };
    }

    const code = await this.createEmailVerificationCode(user.id);
    let emailSent = false;
    try {
      const result = await this.notifications.sendEmail({
        to: email,
        type: 'auth.email_verification',
        title: 'Verify your email address',
        message: `Welcome to Unclutter Desk! Enter this code in the app to activate your account. It expires in 30 minutes.`,
        code,
        tenantId: profile.tenantId,
        profileId: profile.id,
      });
      emailSent = result.success === true;
    } catch (err) {
      this.logger.warn(`Failed to resend verification email to ${email}: ${(err as Error).message}`);
    }

    return { message: 'Verification code sent', success: true, email_sent: emailSent, alreadyVerified: false };
  }

  async forgotPassword(dto: { email: string }) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always answer the same way so the endpoint can't be used to enumerate
    // which emails have Unclutter Desk accounts.
    const generic = {
      message: 'If an account exists for this email, a reset link has been sent.',
      success: true,
      email_sent: null as boolean | null,
    };
    if (!user) return generic;

    const token = await this.createPasswordResetToken(user.id);
    const profile = await this.prisma.profile.findFirst({
      where: { userId: user.id },
      orderBy: [{ emailVerified: 'desc' }, { createdAt: 'desc' }],
    });

    const baseUrl = (
      process.env.APP_BASE_URL ||
      process.env.VITE_APP_URL ||
      process.env.WEB_BASE_URL ||
      'https://app.unclutterdesk.com'
    ).replace(/\/+$/, '');
    const resetLink = `${baseUrl}/reset-password/${token}`;

    let emailSent = false;
    try {
      const result = await this.notifications.sendEmail({
        to: email,
        type: 'auth.password_reset',
        title: 'Reset your password',
        message: `We received a request to reset the password for your Unclutter Desk account. Click the button below to choose a new one. This link expires in 1 hour.`,
        link: resetLink,
        actionLabel: 'Reset password',
        tenantId: profile?.tenantId ?? null,
        profileId: profile?.id ?? null,
      });
      emailSent = result.success;
      // The link was printed here in full. It is a bearer credential for the
      // account: whoever reads it owns the account, no password required.
      this.logger.log(
        `Password reset email processed for ${email}: success=${result.success} provider=${result.providerId ?? 'n/a'}`,
      );
      if (!result.success) {
        this.logger.warn(
          `Password reset email delivery failed for ${email}: ${result.error || 'unknown delivery failure'}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send password reset email to ${email}: ${(err as Error).message}`);
    }

    return {
      ...generic,
      email_sent: emailSent,
      message: emailSent
        ? generic.message
        : 'We could not send a reset email right now. Please try again in a moment.',
    };
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const token = (dto.token || '').trim();
    if (!token) throw new BadRequestException('Invalid or missing reset token');

    const tokenHash = this.hashToken(token);
    const reset = await this.prisma.token.findFirst({
      where: { type: 'password_reset', tokenHash },
      include: { user: true },
    });
    if (!reset) throw new BadRequestException('This reset link is invalid. Please request a new one.');
    if (reset.expiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Please request a new one.');
    }

    // Same password policy as registration.
    const password = dto.newPassword || '';
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      throw new BadRequestException('Password must contain both uppercase and lowercase letters');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least one special character');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // A reset is the recovery path from a compromised account, so no existing
    // session survives it.
    await this.sessions.revokeAllForUser(reset.userId);

    this.authDebug('reset_password', {
      userId: reset.userId.toString(),
      email: reset.user.email,
      tokenId: reset.id,
    });

    await this.prisma.token.deleteMany({ where: { userId: reset.userId, type: 'password_reset' } });

    return { message: 'Password updated. You can now log in.', success: true };
  }

  async loginPlatformAdmin(dto: { email: string; password: string }, device: DeviceInfo = {}) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.platformRole) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = SessionService.newSessionId();
    const { accessToken, refreshToken } = this.generatePlatformAdminTokens(
      user,
      user.platformRole,
      sessionId,
    );
    await this.sessions.startSession(sessionId, user.id, refreshToken, device);
    return {
      accessToken,
      refreshToken,
      profile: this.platformAdminProfile(user),
    };
  }

  async login(
    tenantId: bigint | undefined,
    dto: { email: string; password: string },
    device: DeviceInfo = {},
  ) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`Login failed for ${email}: no user record found`);
      this.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    this.authDebug('login_attempt', {
      email,
      tenantId: tenantId?.toString() ?? null,
      userFound: true,
      userId: user.id.toString(),
      passwordValid,
    });
    if (!passwordValid) {
      this.logger.warn(
        `Login failed for ${email}: password mismatch for user ${user.id.toString()}`,
      );
      this.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
    }

    const candidateProfiles = await this.prisma.profile.findMany({
      where: tenantId ? { tenantId, userId: user.id } : { userId: user.id },
      orderBy: [{ emailVerified: 'desc' }, { createdAt: 'desc' }],
      include: { tenant: true, consultTherapistProfile: true },
    });

    this.authDebug('login_profiles', {
      email,
      userId: user.id.toString(),
      tenantId: tenantId?.toString() ?? null,
      profiles: candidateProfiles.map((item) => ({
        id: item.id.toString(),
        tenantId: item.tenantId.toString(),
        status: item.status,
        type: item.type,
        role: item.role,
        emailVerified: item.emailVerified,
        createdAt: item.createdAt.toISOString(),
      })),
    });

    const profile = candidateProfiles[0] ?? null;
    const latestUnverifiedProfile = candidateProfiles.find((item) => item.emailVerified !== true) ?? null;

    if (!profile) {
      this.logger.warn(`Login failed for ${email}: no profile linked to user ${user.id.toString()}`);
      this.unauthorized('No practice profile is linked to this account yet.', 'AUTH_PROFILE_MISSING');
    }

    if (profile.status === 'inactive' && !latestUnverifiedProfile) {
      this.logger.warn(`Login blocked for ${email}: profile ${profile.id.toString()} is inactive`);
      this.unauthorized(
        'Your account has been deactivated. Please contact your administrator.',
        'AUTH_PROFILE_INACTIVE',
      );
    }

    if (latestUnverifiedProfile) {
      const latestVerification = await this.prisma.token.findFirst({
        where: { userId: user.id, type: 'email_verification' },
        orderBy: { createdAt: 'desc' },
      });
      const canResendVerification =
        !latestVerification || latestVerification.expiresAt < new Date();

      this.logger.warn(
        `Login blocked for ${email}: user ${user.id.toString()} still has unverified profile ${latestUnverifiedProfile.id.toString()}`,
      );
      this.forbidden(
        canResendVerification
          ? 'Please verify your email address before logging in. Your previous verification code may have expired, so request a new one from the verify email screen.'
          : 'Please verify your email address before logging in. Check your inbox for the verification code.',
        'AUTH_EMAIL_VERIFICATION_REQUIRED',
      );
    }

    const sessionId = SessionService.newSessionId();
    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      profile.id,
      profile.tenantId,
      profile.type,
      sessionId,
    );
    await this.sessions.startSession(sessionId, user.id, refreshToken, device);

    this.authDebug('login_success', {
      email,
      userId: user.id.toString(),
      profileId: profile.id.toString(),
      tenantId: profile.tenantId.toString(),
      profileStatus: profile.status,
      emailVerified: profile.emailVerified,
      accessTokenIssued: !!accessToken,
      refreshTokenIssued: !!refreshToken,
    });

    return {
      accessToken,
      refreshToken,
      profile: this.practiceProfile(profile),
    };
  }

  /**
   * Turns an invitation into a staff account and signs the person in.
   *
   * The claim page previously called nothing at all — it navigated to
   * /dashboard, so an invited colleague ended up with no profile and no
   * practice. The whole exchange happens in one transaction: consume the
   * invite, create or attach the login, create the profile with the role the
   * inviter chose. A half-completed claim would leave a token that looks unused
   * against an account that already exists.
   */
  async claimInvite(
    dto: {
      token: string;
      password: string;
      firstName?: string;
      lastName?: string;
    },
    device: DeviceInfo = {},
  ) {
    if (!dto?.token) throw new BadRequestException('Invitation token is required');
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Choose a password of at least 8 characters');
    }

    const invite = await this.prisma.consultPendingInvite.findUnique({
      where: { claimToken: dto.token },
    });

    if (!invite || invite.expiresAt < new Date()) {
      // Identical for an unknown token and an expired one, so the endpoint
      // cannot be used to tell which invitations exist.
      throw new BadRequestException('This invitation is no longer valid');
    }

    const email = invite.email.toLowerCase().trim();

    const existingProfile = await this.prisma.profile.findFirst({
      where: { tenantId: invite.tenantId, email },
    });
    if (existingProfile) {
      throw new BadRequestException('That address already has a profile in this practice');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const { profile } = await this.prisma.$transaction(async (tx) => {
      // Consume the invite first. deleteMany returning zero means another
      // request claimed it in the meantime, and this one loses cleanly.
      const consumed = await tx.consultPendingInvite.deleteMany({
        where: { id: invite.id },
      });
      if (consumed.count === 0) {
        throw new BadRequestException('This invitation has already been used');
      }

      // The address may already have a login from another practice.
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            username: email.split('@')[0] + '-' + invite.tenantId.toString(),
            password: passwordHash,
          },
        });
      }

      const created = await tx.profile.create({
        data: {
          tenantId: invite.tenantId,
          userId: user.id,
          email,
          username: email.split('@')[0],
          type: 'staff',
          role: invite.role,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          status: 'active',
          // The invitation was sent to this address, so reaching it proves control.
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      return { user, profile: created };
    });

    const sessionId = SessionService.newSessionId();
    const { accessToken, refreshToken } = this.generateTokens(
      profile.userId!,
      profile.id,
      profile.tenantId,
      profile.type,
      sessionId,
    );
    await this.sessions.startSession(sessionId, profile.userId!, refreshToken, device);

    this.logger.log(`Invite claimed: profile ${profile.id} joined tenant ${profile.tenantId} as ${profile.role}`);

    return {
      accessToken,
      refreshToken,
      profile: {
        id: profile.id.toString(),
        email: profile.email,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        type: profile.type,
        status: profile.status,
        avatarUrl: profile.avatarUrl,
      },
    };
  }

  /**
   * Only values the UI actually offers are accepted. Anything else is dropped
   * rather than stored, so a malformed locale cannot come back out and break
   * Intl.DateTimeFormat on every page that formats a date.
   */
  private static readonly ALLOWED_PREFERENCES: Record<string, readonly string[]> = {
    locale: ['en-NG', 'en-GB', 'en-US', 'fr-FR'],
    timezone: ['Africa/Lagos', 'Europe/London', 'Africa/Nairobi', 'Africa/Accra'],
    dateFormat: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMM YYYY'],
    timeFormat: ['24-hour', '12-hour'],
    weekStartsOn: ['Monday', 'Sunday'],
    numberFormat: ['1,234.56', '1.234,56'],
  };

  private static readonly PREFERENCE_FIELDS = {
    locale: true,
    timezone: true,
    dateFormat: true,
    timeFormat: true,
    weekStartsOn: true,
    numberFormat: true,
  } as const;

  async getPreferences(tenantId: bigint, profileId: bigint) {
    const profile = await this.prisma.profile.findFirst({
      where: { id: profileId, tenantId },
      select: {
        email: true,
        emailVerified: true,
        ...AuthService.PREFERENCE_FIELDS,
        user: { select: { passwordChangedAt: true } },
      },
    });

    if (!profile) throw new NotFoundException('Profile not found');

    const { user, ...rest } = profile;
    return {
      ...rest,
      // Null for an account whose password predates this being recorded; the
      // page says "Not recorded" rather than inventing a date.
      passwordChangedAt: user?.passwordChangedAt?.toISOString() ?? null,
    };
  }

  async updatePreferences(
    tenantId: bigint,
    profileId: bigint,
    dto: Record<string, unknown>,
  ) {
    const data: Record<string, string> = {};

    for (const [field, allowed] of Object.entries(AuthService.ALLOWED_PREFERENCES)) {
      const value = dto?.[field];
      if (value === undefined) continue;
      if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new BadRequestException(`${field} must be one of: ${allowed.join(', ')}`);
      }
      data[field] = value;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No preferences to update');
    }

    // updateMany so the tenant stays in the WHERE: update() takes a unique
    // where, which would leave this addressable by profile id alone.
    const updated = await this.prisma.profile.updateMany({
      where: { id: profileId, tenantId },
      data,
    });
    if (updated.count === 0) throw new NotFoundException('Profile not found');

    return this.getPreferences(tenantId, profileId);
  }

  /**
   * Changing a password from inside a session.
   *
   * The current password is required: a session left open on a shared machine
   * should not be enough to lock the real owner out of their account.
   */
  async changePassword(
    profileId: bigint,
    dto: { currentPassword: string; newPassword: string },
    currentSessionId?: string,
  ) {
    if (!dto?.currentPassword || !dto?.newPassword) {
      throw new BadRequestException('Both your current and new password are required');
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException('Choose a new password of at least 8 characters');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('That is the password you are already using');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { user: true },
    });

    if (!profile?.user) throw new NotFoundException('Account not found');

    const matches = await bcrypt.compare(dto.currentPassword, profile.user.password);
    if (!matches) throw new BadRequestException('Your current password is not correct');

    await this.prisma.user.update({
      where: { id: profile.user.id },
      data: {
        password: await bcrypt.hash(dto.newPassword, 10),
        passwordChangedAt: new Date(),
      },
    });

    // Someone changing their password usually means they suspect someone else
    // has it. Every other session is ended; the one making the request is
    // spared so the change does not sign them out of the page they are on.
    const ended = await this.sessions.revokeAllForUser(profile.user.id, currentSessionId);

    this.logger.log(`Password changed for user ${profile.user.id}`);
    return { success: true, otherSessionsEnded: ended };
  }

  async getPlatformAdminStatus(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.platformRole) throw new NotFoundException('Session profile not found');
    return this.platformAdminProfile(user);
  }

  async getSessionStatus(profileId: bigint) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: { consultTherapistProfile: true, tenant: true },
    });

    if (!profile) throw new NotFoundException('Session profile not found');

    return this.practiceProfile(profile);
  }

  /** The live sessions of the signed-in account, newest use first. */
  listSessions(userId: bigint, currentSessionId?: string) {
    return this.sessions.listForUser(userId, currentSessionId);
  }

  /**
   * Ends one named session. The user id is part of the match, so an id
   * belonging to somebody else simply does not exist as far as this call is
   * concerned.
   */
  async endSession(userId: bigint, sessionId: string, currentSessionId?: string) {
    const ended = await this.sessions.revokeSession(sessionId, userId);
    if (ended === 0) {
      throw new NotFoundException('That session has already ended');
    }
    return { success: true, endedCurrentSession: sessionId === currentSessionId };
  }

  /** "Sign out everywhere else" — every session but the one asking. */
  async endOtherSessions(userId: bigint, currentSessionId?: string) {
    const ended = await this.sessions.revokeAllForUser(userId, currentSessionId);
    return { success: true, sessionsEnded: ended };
  }

  /**
   * Ends the session behind an access token, best effort.
   *
   * Logout has to work with an expired access token — otherwise someone whose
   * token lapsed could never clear their cookies — so expiry is ignored here
   * while the signature is still required. A valid signature means the caller
   * held this session, and ending your own session is what they asked for.
   */
  async endSessionForAccessToken(accessToken: string | undefined) {
    if (!accessToken) return;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(accessToken, {
        ignoreExpiration: true,
      });
      if (payload.sid) await this.sessions.revokeSession(payload.sid);
    } catch {
      // An unreadable token means there is no session to end; the caller still
      // gets its cookies cleared.
    }
  }

  async refresh(refreshToken: string, device: DeviceInfo = {}) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type === 'platform_admin') {
      const user = await this.prisma.user.findUnique({ where: { id: BigInt(payload.sub) } });
      if (!user || !user.platformRole) {
        throw new UnauthorizedException('Session is no longer valid');
      }
      const { accessToken, refreshToken: nextRefreshToken } = await this.rotateSession(
        payload,
        user.id,
        refreshToken,
        (next) => this.generatePlatformAdminTokens(user, user.platformRole!, next),
        device,
      );
      return {
        accessToken,
        refreshToken: nextRefreshToken,
        profile: this.platformAdminProfile(user),
      };
    }

    if (!payload.profileId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: BigInt(payload.profileId) },
      include: { user: true, tenant: true, consultTherapistProfile: true },
    });

    if (!profile || !profile.user) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const { accessToken, refreshToken: nextRefreshToken } = await this.rotateSession(
      payload,
      profile.user.id,
      refreshToken,
      (next) => this.generateTokens(profile.user!.id, profile.id, profile.tenantId, profile.type, next),
      device,
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      profile: this.practiceProfile(profile),
    };
  }

  /**
   * Exchanges a presented refresh token for the next pair in the same session.
   *
   * `issue` is called with the session id so the new tokens carry it, and the
   * session row is only updated if the presented token is the one currently
   * outstanding — a token that was already exchanged means two parties hold
   * the session, and rotate() ends it rather than renewing it.
   */
  private async rotateSession(
    payload: JwtPayload,
    userId: bigint,
    presentedToken: string,
    issue: (sessionId: string) => { accessToken: string; refreshToken: string },
    device: DeviceInfo = {},
  ) {
    // Refresh tokens minted before sessions existed carry no sid. Rather than
    // signing everyone out on deploy, the first refresh of such a token opens
    // a real session for it. They all expire within the refresh TTL, after
    // which every token in circulation is session-backed.
    if (!payload.sid) {
      const sessionId = SessionService.newSessionId();
      const tokens = issue(sessionId);
      await this.sessions.startSession(sessionId, userId, tokens.refreshToken, device);
      return tokens;
    }

    const tokens = issue(payload.sid);
    const rotated = await this.sessions.rotate(
      payload.sid,
      presentedToken,
      tokens.refreshToken,
      device,
    );
    if (!rotated) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    return tokens;
  }

  /**
   * Signs a pair of tokens bound to `sessionId`, which is the id of the Token
   * row backing the session. The refresh token is only usable while that row
   * still holds its hash, which is what makes it revocable.
   */
  /**
   * The signed-in profile, as every endpoint that returns one should describe it.
   *
   * Login, refresh and /status each built their own shape and disagreed.
   * Refresh carried practiceName and tenantSlug; login carried neither;
   * /status carried tenantId but neither of those, and added isTherapist. So a
   * client reading tenantSlug after signing in got nothing until a token
   * refresh happened — and tenantSlug is what the booking link and the
   * practice branding are built from.
   */
  private practiceProfile(profile: {
    id: bigint;
    tenantId: bigint;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    type: string;
    status: string;
    avatarUrl: string | null;
    // Required, not optional: a caller that forgets the include would otherwise
    // hand back tenantSlug: null, which is worse than the inconsistency this
    // replaces — silently wrong instead of visibly absent.
    tenant: { name: string; slug: string } | null;
    consultTherapistProfile: unknown | null;
  }) {
    return {
      id: profile.id.toString(),
      tenantId: profile.tenantId.toString(),
      email: profile.email,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      type: profile.type,
      status: profile.status,
      avatarUrl: profile.avatarUrl,
      practiceName: profile.tenant?.name ?? null,
      tenantSlug: profile.tenant?.slug ?? null,
      isTherapist: !!profile.consultTherapistProfile,
    };
  }

  private generateTokens(
    userId: bigint,
    profileId: bigint,
    tenantId: bigint,
    type: string,
    sessionId: string,
  ) {
    const payload: JwtPayload = {
      sub: userId.toString(),
      profileId: profileId.toString(),
      tenantId: tenantId.toString(),
      type,
      sid: sessionId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = this.jwtService.sign(payload, {
      secret: REFRESH_SECRET,
      expiresIn: REFRESH_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  private generatePlatformAdminTokens(
    user: { id: bigint; email: string },
    platformRole: string,
    sessionId: string,
  ) {
    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      type: 'platform_admin',
      roles: [platformRole],
      sid: sessionId,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = this.jwtService.sign(payload, {
      secret: REFRESH_SECRET,
      expiresIn: REFRESH_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  private platformAdminProfile(user: {
    id: bigint;
    email: string;
    username: string | null;
    platformRole: string | null;
  }) {
    return {
      id: user.id.toString(),
      email: user.email,
      username: user.username,
      type: 'platform_admin',
      platformRole: user.platformRole,
      status: 'active',
    };
  }
}
