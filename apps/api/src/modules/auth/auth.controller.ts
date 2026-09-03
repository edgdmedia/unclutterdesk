import { Controller, Post, Get, Body, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
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

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000, blockDuration: 300000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Req() req: TenantRequest,
    @Body() dto: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.tenantId, dto);
    const csrfToken = this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile, csrfToken };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the access token using the refresh cookie' })
  async refresh(@Req() req: TenantRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('No refresh token provided');
    const result = await this.authService.refresh(refreshToken);
    const csrfToken = this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { profile: result.profile, csrfToken };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear the session cookies' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(0), path: '/v1/auth/refresh' });
    res.clearCookie(CSRF_COOKIE, { ...csrfCookieOptions(), maxAge: 0 });
    return { success: true };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
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
}
