import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantRequest } from '../../common/middleware/tenant.middleware';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
  cookieOptions,
  csrfCookieOptions,
} from '../../common/auth.config';
import { RolesGuard } from '../../common/roles.guard';
import { authenticatedProfileId, authenticatedTenantId } from '../../common/authenticated-tenant';
import { AnyAuthenticated } from '../../common/roles';
import { DeviceInfo } from './session.service';

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new account (Client or Therapist)' })
  async register(
    @Req() req: TenantRequest,
    @Body() dto: any,
  ) {
    const result = await this.authService.register(req.tenantId, dto);
    return result;
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify an email address using a 6-digit code' })
  async verifyEmail(@Body() dto: { email: string; code: string }) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Re-send the email verification code' })
  async resendVerification(@Body() dto: { email: string }) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a password reset link to the account email' })
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  async resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.authService.resetPassword(dto);
  }

  @Post('invite/claim')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept a staff invitation and sign in' })
  async claimInvite(
    @Req() req: TenantRequest,
    @Body() dto: { token: string; password: string; firstName?: string; lastName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.claimInvite(dto, deviceOf(req));
    const csrfToken = this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile, csrfToken };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Req() req: TenantRequest,
    @Body() dto: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.tenantId, dto, deviceOf(req));
    const csrfToken = this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile, csrfToken };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the access token using the refresh cookie' })
  async refresh(@Req() req: TenantRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');
    const result = await this.authService.refresh(refreshToken, deviceOf(req));
    const csrfToken = this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile, csrfToken };
  }

  @Post('logout')
  @ApiOperation({ summary: 'End the session and clear its cookies' })
  async logout(@Req() req: TenantRequest, @Res({ passthrough: true }) res: Response) {
    // The refresh cookie is scoped to /v1/auth/refresh so it never reaches
    // this route; the access cookie names the session instead.
    await this.authService.endSessionForAccessToken(req.cookies?.[ACCESS_COOKIE]);
    this.clearSessionCookies(res);
    return { success: true };
  }

  @AnyAuthenticated()
  @Get('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Display preferences for the signed-in account' })
  getPreferences(@Req() req: any) {
    return this.authService.getPreferences(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
    );
  }

  @AnyAuthenticated()
  @Put('preferences')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update display preferences for the signed-in account' })
  updatePreferences(@Req() req: any, @Body() dto: Record<string, unknown>) {
    return this.authService.updatePreferences(
      authenticatedTenantId(req),
      authenticatedProfileId(req),
      dto,
    );
  }

  @AnyAuthenticated()
  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the password of the signed-in account' })
  changePassword(
    @Req() req: any,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      authenticatedProfileId(req),
      dto,
      req.user?.sessionId,
    );
  }

  @AnyAuthenticated()
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current session profile status' })
  async getStatus(@Req() req: any) {
    const csrfToken = req.cookies?.[CSRF_COOKIE];
    if (req.user.type === 'platform_admin') {
      const result = await this.authService.getPlatformAdminStatus(BigInt(req.user.userId));
      return { ...result, csrfToken };
    }
    const result = await this.authService.getSessionStatus(BigInt(req.user.profileId || req.user.userId));
    return { ...result, csrfToken };
  }

  @AnyAuthenticated()
  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the devices currently signed in to this account' })
  listSessions(@Req() req: any) {
    return this.authService.listSessions(BigInt(req.user.userId), req.user.sessionId);
  }

  @AnyAuthenticated()
  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out every other device' })
  revokeOtherSessions(@Req() req: any) {
    return this.authService.endOtherSessions(BigInt(req.user.userId), req.user.sessionId);
  }

  @AnyAuthenticated()
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out one device' })
  async revokeSession(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.endSession(
      BigInt(req.user.userId),
      id,
      req.user.sessionId,
    );
    // Ending the session you are sitting in is allowed — it is how someone
    // signs out from the list — but the cookies have to go with it, or the
    // browser keeps presenting a session that no longer exists.
    if (result.endedCurrentSession) this.clearSessionCookies(res);
    return result;
  }

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_COOKIE_MAX_AGE));
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...cookieOptions(REFRESH_COOKIE_MAX_AGE),
      path: '/v1/auth/refresh',
    });
    const csrfToken = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return csrfToken;
  }

  private clearSessionCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(0), path: '/v1/auth/refresh' });
    res.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(), maxAge: 0 });
  }
}

/**
 * What to record about the device opening a session.
 *
 * Both values are shown back to the account owner so they can recognise their
 * own devices; neither is trusted for anything else. `req.ip` is meaningful
 * because main.ts sets `trust proxy`.
 */
function deviceOf(req: TenantRequest): DeviceInfo {
  return {
    userAgent: req.headers?.['user-agent'] ?? null,
    ipAddress: req.ip ?? null,
  };
}
